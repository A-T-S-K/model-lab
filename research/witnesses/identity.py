"""Generate binding metadata from the actual registered witness, before qualification."""
import json
from pathlib import Path
from adapter import capture, runtime, initial_state
from fixtures import fixture_record
if __name__=='__main__':
    request={'version':2,'integration':'mlp-native-v1','profile':'mlp-f32-sgd-v1','requestId':'schema','sessionId':'schema','epoch':0,'action':'train','input':{'kind':'numeric','values':[[1.,2.],[-1.,0.5]],'targets':[[0.5],[-0.25]]},'state':None}
    r=capture(request)
    def metadata(p):return {k:v for k,v in p.items() if k not in ['values','shape','axes']}|{'axes':[{'role':a['role'],'space':a['space']} for a in p['axes']]}
    profile={'runtime':runtime(),'initial':initial_state(),'schema':[metadata(p) for p in r['record']['run']['points']], 'fixtures':{k:fixture_record(k)['record'] for k in ['grouped','shape','opaque']}}
    (Path(__file__).parent/'profile.json').write_text(json.dumps(profile,indent=2)+'\n')
    print(runtime())
