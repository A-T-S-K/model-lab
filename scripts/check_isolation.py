"""Copy only tracked Model Lab sources, then install/test/build without siblings."""
import pathlib
import shutil
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parents[2]
tracked = subprocess.check_output(
    ['git', 'ls-files', '-z', '--', 'model-lab/'], cwd=root
).decode().split('\0')
paths = [path for path in tracked if path]
if not paths:
    raise SystemExit('Stage Model Lab sources before the tracked-source isolation check.')
untracked = subprocess.check_output(
    ['git', 'ls-files', '--others', '--exclude-standard', '--', 'model-lab/'], cwd=root
).decode().strip()
if untracked:
    raise SystemExit('Untracked sources would be omitted; stage them first:\n' + untracked)
destination = pathlib.Path(tempfile.mkdtemp(prefix='model-lab-isolation-'))
for relative in paths:
    source = root / relative
    target = destination / pathlib.Path(relative).relative_to('model-lab')
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
print('Isolated source copy:', destination, flush=True)
for command in [
    ['npm', 'ci'],
    ['npm', 'run', 'test:reference'],
    ['npm', 'test'],
    ['npm', 'run', 'build'],
    ['npm', 'run', 'test:browser'],
]:
    subprocess.run(command, cwd=destination, check=True)
print('PASS isolated install, reference, unit/conformance, production build, browser')
