"""Copy the complete tracked Model Lab repository, then install/test/build without Git metadata."""
import pathlib
import shutil
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parents[1]

tracked = subprocess.check_output(
    ['git', 'ls-files', '-z'],
    cwd=root,
).decode().split('\0')
paths = [path for path in tracked if path]

if not paths:
    raise SystemExit('No tracked Model Lab files found.')

untracked = subprocess.check_output(
    ['git', 'ls-files', '--others', '--exclude-standard'],
    cwd=root,
).decode().strip()

if untracked:
    raise SystemExit(
        'Untracked files would be omitted; stage or remove them first:\n' + untracked
    )

destination = pathlib.Path(tempfile.mkdtemp(prefix='model-lab-isolation-'))

for relative in paths:
    source = root / relative
    target = destination / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)

print('Isolated source copy:', destination, flush=True)

identity_command = [
    'node',
    '--input-type=module',
    '-e',
    "import { runtimeIdentity } from './scripts/runtime-identity.mjs'; "
    "console.log((await runtimeIdentity(process.cwd())).revision)",
]

original_revision = subprocess.check_output(
    identity_command,
    cwd=root,
    text=True,
).strip()

isolated_revision = subprocess.check_output(
    identity_command,
    cwd=destination,
    text=True,
).strip()

if original_revision != isolated_revision:
    raise SystemExit('Isolated runtime identity differs from repository source')

for command in [
    ['npm', 'ci'],
    ['npm', 'run', 'test:reference'],
    ['npm', 'test'],
    ['npm', 'run', 'example'],
    ['npm', 'run', 'build'],
    ['npm', 'run', 'test:browser'],
]:
    subprocess.run(command, cwd=destination, check=True)

generated = (destination / 'runtime/revision.ts').read_text()

if f'"{original_revision}"' not in generated:
    raise SystemExit('Isolated build did not embed the exact source runtime identity')

print('PASS isolated install, reference, unit/conformance, production build, browser')
print('PASS isolated runtime identity:', original_revision)
