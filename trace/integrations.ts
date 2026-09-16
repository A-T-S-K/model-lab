import { registerWitnessCodecs } from './witness-codecs.js';
import { noncanonicalCodec } from './noncanonical.js';
import { canonicalIdentity, compareRuns } from './compare.js';
import { IntegrationRegistry, check, fields, object, validateRun, evidenceHash, type EvidenceRun, type EvidencePoint } from './evidence.js';
import { validateLegacyRun } from '../archive/legacy-run.js';
import type { ArchivedSnapshot } from '../archive/snapshot.js';
import type { RecordedRun } from './types.js';
import { sourceMapping } from '../app/source/mappings.js';
import m2Profile from '../research/pythia/profile.json';
import generationProfile from '../research/pythia/profile-generation.json';
import legacyProfile from '../research/pythia/profile-legacy.json';

const same=(a:unknown,b:unknown,reason:string)=>check(canonicalIdentity(a)===canonicalIdentity(b),reason);
const pythiaBaseIds=['tokens','embedding','residual.input','norm.attention','norm.mlp','attention.output','mlp.output','residual.output','attention.qkv','attention.weights','logits'] as const;
function pythiaInput(run:EvidenceRun){check('tokenIds' in run.input,'Native token input required');return run.input as Extract<EvidenceRun['input'],{tokenIds:number[]}>;}

function validatePythiaPoint(point:EvidencePoint,baseId:string,prefix:string,invocation:string,phase:string,n:number,tokenDependencies:string[]=[]){
  const architecture=m2Profile.architecture,schema=m2Profile.captureSchema.find(value=>value.id===baseId);check(schema,'Unknown native operation');
  const id=prefix?`${prefix}/${baseId}`:baseId;
  check(point.id===id&&point.invocation===invocation&&point.phase===phase,'Native invocation/point identity mismatch');
  const expectedMetadata={...schema,id,invocation,phase,dependencies:baseId==='tokens'?tokenDependencies:schema.dependencies.map(dependency=>prefix?`${prefix}/${dependency}`:dependency)};
  const actualMetadata={id:point.id,node:point.node,port:point.port,invocation:point.invocation,phase:point.phase,source:point.source,owners:point.owners,dependencies:point.dependencies,capabilities:point.capabilities,axes:point.axes.map(axis=>({role:axis.role,space:axis.space}))};
  same(actualMetadata,expectedMetadata,'Native semantic/source/axis mapping mismatch');
  const shape=baseId==='tokens'?[n]:baseId==='logits'?[architecture.outputSize]:baseId==='attention.weights'?[architecture.attentionHeads,n,n]:baseId==='attention.qkv'?[n,architecture.attentionHeads,3,architecture.headWidth]:[n,architecture.hiddenWidth];
  same(point.shape,shape,'Native capture shape');check(point.dtype===(baseId==='tokens'?'int32':'float32'),'Native capture dtype');
  check(point.origin==='observed'&&point.availability==='available','Native observation declaration');
  check(point.source.revision===(baseId==='tokens'?m2Profile.tokenizerSourceRevision:m2Profile.sourceRevision),'Native source identity');
}

function validatePythiaBinding(run:EvidenceRun,profile:{profile:string;runtime:string;definition:string;checkpoint:string;inputTransform:string}){
  check(run.integration==='pythia-native-v1'&&run.profile===profile.profile&&run.runtime===profile.runtime,'Unqualified native binding/profile');
  check(run.definition===profile.definition&&run.checkpoint===profile.checkpoint&&run.inputTransform===profile.inputTransform,'Native identity mismatch');
  const architecture=m2Profile.architecture;
  check(architecture.configRevision===`sha256:${run.definition.split(':')[1]}`&&architecture.sourceRevision===m2Profile.sourceRevision,'Native architecture source binding mismatch');
  check(architecture.layerCount===6&&architecture.capturedLayer===1&&architecture.hiddenWidth===128&&architecture.attentionHeads===4&&architecture.headWidth===32&&architecture.mlpWidth===512,'Native architecture dimensions');
  check(architecture.normalization.kind==='LayerNorm'&&architecture.normalization.epsilon===1e-5&&architecture.activation==='gelu'&&architecture.parallelResidual===true,'Native block semantics');
  check(architecture.position.kind==='rotary'&&architecture.outputSize===50304&&architecture.tokenizerSize===m2Profile.tokenizerSize,'Native position/output semantics');
  check(run.precision.storage==='F16'&&run.precision.compute==='float32','Unsupported native precision');
  check(run.id===`${run.request.sessionId}:${run.request.requestId}`,'Native receipt ID mismatch');
  const input=pythiaInput(run);
  check(input.tokenIds.length>=1&&input.tokenIds.length<=16&&input.tokenIds.every(n=>n<m2Profile.tokenizerSize)&&input.text===run.request.input&&/^[\x00-\x7f]{1,128}$/.test(input.text),'Native input mismatch');
}

function validatePrediction(record:unknown):EvidenceRun{
  const run=validateRun(record);
  const profile=[generationProfile,m2Profile,legacyProfile].find(value=>value.runtime===run.runtime);check(profile,'Unqualified native runtime');
  check(run.version===1&&run.request.version===1&&run.request.action==='predict','Native prediction version/action');
  validatePythiaBinding(run,profile);
  const input=pythiaInput(run);
  check(run.points.length===pythiaBaseIds.length,'Native prediction capture coverage');
  for(const id of pythiaBaseIds){const point=run.points.find(value=>value.id===id);check(point,'Missing native prediction point');validatePythiaPoint(point,id,'','prefill:0','inference',input.tokenIds.length);}
  same(run.points.find(point=>point.id==='tokens')!.values,input.tokenIds,'Native token evidence mismatch');
  return run;
}

function validateDistribution(value:unknown,logits:readonly number[],chosen:number){
  const distribution=fields(value,['support','top','omittedMass','selectedLogit','selectedProbability']);
  check(distribution.support===50304&&distribution.selectedLogit===logits[chosen],'Generation distribution support/selected logit');
  const maximum=logits.reduce((result,value)=>Math.max(result,value),-Infinity),exponentials=logits.map(value=>Math.exp(value-maximum)),denominator=exponentials.reduce((sum,value)=>sum+value,0);
  const expected=[...logits.keys()].sort((a,b)=>logits[b]!-logits[a]!||a-b).slice(0,5);
  check(Array.isArray(distribution.top)&&distribution.top.length===5,'Generation top-k summary');let shown=0;
  distribution.top.forEach((value,index)=>{const row=fields(value,['index','logit','probability']),output=expected[index]!;check(row.index===output&&row.logit===logits[output],'Generation top-k identity');const probability=exponentials[output]!/denominator;check(typeof row.probability==='number'&&Math.abs(row.probability-probability)<=1e-12,'Generation top-k probability');shown+=Number(row.probability);});
  const selected=exponentials[chosen]!/denominator;check(typeof distribution.selectedProbability==='number'&&Math.abs(distribution.selectedProbability-selected)<=1e-12,'Generation selected probability');
  check(typeof distribution.omittedMass==='number'&&Math.abs(distribution.omittedMass-(1-shown))<=1e-12,'Generation omitted probability mass');
}

function validateGeneration(record:unknown):EvidenceRun{
  const envelope=fields(record,['kind','run','generation']);check(envelope.kind==='generation-v1','Generation record kind');
  const run=validateRun(envelope.run);check(run.version===2&&run.request.version===3&&run.request.action==='generate','Generation run/request version');
  validatePythiaBinding(run,generationProfile);const input=pythiaInput(run);
  const configuration=fields(run.request.generation,['recipe','maxNewTokens']);check(configuration.recipe===generationProfile.generation.recipe,'Generation recipe request');
  check(Number.isSafeInteger(configuration.maxNewTokens)&&Number(configuration.maxNewTokens)>=1&&Number(configuration.maxNewTokens)<=generationProfile.generation.maxNewTokens,'Generation requested-token bound');
  const requested=Number(configuration.maxNewTokens);check(input.tokenIds.length<=generationProfile.generation.maxPromptTokens&&input.tokenIds.length+requested<=generationProfile.generation.maxTotalTokens,'Generation prefix/context bound');
  const generation=fields(envelope.generation,['version','recipe','selectionPolicy','cache','cancellationEpoch','promptInvocation','invocations','generated','termination']);check(generation.version===1,'Generation receipt version');
  const recipe=fields(generation.recipe,['identity','requested','effective']);check(recipe.identity===generationProfile.generation.recipe,'Generation recipe identity');
  same(recipe.requested,{maxNewTokens:requested},'Generation requested configuration');same(recipe.effective,{maxNewTokens:requested,promptTokenLimit:4,totalTokenLimit:16,honorEos:false},'Generation effective configuration');
  same(generation.selectionPolicy,{identity:generationProfile.generation.selectionPolicy,version:1,kind:'greedy-argmax',support:50304,stochastic:false},'Generation selection policy');
  same(generation.cache,{capability:'unsupported',qualified:false,strategy:'full-prefix-reexecution',useCache:false,retainedState:false},'Generation uncached policy');
  check(generation.cancellationEpoch===run.request.epoch&&generation.promptInvocation==='prefill:0','Generation cancellation/prompt identity');
  check(Array.isArray(generation.invocations)&&generation.invocations.length===requested+1,'Generation invocation count');
  const generated=fields(generation.generated,['tokenIds','tokenizerLabels','finalPrefixIds']);check(Array.isArray(generated.tokenIds)&&generated.tokenIds.length===requested,'Generated token IDs');check(Array.isArray(generated.tokenizerLabels)&&generated.tokenizerLabels.length===requested,'Generated token labels');const tokenizerLabels=generated.tokenizerLabels as unknown[];
  const allPointIds=new Set<string>(),choices:number[]=[];
  generation.invocations.forEach((value,index)=>{
    const prompt=index===0,invocation=fields(value,prompt?['identity','kind','generatedStep','effectivePrefixIds','finalModelPosition','pointIds','dependsOnChoice']:['identity','kind','generatedStep','effectivePrefixIds','finalModelPosition','pointIds','dependsOnChoice','choice']);
    const identity=prompt?'prefill:0':`generation:${index}`,phase=prompt?'prompt-prefill':`generation-step-${index}`;
    check(invocation.identity===identity&&invocation.kind===(prompt?'prompt':'generated')&&invocation.generatedStep===index,'Generation invocation/step identity');
    check(invocation.identity!==`epoch:${run.request.epoch}`,'Cancellation epoch used as invocation identity');
    const expectedPrefix=[...input.tokenIds,...choices];same(invocation.effectivePrefixIds,expectedPrefix,'Generation effective prefix lineage');check(invocation.finalModelPosition===expectedPrefix.length-1,'Generation model position');
    const tokenDependencies=prompt?[]:index===1?['prefill:0/tokens']:['prefill:0/tokens',`generation:${index-1}/choice`];
    check(invocation.dependsOnChoice===(index<=1?null:`generation:${index-1}/choice`),'Generation previous-choice dependency');
    const basePointIds=pythiaBaseIds.map(id=>`${identity}/${id}`),expectedPointIds=prompt?basePointIds:[...basePointIds,`${identity}/choice`];same(invocation.pointIds,expectedPointIds,'Generation invocation point coverage');
    for(const id of pythiaBaseIds){const pointId=`${identity}/${id}`,point=run.points.find(candidate=>candidate.id===pointId);check(point&&!allPointIds.has(pointId),'Missing/repeated generation point');allPointIds.add(pointId);validatePythiaPoint(point,id,identity,identity,phase,expectedPrefix.length,tokenDependencies);if(id==='tokens')same(point.values,expectedPrefix,'Generation native prefix evidence');}
    if(prompt)return;
    const choice=fields(invocation.choice,['selectionPolicy','sourceLogitsOccurrence','chosenOutputIndex','tokenizerLabelAvailable','tokenizerLabel','generatedPosition','stopReason','distribution']);
    check(choice.selectionPolicy===generationProfile.generation.selectionPolicy&&choice.sourceLogitsOccurrence===`${identity}/logits`,'Generation logits/selection separation');
    const logits=run.points.find(point=>point.id===choice.sourceLogitsOccurrence)!.values!;let chosen=0;for(let i=1;i<logits.length;i++)if(logits[i]!>logits[chosen]!)chosen=i;
    check(choice.chosenOutputIndex===chosen&&chosen>=0&&chosen<50304,'Generation chosen index is not full-support argmax');
    check(choice.generatedPosition===expectedPrefix.length,'Generation output position');check(choice.stopReason===(index===requested?'max_new_tokens':null),'Generation stop reason');
    const label=tokenizerLabels[index-1];check(choice.tokenizerLabel===label&&choice.tokenizerLabelAvailable===(label!==null),'Generation tokenizer label declaration');
    if(chosen>=m2Profile.tokenizerSize)check(label===null,'Fabricated tokenizer label for unmapped output');else check(typeof label==='string'&&label.length>0&&label.length<=256,'Mapped tokenizer label');
    validateDistribution(choice.distribution,logits,chosen);
    const choicePointId=`${identity}/choice`,choicePoint=run.points.find(point=>point.id===choicePointId);check(choicePoint&&!allPointIds.has(choicePointId),'Missing/repeated choice evidence');allPointIds.add(choicePointId);
    check(choicePoint.invocation===identity&&choicePoint.phase===`selection-step-${index}`&&choicePoint.node==='generation-policy.argmax'&&choicePoint.port==='decision','Generation choice semantic identity');
    check(choicePoint.origin==='derived'&&choicePoint.availability==='available'&&choicePoint.dtype==='int32'&&choicePoint.shape.length===0&&choicePoint.values?.[0]===chosen,'Generation choice evidence');
    same(choicePoint.dependencies,[`${identity}/logits`],'Generation choice dependency');check(choicePoint.source.revision===generationProfile.adapterSourceRevision,'Generation policy source identity');
    choices.push(chosen);
  });
  check(allPointIds.size===run.points.length,'Unknown or cross-invocation generation point');same(generated.tokenIds,choices,'Generated sequence/choices');same(generated.finalPrefixIds,[...input.tokenIds,...choices],'Generated final prefix');
  same(generation.termination,{reason:'max_new_tokens',generatedTokens:requested},'Generation termination');
  return run;
}

/** Compatibility metadata is derived; original run, snapshot and their IDs are retained. */
export async function readLegacyEvidence(record: unknown): Promise<EvidenceRun> {
  const data=fields(record,['run','snapshot']);
  const run=await validateLegacyRun(data.run as RecordedRun,data.snapshot as ArchivedSnapshot);
  const m=run.manifest; const ids=m.input as number[];
  check(Array.isArray(ids)&&ids.every(Number.isSafeInteger),'Legacy input IDs');
  const vocabulary=(data.snapshot as ArchivedSnapshot).state.config.vocabulary;
  const points:EvidencePoint[]=run.artifacts.map(a=>{
    const c=a.concept; const mapping=sourceMapping(c.kind);
    return {id:a.id,node:`${c.layer===undefined?'model':`layer.${c.layer}`}.${c.kind}${c.head===undefined?'':`.head.${c.head}`}`,
      port:'output',invocation:`legacy-occurrence:${a.id}`,phase:'legacy-recorded',shape:[...a.shape],
      axes:a.axes.map((role,i)=>({role,space:`${m.model.id}:${m.model.version}:${c.kind}:${role}`,size:a.shape[i]})),
      dtype:a.dtype,encoding:'json-numbers-row-major',values:a.values?[...a.values]:null,origin:a.provenance,availability:a.availability,
      source:{file:mapping.status==='mapped'?mapping.file:'unknown',symbol:mapping.status==='mapped'?mapping.symbol:'unknown',revision:m.runtimeRevision},
      owners:[],dependencies:[],semantics:`${mapping.status==='mapped'?mapping.equation:'Unsupported source mapping'}. Legacy concept ${JSON.stringify(c)}. Original recording has no explicit invocation, parameter-owner or dependency metadata; occurrence ID is an adapter address.`,capabilities:['slice','source']};
  });
  return validateRun({version:1,id:m.runId,integration:'microgpt-legacy-v1',definition:`${m.model.id}:${await evidenceHash(m.model)}`,checkpoint:m.startingCheckpointId,
    inputTransform:`legacy-character-vocabulary:${await evidenceHash({vocabulary,bosTokenId:(data.snapshot as ArchivedSnapshot).state.config.bosTokenId})}`,profile:m.numeric.policy,runtime:m.runtimeRevision,
    request:{version:1,integration:'microgpt-legacy-v1',profile:m.numeric.policy,requestId:m.runId,sessionId:m.sessionId,epoch:m.generationId,action:'legacy-recorded',input:ids.slice(1).map(id=>vocabulary[id]??'').join('')},
    execution:'native',precision:{storage:'float64',compute:'float64',policy:m.numeric.policy},
    input:{text:ids.slice(1).map(id=>vocabulary[id]??'').join(''),tokenIds:ids,labels:ids.map(id=>vocabulary[id]??'BOS'),offsets:[]},points,
    limits:['Format-1 bytes and identities preserved in the envelope. Request text and semantic metadata are a compatibility view; unknown legacy metadata stays unknown.','Scalar/backward/learning actions use the existing canonical worker and candidate lifecycle. Saved evidence never invokes them.']});
}
export function integrations():IntegrationRegistry {
  return registerWitnessCodecs(new IntegrationRegistry().register(noncanonicalCodec)).register({id:'microgpt-legacy-v1',decode:readLegacyEvidence,compare(before,after){return compareRuns((before as {run:RecordedRun}).run,(after as {run:RecordedRun}).run);}}).register({id:'pythia-native-v1',async decode(record){
    return object(record).kind==='generation-v1'?validateGeneration(record):validatePrediction(record);
  },retainMetadata(record){
    const value=object(record);return value.kind==='generation-v1'?{kind:'generation-v1',generation:value.generation}:{kind:'prediction-v1'};
  }});
}
