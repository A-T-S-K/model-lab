"""Offline oracle properties; optional upstream comparison is a separate command."""

import copy
import hashlib
import json
import math
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'reference'))
from generate_fixture import EXPECTED, INITIAL, encode, generate
from microgpt_reference import Scalar, forward, load_parameters


class ReferenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.initial = json.loads(INITIAL.read_text())
        cls.expected = json.loads(EXPECTED.read_text())

    def test_fixture_regenerates_byte_for_byte(self):
        self.assertEqual(encode(generate()), EXPECTED.read_text())

    def test_initial_numeric_state_is_bound_to_expected_evidence(self):
        self.assertEqual(hashlib.sha256(INITIAL.read_bytes()).hexdigest(),
                         self.expected['initialStateSha256'])
        self.assertEqual(self.expected['parameterCount'], 896)
        self.assertEqual(len(self.initial['optimizer']['m']), 896)
        self.assertEqual(len(self.initial['optimizer']['v']), 896)

    def test_bos_and_targets_are_authentic_shifted_document(self):
        config = self.initial['config']
        sequence = [config['bosTokenId']] + [config['vocabulary'].index(c)
                                           for c in self.initial['document']] + [config['bosTokenId']]
        self.assertEqual(self.initial['tokenIds'], sequence[:-1])
        self.assertEqual(self.initial['targetIds'], sequence[1:])

    def test_shared_scalar_paths_accumulate(self):
        x = Scalar(3)
        square = x * x
        result = square + square
        result.backward()
        self.assertEqual(x.grad, 12)

    def test_probabilities_normalize_and_future_positions_are_absent(self):
        for position, record in enumerate(self.expected['positions']):
            self.assertAlmostEqual(sum(record['probabilities']), 1, places=14)
            for layer in record['layers']:
                for head in layer['heads']:
                    self.assertEqual(len(head['attentionLogits']), position + 1)
                    self.assertEqual(len(head['attentionProbabilities']), position + 1)
                    self.assertAlmostEqual(sum(head['attentionProbabilities']), 1, places=14)

    def test_captured_loss_uses_target_probability(self):
        records = self.expected['positions']
        for record in records:
            self.assertEqual(record['loss'], -math.log(record['probabilities'][record['targetId']]))
        self.assertAlmostEqual(self.expected['meanLoss'], sum(p['loss'] for p in records) / len(records))

    def test_gradients_match_central_differences_including_reused_bos_embedding(self):
        # A BOS embedding at position zero receives later-position gradient via K/V.
        # The analytic gradient includes the full sequence graph.
        for name, row, col in [('wte', 3, 0), ('layer0.attn_wk', 1, 2),
                               ('layer0.attn_wv', 3, 4), ('layer0.mlp_fc1', 2, 1), ('lm_head', 0, 0)]:
            with self.subTest(parameter=(name, row, col)):
                losses = []
                for sign in [-1, 1]:
                    initial = copy.deepcopy(self.initial)
                    initial['parameters'][name][row][col] += sign * 1e-6
                    _, loss = forward(initial, load_parameters(initial))
                    losses.append(loss.data)
                numerical = (losses[1] - losses[0]) / 2e-6
                self.assertAlmostEqual(numerical, self.expected['gradients'][name][row][col], delta=1e-8)

    def test_adam_evidence_is_the_applied_update(self):
        index = 0
        adam = self.expected['adam']
        for name in self.initial['parameterOrder']:
            for row, values in enumerate(self.initial['parameters'][name]):
                for column, before in enumerate(values):
                    after = self.expected['postParameters'][name][row][column]
                    self.assertEqual(after - before, adam['delta'][index])
                    self.assertEqual(before + adam['delta'][index], after)
                    index += 1

    def test_post_update_reexecutes_the_identical_fixed_input(self):
        updated = copy.deepcopy(self.initial)
        updated['parameters'] = self.expected['postParameters']
        positions, loss = forward(updated, load_parameters(updated))
        self.assertEqual(positions, self.expected['postUpdate']['positions'])
        self.assertEqual(loss.data, self.expected['postUpdate']['meanLoss'])
        self.assertNotEqual(positions[-1]['probabilities'], self.expected['positions'][-1]['probabilities'])


if __name__ == '__main__':
    unittest.main()
