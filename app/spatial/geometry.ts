/** Exact local span of complete Q/K vectors. Screen coordinates share one scale. */
export function qkGeometry(q: readonly number[], k: readonly number[], radius = 130) {
  if (!q.length || q.length !== k.length || ![...q, ...k, radius].every(Number.isFinite) || radius <= 0)
    throw new Error("Q/K geometry requires equal, finite complete vectors and a positive radius");
  const qNorm = Math.hypot(...q), kNorm = Math.hypot(...k);
  const dot = q.reduce((sum, value, i) => sum + value * k[i]!, 0);
  const x = qNorm === 0 ? kNorm : dot / qNorm;
  const residual = kNorm * kNorm - x * x;
  const tolerance = 64 * Number.EPSILON * Math.max(kNorm * kNorm, x * x);
  if (residual < -tolerance) throw new Error("Q/K span residual exceeds floating-point roundoff");
  const y = qNorm === 0 ? 0 : Math.sqrt(Math.max(0, residual));
  const scale = Math.max(qNorm, kNorm) === 0 ? 1 : radius / Math.max(qNorm, kNorm);
  return { qNorm, kNorm, dot, scale, q: [qNorm, 0] as const, k: [x, y] as const,
    angle: qNorm === 0 || kNorm === 0 ? undefined : Math.acos(Math.max(-1, Math.min(1, dot / qNorm / kNorm))) * 180 / Math.PI,
    state: qNorm === 0 || kNorm === 0 ? "zero vector · angle undefined" : y <= Math.sqrt(tolerance) ? "collinear" : "exact two-vector span" };
}

const dot = (a: readonly number[], b: readonly number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0);
/** Affine basis uses every original point. Rank >3 uses a declared fixed coordinate projection. */
export function affineMixture(points: readonly (readonly number[])[], weights: readonly number[]) {
  const width = points[0]?.length ?? 0;
  if (!width || points.length !== weights.length || points.some(p => p.length !== width || !p.every(Number.isFinite)) ||
      weights.some(w => !Number.isFinite(w) || w < 0) || Math.abs(weights.reduce((s,w)=>s+w,0)-1) > 1e-12)
    throw new Error("Mixture needs complete finite points and normalized nonnegative weights");
  const origin = [...points[0]], differences = points.map(p => p.map((x,i)=>x-origin[i]));
  const magnitude = Math.max(...differences.map(p=>Math.hypot(...p)));
  const tolerance = 64 * Number.EPSILON * Math.max(width, points.length) * magnitude;
  const basis: number[][] = [];
  for (const difference of differences) {
    const residual = [...difference];
    // Reorthogonalization avoids classifying rounding error as a new affine dimension.
    for (let pass=0; pass<2; pass++) for (const axis of basis) {
      const coefficient = dot(residual,axis);
      residual.forEach((x,i)=>residual[i]=x-coefficient*axis[i]);
    }
    const norm = Math.hypot(...residual);
    if (norm > tolerance) basis.push(residual.map(x=>x/norm));
  }
  const rank = basis.length, exact = rank <= 3;
  const displayBasis = exact ? basis : Array.from({length:Math.min(3,width)},(_,i)=>Array.from({length:width},(_,j)=>Number(i===j)));
  const coordinates = differences.map(p => Array.from({length:3},(_,i)=>displayBasis[i] ? dot(p,displayBasis[i]) : 0));
  const mixture = Array.from({length:width},(_,i)=>points.reduce((s,p,j)=>s+weights[j]*p[i],0));
  const point = Array.from({length:3},(_,i)=>coordinates.reduce((s,p,j)=>s+weights[j]*p[i],0));
  return {rank, exact, origin, basis:displayBasis, coordinates, point, mixture,
    description: exact ? `Exact affine span · rank ${rank}. Basis fitted to this source only; not a cross-run comparison.` : `Affine rank ${rank} · fixed original components 0,1,2 projected; all ${points.length} contributors retained.`};
}
export const tetrahedron = [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]] as const;
export function probabilitySimplex(probabilities: readonly number[]) {
  if (probabilities.length !== 4 || probabilities.some(p=>!Number.isFinite(p)||p<0||p>1) || Math.abs(probabilities.reduce((s,p)=>s+p,0)-1)>1e-12)
    throw new Error("The four-class simplex requires an actual normalized probability vector");
  return {vertices:tetrahedron, point:[0,1,2].map(i=>probabilities.reduce((s,p,j)=>s+p*tetrahedron[j][i],0))};
}
/** Fixed orthographic view of 3D geometry; screen distances are not original distances. */
export function project3(point: readonly number[]) { return [point[0] - .55*point[2], -point[1] + .35*point[2]] as const; }
/** Accepted cividis-derived sequential ramp. Invalid probabilities stay unavailable. */
export function probabilityColor(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value) || value < 0 || value > 1) return "#667078";
  const stops = [[0,34,78],[67,78,108],[125,124,120],[188,174,108],[254,232,56]];
  const index = Math.min(3,Math.floor(value*4)), t = value*4-index;
  return `rgb(${stops[index].map((x,i)=>Math.round(x+(stops[index+1][i]-x)*t)).join(",")})`;
}
