"""Byte provenance for the canonical environment documented in PROVENANCE.md."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'reference'))
from generate_fixture import EXPECTED, encode, generate


class CanonicalTests(unittest.TestCase):
    def test_fixture_regenerates_byte_for_byte(self):
        self.assertEqual(encode(generate()), EXPECTED.read_text())
