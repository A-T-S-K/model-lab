import type { ForwardModel } from '../spatial/forward.js';

/** Learning is an activity, independent of deployment. Explicit legacy entries win. */
export function releaseLearningEnabled(query: URLSearchParams): boolean {
  return query.get('experience') === 'learn' && query.get('presentation') !== 'classic'
    && query.get('kiosk') !== '1' && query.get('demo') !== '1';
}

/** The introductory recipe follows abca's p3 character-to-character occurrence. */
export const INTRO_POSITION = 3;
export const REPRESENTATION_KINDS = ['tokenEmbedding', 'positionEmbedding', 'embeddingSum', 'embeddingNorm', 'preAttentionNorm'] as const;
export function introductoryEvidence(f: ForwardModel | undefined, requested: string, position = INTRO_POSITION) {
  if (!f) return { available: false as const, reason: 'No recorded computation is available yet.' };
  const document = f.input.slice(1).map(id => f.vocabulary[id] ?? '').join('');
  if (!Number.isInteger(position) || position < 0 || position >= f.input.length)
    return { available: false as const, reason: `This example has no lesson occurrence p${position}. Use abca for the introductory recipe.` };
  const probabilities = f.values({ kind: 'probabilities', token: position });
  const target = f.targets[position];
  if (!probabilities || probabilities.length !== f.vocabulary.length + 1 || target === undefined
    || probabilities.some(p => !Number.isFinite(p) || p < 0 || p > 1))
    return { available: false as const, reason: 'The full output distribution or known target was not captured. Missing evidence is not zero.' };
  const predicted = probabilities.reduce((best, p, i) => p > probabilities[best]! ? i : best, 0);
  const label = (id: number) => id === f.vocabulary.length ? 'END' : f.vocabulary[id] ?? `ID ${id}`;
  const members = REPRESENTATION_KINDS.map(kind => {
    const address = { kind, token: position, ...(kind === 'preAttentionNorm' ? {layer: 0} : {}) };
    const artifact = f.artifact(address);
    return { kind, address, identity: f.semanticId(address), artifact: artifact?.id,
      values: artifact?.availability === 'available' ? artifact.values ?? undefined : undefined };
  });
  return { available: true as const, run: f.runId, document, stale: requested !== document,
    prefix: f.input.slice(1, position + 1).map(id => f.vocabulary[id] ?? '').join(''), position,
    token: f.input[position]!, character: position === 0 ? 'START' : f.vocabulary[f.input[position]!]!,
    target, targetLabel: label(target), predicted, predictedLabel: label(predicted),
    rows: probabilities.map((probability, id) => ({id, label: label(id), probability, target: id === target, predicted: id === predicted})),
    members, finalPosition: f.input.length - 1, finalTarget: label(f.targets[f.input.length - 1]!),
  };
}

export function predictionFeedback(e: ReturnType<typeof introductoryEvidence>, answer: string): string {
  if (!e.available) return e.reason;
  if (answer === 'guarantee') return `${e.predictedLabel} has the highest probability in this run, but that is no guarantee and no token has been sampled. The known example target is ${e.targetLabel}.`;
  if (answer === 'train') return 'This prediction used the current parameters. It did not train or change them; learning is a separate explicit action.';
  return `Yes: the model assigns probabilities to the next token after ${e.prefix || 'START'}. The example tells us the target is ${e.targetLabel}; this run ranks ${e.predictedLabel} highest. Probability is not measured accuracy.`;
}

import type { SpatialReadModel } from '../spatial/bindings.js';
import type { Address } from '../spatial/forward.js';
import { CANONICAL_MICROGPT_DEFINITION } from '../../model/definitions.js';
import type { PublicTourState } from '../spatial/public-tour.js';

export const FORWARD_LESSON_STATES = ['p1_qkv','p1_attention_compare','p1_attention_weights','p1_value_mixture','p1_attention_integration','p1_transform','p1_score','p1_probabilities','p1_complete'] as const;
export function releaseChapter(state: PublicTourState): string {
  return state === 'cold' ? 'Opening' : state === 'p1_prediction_preview' ? '1 · Prediction'
    : state === 'p1_represent' ? '2 · Representation'
    : FORWARD_LESSON_STATES.slice(0,5).includes(state as typeof FORWARD_LESSON_STATES[0]) ? '3 · Context / attention'
    : FORWARD_LESSON_STATES.includes(state as typeof FORWARD_LESSON_STATES[number]) ? '4 · Output' : 'Existing learning workflow';
}
export const forwardContinue: Partial<Record<PublicTourState,string>> = {
  p1_prediction_preview: 'How characters become numbers', p1_represent: 'How earlier context affects this position',
  p1_qkv: 'Compare Query and Key', p1_attention_compare: 'Turn scores into position weights',
  p1_attention_weights: 'Combine Value components', p1_value_mixture: 'Join heads, project and add',
  p1_attention_integration: 'Transform the context-aware representation', p1_transform: 'Score possible next tokens',
  p1_score: 'Turn output scores into probabilities', p1_probabilities: 'Return to the recorded prediction',
};

/** A bounded teaching query over the same world lens and operation explanations.
 * No execution, model arithmetic or lesson state is owned here. */
export function forwardTourEvidence(m: SpatialReadModel | undefined, requested: string) {
  if (!m) return {available:false as const,reason:'No recorded computation is available.'};
  const f=m.forward, intro=introductoryEvidence(f,requested);
  if (!intro.available) return intro;
  const definition=`${CANONICAL_MICROGPT_DEFINITION.id}:${CANONICAL_MICROGPT_DEFINITION.version}`;
  if(f.semanticAddress({kind:'q',token:3,layer:0}).modelDefinition!==definition || f.activationKind!=='mlpRelu'
    || f.layers!==1 || intro.document!=='abca')
    return {available:false as const,reason:'This forward tour requires canonical abca evidence. Other models and inputs retain their own inspection paths.'};
  if(m.source.sourceRunId!==f.runId || m.selection.query!==3 || m.selection.layer!==0 || m.selection.head!==0 || m.selection.key!==0)
    return {available:false as const,reason:'The lesson and numerical lens have incompatible run or occurrence coordinates. Resume the bound p3 / layer 0 / head 0 / key 0 lesson.'};
  const member=(kind:string,token=3,head?:number)=>{
    const address:Address={kind,token,...(['embeddingNorm','logits','probabilities'].includes(kind)?{}:{layer:0}),...(head===undefined?{}:{head})};
    const artifact=f.artifact(address),values=f.values(address);
    return {address,identity:f.semanticId(address),artifact:artifact?.id,values,explanation:f.explain(address,0)};
  };
  const q=member('q'),keys=Array.from({length:4},(_,k)=>member('k',k)),values=Array.from({length:4},(_,k)=>member('v',k));
  const heads=Array.from({length:f.heads},(_,head)=>({head,score:member('attentionLogits',3,head),weights:member('attentionProbabilities',3,head),output:member('headOutput',3,head)}));
  const chain=['embeddingNorm','attentionOutput','attentionProjection','attentionResidual','preMlpNorm','mlpUp','mlpRelu','mlpDown','mlpResidual','logits','probabilities'].map(kind=>member(kind));
  const all=[q,...keys,...values,...heads.flatMap(h=>[h.score,h.weights,h.output]),...chain];
  if(all.some(x=>!x.values?.length||x.values.some(v=>!Number.isFinite(v))) || !m.lens || m.lens.availability!=='AVAILABLE'
    || !m.lens.products || m.lens.products.length!==f.width || heads.some(h=>h.score.values?.length!==4||h.weights.values?.length!==4||h.output.values?.length!==f.width)
    || chain.some(x=>['attentionProjection','mlpUp','mlpDown','logits'].includes(x.address.kind)&&!x.explanation.terms))
    return {available:false as const,reason:'Complete captured operands or compatible checkpoint projection evidence are unavailable. Missing values are not zero; no replacement computation was requested.'};
  return {available:true as const,intro,run:f.runId,width:f.width,q,keys,values,heads,chain,lens:m.lens,
    positions:f.input.map((id,position)=>({position,label:`p${position} · ${position===0?'START':f.vocabulary[id]}`,eligible:position<=3})),
    get:(kind:string)=>chain.find(x=>x.address.kind===kind)!,
  };
}

export function forwardFeedback(answer:string):string {
  if(answer==='future') return 'p4 belongs to the complete example, but it is future context at p3. It has no entry in this comparison; it is not an observed zero.';
  if(answer==='positions') return 'Yes: these attention weights normalize over START and positions p1–p3. They combine Value vectors, not possible output characters. A click is not evidence of comprehension.';
  if(answer==='importance') return 'Attention weights control this Value mixture. Alone they do not establish causal word importance or learned head specialization.';
  if(answer==='outputs') return 'Yes: output softmax normalizes over all four possible next-token indices. Attention softmax instead normalizes over eligible positions.';
  return 'The example target is known; the highest probability is a ranking from this run. No token was sampled, and navigating the explanation did not train parameters.';
}

export function learningHandoff(m: SpatialReadModel | undefined, requested: string, current: boolean) {
  const e=forwardTourEvidence(m,requested);
  if(!e.available) return {available:false,reason:e.reason};
  if(e.intro.stale) return {available:false,reason:'Learning handoff refused: edited input differs from recorded abca. Restore abca or explicitly Predict the edited input before starting learning computation.'};
  if(!current) return {available:false,reason:'Learning handoff refused: this retained prediction is not the current accepted-state prediction. Explicitly Predict before starting learning computation.'};
  return {available:true,reason:''};
}
