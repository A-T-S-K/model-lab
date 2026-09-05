"""Regenerate canonical.expected.json from committed numeric state, offline."""

import argparse
import hashlib
import json
from pathlib import Path

from microgpt_reference import adam_step, forward, load_parameters, parameter_values

ROOT = Path(__file__).resolve().parents[1]
INITIAL = ROOT / 'fixtures/canonical.initial.json'
EXPECTED = ROOT / 'fixtures/canonical.expected.json'


def encode(value):
    return json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n'


def generate(initial=None):
    if initial is None:
        initial = json.loads(INITIAL.read_text())
    parameters = load_parameters(initial)
    positions, loss = forward(initial, parameters)
    loss.backward()
    gradients = parameter_values(parameters, 'grad')
    adam = adam_step(initial, parameters)
    post_parameters = parameter_values(parameters)
    post_positions, post_loss = forward(initial, parameters)
    return dict(formatVersion=1, reference=initial['reference'],
                initialStateSha256=hashlib.sha256(encode(initial).encode()).hexdigest(),
                parameterCount=sum(len(row) for matrix in parameters.values() for row in matrix),
                positions=positions, meanLoss=loss.data, gradients=gradients, adam=adam,
                postParameters=post_parameters,
                postUpdate=dict(positions=post_positions, meanLoss=post_loss.data))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='fail if committed output differs byte-for-byte')
    arguments = parser.parse_args()
    output = encode(generate())
    if arguments.check:
        if not EXPECTED.exists() or EXPECTED.read_text() != output:
            raise SystemExit('FAIL: canonical.expected.json differs from regenerated evidence')
        print('PASS: canonical.expected.json regenerates byte-for-byte')
    else:
        EXPECTED.write_text(output)
        print(f'Wrote {EXPECTED}')
