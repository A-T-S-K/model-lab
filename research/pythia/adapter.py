"""Read-only native GPTNeoX capture and bounded uncached generation."""
import hashlib
import importlib.metadata
import inspect
import json
import math
import os
import platform
import sys
from pathlib import Path

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
import torch
from safetensors import safe_open
from transformers import AutoModelForCausalLM, AutoTokenizer

ROOT = Path(__file__).resolve().parent
PROFILE = 'pythia-14m-cpu-f32-eager-uncached-generation-v2'
INTEGRATION = 'pythia-native-v1'
LAYER = 1
MAX_TOKENS = 16
MAX_GENERATION_PROMPT_TOKENS = 4
MAX_NEW_TOKENS = 2
OUTPUT_SIZE = 50_304
GENERATION_RECIPE = 'pythia-greedy-full-prefix-uncached-v1'
SELECTION_POLICY = 'argmax-full-output-v1'


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def validate_request(value):
    if not isinstance(value, dict):
        raise ValueError('Invalid request schema')
    common = {'version', 'integration', 'profile', 'requestId', 'sessionId', 'epoch', 'action', 'input'}
    action = value.get('action')
    expected = common | ({'generation'} if action == 'generate' else set())
    if set(value) != expected:
        raise ValueError('Invalid request schema')
    if value.get('integration') != INTEGRATION or value.get('profile') != PROFILE:
        raise ValueError('Unsupported integration/profile')
    if action == 'predict':
        if type(value.get('version')) is not int or value['version'] != 1:
            raise ValueError('Prediction request version')
    elif action == 'generate':
        if type(value.get('version')) is not int or value['version'] != 3:
            raise ValueError('Generation request version')
        generation = value['generation']
        if not isinstance(generation, dict) or set(generation) != {'recipe', 'maxNewTokens'}:
            raise ValueError('Malformed generation configuration')
        if generation['recipe'] != GENERATION_RECIPE:
            raise ValueError('Unsupported generation recipe')
        if type(generation['maxNewTokens']) is not int or not 1 <= generation['maxNewTokens'] <= MAX_NEW_TOKENS:
            raise ValueError('Requested new-token budget must be 1–2')
    else:
        raise ValueError('Unsupported action')
    for key in ['requestId', 'sessionId']:
        if not isinstance(value[key], str) or not 1 <= len(value[key]) <= 256:
            raise ValueError('Invalid request identity')
    if type(value['epoch']) is not int or not 0 <= value['epoch'] <= 2**53 - 1:
        raise ValueError('Invalid cancellation epoch')
    if not isinstance(value['input'], str) or not 1 <= len(value['input']) <= 128 or not value['input'].isascii():
        raise ValueError('Profile accepts 1–128 ASCII characters; input is never truncated')
    return value


class NativePythia:
    def __init__(self):
        dependencies = json.loads((ROOT / 'dependencies.json').read_text())
        for package in dependencies['packages']:
            if importlib.metadata.version(package['name']) != package['version']:
                raise ValueError('Installed dependency differs from qualified lock: ' + package['name'])
        if sys.version_info[:3] != (3, 14, 7) or platform.system() != 'Darwin' or platform.machine() != 'arm64':
            raise ValueError('This execution profile is qualified only for Python 3.14.7 / macOS arm64; declare and qualify another profile explicitly')
        self.lock = json.loads((ROOT / 'model-lock.json').read_text())
        transform = {
            'files': {k: v for k, v in self.lock['files'].items() if 'token' in k},
            'tokenizers': importlib.metadata.version('tokenizers'),
            'transformers': importlib.metadata.version('transformers'),
            'policy': 'ASCII; add_special_tokens=False; no padding/truncation; prediction max_tokens=16; generation prompt max_tokens=4',
        }
        self.input_transform = 'sha256:' + hashlib.sha256(json.dumps(transform, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        for name, item in self.lock['files'].items():
            if digest(ROOT / 'cache' / name) != item['sha256']:
                raise ValueError('Pinned model file digest mismatch: ' + name)
        with safe_open(ROOT / 'cache/model.safetensors', framework='pt') as handle:
            self.storage = sorted({handle.get_slice(key).get_dtype() for key in handle.keys()})
        torch.set_num_threads(1)
        self.tokenizer = AutoTokenizer.from_pretrained(ROOT / 'cache', local_files_only=True, trust_remote_code=False)
        self.model = AutoModelForCausalLM.from_pretrained(
            ROOT / 'cache', local_files_only=True, trust_remote_code=False,
            use_safetensors=True, dtype=torch.float32, attn_implementation='eager').eval()
        if self.model.config.use_parallel_residual is not True or {p.dtype for p in self.model.parameters()} != {torch.float32}:
            raise ValueError('Unsupported native profile')
        if (self.model.config.vocab_size != OUTPUT_SIZE or
                self.model.get_input_embeddings().num_embeddings != OUTPUT_SIZE or
                self.model.get_output_embeddings().out_features != OUTPUT_SIZE):
            raise ValueError('Model input/output support differs from qualified 50,304-index profile')
        source = Path(inspect.getfile(type(self.model)))
        self.source_digest = digest(source)
        self.adapter_digest = digest(ROOT / 'adapter.py')
        self.runtime = 'sha256:' + hashlib.sha256(b''.join(
            path.read_bytes() for path in [ROOT / 'adapter.py', ROOT / 'server.py', ROOT / 'requirements.lock', ROOT / 'dependencies.json', ROOT / 'model-lock.json']
        )).hexdigest()

    def _tokenize(self, text):
        encoded = self.tokenizer(text, return_tensors='pt', return_offsets_mapping=True, add_special_tokens=False)
        offsets = encoded.pop('offset_mapping')[0].tolist()
        ids = encoded['input_ids'][0].tolist()
        if not 1 <= len(ids) <= MAX_TOKENS:
            raise ValueError('Input token budget exceeded; no truncation')
        return ids, offsets

    def _label(self, token_id):
        if token_id >= len(self.tokenizer):
            return None
        label = self.tokenizer.convert_ids_to_tokens(token_id)
        return label if isinstance(label, str) else None

    def _capture_invocation(self, prefix, invocation, phase, point_prefix='', token_dependencies=None):
        input_ids = torch.tensor([prefix], dtype=torch.long)
        captures = {}
        handles = []
        layer = self.model.gpt_neox.layers[LAYER]

        def hook(name, module, select=lambda output: output):
            def observe(_module, _args, output):
                captures[name] = select(output).detach().clone()
            handles.append(module.register_forward_hook(observe))

        def residual_input(_module, args):
            captures['residual.input'] = args[0].detach().clone()

        handles.append(layer.register_forward_pre_hook(residual_input))
        hook('embedding', self.model.gpt_neox.embed_in)
        hook('norm.attention', layer.input_layernorm)
        hook('norm.mlp', layer.post_attention_layernorm)
        hook('attention.qkv', layer.attention.query_key_value)
        hook('attention.output', layer.attention, lambda output: output[0])
        hook('attention.weights', layer.attention, lambda output: output[1])
        hook('mlp.output', layer.mlp)
        hook('residual.output', layer)
        try:
            with torch.inference_mode():
                result = self.model(input_ids=input_ids, use_cache=False)
                if result.past_key_values is not None:
                    raise ValueError('Uncached profile unexpectedly returned reusable state')
                captures['logits'] = result.logits[:, -1, :].detach().clone()
        finally:
            for handle in handles:
                handle.remove()

        source = {'file': 'transformers/models/gpt_neox/modeling_gpt_neox.py',
                  'symbol': 'GPTNeoXLayer.forward', 'revision': 'sha256:' + self.source_digest}
        points = []

        def point_id(name):
            return f'{point_prefix}/{name}' if point_prefix else name

        def dependencies(names):
            return [name if '/' in name or not point_prefix else point_id(name) for name in names]

        def point(name, tensor, roles, node, symbol, owners, deps, semantics):
            shape = list(tensor.shape)
            points.append({
                'id': point_id(name), 'node': node,
                'port': 'input' if name == 'residual.input' else 'probabilities' if name == 'attention.weights' else 'output',
                'invocation': invocation, 'phase': phase, 'shape': shape,
                'axes': [{'role': role, 'space': f"{self.lock['revision']}:{node}:{role}", 'size': size} for role, size in zip(roles, shape)],
                'dtype': 'int32' if tensor.dtype == torch.int64 else 'float32',
                'encoding': 'json-numbers-row-major', 'values': tensor.reshape(-1).tolist(),
                'origin': 'observed', 'availability': 'available',
                'source': dict(source, symbol=symbol), 'owners': owners,
                'dependencies': dependencies(deps), 'semantics': semantics,
                'capabilities': ['slice', 'source'],
            })

        base = 'gpt_neox.layers.1'
        point('tokens', input_ids[0], ['input_position'], 'tokenizer', 'AutoTokenizer.__call__', [], token_dependencies or [],
              'Exact effective prefix token IDs supplied to this native invocation; no BOS insertion, padding, truncation, text fabrication or re-tokenization.')
        points[-1]['source'] = {'file': 'tokenizer.json', 'symbol': 'tokenizers.Tokenizer.encode',
                                'revision': 'sha256:' + self.lock['files']['tokenizer.json']['sha256']}
        point('embedding', captures['embedding'][0], ['input_position', 'feature'], 'gpt_neox.embed_in', 'GPTNeoXModel.forward',
              ['gpt_neox.embed_in.weight'], ['tokens'], 'Token embedding lookup; rotary position transforms occur inside attention, not an added position embedding.')
        point('residual.input', captures['residual.input'][0], ['input_position', 'feature'], base, 'GPTNeoXLayer.forward', [], [],
              'Observed input to nonzero layer 1. Layer 0 internals are not captured; this is not directly the embedding output.')
        for name, module, deps, meaning in [
            ('norm.attention', 'input_layernorm', ['residual.input'], 'LayerNorm(input), epsilon 1e-5, learned weight and bias; attention branch.'),
            ('norm.mlp', 'post_attention_layernorm', ['residual.input'], 'Parallel LayerNorm of the SAME residual input, not attention output; learned weight and bias.'),
            ('attention.output', 'attention', ['norm.attention', 'attention.qkv', 'attention.weights'], 'Native attention output after dense projection; all four heads contribute.'),
            ('mlp.output', 'mlp', ['norm.mlp'], 'Native GELU MLP output, 128 → 512 → 128 with biases.'),
            ('residual.output', '', ['residual.input', 'attention.output', 'mlp.output'], 'Native parallel residual: (MLP output + attention output) + residual input; eval dropout is identity.'),
        ]:
            point(name, captures[name][0], ['input_position', 'feature'], base + ('.' + module if module else ''), 'GPTNeoXLayer.forward',
                  [base + '.' + module] if module else [], deps, meaning)
        qkv = captures['attention.qkv'][0].reshape(len(prefix), 4, 3, 32)
        point('attention.qkv', qkv, ['input_position', 'query_head', 'qkv_member', 'head_feature'], base + '.attention.query_key_value', 'GPTNeoXAttention.forward',
              [base + '.attention.query_key_value.weight', base + '.attention.query_key_value.bias'], ['norm.attention'],
              'Observed fused linear output reshaped without arithmetic: per-head Q,K,V, each width 32. Q and K here are BEFORE RoPE; not attention-score operands after rotation.')
        point('attention.weights', captures['attention.weights'][0], ['query_head', 'query_position', 'key_position'], base + '.attention', 'eager_attention_forward', [], ['attention.qkv'],
              'Actual native eager attention probabilities after RoPE, scaling and causal masking; all 4 heads captured. Scores and rotated Q/K are not captured.')
        point('logits', captures['logits'][0], ['output_index'], 'lm_head', 'GPTNeoXForCausalLM.forward', ['lm_head.weight'], [],
              f'Observed final-position logits at model input position {len(prefix) - 1}, full 50304 output entries. Token selection is a separate derived policy decision.')
        return points, captures['logits'][0]

    def _base_run(self, request, ids, offsets, points, limits, version=1):
        return {
            'version': version, 'id': request['sessionId'] + ':' + request['requestId'], 'integration': INTEGRATION,
            'definition': 'pythia-14m:' + self.lock['files']['config.json']['sha256'],
            'checkpoint': 'sha256:' + self.lock['files']['model.safetensors']['sha256'],
            'inputTransform': self.input_transform, 'profile': PROFILE, 'runtime': self.runtime,
            'request': request, 'execution': 'native',
            'precision': {'storage': ','.join(self.storage), 'compute': 'float32',
                          'policy': 'CPU; one thread; eager attention; eval; use_cache=False; no retained KV state; F16 weights converted to F32; native reduction order.'},
            'input': {'text': request['input'], 'tokenIds': ids,
                      'labels': [self._label(token_id) for token_id in ids], 'offsets': offsets},
            'points': points, 'limits': limits,
        }

    def capture(self, request):
        value = validate_request(request)
        ids, offsets = self._tokenize(value['input'])
        if value['action'] == 'generate':
            return self.generate(value, ids, offsets)
        points, _ = self._capture_invocation(ids, 'prefill:0', 'inference')
        run = self._base_run(value, ids, offsets, points, [
            'Prediction/capture/replay only; generation is a separate recipe and receipt, not an alias for Predict.',
            'Only layer 1 selected internals and final-position logits captured. Uncaptured details require a separately authorized execution.',
            'No cache retained or advertised. Weights are a parameter checkpoint, not training continuation state. Probability display derives from all 50304 observed logits.',
        ])
        return {'version': 1, 'codec': INTEGRATION, 'record': run}

    def _distribution_summary(self, logits, chosen):
        values = [float(value) for value in logits.tolist()]
        maximum = max(values)
        exponentials = [math.exp(value - maximum) for value in values]
        denominator = sum(exponentials)
        ranked = sorted(range(len(values)), key=lambda index: (-values[index], index))[:5]
        top = [{'index': index, 'logit': values[index], 'probability': exponentials[index] / denominator} for index in ranked]
        shown = sum(item['probability'] for item in top)
        return {'support': len(values), 'top': top, 'omittedMass': 1 - shown,
                'selectedLogit': values[chosen], 'selectedProbability': exponentials[chosen] / denominator}

    def generate(self, request, prompt_ids, offsets):
        requested = request['generation']['maxNewTokens']
        if len(prompt_ids) > MAX_GENERATION_PROMPT_TOKENS:
            raise ValueError('Generation prompt capture budget exceeded; maximum 4 prompt tokens')
        if len(prompt_ids) + requested > MAX_TOKENS:
            raise ValueError('Generation would exceed supported context/capture budget')
        points, _ = self._capture_invocation(prompt_ids, 'prefill:0', 'prompt-prefill', 'prefill:0')
        invocations = [{
            'identity': 'prefill:0', 'kind': 'prompt', 'generatedStep': 0,
            'effectivePrefixIds': list(prompt_ids), 'finalModelPosition': len(prompt_ids) - 1,
            'pointIds': [point['id'] for point in points], 'dependsOnChoice': None,
        }]
        generated_ids = []
        generated_labels = []
        prefix = list(prompt_ids)
        for step in range(1, requested + 1):
            invocation = f'generation:{step}'
            prior_choice = None if step == 1 else f'generation:{step - 1}/choice'
            invocation_points, logits = self._capture_invocation(
                prefix, invocation, f'generation-step-{step}', invocation,
                ['prefill:0/tokens'] if step == 1 else ['prefill:0/tokens', prior_choice])
            chosen = int(torch.argmax(logits).item())
            label = self._label(chosen)
            logits_point = f'{invocation}/logits'
            choice_point = {
                'id': f'{invocation}/choice', 'node': 'generation-policy.argmax', 'port': 'decision',
                'invocation': invocation, 'phase': f'selection-step-{step}', 'shape': [], 'axes': [],
                'dtype': 'int32', 'encoding': 'json-numbers-row-major', 'values': [chosen],
                'origin': 'derived', 'availability': 'available',
                'source': {'file': 'research/pythia/adapter.py', 'symbol': 'NativePythia.generate', 'revision': 'sha256:' + self.adapter_digest},
                'owners': [], 'dependencies': [logits_point],
                'semantics': 'Deterministic argmax over all 50,304 observed logits. This policy decision is derived evidence, not a model activation or observation.',
                'capabilities': ['slice', 'source'],
            }
            invocation_points.append(choice_point)
            stop_reason = 'max_new_tokens' if step == requested else None
            summary = self._distribution_summary(logits, chosen)
            choice = {
                'selectionPolicy': SELECTION_POLICY, 'sourceLogitsOccurrence': logits_point,
                'chosenOutputIndex': chosen, 'tokenizerLabelAvailable': label is not None,
                'tokenizerLabel': label, 'generatedPosition': len(prefix), 'stopReason': stop_reason,
                'distribution': summary,
            }
            invocations.append({
                'identity': invocation, 'kind': 'generated', 'generatedStep': step,
                'effectivePrefixIds': list(prefix), 'finalModelPosition': len(prefix) - 1,
                'pointIds': [point['id'] for point in invocation_points],
                'dependsOnChoice': prior_choice, 'choice': choice,
            })
            points.extend(invocation_points)
            generated_ids.append(chosen)
            generated_labels.append(label)
            prefix.append(chosen)
        run = self._base_run(request, prompt_ids, offsets, points, [
            'Bounded deterministic greedy generation only: 1–2 requested new tokens; no temperature, top-p, sampling or RNG.',
            'Explicitly uncached: prompt prefill and every generation step are distinct native calls with use_cache=False; every generated step reexecutes its full exact prefix and retains no reusable KV payload.',
            'Selected layer 1 internals and full final-position 50,304 logits are observed for every invocation. Argmax choices are separate derived generation-policy evidence.',
            'Cache capability is unsupported/unqualified. A future cache-enabled profile requires separate qualification; no cached-versus-uncached equivalence is claimed.',
        ], version=2)
        generation = {
            'version': 1,
            'recipe': {'identity': GENERATION_RECIPE, 'requested': {'maxNewTokens': requested},
                       'effective': {'maxNewTokens': requested, 'promptTokenLimit': MAX_GENERATION_PROMPT_TOKENS,
                                     'totalTokenLimit': MAX_TOKENS, 'honorEos': False}},
            'selectionPolicy': {'identity': SELECTION_POLICY, 'version': 1, 'kind': 'greedy-argmax',
                                'support': OUTPUT_SIZE, 'stochastic': False},
            'cache': {'capability': 'unsupported', 'qualified': False, 'strategy': 'full-prefix-reexecution',
                      'useCache': False, 'retainedState': False},
            'cancellationEpoch': request['epoch'], 'promptInvocation': 'prefill:0',
            'invocations': invocations,
            'generated': {'tokenIds': generated_ids, 'tokenizerLabels': generated_labels,
                          'finalPrefixIds': prefix},
            'termination': {'reason': 'max_new_tokens', 'generatedTokens': requested},
        }
        return {'version': 1, 'codec': INTEGRATION,
                'record': {'kind': 'generation-v1', 'run': run, 'generation': generation}}
