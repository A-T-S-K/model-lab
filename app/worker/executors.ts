import { check, validateNumericInput, type EvidenceRun, type EvidenceStore } from '../../trace/evidence.js';
import { NONCANONICAL } from '../../trace/noncanonical.js';
import { NativeClient } from './native-client.js';
export type CanonicalReceipt = { status: 'completed'; runId: string } | { status: 'refused' | 'failed'; reason: string };
export interface ExecutorContext { input:string; action?:string; endpoint:string; store:EvidenceStore; canonical:()=>Promise<CanonicalReceipt> }
export interface ExecutorBinding {
  id:string; label:string; inputLocation:'world'|'request'|'saved'; inputLabel?:string; defaultInput?:string; endpoint?:boolean; actions?:string[];
  execute(context:ExecutorContext):Promise<EvidenceRun>; connected():boolean;
}
/** Build-time trusted bindings. Imported evidence cannot add or replace executors. */
export class ExecutorRegistry {
  #localWorker?:Worker;#localReject?: (error:Error)=>void;#epoch=0;
  #bindings=new Map<string,ExecutorBinding>();readonly native=new NativeClient();
  constructor(){
    this.register({id:'microgpt-legacy-v1',label:'MicroGPT · browser',inputLocation:'world',connected:()=>true,
      async execute({store,canonical}){
        const receipt=await canonical();
        if(receipt.status!=='completed')throw new Error(receipt.reason);
        const run=store.get(receipt.runId);
        check(run.integration==='microgpt-legacy-v1','Canonical receipt names another producer');return run;
      }});
    this.register({id:'pythia-native-v1',label:'Pythia-14M · optional native CPU',inputLocation:'request',inputLabel:'Prompt',defaultInput:'The cat sat',endpoint:true,actions:['predict'],connected:()=>this.native.connected,
      execute:({input,endpoint,store})=>this.native.execute(input,endpoint,store)});
    this.register({id:'mlp-native-v1',label:'Numeric MLP · float32 / MSE / SGD',inputLocation:'request',inputLabel:'Numeric batch and targets (JSON)',defaultInput:JSON.stringify({kind:'numeric',values:[[1,2],[-1,0.5]],targets:[[0.5],[-0.25]]}),endpoint:true,actions:['predict','train'],connected:()=>this.native.connected,
      execute:({input,action,endpoint,store})=>this.native.executeRequest({version:2,integration:'mlp-native-v1',profile:'mlp-f32-sgd-v1',action:action??'predict',input:validateNumericInput(JSON.parse(input)),state:null},endpoint,store)});
    this.register({id:NONCANONICAL,label:'MicroGPT · 2 layers / 3 heads / width 6',inputLocation:'request',inputLabel:'Characters: w x y z ! (maximum five)',defaultInput:'wxyz!',actions:['predict'],connected:()=>true,
      execute:async({input,store})=>{
        const epoch=this.#epoch,request={version:1 as const,integration:NONCANONICAL,profile:'microgpt-multilayer-f64-v1',sessionId:crypto.randomUUID(),requestId:'predict',epoch,action:'predict',input};
        const worker=new Worker(new URL('./noncanonical-worker.ts',import.meta.url),{type:'module'});this.#localWorker=worker;
        try {const envelope=await new Promise<unknown>((resolve,reject)=>{this.#localReject=reject;worker.onmessage=e=>e.data.error?reject(Error(e.data.error)):resolve(e.data.envelope);worker.onerror=e=>reject(Error(e.message));worker.postMessage(request);});
          return await store.admit(envelope,request,()=>epoch===this.#epoch);
        }finally{worker.terminate();if(this.#localWorker===worker){this.#localWorker=undefined;this.#localReject=undefined;}}
      }});
  }
  private register(binding:ExecutorBinding){check(!this.#bindings.has(binding.id),'Duplicate executor binding');this.#bindings.set(binding.id,binding);}
  list(){return [...this.#bindings.values()];}
  get(id:string):ExecutorBinding{return this.#bindings.get(id)??{id,label:id,inputLocation:'saved',connected:()=>false,execute:async()=>{throw Error('No registered executor for saved integration');}};}
  cancel(){this.#epoch++;this.native.cancel();this.#localWorker?.terminate();this.#localReject?.(Error('Local request cancelled'));this.#localWorker=undefined;this.#localReject=undefined;}
}
