"""Numerical grouped-head and opaque-region fixtures, plus a non-executing preview."""
import torch


def grouped(mapping=(0, 0, 1, 1)):
    if len(mapping)!=4 or any(type(i) is not int or not 0<=i<2 for i in mapping):
        raise ValueError('Query head to KV head mapping must have four indices in [0, 2)')
    q=torch.tensor([[1.,0.],[0.,1.],[1.,1.],[-1.,1.]])
    k=torch.tensor([[[1.,0.],[0.,1.]],[[2.,1.],[-1.,0.]]])
    v=torch.tensor([[[1.,2.],[3.,4.]],[[5.,6.],[7.,8.]]])
    scores=torch.einsum('hd,hkd->hk',q,k[list(mapping)])/2**0.5
    weights=torch.softmax(scores,dim=-1)
    output=torch.einsum('hk,hkd->hd',weights,v[list(mapping)])
    return {'query':q,'key':k,'value':v,'mapping':torch.tensor(mapping,dtype=torch.int32),'scores':scores,'weights':weights,'output':output}


def fixture_record(kind):
    from adapter import runtime
    points=[]
    def add(name,tensor,roles,deps=(),availability='available',shape=None):
        dims=list(tensor.shape) if tensor is not None else shape
        points.append({'id':name,'node':name,'port':'output','invocation':'fixture:0','phase':'preview' if kind=='shape' else 'forward',
        'shape':dims,'axes':[{'role':role,'space':'grouped-v1:'+role,'size':size} for role,size in zip(roles,dims)],'dtype':'int32' if name=='mapping' else 'float32','encoding':'json-numbers-row-major',
        'values':tensor.flatten().tolist() if tensor is not None else None,'origin':'observed','availability':availability,'source':{'file':'research/witnesses/fixtures.py','symbol':'grouped' if kind=='grouped' else 'fixture_record','revision':runtime()},'owners':[],
        'dependencies':list(deps),'semantics':('Explicit query-head → KV-head mapping [0,0,1,1]; unequal head roles cannot be interchanged. ' if kind=='grouped' else 'Structural preview only, no forward execution. ' if kind=='shape' else 'Actual torch.linalg.vector_norm boundary; internals opaque. Unknown operator has no registered scalar explanation. ')+name,
        'capabilities':['slice','source'] if tensor is not None else ['source']})
    if kind=='grouped':
        values=grouped()
        for name,roles,deps in [('query',['query_head','feature'],[]),('key',['kv_head','key_position','feature'],[]),('value',['kv_head','key_position','value_feature'],[]),('mapping',['query_head'],[]),('scores',['query_head','key_position'],['query','key','mapping']),('weights',['query_head','key_position'],['scores']),('output',['query_head','value_feature'],['weights','value','mapping'])]:add(name,values[name],roles,deps)
    elif kind=='shape':
        add('input',None,['example','feature'],availability='shape_only',shape=[2,3])
        add('unknown.custom',None,['example','feature'],['input'],availability='shape_only',shape=[2,5])
    elif kind=='opaque':
        x=torch.tensor([3.,4.]);result=torch.linalg.vector_norm(x)
        add('input',x,['feature'])
        add('opaque.norm',None,[],['input'],availability='opaque',shape=[])
        add('output',result,[],['opaque.norm'])
        add('unknown.scalar.explanation',None,[],['output'],availability='unsupported',shape=[])
    else:raise ValueError('Unregistered fixture')
    integration='fixture-'+kind+'-v1'
    request={'version':1,'integration':integration,'profile':'developer-fixture-v1','requestId':kind,'sessionId':'fixture','epoch':0,'action':'preview' if kind=='shape' else 'predict','input':kind}
    return {'version':1,'codec':integration,'record':{'version':2,'id':'fixture:'+kind,'integration':integration,'definition':integration,'checkpoint':'deterministic-fixture-v1','inputTransform':'fixture-constants-v1','profile':request['profile'],'runtime':runtime(),'request':request,'execution':'structural-preview' if kind=='shape' else 'native','precision':{'storage':'float32','compute':'none' if kind=='shape' else 'float32','policy':'Deterministic CPU fixture'},'input':{'text':kind,'tokenIds':[],'labels':[],'offsets':[]},'points':points,'limits':['Developer fixture, not pretrained model evidence. No scalar reconstruction, training or state continuation supported.']}}
