"""Adversarial checks for the portable contract, independent of native libm."""
import copy
import json
import math
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'reference'))
from generate_fixture import EXPECTED, INITIAL
from portable_conformance import ABS_TOL, REL_TOL, ConformanceError, compare


class PortableTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.canonical = json.loads(EXPECTED.read_text())

    def test_measured_linux_differences_are_accepted_and_reported(self):
        actual = copy.deepcopy(self.canonical)
        # Full-precision observations from Ubuntu 24.04/CPython 3.12.14; PORTABILITY.md.
        actual['adam']['vAfter'][150] = 1.0420139414392545e-11
        actual['adam']['vHat'][150] = 1.0420139414392535e-09
        result = compare(self.canonical, actual)
        self.assertEqual(result.differing_floats, 2)
        self.assertEqual(result.max_absolute_error, 2.0679515313825692e-25)
        self.assertEqual(result.max_relative_error, 1.984571846060205e-16)
        self.assertEqual(result.max_absolute_path, '$["adam"]["vHat"][150]')
        self.assertEqual(result.max_relative_path, result.max_absolute_path)

    def test_meaningful_drift_in_large_and_tiny_values_is_rejected(self):
        for key, index in [('mHat', 10), ('vAfter', 150)]:
            with self.subTest(key=key):
                actual = copy.deepcopy(self.canonical)
                actual['adam'][key][index] *= 1.000001
                with self.assertRaises(ConformanceError) as caught:
                    compare(self.canonical, actual)
                message = str(caught.exception)
                self.assertIn(f'$["adam"]["{key}"][{index}]', message)
                self.assertIn('absolute error=', message)
                self.assertIn('relative error=', message)
                self.assertIn('max absolute error=', message)

    def test_tolerance_boundary_and_zero_floor(self):
        compare(1.0, 1.0 + REL_TOL / 2)
        with self.assertRaises(ConformanceError):
            compare(1.0, 1.0 + 2 * REL_TOL)
        compare(0.0, ABS_TOL)
        with self.assertRaises(ConformanceError):
            compare(0.0, 2 * ABS_TOL)

    def test_structure_keys_and_array_order_are_exact(self):
        for change in ('missing', 'extra', 'keys', 'length', 'order', 'parameters'):
            with self.subTest(change=change):
                actual = copy.deepcopy(self.canonical)
                if change == 'missing': del actual['meanLoss']
                elif change == 'extra': actual['extra'] = None
                elif change == 'keys': actual = dict(reversed(list(actual.items())))
                elif change == 'length': actual['positions'].pop()
                elif change == 'order': actual['positions'].reverse()
                elif change == 'parameters':
                    actual['gradients'] = dict(reversed(list(actual['gradients'].items())))
                with self.assertRaises(ConformanceError): compare(self.canonical, actual)

    def test_integer_identity_and_configuration_are_exact(self):
        for field in ('parameterCount', 'initialStateSha256', 'targetId', 'tokenId', 'step'):
            with self.subTest(field=field):
                actual = copy.deepcopy(self.canonical)
                if field == 'initialStateSha256': actual[field] = '0' * 64
                elif field in ('targetId', 'tokenId'): actual['positions'][0][field] += 1
                elif field == 'step': actual['adam'][field] += 1
                else: actual[field] += 1
                with self.assertRaises(ConformanceError): compare(self.canonical, actual)
        # Floating input configuration is exact too; no tolerance at identity boundaries.
        with self.assertRaises(ConformanceError):
            compare({'config': {'rate': 0.01}}, {'config': {'rate': math.nextafter(0.01, 1.0)}})
        for expected, actual in [(1, True), (1, 1.0), (None, False), ('observed', 'derived'),
                                 (10**15, 10**15 + 1),
                                 ({'parameterOrder': ['wte', 'wpe']}, {'parameterOrder': ['wpe', 'wte']})]:
            with self.subTest(expected=expected):
                with self.assertRaises(ConformanceError): compare(expected, actual)

    def test_nonfinite_values_are_never_evidence(self):
        for value in (math.nan, math.inf, -math.inf):
            with self.subTest(value=value):
                with self.assertRaises(ConformanceError): compare(0.0, value)
                with self.assertRaises(ConformanceError): compare(value, value)

    def test_failure_reports_global_maximum_even_after_first_failure(self):
        with self.assertRaises(ConformanceError) as caught:
            compare([1.0, 1.0], [1.1, 2.0])
        self.assertIn('$[0]', str(caught.exception))
        self.assertIn('max absolute error=1 at $[1]', str(caught.exception))
        self.assertIn('differing floats=2', str(caught.exception))

    def test_cli_and_comparison_leave_canonical_evidence_untouched(self):
        paths = [INITIAL, EXPECTED]
        before = [(p.read_bytes(), p.stat().st_mtime_ns) for p in paths]
        original = copy.deepcopy(self.canonical)
        compare(self.canonical, copy.deepcopy(self.canonical))
        result = subprocess.run([sys.executable, 'reference/portable_conformance.py'],
                                cwd=ROOT, capture_output=True, text=True, check=True)
        self.assertIn('PASS: exact structure/identity', result.stdout)
        self.assertIn('max absolute error=', result.stdout)
        self.assertEqual(self.canonical, original)
        self.assertEqual(before, [(p.read_bytes(), p.stat().st_mtime_ns) for p in paths])
