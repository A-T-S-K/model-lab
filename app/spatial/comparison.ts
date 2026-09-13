import type { RecordedRun } from '../../trace/types.js';
import { forwardReadModel, type Address, type ForwardModel } from './forward.js';
import { escapeHtml as esc } from '../views/evidence.js';
export interface OutputPair { before: RecordedRun; after: RecordedRun }
export const precise = (v:number|undefined) => v === undefined ? 'pending / unavailable' : String(v);
export function outputMetrics(run:RecordedRun) {
  const input=run.manifest.input as readonly number[], targets=run.manifest.targets as readonly number[];
  const f=forwardReadModel(run,undefined);
  const rows=input.map((_,token)=>f.values({kind:'probabilities',token}));
  const losses=targets.map((target,i)=>{const p=rows[i]?.[target];return p===undefined||p<0||p>1?undefined:-Math.log(p);});
  const complete=input.length===targets.length&&input.length>0&&losses.every(v=>v!==undefined);
  return {rows,targets,mean:complete?losses.reduce<number>((s,v)=>s+v!,0)/losses.length:undefined};
}
export function outputSummary(pair:OutputPair,position:number,labels:[string,string]) {
 const a=outputMetrics(pair.before),b=outputMetrics(pair.after),vocabulary=pair.before.manifest.model.architecture.vocabulary as readonly string[];
 const token=(i:number)=>vocabulary[i]??'END';
 const compatible=JSON.stringify(pair.before.manifest.input)===JSON.stringify(pair.after.manifest.input)&&JSON.stringify(a.targets)===JSON.stringify(b.targets);
 if(!compatible)return '<p>Comparison unavailable: input / target mismatch.</p>';
 const source=(run:RecordedRun)=>`<code>${esc(run.manifest.runId)}</code> · snapshot <code>${esc(run.manifest.startingSnapshotId??'unavailable')}</code>`;
 return `<section class="output-comparison" data-testid="output-comparison"><div><strong>${esc(labels[0])} / ${esc(labels[1])}</strong><p>Loss on this input · all ${a.targets.length} positions<br><span data-testid="before-mean" data-value="${a.mean}">${precise(a.mean)}</span> → <span data-testid="after-mean" data-value="${b.mean}">${precise(b.mean)}</span></p><small>Both means DERIVED from complete observed probabilities and matching targets. No quality or acceptance rule.</small><details><summary>Endpoint run / snapshot / runtime</summary><p>${esc(labels[0])}: ${source(pair.before)}<br>${esc(labels[1])}: ${source(pair.after)}<br>Runtime ${esc(pair.before.manifest.runtimeRevision)} / ${esc(pair.after.manifest.runtimeRevision)}</p></details></div><div><strong>Position ${position} · target ${esc(token(a.targets[position]))}</strong><table><thead><tr><th>Token</th><th>${esc(labels[0])}</th><th>${esc(labels[1])}</th><th>Δ</th></tr></thead><tbody>${Array.from({length:Number(pair.before.manifest.model.architecture.vocabSize)||vocabulary.length+1},(_,i)=>{const x=a.rows[position]?.[i],y=b.rows[position]?.[i];return `<tr data-probability-token="${i}"><th>${esc(token(i))}</th><td title="${x}"><meter min="0" max="1" value="${x??0}" ${x===undefined?'hidden':''}></meter>${x===undefined?'pending':x.toFixed(6)}</td><td title="${y}"><meter min="0" max="1" value="${y??0}" ${y===undefined?'hidden':''}></meter>${y===undefined?'pending':y.toFixed(6)}</td><td title="${x===undefined||y===undefined?'unavailable':y-x}">${x===undefined||y===undefined?'unavailable':`${y-x>=0?'+':''}${(y-x).toPrecision(6)}`}</td></tr>`;}).join('')}</tbody></table><small>Probability bars 0–1 · exact values in tooltips.</small></div></section>`;
}
export function componentComparison(pair:{before:ForwardModel;after:ForwardModel},address:Address,labels:[string,string]) {
 const a=pair.before.values(address),b=pair.after.values(address);
 return `<section class="paired-components" data-testid="paired-components"><h3>${esc(labels[0])} / ${esc(labels[1])} · ${esc(address.kind)}</h3><p>Original components · shared domain per map pair. Exact equality uses no tolerance; displayed rounding can hide a nonzero delta.</p><table><thead><tr><th>i</th><th>${esc(labels[0])}</th><th>${esc(labels[1])}</th><th>Δ / equality</th></tr></thead><tbody>${Array.from({length:Math.max(a?.length??0,b?.length??0)},(_,i)=>`<tr><th>${i}</th><td>${precise(a?.[i])}</td><td>${precise(b?.[i])}</td><td>${a?.[i]===undefined||b?.[i]===undefined?'unavailable':a[i]===b[i]?'exactly equal':precise(b[i]-a[i])}</td></tr>`).join('')}</tbody></table></section>`;
}
