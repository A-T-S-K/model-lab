"""Test-output ownership only; importing this module never imports/loads a model."""
import json
import os
from pathlib import Path
import tempfile


def allocate_output(root, destination=None):
    root = Path(root).resolve()
    scratch = root / 'test-results/scratch'
    if destination is not None:
        raw = str(destination)
        if not raw or '\\' in raw or any(p in ('.', '..') for p in raw.split('/')):
            raise ValueError('Unsafe output path')
        requested = Path(os.path.abspath(root / raw))
        if requested.parent != scratch or not requested.name[0].isalnum():
            raise ValueError('Output must be a fresh immediate child of test-results/scratch')
    else:
        requested = None
    for directory in (scratch.parent, scratch):
        directory.mkdir(mode=0o700, exist_ok=True)
        if directory.is_symlink() or directory.resolve() != directory:
            raise ValueError('Output symlink refused')
    if requested is None:
        directory = Path(tempfile.mkdtemp(prefix='native-', dir=scratch))
    else:
        requested.mkdir(mode=0o700)  # Existing paths fail; no cleanup/reuse.
        directory = requested
    identity = directory.stat()

    def write(name, data):
        if not name or Path(name).name != name or '\\' in name or name in ('.', '..'):
            raise ValueError('Unsafe output filename')
        if directory.is_symlink() or directory.resolve() != directory:
            raise ValueError('Output symlink refused')
        now = directory.stat()
        if (now.st_dev, now.st_ino) != (identity.st_dev, identity.st_ino):
            raise ValueError('Output ownership changed')
        fd = os.open(directory / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'w') as stream:
            stream.write(data)
    write('allocation.json', json.dumps({'directory': str(directory), 'status': 'allocated'}) + '\n')
    return directory, write
