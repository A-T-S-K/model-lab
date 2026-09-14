"""Write the declared binding identity after source/profile changes, before qualification."""
import json
from pathlib import Path
from adapter import NativePythia, PROFILE
if __name__ == '__main__':
    model=NativePythia(); lock=model.lock
    profile={'profile':PROFILE,'runtime':model.runtime,'definition':'pythia-14m:'+lock['files']['config.json']['sha256'],
             'checkpoint':'sha256:'+lock['files']['model.safetensors']['sha256'],
             'inputTransform':model.input_transform, 'tokenizerSourceRevision':'sha256:'+lock['files']['tokenizer.json']['sha256'], 'sourceRevision':'sha256:'+model.source_digest,
             'binding':'native torch module hooks; no TransformerBridge, processing, provider fallback, remote code or pickle',
             'versions':{'python':'3.14.7','torch':'2.14.0','transformers':'5.17.0'},'modelRevision':lock['revision']}
    request={'version':1,'integration':'pythia-native-v1','profile':PROFILE,'requestId':'schema','sessionId':'schema','epoch':0,'action':'predict','input':'The cat sat'}
    capture=model.capture(request)['record']
    profile['tokenizerSize']=len(model.tokenizer)
    profile['captureSchema']=[{k:p[k] for k in ['id','node','port','invocation','phase','source','owners','dependencies','capabilities']} | {'axes':[{'role':a['role'],'space':a['space']} for a in p['axes']]} for p in capture['points']]
    (Path(__file__).parent/'profile.json').write_text(json.dumps(profile,indent=2)+'\n')
    print(json.dumps(profile))
