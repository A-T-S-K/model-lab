import { check, fields, validateRun, validateNumericInput, evidenceHash, type IntegrationRegistry } from './evidence.js';
import { canonicalIdentity } from './compare.js';
import profile from '../research/witnesses/profile.json';
const same=(a:unknown,b:unknown,why:string)=>check(canonicalIdentity(a)===canonicalIdentity(b),why);
export function mlpState(value:unknown){
  const s=fields(value,['version','parameters','optimizer']);check(s.version===1,'MLP state version');
  const parameters=fields(s.parameters,Object.keys(profile.initial.parameters));
  for(const [name,sample] of Object.entries(profile.initial.parameters)){
    const value=parameters[name];check(Array.isArray(value)&&value.length===sample.length,'MLP parameter shape');
    if(Array.isArray(sample[0]))check(value.every(row=>Array.isArray(row)&&row.length===(sample[0] as number[]).length),'MLP parameter matrix');
    else check(value.every(n=>typeof n==='number'),'MLP parameter vector');
    check(value.flat().every(n=>typeof n==='number'&&Number.isFinite(n)&&Object.is(Math.fround(n),n)),'MLP float32 state');
  }
  const o=fields(s.optimizer,Object.keys(profile.initial.optimizer));
  for(const k of ['family','learningRate','momentum','schedule','rngState'] as const)same(o[k],profile.initial.optimizer[k],'Unsupported SGD state');
  for(const k of ['step','datasetCursor'])check(Number.isSafeInteger(o[k])&&Number(o[k])>=0&&Number(o[k])<=100000,'SGD cursor');
  return s as unknown as typeof profile.initial;
}
export function registerWitnessCodecs(registry:IntegrationRegistry):IntegrationRegistry{
  registry.register({id:'mlp-native-v1',async decode(record){
    const envelope=fields(record,['run','starting','resulting']);const run=validateRun(envelope.run);
    check(run.version===2&&run.integration==='mlp-native-v1'&&run.profile==='mlp-f32-sgd-v1'&&run.runtime===profile.runtime&&run.definition==='numeric-mlp-2-3-1-v1'&&run.inputTransform==='numeric-f32-identity-v1'&&run.checkpoint==='state:starting','MLP binding identity');
    check(run.execution==='native'&&run.precision.compute==='float32'&&run.precision.storage==='float32','MLP precision');
    check(run.request.version===2&&['predict','train'].includes(run.request.action)&&run.id===`${run.request.sessionId}:${run.request.requestId}`,'MLP request receipt');
    const input=validateNumericInput(run.input);same(input,run.request.input,'MLP input binding');
    check(input.values.every(r=>r.length===2)&&input.targets.every(r=>r.length===1),'MLP input width');
    const starting=mlpState(envelope.starting),resulting=mlpState(envelope.resulting);
    same(starting,run.request.state??profile.initial,'MLP starting state request');
    const training=run.request.action==='train';
    same(resulting.optimizer,{...starting.optimizer,step:starting.optimizer.step+Number(training),datasetCursor:starting.optimizer.datasetCursor+(training?input.values.length:0)},'MLP SGD state transition');
    const expected=profile.schema.filter(p=>training||!p.id.endsWith('.gradient'));
    check(run.points.length===expected.length,'MLP capture coverage');
    for(const p of run.points){
      const schema=expected.find(s=>s.id===p.id);check(schema,'Unknown MLP operation');
      const {values,shape,axes,...meta}=p;
      const expectedMeta=structuredClone(schema);
      if(!training&&p.id.endsWith('.after')&&p.owners.length)expectedMeta.dependencies=[p.owners[0]+'.before'];
      same({...meta,axes:axes.map(({role,space})=>({role,space}))},expectedMeta,'MLP semantic binding');
      const name=p.id.split('.')[0] as keyof typeof starting.parameters;
      const param=starting.parameters[name];
      const expectedShape=param?(Array.isArray(param[0])?[param.length,(param[0] as number[]).length]:[param.length]):p.id==='loss'?[]:[input.values.length,['inputs','input.gradient'].includes(p.id)?2:['hidden','hidden.pre'].includes(p.id)?3:1];
      same(shape,expectedShape,'MLP shape');
      if(p.id==='inputs')same(values,input.values.flat(),'MLP observed input');
      if(p.id==='targets')same(values,input.targets.flat(),'MLP observed targets');
      if(param&&p.id.endsWith('.before'))same(values,param.flat(),'MLP starting parameter');
      if(param&&p.id.endsWith('.after'))same(values,resulting.parameters[name].flat(),'MLP resulting parameter');
      if(param&&p.id.endsWith('.delta'))same(values,resulting.parameters[name].flat().map((n,i)=>Math.fround(n-param.flat()[i])),'MLP applied delta');
    }
    if(training)for(const name of Object.keys(starting.parameters) as (keyof typeof starting.parameters)[]){
      const gradient=run.points.find(p=>p.id===name+'.gradient')!.values!;
      same(resulting.parameters[name].flat(),starting.parameters[name].flat().map((n,i)=>Math.fround(n-0.0625*gradient[i])),'SGD update does not match recorded gradient');
    }
    if(!training)same(resulting,starting,'Prediction must not update state');
    // The original envelope is retained byte-for-byte; this checkpoint is a derived view.
    return validateRun({...run,checkpoint:await evidenceHash(starting),limits:[...run.limits,`Starting state ${await evidenceHash(starting)}; resulting disposable state ${await evidenceHash(resulting)}. No acceptance receipt is implied.`]});
  }});
  for(const [kind,expected] of Object.entries(profile.fixtures))registry.register({id:`fixture-${kind}-v1`,async decode(record){
    const run=validateRun(record);same(run,expected,'Fixture values, axis roles, mapping or coverage differs from pinned numerical fixture');return run;
  }});
  return registry;
}
