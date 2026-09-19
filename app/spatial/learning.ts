import type {RecordedRun} from '../../trace/types.js';
import type {ArchivedSnapshot,LearningExperiment} from '../../archive/session.js';
import {validateLearningExperiment} from '../../archive/experiment.js';
import type {InspectionResult,ParameterRef} from '../../inspect/types.js';
import {backwardReadModel} from '../presentation/backward-read-model.js';
import {adamReadModel} from '../presentation/adam-read-model.js';
import {forwardReadModel} from './forward.js';
import type {TrainingPhase} from '../worker/training-execution.js';
export interface ParameterPin {name:string;row:number;column:number}
export type LearningStage='objective'|'gradient'|'adam'|'checkpoint'|'compare';

export interface LearningPhasePresentation {
  readonly label: string;
  readonly purpose: string;
}

export function learningPhasePresentation(
  phase: TrainingPhase,
  context?: { readonly final?: boolean; readonly count?: number; readonly pinLabel?: string }
): LearningPhasePresentation {
  switch (phase) {
    case 'baseline forward':
      return {
        label: 'Learning · Baseline Forward',
        purpose: 'Running the accepted model on the fixed training input to establish the current endpoint.',
      };
    case 'training forward':
      return {
        label: 'Learning · Training Forward',
        purpose: 'Running the training forward pass that produces the values used by the objective and backward pass.',
      };
    case 'loss':
      return {
        label: 'Learning · Training Objective',
        purpose: 'Combine cross-entropy losses across all positions into mean training objective.',
      };
    case 'backward seed':
      return {
        label: 'Learning · Backward Seed',
        purpose: 'Seeding dLoss/dLoss = 1 before reverse-mode accumulation begins.',
      };
    case 'backward':
      return {
        label: `Learning · Backward ${context?.final ? 'complete' : context?.count !== undefined ? `pass (${context.count} steps)` : ''}`.trim(),
        purpose: 'Actual scalar reverse-mode execution is propagating adjoints and accumulating parameter gradients.',
      };
    case 'optimizer proposal':
      return {
        label: 'Learning · Adam Proposal',
        purpose: context?.pinLabel
          ? `Adam is computing provisional parameter proposals from final gradients and persistent optimizer state for pinned ${context.pinLabel}.`
          : 'Adam is computing provisional parameter proposals from final gradients and persistent optimizer state.',
      };
    case 'candidate application':
      return {
        label: 'Learning · Private Candidate',
        purpose: 'Applying the complete validated proposal inside the private working transaction to create the provisional candidate state.',
      };
    case 'candidate forward':
      return {
        label: 'Learning · Candidate Forward',
        purpose: 'Real forward execution on the provisional candidate state. The accepted model has not changed.',
      };
    case 'ready':
      return {
        label: 'Learning · Candidate Ready',
        purpose: 'Candidate parameters evaluated. Accept the update to advance the accepted model, or Discard to revert.',
      };
    default: {
      const _exhaustive: never = phase;
      throw new Error(`Unhandled training phase: ${_exhaustive}`);
    }
  }
}
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
