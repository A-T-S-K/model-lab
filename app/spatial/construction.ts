import type {SpatialReadModel} from './bindings.js';
import type {Address} from './forward.js';
import type {ForwardProgress} from '../worker/protocol.js';
import {outputTokenName} from './comparison.js';
import {geometry} from './view.js';
import {mixture, fmt, addressLabel} from './inspector.js';
import {escapeHtml as esc} from '../views/evidence.js';

const value=(v:number|undefined)=>`<span data-value="${v??''}" title="${v??'unavailable'}">${fmt(v)}</span>`;
export interface OperationConstruction {
  readonly purpose: string;
  readonly essentialSummary: string;
  readonly detailMath: string;
  readonly notes?: string;
  readonly plainMeaning?: string;
  readonly plainResult?: string;
}

export function operationConstruction(m:SpatialReadModel,a:Address,element:number,execution?:ForwardProgress): OperationConstruction {
  const e=m.forward.explain(a,element),s=m.selection;
  let purpose='';
  let essentialSummary='';
  let detailMath='';
  let notes:string|undefined;
  let plainMeaning:string|undefined;
  let plainResult:string|undefined;

  if(a.kind==='probabilities'){
    const probs=e.output,top=probs?.reduce((best,v,i)=>v>probs[best]?i:best,0);
    purpose="What does the model predict comes next? Compare token probabilities with the known target.";
    plainMeaning="The model converts raw scores into probabilities that sum to 100%, and selects the character with the highest probability as its prediction.";
    plainResult=`Input <strong>${esc(m.source.capturedDocument)}</strong> · position ${a.token} ('${esc(m.labels[a.token]??'unavailable')}'). Known target: <strong>${esc(outputTokenName(m.forward.targets[a.token],m.forward.vocabulary))}</strong>. Highest-probability token: <strong>${top===undefined?'pending':esc(outputTokenName(top,m.forward.vocabulary))}</strong>.`;
    essentialSummary=`<p>Input ${esc(m.source.capturedDocument)} · position ${a.token} reads ${esc(m.labels[a.token]??'unavailable')}. Known target: <strong>${esc(outputTokenName(m.forward.targets[a.token],m.forward.vocabulary))}</strong>. Highest-probability token: <strong>${top===undefined?'pending':esc(outputTokenName(top,m.forward.vocabulary))}</strong>.</p>`;
    detailMath=`<div class="construction-products">${probs?.map((v,i)=>`<span>${esc(outputTokenName(i,m.forward.vocabulary))}: ${value(v)}</span>`).join('')??'Pending distribution'}</div>`;
    notes=`This is a teacher-forced comparison at one position, not generated continuation. Learning uses all ${m.forward.input.length} target positions.`;
  }else if(a.kind==='attentionLogits'){
    purpose="Compare this position's query with allowed earlier keys to produce attention scores.";
    plainMeaning="The Query vector for this position is compared with Key vectors from allowed positions to calculate raw attention scores.";
    plainResult=`Query '${esc(m.labels[s.query]??'unavailable')}' (pos ${s.query}) compared with Key '${esc(m.labels[s.key]??'unavailable')}' (pos ${s.key}) in head ${s.head}.`;
    essentialSummary=`<p>Q: ${esc(m.labels[s.query]??'unavailable')} · K: ${esc(m.labels[s.key]??'unavailable')} · head ${s.head}</p><p>All ${m.width} original component products · derived signed reduction</p><p>Σ products ${value(m.geometry?.dot)} × 1/√${m.width} = ${value(m.lens?.scaled)} → observed score ${value(m.lens?.observedLogit)}</p>`;
    detailMath=`<div class="construction-columns">${geometry(m)}<div><p>Q: ${esc(m.labels[s.query]??'unavailable')} · K: ${esc(m.labels[s.key]??'unavailable')} · head ${s.head}</p><p>All ${m.width} original component products · derived signed reduction</p><div class="construction-products">${m.lens?.q?.map((q,j)=>`<span>${value(q)} × ${value(m.lens?.k?.[j])}<br>= ${value(m.lens?.k?.[j]===undefined?undefined:q*m.lens.k[j])}</span>`).join('')??'Operands pending'}</div><p>Σ products ${value(m.geometry?.dot)} × 1/√${m.width} = ${value(m.lens?.scaled)} → observed score ${value(m.lens?.observedLogit)}</p><p>Consumer: the complete causal softmax row. Earlier-key K comes from its own token projection.</p></div></div>`;
    notes=`Consumer: the complete causal softmax row. Earlier-key K comes from its own token projection.`;
  }else if(a.kind==='attentionProbabilities'){
    purpose="Turn the causal scores into normalized attention weights across allowed earlier keys.";
    plainMeaning="Softmax converts raw scores into normalized mixing weights across allowed positions. These weights are not direct measures of relevance or causal importance.";
    plainResult=`Normalized attention distribution calculated across allowed earlier characters for position ${a.token}.`;
    essentialSummary=`<p>Every causal score contributes to one shared denominator. Future keys are structural NA.</p><p>Shifted exponentials and denominator are derived from observed scores. Shared sum = ${value(e.denominator)}. Probabilities above are observed; consumer: weighted values.</p>`;
    detailMath=`<div class="construction-softmax">${m.forward.input.map((_,i)=>`<div><strong>key ${i}</strong>${i>a.token?'<p>future · NA</p>':`<p>score ${value(e.scoreInputs?.[i])}</p><p>exp(score − ${value(e.maximum)})</p><p>${value(e.exponentials?.[i])} / ${value(e.denominator)}</p><p>→ P ${value(e.output?.[i])}</p>`}</div>`).join('')}</div><p>Shifted exponentials and denominator are derived from observed scores. Shared sum = ${value(e.denominator)}. Probabilities above are observed; consumer: weighted values.</p>`;
  }else if(a.kind==='headOutput'){
    purpose="Use normalized attention weights to combine information from allowed value vectors into this head's output.";
    plainMeaning="The model uses attention weights to mix Value vectors from allowed positions into this head’s output.";
    plainResult=`Head ${s.head} context output blended from weighted previous characters.`;
    essentialSummary=e.zeroed?`<p>Declared intervention: aggregated weighted output ${value(e.mixture?.mixture[element])} is replaced with constant ${value(e.observed)} before concatenation. No training.</p>`:`<p>Selected key ${s.key}: α ${value(e.probabilities?.[s.key])} × complete V [${e.points?.[s.key]?.map(fmt).join(', ')??'unavailable'}]. Its component [${element}] contribution is ${value(e.points?.[s.key]&&e.probabilities?.[s.key]!==undefined?e.points[s.key]![element]*e.probabilities[s.key]:undefined)}. Consumer: concatenate all heads, then WO.</p>`;
    detailMath=e.zeroed?`<p>Declared intervention: aggregated weighted output ${value(e.mixture?.mixture[element])} is replaced with constant ${value(e.observed)} before concatenation. No training.</p>`:`<div class="construction-mixture">${mixture(e,element)}</div><p>Selected key ${s.key}: α ${value(e.probabilities?.[s.key])} × complete V [${e.points?.[s.key]?.map(fmt).join(', ')??'unavailable'}]. Its component [${element}] contribution is ${value(e.points?.[s.key]&&e.probabilities?.[s.key]!==undefined?e.points[s.key]![element]*e.probabilities[s.key]:undefined)}. Consumer: concatenate all heads, then WO.</p>`;
  }else if(['attentionOutput','attentionProjection','attentionResidual'].includes(a.kind)){
    purpose="Project the attention result and add it back to the saved residual stream.";
    plainMeaning="Attention mixes Value vectors from allowed positions. The head outputs are joined, projected, and added to the saved representation.";
    plainResult=`Context from earlier characters blended into position ${a.token} and added to the residual stream.`;
    const f=m.forward,concat=f.explain({kind:'attentionOutput',token:a.token},element),projection=f.explain({kind:'attentionProjection',token:a.token},element),residual=f.explain({kind:'attentionResidual',token:a.token},element);
    essentialSummary=`<p>Saved embeddingNorm[${element}] ${value(residual.pairs?.[1])} + update[${element}] ${value(residual.pairs?.[0])} = observed residual ${value(residual.observed)}. Consumer: pre-MLP normalization.</p>`;
    detailMath=`<div class="construction-handoff"><section><h3>1 · Concatenate channels</h3><p>Head ${Math.floor(element/m.width)}, channel ${element%m.width} → concat[${element}] ${value(concat.observed)}</p><p>Copy channels; no addition.</p></section><section><h3>2 · Project through WO</h3><p>layer0.attn_wo · row ${element}</p><p>Σ concat[j] × WO[${element},j] → ${value(projection.observed)}</p></section><section><h3>3 · Add saved residual</h3><p>Saved embeddingNorm[${element}] ${value(residual.pairs?.[1])}<br>+ update[${element}] ${value(residual.pairs?.[0])}<br>= observed residual ${value(residual.observed)}</p><p>Consumer: pre-MLP normalization.</p></section></div>`;
  }else if(a.kind==='preAttentionNorm'){
    purpose="Turn the token and its position into the model's working representation and prepare it for attention.";
    plainMeaning="The model converts the input character into numbers and adds position information so it knows the character's order. It normalizes these numbers to create a clean starting representation for the attention layers.";
    plainResult=`Input character '${esc(m.labels[a.token]??'unavailable')}' (position ${a.token}) converted to initial working representation.`;
    const f=m.forward,sum=f.explain({kind:'embeddingSum',token:a.token},element),embNorm=f.explain({kind:'embeddingNorm',token:a.token},element),preNorm=f.explain({kind:'preAttentionNorm',token:a.token,layer:a.layer??0},element);
    essentialSummary=`<p>tokenEmbedding + positionEmbedding → sum[${element}] ${value(sum.observed)} → embeddingNorm[${element}] ${value(embNorm.observed)} → preAttentionNorm[${element}] ${value(preNorm.observed)}.</p><p>Two distinct normalizations are preserved: embeddingNorm precedes preAttentionNorm before attention projection.</p>`;
    detailMath=`<div class="construction-handoff"><section><h3>1 · Token + Position</h3><p>tokenEmbedding + positionEmbedding<br>→ sum[${element}] ${value(sum.observed)}</p></section><section><h3>2 · Embedding RMSNorm</h3><p>embeddingNorm[${element}] ${value(embNorm.observed)}<br><small>Normalizes combined representation</small></p></section><section><h3>3 · Pre-attention RMSNorm</h3><p>preAttentionNorm[${element}] ${value(preNorm.observed)}<br><small>Attention-boundary normalization</small></p></section></div><p>Two distinct normalizations are preserved: embeddingNorm precedes preAttentionNorm before attention projection.</p>`;
  }else if(a.kind==='mlpResidual'||a.kind==='mlpDown'||a.kind==='mlpRelu'||a.kind==='mlpUp'||a.kind==='preMlpNorm'){
    purpose="Transform the context-enriched representation before scoring possible next tokens.";
    plainMeaning="A feed-forward neural network transforms each character's representation independently, expanding and compressing features so the model can capture complex language patterns.";
    plainResult=`Transformed feature representation at position ${a.token} added to the residual stream.`;
    const f=m.forward,preNorm=f.explain({kind:'preMlpNorm',token:a.token,layer:a.layer??0},element),up=f.explain({kind:'mlpUp',token:a.token,layer:a.layer??0},element),act=f.explain({kind:f.activationKind,token:a.token,layer:a.layer??0},element),down=f.explain({kind:'mlpDown',token:a.token,layer:a.layer??0},element),res=f.explain({kind:'mlpResidual',token:a.token,layer:a.layer??0},element);
    essentialSummary=`<p>Canonical MLP pipeline: preMlpNorm (RMSNorm ${value(preNorm.observed)}) → mlpUp (8→32 projection ${value(up.observed)}) → ReLU (${value(act.observed)}) → mlpDown (32→8 projection ${value(down.observed)}) → mlpResidual (residual addition ${value(res.observed)}).</p>`;
    detailMath=`<div class="construction-handoff"><section><h3>1 · Pre-MLP Norm</h3><p>preMlpNorm[${element}] ${value(preNorm.observed)}</p></section><section><h3>2 · Expand (8 → 32)</h3><p>mlpUp[${element}] ${value(up.observed)}</p></section><section><h3>3 · ReLU activation</h3><p>ReLU[${element}] ${value(act.observed)}</p></section><section><h3>4 · Contract (32 → 8)</h3><p>mlpDown[${element}] ${value(down.observed)}</p></section><section><h3>5 · Residual add</h3><p>mlpResidual[${element}] ${value(res.observed)}</p></section></div><p>Canonical MLP pipeline: preMlpNorm → mlpUp → ReLU → mlpDown → mlpResidual.</p>`;
  }else if(a.kind==='logits'){
    purpose="Give each possible next token a raw score (logit).";
    plainMeaning="The model projects its final representation across the entire vocabulary, calculating an unnormalized score for every possible next character before converting them to probabilities.";
    const logits=e.output,top=logits?.reduce((best,v,i)=>v>logits[best]?i:best,0);
    plainResult=`Highest raw score: <strong>${top===undefined?'pending':esc(outputTokenName(top,m.forward.vocabulary))}</strong> across ${logits?.length ?? 0} vocabulary tokens.`;
    essentialSummary=`<p>Input ${esc(m.source.capturedDocument)} · position ${a.token} reads ${esc(m.labels[a.token]??'unavailable')}. Raw unnormalized scores from projection through lm_head. Highest raw score: <strong>${top===undefined?'pending':esc(outputTokenName(top,m.forward.vocabulary))}</strong>.</p><p>Raw token scores are unnormalized logits, not probabilities. Softmax converts these into a normalized probability distribution in the next step.</p>`;
    detailMath=`<div class="construction-products">${logits?.map((v,i)=>`<span>${esc(outputTokenName(i,m.forward.vocabulary))}: ${value(v)}</span>`).join('')??'Pending logits'}</div><p>Raw token scores are unnormalized logits, not probabilities. Softmax converts these into a normalized probability distribution in the next step.</p>`;
  }else{
    purpose=`Use Values / arithmetic / source for complete ${esc(e.definition?.family??'operation')} arithmetic.`;
    essentialSummary=`<p>Use Values / arithmetic / source for complete ${esc(e.definition?.family??'operation')} arithmetic.</p>`;
    detailMath=`<p>Use Values / arithmetic / source for complete ${esc(e.definition?.family??'operation')} arithmetic. The existing component geometry and live learning constructions remain in the map.</p>`;
  }

  if(execution&&!e.output){
    essentialSummary=`<p>Output pending · ${esc(addressLabel(a))}. Known head width ${m.width}; ${Math.min(a.token+1,m.forward.input.length)} causal keys. Only already produced operands may be inspected; navigation grants no execution permits.</p>`;
  }

  return { purpose, essentialSummary, detailMath, notes, plainMeaning, plainResult };
}

/** A read-only construction from the same bound read model as the world and lens.
 * No clock, requests, interpolation or cached evidence lives here. */
export function sceneConstruction(m:SpatialReadModel,a:Address,element:number,execution?:ForwardProgress){
  const e=m.forward.explain(a,element),s=m.selection;
  const c=operationConstruction(m,a,element,execution);
  const body=`${c.purpose?`<p class="construction-purpose">${c.purpose}</p>`:''}${c.essentialSummary}${c.detailMath}${c.notes?`<p>${c.notes}</p>`:''}`;
  return `<section class="scene-construction" aria-label="Selected operation construction" data-testid="scene-construction" data-run="${esc(m.source.sourceRunId)}" data-revision="${execution?.sequence??'completed'}" data-selection="${esc(JSON.stringify([a,s.key,element]))}"><header><strong>${esc(addressLabel(a))}</strong><span>${execution?'ACTIVE EXECUTION':esc(m.source.relationship)} · input ${esc(m.source.capturedDocument)}</span></header>${body}<details><summary>Bound source identity</summary><p>Run ${esc(m.source.sourceRunId)} · artifact ${esc(e.artifact?.id??'pending')} · runtime ${esc(m.runtime)}</p></details></section>`;
}
