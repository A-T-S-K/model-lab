"""Read-only, full-precision conformance to canonical evidence (see PROVENANCE.md)."""

from dataclasses import dataclass
import json
import math

from generate_fixture import EXPECTED, generate

# Keep tiny optimizer moments meaningful: no unit-scale absolute-error allowance.
ABS_TOL = 1e-30
REL_TOL = 1e-12
# These subtrees describe inputs/identity, even if a future schema uses floats.
EXACT_FIELDS = frozenset(('config', 'reference', 'initialStateSha256', 'parameterOrder',
                         'tokenIds', 'targetIds'))


@dataclass
class Comparison:
    differing_floats: int = 0
    max_absolute_error: float = 0.0
    max_relative_error: float = 0.0
    max_absolute_path: str = '$'
    max_relative_path: str = '$'

    def summary(self):
        return (f'differing floats={self.differing_floats}; '
                f'max absolute error={self.max_absolute_error:.17g} at {self.max_absolute_path}; '
                f'max relative error={self.max_relative_error:.17g} at {self.max_relative_path}')


class ConformanceError(AssertionError):
    pass


def compare(expected, actual):
    """Exact types, ordered structure and identity; tolerance only for finite floats.

    Relative error uses abs(expected); a nonzero difference from zero is infinite.
    Visit all comparable numeric leaves so a failure includes global error maxima.
    """
    result = Comparison()
    first_failure = None

    def fail(path, reason):
        nonlocal first_failure
        if first_failure is None:
            first_failure = f'{path}: {reason}'

    def visit(left, right, path, exact=False):
        if type(left) is not type(right):
            fail(path, f'type mismatch: expected {type(left).__name__}, got {type(right).__name__}')
        elif isinstance(left, dict):
            if list(left) != list(right):
                fail(path, 'object keys/order mismatch')
            for key in left:
                if key in right:
                    visit(left[key], right[key], f'{path}[{json.dumps(key)}]',
                          exact or key in EXACT_FIELDS)
        elif isinstance(left, list):
            if len(left) != len(right):
                fail(path, f'array length mismatch: expected {len(left)}, got {len(right)}')
            for index, (a, b) in enumerate(zip(left, right)):
                visit(a, b, f'{path}[{index}]', exact)
        elif isinstance(left, float):
            if not math.isfinite(left) or not math.isfinite(right):
                fail(path, 'non-finite numerical evidence')
                return
            if left == right:
                return
            absolute = abs(left - right)
            relative = absolute / abs(left) if left else math.inf
            result.differing_floats += 1
            if absolute > result.max_absolute_error:
                result.max_absolute_error, result.max_absolute_path = absolute, path
            if relative > result.max_relative_error:
                result.max_relative_error, result.max_relative_path = relative, path
            limit = 0.0 if exact else ABS_TOL + REL_TOL * abs(left)
            if absolute > limit:
                fail(path, f'expected {left!r}, got {right!r}; absolute error={absolute:.17g}, '
                           f'relative error={relative:.17g}, allowed absolute error={limit:.17g}')
        elif left != right:
            # bool is deliberately distinct from int (and int from float) above.
            fail(path, f'exact value mismatch: expected {left!r}, got {right!r}')

    visit(expected, actual, '$')
    if first_failure:
        raise ConformanceError(f'{first_failure}\n{result.summary()}')
    return result


def main():
    print(f'Portable reference conformance: abs(error) <= {ABS_TOL:g} + {REL_TOL:g} * abs(canonical)')
    try:
        result = compare(json.loads(EXPECTED.read_text()), generate())
    except ConformanceError as error:
        raise SystemExit(f'FAIL: {error}') from error
    print(f'PASS: exact structure/identity and strict numerical conformance; {result.summary()}')


if __name__ == '__main__':
    main()
