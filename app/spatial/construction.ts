import type {SpatialReadModel} from './bindings.js';
import type {Address} from './forward.js';
import type {ForwardProgress} from '../worker/protocol.js';
import {outputTokenName} from './comparison.js';
import {geometry} from './view.js';
import {mixture, fmt, addressLabel} from './inspector.js';
import {escapeHtml as esc} from '../views/evidence.js';

const value=(v:number|undefined)=>`<span data-value="${v??''}" title="${v??'unavailable'}">${fmt(v)}</span>`;
/** A read-only construction from the same bound read model as the world and lens.
 * No clock, requests, interpolation or cached evidence lives here. */
export function sceneConstruction(m:SpatialReadModel,a:Address,element:number,execution?:ForwardProgress){
 const e=m.forward.explain(a,element),s=m.selection;
 let body='';
 if(a.kind==='probabilities'){
  const probs=e.output,top=probs?.reduce((best,v,i)=>v>probs[best]?i:best,0);
  body=`<p>Input ${esc(m.source.capturedDocument)} · position ${a.token} reads ${esc(m.labels[a.token]??'unavailable')}. Known target: <strong>${esc(outputTokenName(m.forward.targets[a.token],m.forward.vocabulary))}</strong>. Highest-probability token: <strong>${top===undefined?'pending':esc(outputTokenName(top,m.forward.vocabulary))}</strong>.</p><div class="construction-products">${probs?.map((v,i)=>`<span>${esc(outputTokenName(i,m.forward.vocabulary))}: ${value(v)}</span>`).join('')??'Pending distribution'}</div><p>This is a teacher-forced comparison at one position, not generated continuation. Learning uses all ${m.forward.input.length} target positions.</p>`;
 }else if(a.kind==='attentionLogits'){
  body=`<div class="construction-columns">${geometry(m)}<div><p>Q: ${esc(m.labels[s.query]??'unavailable')} · K: ${esc(m.labels[s.key]??'unavailable')} · head ${s.head}</p><p>All ${m.width} original component products · derived signed reduction</p><div class="construction-products">${m.lens?.q?.map((q,j)=>`<span>${value(q)} × ${value(m.lens?.k?.[j])}<br>= ${value(m.lens?.k?.[j]===undefined?undefined:q*m.lens.k[j])}</span>`).join('')??'Operands pending'}</div><p>Σ products ${value(m.geometry?.dot)} × 1/√${m.width} = ${value(m.lens?.scaled)} → observed score ${value(m.lens?.observedLogit)}</p><p>Consumer: the complete causal softmax row. Earlier-key K comes from its own token projection.</p></div></div>`;
 }else if(a.kind==='attentionProbabilities'){
  body=`<p>Every causal score contributes to one shared denominator. Future keys are structural NA.</p><div class="construction-softmax">${m.forward.input.map((_,i)=>`<div><strong>key ${i}</strong>${i>a.token?'<p>future · NA</p>':`<p>score ${value(e.scoreInputs?.[i])}</p><p>exp(score − ${value(e.maximum)})</p><p>${value(e.exponentials?.[i])} / ${value(e.denominator)}</p><p>→ P ${value(e.output?.[i])}</p>`}</div>`).join('')}</div><p>Shifted exponentials and denominator are derived from observed scores. Shared sum = ${value(e.denominator)}. Probabilities above are observed; consumer: weighted values.</p>`;
 }else if(a.kind==='headOutput'){
  body=e.zeroed?`<p>Declared intervention: aggregated weighted output ${value(e.mixture?.mixture[element])} is replaced with constant ${value(e.observed)} before concatenation. No training.</p>`:`<div class="construction-mixture">${mixture(e,element)}</div><p>Selected key ${s.key}: α ${value(e.probabilities?.[s.key])} × complete V [${e.points?.[s.key]?.map(fmt).join(', ')??'unavailable'}]. Its component [${element}] contribution is ${value(e.points?.[s.key]&&e.probabilities?.[s.key]!==undefined?e.points[s.key]![element]*e.probabilities[s.key]:undefined)}. Consumer: concatenate all heads, then WO.</p>`;
 }else if(['attentionOutput','attentionProjection','attentionResidual'].includes(a.kind)){
  const f=m.forward,concat=f.explain({kind:'attentionOutput',token:a.token},element),projection=f.explain({kind:'attentionProjection',token:a.token},element),residual=f.explain({kind:'attentionResidual',token:a.token},element);
  body=`<div class="construction-handoff"><section><h3>1 · Concatenate channels</h3><p>Head ${Math.floor(element/m.width)}, channel ${element%m.width} → concat[${element}] ${value(concat.observed)}</p><p>Copy channels; no addition.</p></section><section><h3>2 · Project through WO</h3><p>layer0.attn_wo · row ${element}</p><p>Σ concat[j] × WO[${element},j] → ${value(projection.observed)}</p></section><section><h3>3 · Add saved residual</h3><p>Saved embeddingNorm[${element}] ${value(residual.pairs?.[1])}<br>+ update[${element}] ${value(residual.pairs?.[0])}<br>= observed residual ${value(residual.observed)}</p><p>Consumer: pre-MLP normalization.</p></section></div>`;
 }else{
  body=`<p>Use Values / arithmetic / source for complete ${esc(e.definition?.family??'operation')} arithmetic. The existing component geometry and live learning constructions remain in the map.</p>`;
 }
 if(execution&&!e.output)body=`<p>Output pending · ${esc(addressLabel(a))}. Known head width ${m.width}; ${Math.min(a.token+1,m.forward.input.length)} causal keys. Only already produced operands may be inspected; navigation grants no execution permits.</p>`;
 return `<section class="scene-construction" aria-label="Selected operation construction" data-testid="scene-construction" data-run="${esc(m.source.sourceRunId)}" data-revision="${execution?.sequence??'completed'}" data-selection="${esc(JSON.stringify([a,s.key,element]))}"><header><strong>${esc(addressLabel(a))}</strong><span>${execution?'ACTIVE EXECUTION':esc(m.source.relationship)} · input ${esc(m.source.capturedDocument)}</span></header>${body}<details><summary>Bound source identity</summary><p>Run ${esc(m.source.sourceRunId)} · artifact ${esc(e.artifact?.id??'pending')} · runtime ${esc(m.runtime)}</p></details></section>`;
}
