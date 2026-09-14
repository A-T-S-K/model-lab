import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'research/pythia'))
from output import allocate_output

class NativeOutputTests(unittest.TestCase):
    def test_fresh_default_override_collision_and_failure_retention(self):
        root=Path(tempfile.mkdtemp(prefix='model-lab-native-output-')).resolve()
        first,write=allocate_output(root)
        write('partial.json','original')
        with self.assertRaises(FileExistsError):write('partial.json','bad')
        second,_=allocate_output(root)
        self.assertNotEqual(first,second)
        explicit,_=allocate_output(root,'test-results/scratch/explicit')
        before=sorted(p.name for p in explicit.iterdir())
        with self.assertRaises(FileExistsError):allocate_output(root,'test-results/scratch/explicit')
        self.assertEqual(before,sorted(p.name for p in explicit.iterdir()))
        self.assertEqual((first/'partial.json').read_text(),'original')
        self.assertFalse((first/'completion.json').exists())
        self.assertEqual(json.loads((first/'allocation.json').read_text())['status'],'allocated')
    def test_protected_traversal_and_symlink_refusal(self):
        root=Path(tempfile.mkdtemp(prefix='model-lab-native-output-')).resolve()
        protected=root/'test-results/old';protected.mkdir(parents=True);(protected/'sentinel').write_text('keep')
        for destination in ['test-results','test-results/old','test-results/scratch/../old']:
            with self.assertRaises((ValueError,FileExistsError)):allocate_output(root,destination)
        allocate_output(root)
        (root/'test-results/scratch/alias').symlink_to(protected)
        with self.assertRaises(FileExistsError):allocate_output(root,'test-results/scratch/alias')
        self.assertEqual([p.name for p in protected.iterdir()],['sentinel'])
        self.assertEqual((protected/'sentinel').read_text(),'keep')
        other=Path(tempfile.mkdtemp(prefix='model-lab-native-output-')).resolve()
        (other/'test-results').symlink_to(protected)
        with self.assertRaises(ValueError):allocate_output(other)
        self.assertEqual([p.name for p in protected.iterdir()],['sentinel'])

if __name__=='__main__':unittest.main()
