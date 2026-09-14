"""Read-only hooks around native GPTNeoX; no replacement forward or weight processing."""
import hashlib
import inspect
import json
import os
import sys
import platform
import importlib.metadata
from pathlib import Path

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from safetensors import safe_open

ROOT = Path(__file__).resolve().parent
PROFILE = 'pythia-14m-cpu-f32-eager-v1'
INTEGRATION = 'pythia-native-v1'
LAYER = 1
MAX_TOKENS = 16


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def validate_request(r):
    keys = {'version','integration','profile','requestId','sessionId','epoch','action','input'}
    if not isinstance(r, dict) or set(r) != keys or type(r['version']) is not int or r['version'] != 1:
        raise ValueError('Invalid request schema')
    if r['integration'] != INTEGRATION or r['profile'] != PROFILE or r['action'] != 'predict':
        raise ValueError('Unsupported integration/profile/action; inference capture only')
    for key in ['requestId','sessionId']:
        if not isinstance(r[key], str) or not 1 <= len(r[key]) <= 256:
            raise ValueError('Invalid request identity')
    if type(r['epoch']) is not int or not 0 <= r['epoch'] <= 2**53-1:
        raise ValueError('Invalid cancellation epoch')
    if not isinstance(r['input'], str) or not 1 <= len(r['input']) <= 128 or not r['input'].isascii():
        raise ValueError('Profile accepts 1–128 ASCII characters; input is never truncated')
    return r


class NativePythia:
    def __init__(self):
        dependencies=json.loads((ROOT/'dependencies.json').read_text())
        for package in dependencies['packages']:
            if importlib.metadata.version(package['name']) != package['version']:
                raise ValueError('Installed dependency differs from qualified lock: '+package['name'])
        if sys.version_info[:3] != (3,14,7) or platform.system() != 'Darwin' or platform.machine() != 'arm64':
            raise ValueError('This execution profile is qualified only for Python 3.14.7 / macOS arm64; declare and qualify another profile explicitly')
        self.lock = json.loads((ROOT/'model-lock.json').read_text())
        transform={'files':{k:v for k,v in self.lock['files'].items() if 'token' in k},
                   'tokenizers':importlib.metadata.version('tokenizers'), 'transformers':importlib.metadata.version('transformers'),
                   'policy':'ASCII; add_special_tokens=False; no padding/truncation; max_tokens=16'}
        self.input_transform='sha256:'+hashlib.sha256(json.dumps(transform,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        for name, item in self.lock['files'].items():
            if digest(ROOT/'cache'/name) != item['sha256']:
                raise ValueError('Pinned model file digest mismatch: '+name)
        # Inert tensor deserialization only; no pickle, hub access, or remote code.
        with safe_open(ROOT/'cache/model.safetensors', framework='pt') as f:
            self.storage = sorted({f.get_slice(k).get_dtype() for k in f.keys()})
        torch.set_num_threads(1)
        self.tokenizer = AutoTokenizer.from_pretrained(ROOT/'cache', local_files_only=True, trust_remote_code=False)
        self.model = AutoModelForCausalLM.from_pretrained(
            ROOT/'cache', local_files_only=True, trust_remote_code=False,
            use_safetensors=True, dtype=torch.float32, attn_implementation='eager').eval()
        if self.model.config.use_parallel_residual is not True or {p.dtype for p in self.model.parameters()} != {torch.float32}:
            raise ValueError('Unsupported native profile')
        source = Path(inspect.getfile(type(self.model)))
        self.source_digest = digest(source)
        self.runtime = 'sha256:'+hashlib.sha256(b''.join(
            p.read_bytes() for p in [ROOT/'adapter.py', ROOT/'server.py', ROOT/'requirements.lock', ROOT/'dependencies.json', ROOT/'model-lock.json']
        )).hexdigest()

    def capture(self, request):
        r = validate_request(request)
        encoded = self.tokenizer(r['input'], return_tensors='pt', return_offsets_mapping=True, add_special_tokens=False)
        offsets = encoded.pop('offset_mapping')[0].tolist()
        ids = encoded['input_ids'][0].tolist()
        if not 1 <= len(ids) <= MAX_TOKENS:
            raise ValueError('Input token budget exceeded; no truncation')
        captures = {}
        handles = []
        layer = self.model.gpt_neox.layers[LAYER]
        def hook(name, module, select=lambda x: x):
            def observe(_module, _args, output):
                captures[name] = select(output).detach().clone()
                # Deliberately return None: cannot replace the native output.
            handles.append(module.register_forward_hook(observe))
        def residual_input(_module, args):
            captures['residual.input'] = args[0].detach().clone()
        handles.append(layer.register_forward_pre_hook(residual_input))
        hook('embedding', self.model.gpt_neox.embed_in)
        hook('norm.attention', layer.input_layernorm)
        hook('norm.mlp', layer.post_attention_layernorm)
        hook('attention.qkv', layer.attention.query_key_value)
        hook('attention.output', layer.attention, lambda x: x[0])
        hook('attention.weights', layer.attention, lambda x: x[1])
        hook('mlp.output', layer.mlp)
        hook('residual.output', layer)
        try:
            with torch.inference_mode():
                result = self.model(**encoded, use_cache=False)
                captures['logits'] = result.logits[:, -1, :].detach().clone()
        finally:
            for handle in handles: handle.remove()
        source = {'file':'transformers/models/gpt_neox/modeling_gpt_neox.py',
                  'symbol':'GPTNeoXLayer.forward', 'revision':'sha256:'+self.source_digest}
        run_id = r['sessionId']+':'+r['requestId']
        points = []
        def point(name, tensor, roles, node, symbol, owners, deps, semantics):
            shape = list(tensor.shape)
            points.append({'id':name, 'node':node, 'port':('input' if name=='residual.input' else 'probabilities' if name=='attention.weights' else 'output'), 'invocation':'prefill:0', 'phase':'inference',
                'shape':shape, 'axes':[{'role':role,'space':f"{self.lock['revision']}:{node}:{role}",'size':size} for role,size in zip(roles,shape)],
                'dtype':'int32' if tensor.dtype == torch.int64 else 'float32', 'encoding':'json-numbers-row-major',
                'values':tensor.reshape(-1).tolist(), 'origin':'observed','availability':'available',
                'source':dict(source,symbol=symbol), 'owners':owners, 'dependencies':deps,
                'semantics':semantics, 'capabilities':['slice','source']})
        base = 'gpt_neox.layers.1'
        point('tokens',encoded['input_ids'][0],['input_position'],'tokenizer','AutoTokenizer.__call__',[],[],
              'Actual tokenizer IDs; no BOS insertion, padding or truncation. Offsets are ASCII character positions.')
        points[-1]['source']={'file':'tokenizer.json','symbol':'tokenizers.Tokenizer.encode','revision':'sha256:'+self.lock['files']['tokenizer.json']['sha256']}
        point('embedding',captures['embedding'][0],['input_position','feature'],'gpt_neox.embed_in','GPTNeoXModel.forward',['gpt_neox.embed_in.weight'],['tokens'],'Token embedding lookup; rotary position transforms occur inside attention, not an added position embedding.')
        point('residual.input',captures['residual.input'][0],['input_position','feature'],base,'GPTNeoXLayer.forward',[],[],
              'Observed input to nonzero layer 1. Layer 0 internals not captured; this is not directly the embedding output.')
        for name,module,deps,meaning in [
            ('norm.attention','input_layernorm',['residual.input'],'LayerNorm(input), epsilon 1e-5, learned weight and bias; attention branch.'),
            ('norm.mlp','post_attention_layernorm',['residual.input'],'Parallel LayerNorm of the SAME residual input, not attention output; learned weight and bias.'),
            ('attention.output','attention',['norm.attention','attention.qkv','attention.weights'],'Native attention output after dense projection; all four heads contribute.'),
            ('mlp.output','mlp',['norm.mlp'],'Native GELU MLP output, 128 → 512 → 128 with biases.'),
            ('residual.output','',['residual.input','attention.output','mlp.output'],'Native parallel residual: (MLP output + attention output) + residual input; eval dropout is identity.')]:
            point(name,captures[name][0],['input_position','feature'],base+('.'+module if module else ''),'GPTNeoXLayer.forward',
                  [base+'.'+module] if module else [],deps,meaning)
        qkv=captures['attention.qkv'][0].reshape(len(ids),4,3,32)
        point('attention.qkv',qkv,['input_position','query_head','qkv_member','head_feature'],base+'.attention.query_key_value','GPTNeoXAttention.forward',
              [base+'.attention.query_key_value.weight',base+'.attention.query_key_value.bias'],['norm.attention'],
              'Observed fused linear output reshaped without arithmetic: per-head Q,K,V, each width 32. Q and K here are BEFORE RoPE; not attention-score operands after rotation.')
        point('attention.weights',captures['attention.weights'][0],['query_head','query_position','key_position'],base+'.attention','eager_attention_forward',[],['attention.qkv'],
              'Actual native eager attention probabilities after RoPE, scaling and causal masking; all 4 heads captured. Scores and rotated Q/K are not captured.')
        point('logits',captures['logits'][0],['output_index'],'lm_head','GPTNeoXForCausalLM.forward',['lm_head.weight'],[],
              f'Observed final-position logits at input position {len(ids)-1}, full 50304 output entries. Layers 2–5 and final normalization internals not captured; tokenizer labels cover only {len(self.tokenizer)} IDs.')
        run={'version':1,'id':run_id,'integration':INTEGRATION,
             'definition':'pythia-14m:'+self.lock['files']['config.json']['sha256'],
             'checkpoint':'sha256:'+self.lock['files']['model.safetensors']['sha256'],
             'inputTransform':self.input_transform,
             'profile':PROFILE,'runtime':self.runtime,'request':r,'execution':'native',
             'precision':{'storage':','.join(self.storage),'compute':'float32','policy':'CPU; one thread; eager attention; eval; no cache; F16 weights converted to F32; native reduction order.'},
             'input':{'text':r['input'],'tokenIds':ids,'labels':self.tokenizer.convert_ids_to_tokens(ids),'offsets':offsets},
             'points':points,'limits':['Inference/capture/replay only; no training, mutation, scalar stepping, generation/cache or exact resume.',
                                     'Only layer 1 selected internals and final-position logits captured. Uncaptured details require a separately authorized execution, unsupported by this profile.',
                                     'Weights are a parameter checkpoint, not training continuation state. Probability display is derived from all 50304 observed logits.']}
        return {'version':1,'codec':INTEGRATION,'record':run}
