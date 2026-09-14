"""Compare the adapter against a separately authored torch.nn / torch.optim path."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'pythia'))
from output import allocate_output
out,write=allocate_output(Path(__file__).resolve().parents[2])
# Allocate before native imports/loading. Never reuse a prior evidence destination.
sys.path.insert(0,str(Path(__file__).resolve().parent))
import json
import torch
from adapter import capture, validate_request, runtime
from fixtures import fixture_record, grouped

def reference(values, targets, state=None, train=True):
    # Deliberately bypass mlp.execute, its observations, and adapter expected values.
    network=torch.nn.Sequential(torch.nn.Linear(2,3),torch.nn.ReLU(),torch.nn.Linear(3,1)).float()
    original={'w1':[[.25,-.5],[.75,.125],[-.25,.5]],'b1':[.125,-.25,.25],'w2':[[.5,-.25,.75]],'b2':[-.125]}
    params=state['parameters'] if state else original
    names=['w1','b1','w2','b2']
    with torch.no_grad():
        for name,p in zip(names,network.parameters()):p.copy_(torch.tensor(params[name]))
    x=torch.tensor(values,dtype=torch.float32,requires_grad=True)
    y=torch.tensor(targets,dtype=torch.float32)
    optimizer=torch.optim.SGD(network.parameters(),lr=.0625,momentum=0)
    before={name:p.detach().clone() for name,p in zip(names,network.parameters())}
    pre=network[0](x);hidden=network[1](pre);prediction=network[2](hidden)
    loss=torch.nn.functional.mse_loss(prediction,y,reduction='mean')
    expected={'inputs':x,'targets':y,'hidden.pre':pre,'hidden':hidden,'prediction':prediction,'loss':loss,'squared.error':(prediction-y)**2}
    if train:
        loss.backward()
        expected['input.gradient']=x.grad
        expected.update({name+'.gradient':p.grad.detach().clone() for name,p in zip(names,network.parameters())})
        optimizer.step()
    for name,p in zip(names,network.parameters()):
        expected[name+'.before']=before[name];expected[name+'.after']=p.detach().clone();expected[name+'.delta']=p.detach()-before[name]
    expected['prediction.after']=network(x)
    return {name:t.detach().flatten() for name,t in expected.items()}

request={'version':2,'integration':'mlp-native-v1','profile':'mlp-f32-sgd-v1','requestId':'train','sessionId':'qualified-mlp','epoch':0,'action':'train','input':{'kind':'numeric','values':[[1.,2.],[-1.,.5]],'targets':[[.5],[-.25]]},'state':None}
comparisons=[]
for name,action,state in [('predict','predict',None),('train','train',None),('resume','train','previous')]:
    r={**request,'requestId':name,'action':action,'state':previous if state else None}
    result=capture(r);expected=reference(r['input']['values'],r['input']['targets'],r['state'],action=='train')
    for p in result['record']['run']['points']:
        actual=torch.tensor(p['values'],dtype=torch.float32);wanted=expected[p['id']]
        torch.testing.assert_close(actual,wanted,atol=1e-7,rtol=1e-6)
        comparisons.append({'run':name,'point':p['id'],'maxAbs':float((actual-wanted).abs().max())})
    previous=json.loads(json.dumps(result['record']['resulting']))
    write(name+'.json',json.dumps(result,allow_nan=False))
# The exact supported state survives serialization and produces the same next update.
r={**request,'requestId':'state-roundtrip','state':previous}
a=capture(r);b=capture(json.loads(json.dumps(r)))
assert a==b
rejected=0
for mutate in [lambda r:r['state']['optimizer'].update(momentum=.9),lambda r:r['state']['optimizer'].update(rngState=123),lambda r:r['state']['parameters']['w1'][0].append(0),lambda r:r['input']['values'][0].append(0),lambda r:r.update(action='adam')]:
    bad=json.loads(json.dumps(r));mutate(bad)
    try:validate_request(bad)
    except ValueError:rejected+=1
    else:raise AssertionError('Malformed request accepted')
# Independent scalar-loop reference for selected grouped values and all four heads.
import math
actual=grouped()
for head,kv in enumerate([0,0,1,1]):
    scores=[sum(float(actual['query'][head,j])*float(actual['key'][kv,k,j]) for j in range(2))/math.sqrt(2) for k in range(2)]
    weights=[math.exp(s-max(scores)) for s in scores];weights=[v/sum(weights) for v in weights]
    for feature in range(2):
        wanted=sum(weights[k]*float(actual['value'][kv,k,feature]) for k in range(2))
        assert abs(float(actual['output'][head,feature])-wanted)<1e-6
assert not torch.equal(grouped([1,1,0,0])['output'],actual['output'])
for mapping in [[0,1], [0,0,1,2], [0,0,1,-1],[0,0,1,True]]:
    try:grouped(mapping)
    except ValueError:rejected+=1
    else:raise AssertionError('Invalid mapping accepted')
for kind in ['grouped','shape','opaque']:
    record=fixture_record(kind)
    if kind=='shape':assert all(p['values'] is None for p in record['record']['points'])
    if kind=='opaque':assert record['record']['points'][2]['values']==[5.]
    write(kind+'.json',json.dumps(record,allow_nan=False))
write('results.json',json.dumps({'runtime':runtime(),'comparisons':comparisons,'atol':1e-7,'rtol':1e-6,'maxAbs':max(c['maxAbs'] for c in comparisons),'malformedRefusals':rejected,'stateRoundtrip':True,'groupedReference':'independent Python scalar dot/softmax/weighted sum','opaqueOutput':5.0},indent=2))
print(json.dumps({'output':str(out),'comparisons':len(comparisons),'maxAbs':max(c['maxAbs'] for c in comparisons),'refusals':rejected}))
