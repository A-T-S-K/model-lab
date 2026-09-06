"""Diagnostic only: trace/replay transcendental results without editing the oracle."""
import ast
import json
import math
import operator
from pathlib import Path
import sys
import types

root, output = Path(sys.argv[1]), Path(sys.argv[2])
sys.path.insert(0, str(root / 'reference'))
replay = json.loads(Path(sys.argv[3]).read_text()) if len(sys.argv) > 3 else None
calls, differences = [], []
functions = {'pow': operator.pow, 'exp': math.exp, 'log': math.log}
def probe(name, *args):
    if any(type(arg) not in (int, float) for arg in args):
        return functions[name](*args)
    result = functions[name](*args)
    if replay is not None:
        expected = replay[len(calls)]
        assert [name, list(args)] == expected[:2], (len(calls), name, args, expected)
        if result != expected[2]:
            differences.append(dict(call=len(calls), operation=name, args=args,
                                    canonical=expected[2], linux=result,
                                    absolute=abs(result-expected[2])))
        result = expected[2]
    calls.append([name, list(args), result])
    return result
class Instrument(ast.NodeTransformer):
    def visit_BinOp(self, node):
        self.generic_visit(node)
        if isinstance(node.op, ast.Pow):
            return ast.copy_location(ast.Call(func=ast.Name(id='probe', ctx=ast.Load()),
                args=[ast.Constant('pow'), node.left, node.right], keywords=[]), node)
        return node
    def visit_Call(self, node):
        self.generic_visit(node)
        if (isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name)
                and node.func.value.id == 'math' and node.func.attr in ('exp', 'log')):
            return ast.copy_location(ast.Call(func=ast.Name(id='probe', ctx=ast.Load()),
                args=[ast.Constant(node.func.attr)] + node.args, keywords=[]), node)
        return node
module = types.ModuleType('microgpt_reference')
module.probe = probe
source = root / 'reference/microgpt_reference.py'
exec(compile(ast.fix_missing_locations(Instrument().visit(ast.parse(source.read_text()))), str(source), 'exec'), module.__dict__)
sys.modules['microgpt_reference'] = module
from generate_fixture import generate, encode, EXPECTED
result = encode(generate())
output.with_suffix('.json').write_text(result)
output.with_suffix('.calls.json').write_text(json.dumps(calls))
output.with_suffix('.differences.json').write_text(json.dumps(differences, indent=2))
if replay is not None:
    assert len(calls) == len(replay)
    assert result == EXPECTED.read_text(), 'Replay did not reproduce canonical bytes'
print(json.dumps(dict(calls=len(calls), different_operations=len(differences), canonical_bytes=result == EXPECTED.read_text())))
