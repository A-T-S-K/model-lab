import { Value } from './value.js';

/** Parents precede their children; each shared node occurs exactly once. */
export function topologicalOrder(output: Value): Value[] {
  const visited = new Set<Value>();
  const ordered: Value[] = [];
  const stack: { value: Value; finish: boolean }[] = [{ value: output, finish: false }];
  while (stack.length) {
    const { value, finish } = stack.pop()!;
    if (finish) { ordered.push(value); continue; }
    if (visited.has(value)) continue;
    visited.add(value);
    stack.push({ value, finish: true });
    // Reverse push order preserves the reference's left-to-right DFS traversal.
    for (let i = value.parents.length - 1; i >= 0; i--) {
      stack.push({ value: value.parents[i], finish: false });
    }
  }
  return ordered;
}

/** Accumulate all paths into leaf gradients. Call zeroGrad before a new training graph. */
export function backward(output: Value): void {
  const ordered = topologicalOrder(output);
  // Intermediate adjoints belong to this backward pass, while leaf gradients accumulate.
  for (const value of ordered) if (value.parents.length) value.grad = 0;
  output.grad = 1;
  for (let i = ordered.length - 1; i >= 0; i--) {
    const value = ordered[i];
    value.parents.forEach((parent, j) => { parent.grad += value.localDerivatives[j] * value.grad; });
  }
}

export function zeroGrad(parameters: Iterable<Value>): void {
  for (const parameter of parameters) parameter.grad = 0;
}
