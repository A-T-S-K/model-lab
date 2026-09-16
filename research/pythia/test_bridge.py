"""Bounded transport checks against the explicitly launched task-owned loopback bridge."""
import json
import os
import urllib.request
import urllib.error
from adapter import PROFILE, GENERATION_RECIPE
URL=os.environ['SLICE_NATIVE_ENDPOINT']
ORIGIN=os.environ['SLICE_ORIGIN']
BASE={'version':1,'integration':'pythia-native-v1','profile':PROFILE,'requestId':'transport-1','sessionId':'transport-test','epoch':2,'action':'predict','input':'The cat sat'}
GENERATION={'version':3,'integration':'pythia-native-v1','profile':PROFILE,'requestId':'transport-generation','sessionId':'transport-test','epoch':2,'action':'generate','input':'The cat sat','generation':{'recipe':GENERATION_RECIPE,'maxNewTokens':2}}

def send(body,origin=ORIGIN,host=None):
    headers={'Origin':origin,'Content-Type':'application/json'}
    if host:headers['Host']=host
    req=urllib.request.Request(URL,data=json.dumps(body).encode(),headers=headers)
    try:
        with urllib.request.urlopen(req,timeout=15) as r:return r.status,dict(r.headers),json.load(r)
    except urllib.error.HTTPError as e:return e.code,dict(e.headers),json.load(e)

def main():
    checks=[]
    for name,body,origin,host,expected in [
        ('cross-origin',BASE,'http://example.com',None,403),
        ('host-rebinding',BASE,ORIGIN,'attacker.example:4319',403),
        ('unsupported-action',dict(BASE,action='train'),ORIGIN,None,400),
        ('extra-command',dict(BASE,command='arbitrary'),ORIGIN,None,400),
        ('negative-epoch',dict(BASE,epoch=-1),ORIGIN,None,400),
        ('oversized-body',dict(BASE,input='x'*5000),ORIGIN,None,400),
        ('oversized-token-input',dict(BASE,requestId='too-many-tokens',input='hello '*20),ORIGIN,None,400),
        ('zero-generated-tokens',dict(GENERATION,requestId='zero',generation={'recipe':GENERATION_RECIPE,'maxNewTokens':0}),ORIGIN,None,400),
        ('excess-generated-tokens',dict(GENERATION,requestId='excess',generation={'recipe':GENERATION_RECIPE,'maxNewTokens':3}),ORIGIN,None,400),
        ('wrong-generation-recipe',dict(GENERATION,requestId='wrong-recipe',generation={'recipe':'sampling-v1','maxNewTokens':2}),ORIGIN,None,400),
        ('generation-prefix-budget',dict(GENERATION,requestId='long-generation',input='hello hello hello hello hello'),ORIGIN,None,400),
        ('genuine-request',BASE,ORIGIN,None,200),
        ('genuine-generation',GENERATION,ORIGIN,None,200),
        ('duplicate-request',BASE,ORIGIN,None,400),
        ('stale-epoch',dict(BASE,requestId='stale',epoch=1),ORIGIN,None,400)]:
        status,headers,result=send(body,origin,host)
        assert status==expected,(name,status,result)
        assert headers.get('Access-Control-Allow-Origin')!='*'
        if origin!=ORIGIN or host:assert 'Access-Control-Allow-Origin' not in headers
        checks.append({'check':name,'status':status,'result':'PASS'})
    print(json.dumps(checks,indent=2))
if __name__=='__main__':main()
