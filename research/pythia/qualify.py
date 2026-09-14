"""Independent direct-HF comparison; reference never calls the Model Lab capture adapter."""
import os
os.environ['HF_HUB_OFFLINE']='1';os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
import json,time,resource
from pathlib import Path
from output import allocate_output
# Predeclared same-process CPU F32 policy; hooks must be observational.
ATOL=1e-6; RTOL=1e-6

def error(a,b):
    import torch
    a=torch.as_tensor(a,dtype=torch.float64);b=torch.as_tensor(b,dtype=torch.float64)
    d=(a-b).abs(); rel=d/torch.maximum(a.abs(),torch.tensor(1e-12))
    assert torch.all(d<=ATOL+RTOL*a.abs()), 'Observation changed native results'
    return {'maxAbsolute':d.max().item(),'maxRelativeWith1e-12Floor':rel.max().item(),'values':a.numel()}

def main():
    OUT,write=allocate_output(Path(__file__).resolve().parents[2],os.environ.get('NATIVE_EVIDENCE_DIR'))
    print('Native evidence: '+str(OUT),flush=True)
    try:
        qualify(write)
    except Exception as error:
        write('failure.json',json.dumps({'status':'failed','error':str(error)})+'\n')
        raise

def qualify(write):
    import torch
    from transformers import AutoTokenizer,AutoModelForCausalLM
    from adapter import NativePythia,PROFILE,ROOT
    torch.set_num_threads(1);t=time.monotonic()
    reference=AutoModelForCausalLM.from_pretrained(ROOT/'cache',local_files_only=True,trust_remote_code=False,use_safetensors=True,dtype=torch.float32,attn_implementation='eager').eval()
    tokenizer=AutoTokenizer.from_pretrained(ROOT/'cache',local_files_only=True,trust_remote_code=False)
    inp='The cat sat';x=tokenizer(inp,return_tensors='pt',add_special_tokens=False)
    with torch.inference_mode(): plain=reference(**x,use_cache=False).logits[0,-1].clone()
    values={};layer=reference.gpt_neox.layers[1];hooks=[]
    def record(name):
        def f(_m,_a,y):values[name]=y.detach().clone()
        return f
    for name,module in [('embedding',reference.gpt_neox.embed_in),('norm.attention',layer.input_layernorm),('norm.mlp',layer.post_attention_layernorm),('attention.qkv',layer.attention.query_key_value),('mlp.output',layer.mlp),('residual.output',layer)]:hooks.append(module.register_forward_hook(record(name)))
    def pre(_m,args):values['residual.input']=args[0].detach().clone()
    def attention(_m,_args,y):values['attention.output']=y[0].detach().clone();values['attention.weights']=y[1].detach().clone()
    hooks.extend([layer.register_forward_pre_hook(pre),layer.attention.register_forward_hook(attention)])
    with torch.inference_mode(): minimal=reference(**x,use_cache=False).logits[0,-1].clone()
    for h in hooks:h.remove()
    native=NativePythia();request={'version':1,'integration':'pythia-native-v1','profile':PROFILE,'requestId':'qualification-1','sessionId':'qualification','epoch':0,'action':'predict','input':inp}
    envelope=native.capture(request);run=envelope['record'];points={p['id']:p for p in run['points']}
    assert run['input']['tokenIds']==x['input_ids'][0].tolist()
    comparisons={'uninstrumented_vs_reference_hooks':error(plain,minimal),'uninstrumented_vs_adapter_logits':error(plain,points['logits']['values'])}
    for name,tensor in values.items():comparisons[name]=error(tensor.reshape(-1),points[name]['values'])
    parallel=(values['mlp.output']+values['attention.output'])+values['residual.input']
    comparisons['parallel_residual_identity']=error(parallel,values['residual.output'])
    report={'status':'PASSED','profile':json.loads((ROOT/'profile.json').read_text()),'input':run['input'],'tolerance':{'absolute':ATOL,'relative':RTOL},
            'reference':'Fresh direct Hugging Face model, same pinned files; plain pass has no hooks. Selected internal reference values use minimal read-only native hooks, separately from Model Lab adapter.',
            'comparisons':comparisons,'seconds':time.monotonic()-t,'maxRSSBytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
            'torch':torch.__version__,'storage':native.storage,'effectiveParameterDtypes':sorted({str(p.dtype) for p in native.model.parameters()}),'source':native.source_digest}
    write('native-observation.json',json.dumps(report,indent=2)+'\n');write('native-recording.json',json.dumps(envelope,separators=(',',':')))
    write('completion.json',json.dumps({'status':'passed'})+'\n')
    print(json.dumps(report,indent=2))
if __name__=='__main__':main()
