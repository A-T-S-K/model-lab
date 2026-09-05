/** A number plus the local chain-rule information needed for reverse-mode autodiff. */
export class Value {
  grad = 0;

  constructor(
    public data: number,
    public readonly operation = 'leaf',
    public readonly parents: readonly Value[] = [],
    public readonly localDerivatives: readonly number[] = [],
  ) {}

  add(other: Value | number): Value {
    const right = asValue(other);
    return new Value(this.data + right.data, 'add', [this, right], [1, 1]);
  }

  mul(other: Value | number): Value {
    const right = asValue(other);
    return new Value(this.data * right.data, 'multiply', [this, right], [right.data, this.data]);
  }

  pow(exponent: number): Value {
    return new Value(this.data ** exponent, 'power', [this], [exponent * this.data ** (exponent - 1)]);
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

  neg(): Value { return this.mul(-1); }
  sub(other: Value | number): Value { return this.add(asValue(other).neg()); }
  div(other: Value | number): Value { return this.mul(asValue(other).pow(-1)); }
}

export function asValue(value: Value | number): Value {
  return value instanceof Value ? value : new Value(value);
}

export function sum(values: readonly Value[]): Value {
  return values.reduce((total, value) => total.add(value), new Value(0));
}
