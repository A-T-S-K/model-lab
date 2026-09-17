import { PRESENTATION_WORK } from "../presentation/work-contract.js";

export interface RankedOutput {index:number;logit:number;probability:number}
export interface FullSupportDistribution {
  size:number;maximum:number;denominator:number;top:readonly RankedOutput[];
  shownMass:number;omittedMass:number;selected:RankedOutput;
}

export type BoundedValueReader=(start:number,count:number)=>readonly number[];

const derivedByOwner = new WeakMap<object, Map<string, FullSupportDistribution>>();

/** Small presentation-only memo. It stores bounded summaries, never tensor values. */
export function memoizedFullSupportDistribution(
  owner: object,
  identity: string,
  size: number,
  selectedIndex: number,
  read: BoundedValueReader,
  topK = 5,
): FullSupportDistribution {
  let cache = derivedByOwner.get(owner);
  if (!cache) {
    cache = new Map();
    derivedByOwner.set(owner, cache);
  }
  const key = `${identity}\u0000${size}\u0000${selectedIndex}\u0000${topK}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const result = fullSupportDistributionFromSlices(size, selectedIndex, read, topK);
  cache.set(key, result);
  while (cache.size > 8) cache.delete(cache.keys().next().value!);
  return result;
}

/** Two bounded passes: stable maximum, then denominator/top-k. No complete tensor is returned. */
export function fullSupportDistributionFromSlices(size:number,selectedIndex:number,read:BoundedValueReader,topK=5,chunkSize=PRESENTATION_WORK.payloadSlice):FullSupportDistribution{
  if(!Number.isSafeInteger(size)||size<=0||size>PRESENTATION_WORK.numericalValues)throw Error('Distribution size exceeds the qualified evidence bound');
  if(!Number.isSafeInteger(selectedIndex)||selectedIndex<0||selectedIndex>=size)throw Error('Output index out of bounds');
  if(!Number.isSafeInteger(topK)||topK<=0||topK>PRESENTATION_WORK.distributionTopK||topK>size||!Number.isSafeInteger(chunkSize)||chunkSize<=0||chunkSize>PRESENTATION_WORK.payloadSlice)throw Error('Distribution bound is invalid');
  let maximum=-Infinity;
  for(let start=0;start<size;start+=chunkSize){const values=read(start,Math.min(chunkSize,size-start));if(values.length!==Math.min(chunkSize,size-start))throw Error('Incomplete bounded distribution slice');for(const value of values){if(!Number.isFinite(value))throw Error('Distribution values must be finite');maximum=Math.max(maximum,value);}}
  let denominator=0,selectedLogit:number|undefined;const ranked:{index:number;logit:number}[]=[];
  for(let start=0;start<size;start+=chunkSize){const count=Math.min(chunkSize,size-start),values=read(start,count);if(values.length!==count)throw Error('Incomplete bounded distribution slice');values.forEach((logit,offset)=>{if(!Number.isFinite(logit))throw Error('Distribution values must be finite');const index=start+offset;denominator+=Math.exp(logit-maximum);if(index===selectedIndex)selectedLogit=logit;ranked.push({index,logit});ranked.sort((a,b)=>b.logit-a.logit||a.index-b.index);if(ranked.length>topK)ranked.pop();});}
  if(selectedLogit===undefined||!Number.isFinite(denominator)||denominator<=0)throw Error('Incomplete full-support distribution');
  const probability=(logit:number)=>Math.exp(logit-maximum)/denominator;
  const top=ranked.map(item=>({...item,probability:probability(item.logit)}));
  const shownMass=top.reduce((sum,item)=>sum+item.probability,0);
  return {size,maximum,denominator,top,shownMass,omittedMass:1-shownMass,selected:{index:selectedIndex,logit:selectedLogit,probability:probability(selectedLogit)}};
}

/** Stable softmax over every retained logit. Top-k is a view, never a new denominator. */
export function fullSupportDistribution(values:readonly number[],selectedIndex:number,topK=5):FullSupportDistribution{
  return fullSupportDistributionFromSlices(values.length,selectedIndex,(start,count)=>values.slice(start,start+count),topK);
}
