import { check, type EvidenceRun, type EvidenceStore } from '../../trace/evidence.js';
import { NativeClient } from './native-client.js';
export type CanonicalReceipt = { status: 'completed'; runId: string } | { status: 'refused' | 'failed'; reason: string };
export interface ExecutorContext { input:string; endpoint:string; store:EvidenceStore; canonical:()=>Promise<CanonicalReceipt> }
export interface ExecutorBinding {
  id:string; label:string; inputLocation:'world'|'request';
  execute(context:ExecutorContext):Promise<EvidenceRun>; connected():boolean;
}
/** Build-time trusted bindings. Imported evidence cannot add or replace executors. */
export class ExecutorRegistry {
  #bindings=new Map<string,ExecutorBinding>();readonly native=new NativeClient();
  constructor(){
    this.register({id:'microgpt-legacy-v1',label:'MicroGPT · browser',inputLocation:'world',connected:()=>true,
      async execute({store,canonical}){
        const receipt=await canonical();
        if(receipt.status!=='completed')throw new Error(receipt.reason);
        const run=store.get(receipt.runId);
        check(run.integration==='microgpt-legacy-v1','Canonical receipt names another producer');return run;
      }});
    this.register({id:'pythia-native-v1',label:'Pythia-14M · optional native CPU',inputLocation:'request',connected:()=>this.native.connected,
      execute:({input,endpoint,store})=>this.native.execute(input,endpoint,store)});
  }
  private register(binding:ExecutorBinding){check(!this.#bindings.has(binding.id),'Duplicate executor binding');this.#bindings.set(binding.id,binding);}
  list(){return [...this.#bindings.values()];}
  get(id:string){const binding=this.#bindings.get(id);check(binding,'No registered executor for selected integration');return binding;}
  cancel(){this.native.cancel();}
}
