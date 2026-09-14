import { validateRequest, check, type ExecutionRequest } from '../../trace/evidence.js';
import type { WorkerRequest } from './protocol.js';
const actions=new Set(['predict','train','startForward','startTraining']);
export function canonicalIntent(request:WorkerRequest):ExecutionRequest|undefined {
  if(!actions.has(request.command))return;
  check('document' in request,'Execution input missing');
  return validateRequest({version:1,integration:'microgpt-legacy-v1',profile:'canonical-browser-v1',requestId:request.runId,
    sessionId:request.sessionId,epoch:request.generationId,action:request.command,input:request.document});
}
export function validateCanonicalIntent(request:WorkerRequest):void {
  if(!request.intent)return; // Existing version-1 worker callers retain their strict local protocol.
  check(JSON.stringify(validateRequest(request.intent))===JSON.stringify(canonicalIntent(request)),'Worker execution intent mismatch');
}
