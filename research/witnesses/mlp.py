"""Readable deterministic float32 regression: affine → ReLU → affine, MSE, SGD.
No persistent server model is mutated. Each request produces a disposable result state.
"""
import torch

PARAMETERS = {'w1': [[0.25, -0.5], [0.75, 0.125], [-0.25, 0.5]],
              'b1': [0.125, -0.25, 0.25], 'w2': [[0.5, -0.25, 0.75]], 'b2': [-0.125]}


def initial_state():
    return {'version': 1, 'parameters': PARAMETERS, 'optimizer': {'family': 'SGD', 'learningRate': 0.0625,
            'momentum': 0, 'step': 0, 'schedule': 'constant', 'datasetCursor': 0, 'rngState': None}}


def execute(values, targets, state, train):
    x = torch.tensor(values, dtype=torch.float32, requires_grad=True)
    y = torch.tensor(targets, dtype=torch.float32)
    parameters = {name: torch.tensor(data, dtype=torch.float32, requires_grad=True)
                  for name, data in state['parameters'].items()}
    before = {name: p.detach().clone() for name, p in parameters.items()}
    hidden_pre = x @ parameters['w1'].T + parameters['b1']
    hidden = torch.relu(hidden_pre)
    prediction = hidden @ parameters['w2'].T + parameters['b2']
    squared_error = (prediction - y).square()
    loss = squared_error.mean()
    observations = {'inputs': x, 'targets': y, 'hidden.pre': hidden_pre, 'hidden': hidden,
                    'prediction': prediction, 'squared.error': squared_error, 'loss': loss}
    if train:
        loss.backward()
        observations['input.gradient'] = x.grad
        for name, parameter in parameters.items():
            observations[name + '.gradient'] = parameter.grad.detach().clone()
        # Explicit SGD, no momentum, clipping, schedule decay or hidden optimizer state.
        with torch.no_grad():
            for parameter in parameters.values():
                parameter.add_(parameter.grad, alpha=-state['optimizer']['learningRate'])
    for name, parameter in parameters.items():
        observations[name + '.before'] = before[name]
        observations[name + '.after'] = parameter.detach().clone()
        observations[name + '.delta'] = parameter.detach() - before[name]
    with torch.no_grad():
        observations['prediction.after'] = torch.relu(x @ parameters['w1'].T + parameters['b1']) @ parameters['w2'].T + parameters['b2']
    optimizer = dict(state['optimizer'])
    if train:
        optimizer['step'] += 1
        optimizer['datasetCursor'] += len(values)
    resulting = {'version': 1, 'parameters': {name: p.detach().tolist() for name, p in parameters.items()}, 'optimizer': optimizer}
    return observations, resulting
