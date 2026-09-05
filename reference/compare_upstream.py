"""Compare the independent oracle to a locally supplied, hash-verified upstream file.

The original source is not vendored. Only its mathematical declarations are
executed: no dataset download, initialization, training loop, or sampling runs.
"""

import argparse
import ast
import hashlib
import json
import math
from pathlib import Path

from generate_fixture import INITIAL, generate

PINNED_SHA256 = 'd47d88c2fd432c8ebdc1048beab7f7eb64ea7e0e664e11b812d72a6d95ebccee'


def compare(path):
    source = Path(path).read_bytes()
    if hashlib.sha256(source).hexdigest() != PINNED_SHA256:
        raise ValueError('Upstream source hash does not match the pinned reference')
    tree = ast.parse(source)
    declarations = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.ClassDef))]
    namespace = {'math': math}
    exec(compile(ast.Module(body=declarations, type_ignores=[]), str(path), 'exec'), namespace)
    initial = json.loads(INITIAL.read_text())
    config = initial['config']
    namespace.update(n_layer=config['nLayer'], n_embd=config['nEmbd'], n_head=config['nHead'],
                     head_dim=config['nEmbd'] // config['nHead'])
    Value = namespace['Value']
    parameters = {name: [[Value(x) for x in row] for row in initial['parameters'][name]]
                  for name in initial['parameterOrder']}
    namespace['state_dict'] = parameters
    expected = generate(initial)
    checked = 0
    maximum_error = 0.0

    def assert_close(actual, wanted, label):
        nonlocal checked, maximum_error
        if isinstance(wanted, list):
            if len(actual) != len(wanted):
                raise AssertionError(f'{label}: shape mismatch')
            for index, (a, b) in enumerate(zip(actual, wanted)):
                assert_close(a, b, f'{label}[{index}]')
            return
        checked += 1
        maximum_error = max(maximum_error, abs(actual - wanted))
        if not math.isclose(actual, wanted, rel_tol=1e-12, abs_tol=1e-12):
            raise AssertionError(f'{label}: {actual!r} != {wanted!r}')

    def run(wanted):
        cache_k, cache_v = [[] for _ in range(config['nLayer'])], [[] for _ in range(config['nLayer'])]
        losses = []
        for pos, (token, target) in enumerate(zip(initial['tokenIds'], initial['targetIds'])):
            logits = namespace['gpt'](token, pos, cache_k, cache_v)
            probs = namespace['softmax'](logits)
            loss = -probs[target].log()
            losses.append(loss)
            assert_close([x.data for x in logits], wanted['positions'][pos]['logits'], 'logits')
            assert_close([x.data for x in probs], wanted['positions'][pos]['probabilities'], 'probabilities')
            assert_close(loss.data, wanted['positions'][pos]['loss'], 'loss')
        loss = (1 / len(losses)) * sum(losses)
        assert_close(loss.data, wanted['meanLoss'], 'meanLoss')
        return loss

    run(expected).backward()
    flattened = []
    for name, matrix in parameters.items():
        assert_close([[x.grad for x in row] for row in matrix], expected['gradients'][name], name + '.gradient')
        flattened.extend(x for row in matrix for x in row)
    # Execute upstream's actual optimizer update statements, not the oracle's Adam.
    training_loop = next(node for node in tree.body if isinstance(node, ast.For)
                         and isinstance(node.target, ast.Name) and node.target.id == 'step')
    update_assignment = next(node for node in training_loop.body if isinstance(node, ast.Assign)
                             and any(isinstance(t, ast.Name) and t.id == 'lr_t' for t in node.targets))
    update_loop = next(node for node in training_loop.body if isinstance(node, ast.For)
                      and isinstance(node.target, ast.Tuple))
    opt = initial['optimizer']
    namespace.update(params=flattened, m=list(opt['m']), v=list(opt['v']), step=opt['step'],
                     num_steps=opt['numSteps'], learning_rate=opt['learningRate'],
                     beta1=opt['beta1'], beta2=opt['beta2'], eps_adam=opt['epsilon'])
    exec(compile(ast.Module(body=[update_assignment, update_loop], type_ignores=[]), str(path), 'exec'), namespace)
    assert_close(namespace['m'], expected['adam']['mAfter'], 'adam.m')
    assert_close(namespace['v'], expected['adam']['vAfter'], 'adam.v')
    for name, matrix in parameters.items():
        assert_close([[x.data for x in row] for row in matrix], expected['postParameters'][name], name + '.post')
    run(expected['postUpdate'])
    return dict(sourceSha256=PINNED_SHA256, comparedScalars=checked,
                maximumAbsoluteError=maximum_error, absoluteTolerance=1e-12, relativeTolerance=1e-12)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('upstream_path', type=Path)
    arguments = parser.parse_args()
    print(json.dumps(compare(arguments.upstream_path), indent=2))
