"""Independent scalar mathematical oracle for Karpathy's pinned microgpt algorithm.

See PROVENANCE.md for the pin, attribution, comparison procedure, and deviations.
This module has no TypeScript, network, dataset, or random-number dependency.
"""

import math


class Scalar:
    """A number plus incoming derivative edges; repeated edges are intentional."""

    def __init__(self, data, edges=()):
        self.data = float(data)
        self.grad = 0.0
        self.edges = edges

    def __add__(self, other):
        other = scalar(other)
        return Scalar(self.data + other.data, ((self, 1.0), (other, 1.0)))

    __radd__ = __add__

    def __mul__(self, other):
        other = scalar(other)
        return Scalar(self.data * other.data, ((self, other.data), (other, self.data)))

    __rmul__ = __mul__

    def __pow__(self, exponent):
        derivative = exponent * self.data ** (exponent - 1)
        return Scalar(self.data ** exponent, ((self, derivative),))

    def __neg__(self):
        return self * -1

    def __sub__(self, other):
        return self + (-other)

    def __truediv__(self, other):
        return self * other ** -1

    def exp(self):
        result = math.exp(self.data)
        return Scalar(result, ((self, result),))

    def log(self):
        return Scalar(math.log(self.data), ((self, 1 / self.data),))

    def relu(self):
        return Scalar(max(0, self.data), ((self, float(self.data > 0)),))

    def backward(self):
        # Iterative depth-first postorder avoids a Python recursion-limit dependency.
        ordered, seen = [], set()
        pending = [(self, False)]
        while pending:
            node, expanded = pending.pop()
            if expanded:
                ordered.append(node)
            elif node not in seen:
                seen.add(node)
                pending.append((node, True))
                pending.extend((parent, False) for parent, _ in reversed(node.edges))
        self.grad = 1.0
        for node in reversed(ordered):
            for parent, derivative in node.edges:
                parent.grad += derivative * node.grad


def scalar(value):
    return value if isinstance(value, Scalar) else Scalar(value)


def numbers(vector):
    return [entry.data for entry in vector]


def linear(vector, matrix):
    output = []
    for row in matrix:
        total = 0
        for coefficient, entry in zip(row, vector):
            total = total + coefficient * entry
        output.append(total)
    return output


def rms_norm(vector):
    mean_square = sum(entry * entry for entry in vector) / len(vector)
    inverse_rms = (mean_square + 0.00001) ** -0.5
    return [entry * inverse_rms for entry in vector]


def softmax(vector):
    offset = max(entry.data for entry in vector)
    exponentials = [(entry - offset).exp() for entry in vector]
    denominator = sum(exponentials)
    return [entry / denominator for entry in exponentials]


def load_parameters(initial):
    return {name: [[Scalar(x) for x in row] for row in initial['parameters'][name]]
            for name in initial['parameterOrder']}


def parameter_values(parameters, attribute='data'):
    return {name: [[getattr(x, attribute) for x in row] for row in matrix]
            for name, matrix in parameters.items()}


def forward(initial, parameters):
    """Teacher-force one sequence, retaining connected K/V nodes across positions."""
    config = initial['config']
    width = config['nEmbd']
    head_width = width // config['nHead']
    keys = [[] for _ in range(config['nLayer'])]
    values = [[] for _ in range(config['nLayer'])]
    evidence, losses = [], []
    for position, (token, target) in enumerate(zip(initial['tokenIds'], initial['targetIds'])):
        token_embedding = parameters['wte'][token]
        position_embedding = parameters['wpe'][position]
        embedding_sum = [a + b for a, b in zip(token_embedding, position_embedding)]
        stream = rms_norm(embedding_sum)
        record = dict(position=position, tokenId=token, targetId=target,
                      tokenEmbedding=numbers(token_embedding),
                      positionEmbedding=numbers(position_embedding),
                      embeddingSum=numbers(embedding_sum), embeddingNorm=numbers(stream), layers=[])
        for layer in range(config['nLayer']):
            prefix = f'layer{layer}.'
            residual = stream
            normalized = rms_norm(stream)
            query = linear(normalized, parameters[prefix + 'attn_wq'])
            key = linear(normalized, parameters[prefix + 'attn_wk'])
            value = linear(normalized, parameters[prefix + 'attn_wv'])
            keys[layer].append(key)
            values[layer].append(value)
            layer_record = dict(layer=layer, preAttentionNorm=numbers(normalized),
                                q=numbers(query), k=numbers(key), v=numbers(value), heads=[])
            concatenated = []
            for head in range(config['nHead']):
                start = head * head_width
                query_slice = query[start:start + head_width]
                key_slices = [past[start:start + head_width] for past in keys[layer]]
                value_slices = [past[start:start + head_width] for past in values[layer]]
                scores = []
                for past in key_slices:
                    dot = sum(query_slice[j] * past[j] for j in range(head_width))
                    scores.append(dot / head_width ** 0.5)
                weights = softmax(scores)
                output = []
                for feature in range(head_width):
                    output.append(sum(weights[t] * value_slices[t][feature]
                                      for t in range(len(value_slices))))
                concatenated.extend(output)
                layer_record['heads'].append(dict(head=head, attentionLogits=numbers(scores),
                    attentionProbabilities=numbers(weights), headOutput=numbers(output)))
            projection = linear(concatenated, parameters[prefix + 'attn_wo'])
            stream = [a + b for a, b in zip(projection, residual)]
            layer_record.update(attentionOutput=numbers(concatenated),
                                attentionProjection=numbers(projection), attentionResidual=numbers(stream))
            residual = stream
            normalized = rms_norm(stream)
            up = linear(normalized, parameters[prefix + 'mlp_fc1'])
            activated = [entry.relu() for entry in up]
            down = linear(activated, parameters[prefix + 'mlp_fc2'])
            stream = [a + b for a, b in zip(down, residual)]
            layer_record.update(preMlpNorm=numbers(normalized), mlpUp=numbers(up),
                                mlpRelu=numbers(activated), mlpDown=numbers(down), mlpResidual=numbers(stream))
            record['layers'].append(layer_record)
        # The pinned organism has no final normalization here.
        logits = linear(stream, parameters['lm_head'])
        probabilities = softmax(logits)
        loss = -probabilities[target].log()
        losses.append(loss)
        record.update(logits=numbers(logits), probabilities=numbers(probabilities), loss=loss.data)
        evidence.append(record)
    mean_loss = (1 / len(losses)) * sum(losses)
    return evidence, mean_loss


def adam_step(initial, parameters):
    optimizer = initial['optimizer']
    step = optimizer['step']
    rate = optimizer['learningRate'] * (1 - step / optimizer['numSteps'])
    beta1, beta2 = optimizer['beta1'], optimizer['beta2']
    before_m, before_v = optimizer['m'], optimizer['v']
    result = dict(step=step, effectiveLearningRate=rate, mBefore=list(before_m), vBefore=list(before_v),
                  mAfter=[], vAfter=[], mHat=[], vHat=[], delta=[])
    flattened = [entry for matrix in parameters.values() for row in matrix for entry in row]
    for index, parameter in enumerate(flattened):
        first = beta1 * before_m[index] + (1 - beta1) * parameter.grad
        second = beta2 * before_v[index] + (1 - beta2) * parameter.grad ** 2
        corrected_first = first / (1 - beta1 ** (step + 1))
        corrected_second = second / (1 - beta2 ** (step + 1))
        update = rate * corrected_first / (corrected_second ** 0.5 + optimizer['epsilon'])
        before = parameter.data
        parameter.data -= update
        result['mAfter'].append(first)
        result['vAfter'].append(second)
        result['mHat'].append(corrected_first)
        result['vHat'].append(corrected_second)
        result['delta'].append(parameter.data - before)
        parameter.grad = 0.0
    return result
