export interface RankedOutput {index:number;logit:number;probability:number}
export interface FullSupportDistribution {
  size:number;maximum:number;denominator:number;top:readonly RankedOutput[];
  shownMass:number;omittedMass:number;selected:RankedOutput;
}

/** Stable softmax over every retained logit. Top-k is a view, never a new denominator. */
export function fullSupportDistribution(values:readonly number[],selectedIndex:number,topK=5):FullSupportDistribution{
  if(!Number.isSafeInteger(selectedIndex)||selectedIndex<0||selectedIndex>=values.length)throw Error('Output index out of bounds');
  let maximum=-Infinity;for(const value of values)maximum=Math.max(maximum,value);
  let denominator=0;const ranked:{index:number;logit:number}[]=[];
  values.forEach((logit,index)=>{denominator+=Math.exp(logit-maximum);ranked.push({index,logit});ranked.sort((a,b)=>b.logit-a.logit);if(ranked.length>topK)ranked.pop();});
  const probability=(logit:number)=>Math.exp(logit-maximum)/denominator;
  const top=ranked.map(item=>({...item,probability:probability(item.logit)}));
  const shownMass=top.reduce((sum,item)=>sum+item.probability,0),logit=values[selectedIndex]!;
  return {size:values.length,maximum,denominator,top,shownMass,omittedMass:1-shownMass,selected:{index:selectedIndex,logit,probability:probability(logit)}};
}
