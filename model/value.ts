/** A number plus the local chain-rule information needed for reverse-mode autodiff. */
export class Value {
  grad = 0;

  constructor(
    public data: number,
    public readonly operation = 'leaf',
    public readonly parents: readonly Value[] = [],
    public readonly localDerivatives: readonly number[] = [],
    public readonly detail: { constant?: string; exponent?: number; negativeSlope?: number } = {},
  ) {}

  static constant(data: number, description = 'numeric literal'): Value {
    return new Value(data, 'leaf', [], [], { constant: description });
  }

  add(other: Value | number): Value {
    const right = asValue(other);
    return new Value(this.data + right.data, 'add', [this, right], [1, 1]);
  }

  mul(other: Value | number): Value {
    const right = asValue(other);
    return new Value(this.data * right.data, 'multiply', [this, right], [right.data, this.data]);
  }

  pow(exponent: number): Value {
    return new Value(this.data ** exponent, 'power', [this], [exponent * this.data ** (exponent - 1)], { exponent });
  }

  log(): Value {
    return new Value(Math.log(this.data), 'log', [this], [1 / this.data]);
  }

  exp(): Value {
    const result = Math.exp(this.data);
    return new Value(result, 'exp', [this], [result]);
  }

  relu(): Value {
    return new Value(Math.max(0, this.data), 'relu', [this], [this.data > 0 ? 1 : 0]);
  }

  /** f(x) = x when x > 0, otherwise negativeSlope * x.
   * The explicit `otherwise` branch makes the derivative at zero negativeSlope.
   */
  leakyRelu(negativeSlope: number): Value {
    if (!Number.isFinite(negativeSlope) || negativeSlope <= 0 || negativeSlope >= 1) {
      throw new RangeError('Leaky ReLU negative slope must be finite and strictly between zero and one');
    }
    const positive = this.data > 0;
    return new Value(positive ? this.data : negativeSlope * this.data, 'leaky_relu', [this],
      [positive ? 1 : negativeSlope], { negativeSlope });
  }

  neg(): Value { return this.mul(-1); }
  sub(other: Value | number): Value { return this.add(asValue(other).neg()); }
  div(other: Value | number): Value { return this.mul(asValue(other).pow(-1)); }
}

export function asValue(value: Value | number): Value {
  return value instanceof Value ? value : Value.constant(value);
}

export function sum(values: readonly Value[]): Value {
  return values.reduce((total, value) => total.add(value), Value.constant(0, 'sum initial value'));
}
