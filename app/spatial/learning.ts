import type {RecordedRun} from '../../trace/types.js';
import type {ArchivedSnapshot,LearningExperiment} from '../../archive/session.js';
import {validateLearningExperiment} from '../../archive/experiment.js';
import type {InspectionResult,ParameterRef} from '../../inspect/types.js';
import {backwardReadModel} from '../presentation/backward-read-model.js';
import {adamReadModel} from '../presentation/adam-read-model.js';
import {forwardReadModel} from './forward.js';
export interface ParameterPin {name:string;row:number;column:number}
export type LearningStage='objective'|'gradient'|'adam'|'checkpoint'|'compare';
export function resolveParameter(snapshot:ArchivedSnapshot|undefined,pin:ParameterPin):ParameterRef|undefined{
 if(!snapshot||![pin.row,pin.column].every(x=>Number.isInteger(x)&&x>=0))return;
 let index=0;
 for(const name of snapshot.state.parameterOrder)for(let row=0;row<snapshot.state.parameters[name].length;row++)for(let column=0;column<snapshot.state.parameters[name][row].length;column++,index++)if(name===pin.name&&row===pin.row&&column===pin.column)return {...pin,index};
}
const values=(run:RecordedRun,kind:string,token?:number)=>run.artifacts.find(a=>a.kind===kind&&(token===undefined||a.concept.token===token)&&a.availability==='available')?.values;
export function targetLosses(run:RecordedRun,experiment:LearningExperiment){
 if(JSON.stringify(run.manifest.input)!==JSON.stringify(experiment.objective.inputIds)||JSON.stringify(run.manifest.targets)!==JSON.stringify(experiment.objective.targetIds))return;
 const vocabulary=run.manifest.model.architecture.vocabulary as readonly string[];
 const rows=experiment.objective.targetIds.map((target,position)=>{
  const probability=values(run,'probabilities',position)?.[target],observed=values(run,'loss',position)?.[0];
  const derived=probability===undefined||probability<0||probability>1?undefined:-Math.log(probability);
  return {position,input:experiment.objective.inputIds[position],inputLabel:vocabulary[experiment.objective.inputIds[position]]??"START",target,targetLabel:vocabulary[target]??"START",probability,loss:observed??derived,origin:observed===undefined?'DERIVED':'OBSERVED'};
 });
 const observedMean=values(run,'meanLoss')?.[0];
 return {runId:run.manifest.runId,rows,mean:observedMean??(rows.every(r=>r.loss!==undefined)?rows.reduce((s,r)=>s+r.loss!,0)/rows.length:undefined),origin:observedMean===undefined?'DERIVED':'OBSERVED'};
}
export function learningReadModel(experiment:LearningExperiment|undefined,start:ArchivedSnapshot|undefined,end:ArchivedSnapshot|undefined,before:RecordedRun|undefined,training:RecordedRun|undefined,after:RecordedRun|undefined,pin:ParameterPin,inspection?:InspectionResult,limit=3,pending=false){
 const unavailable={available:false as const,pin,reason:'No complete matching learning transition. Run Learn to record one.'};
 if(!experiment||!start||!end||!before||!training||!after)return unavailable;
 if(start.id!==experiment.startingSnapshotId||end.id!==experiment.resultingSnapshotId||before.manifest.runId!==experiment.beforeRunId||training.manifest.runId!==experiment.trainingRunId||after.manifest.runId!==experiment.afterRunId)return unavailable;
 try{validateLearningExperiment(experiment,start.state,end.state,before,training,training,after);}catch{return {...unavailable,reason:'Transition source validation failed; arithmetic is unavailable.'};}
 const parameter=resolveParameter(start,pin);if(!parameter)return {...unavailable,reason:'Parameter address is unavailable in this checkpoint.'};
 const graph=inspection?.graph,root=graph?.nodes.find(n=>graph.roots.includes(n.id)&&n.parameter?.index===parameter.index);
 const verifiedInspection=root&&root.parameter?.name===pin.name&&root.parameter.row===pin.row&&root.parameter.column===pin.column?inspection:undefined;
 return {available:true as const,pin,parameter,experiment,start,end,before,training,after,
  backward:backwardReadModel(experiment,training,parameter,verifiedInspection,limit,pending),
  adam:adamReadModel(experiment,start,end,before,after,parameter),
  objective:targetLosses(training,experiment)!,beforeObjective:targetLosses(before,experiment)!,afterObjective:targetLosses(after,experiment)!,
  comparison:{before:forwardReadModel(before,start),after:forwardReadModel(after,end)}};
}
export type LearningModel=ReturnType<typeof learningReadModel>;
