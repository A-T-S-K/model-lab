import { check, MAX_RECORD_BYTES, validateRequest, type ExecutionRequest, EvidenceStore, type EvidenceRun } from '../../trace/evidence.js';
import profile from '../../research/pythia/profile-generation.json';

/** One outstanding read-only native request; model switches invalidate admission, not just display. */
export class NativeClient {
  readonly sessionId=crypto.randomUUID();
  #epoch=0; #sequence=0; #abort?:AbortController;
  connected=false;
  cancel(){this.#epoch++;this.#abort?.abort();this.#abort=undefined;this.connected=false;}
  async execute(input:string,action:string,endpoint:string,store:EvidenceStore):Promise<EvidenceRun>{
    const intent=action==='generate'
      ?{version:3 as const,integration:'pythia-native-v1',profile:profile.profile,action,input,generation:{recipe:profile.generation.recipe,maxNewTokens:2}}
      :{version:1 as const,integration:'pythia-native-v1',profile:profile.profile,action:'predict',input};
    return this.executeRequest(intent,endpoint,store);
  }
  async executeRequest(intent:Pick<ExecutionRequest,'version'|'integration'|'profile'|'action'|'input'|'state'|'generation'>,endpoint:string,store:EvidenceStore):Promise<EvidenceRun>{
    check(!this.#abort,'Native execution already pending');
    const url=new URL(endpoint);
    check(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&!!url.port&&url.pathname==='/execute'&&!url.search&&!url.hash&&!url.username&&!url.password,'Only explicit loopback /execute endpoint allowed');
    const request:ExecutionRequest=validateRequest({...intent,sessionId:this.sessionId,
      requestId:`native-${++this.#sequence}`,epoch:this.#epoch});
    const epoch=this.#epoch,abort=new AbortController();this.#abort=abort;
    const timeout=setTimeout(()=>abort.abort(),30_000);
    try{
      const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:abort.signal,credentials:'omit',redirect:'error'});
      check(response.ok,`Native request refused (${response.status})`);check(response.body,'Missing native response');
      const reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
      while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX_RECORD_BYTES){await reader.cancel();throw new Error('Native response byte budget');}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      check(epoch===this.#epoch&&!abort.signal.aborted,'Stale native response');
      // Decode and validate in a temporary store before the final synchronous publication guard.
      const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
      const pending=new EvidenceStore(store.registry);
      await pending.admit(value,request);
      check(epoch===this.#epoch&&!abort.signal.aborted,'Stale native response');
      // Store has an admission guard as validation can yield.
      const admitted=await store.admit(value,request,()=>epoch===this.#epoch&&!abort.signal.aborted);
      this.connected=true;return admitted;
    }finally{clearTimeout(timeout);if(this.#abort===abort)this.#abort=undefined;}
  }
}
