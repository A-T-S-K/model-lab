"""Independent direct-HF prediction and uncached generation comparison."""
import json
import os
import resource
import time
from pathlib import Path

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
from output import allocate_output

ATOL = 1e-6
RTOL = 1e-6
BASE_POINTS = ['embedding', 'residual.input', 'norm.attention', 'norm.mlp',
               'attention.output', 'mlp.output', 'residual.output',
               'attention.qkv', 'attention.weights', 'logits']


def error(reference, candidate):
    import torch
    reference = torch.as_tensor(reference, dtype=torch.float64)
    candidate = torch.as_tensor(candidate, dtype=torch.float64)
    difference = (reference - candidate).abs()
    relative = difference / torch.maximum(reference.abs(), torch.tensor(1e-12))
    assert torch.all(difference <= ATOL + RTOL * reference.abs()), 'Observation changed native results'
    return {'maxAbsolute': difference.max().item(),
            'maxRelativeWith1e-12Floor': relative.max().item(),
            'values': reference.numel()}


def main():
    output, write = allocate_output(Path(__file__).resolve().parents[2], os.environ.get('NATIVE_EVIDENCE_DIR'))
    print('Native evidence: ' + str(output), flush=True)
    try:
        qualify(write)
    except Exception as failure:
        write('failure.json', json.dumps({'status': 'failed', 'error': str(failure)}) + '\n')
        raise


def qualify(write):
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from adapter import (NativePythia, PROFILE, INTEGRATION, ROOT,
                         GENERATION_RECIPE, SELECTION_POLICY)

    torch.set_num_threads(1)
    started = time.monotonic()
    reference = AutoModelForCausalLM.from_pretrained(
        ROOT / 'cache', local_files_only=True, trust_remote_code=False,
        use_safetensors=True, dtype=torch.float32, attn_implementation='eager').eval()
    tokenizer = AutoTokenizer.from_pretrained(ROOT / 'cache', local_files_only=True, trust_remote_code=False)
    prompt = 'The cat sat'
    encoded = tokenizer(prompt, return_tensors='pt', add_special_tokens=False)

    def direct(prefix, hooked):
        input_ids = torch.tensor([prefix], dtype=torch.long)
        values = {}
        handles = []
        layer = reference.gpt_neox.layers[1]
        if hooked:
            def record(name, select=lambda output: output):
                def observe(_module, _args, output):
                    values[name] = select(output).detach().clone()
                return observe
            for name, module in [('embedding', reference.gpt_neox.embed_in),
                                 ('norm.attention', layer.input_layernorm),
                                 ('norm.mlp', layer.post_attention_layernorm),
                                 ('attention.qkv', layer.attention.query_key_value),
                                 ('mlp.output', layer.mlp),
                                 ('residual.output', layer)]:
                handles.append(module.register_forward_hook(record(name)))
            def pre(_module, args):
                values['residual.input'] = args[0].detach().clone()
            def attention(_module, _args, output):
                values['attention.output'] = output[0].detach().clone()
                values['attention.weights'] = output[1].detach().clone()
            handles.extend([layer.register_forward_pre_hook(pre),
                            layer.attention.register_forward_hook(attention)])
        try:
            with torch.inference_mode():
                result = reference(input_ids=input_ids, use_cache=False)
                assert result.past_key_values is None, 'Reference unexpectedly retained KV state'
                values['logits'] = result.logits[:, -1, :].detach().clone()
        finally:
            for handle in handles:
                handle.remove()
        return values

    native = NativePythia()
    prediction_request = {'version': 1, 'integration': INTEGRATION, 'profile': PROFILE,
                          'requestId': 'qualification-predict', 'sessionId': 'qualification',
                          'epoch': 37, 'action': 'predict', 'input': prompt}
    prediction = native.capture(prediction_request)
    prediction_run = prediction['record']
    prediction_points = {point['id']: point for point in prediction_run['points']}
    prompt_ids = encoded['input_ids'][0].tolist()
    assert prediction_run['input']['tokenIds'] == prompt_ids
    prediction_plain = direct(prompt_ids, False)
    prediction_hooked = direct(prompt_ids, True)
    prediction_comparisons = {
        'uninstrumented_vs_reference_hooks': error(prediction_plain['logits'], prediction_hooked['logits']),
        'uninstrumented_vs_adapter_logits': error(prediction_plain['logits'], prediction_points['logits']['values']),
    }
    for name in BASE_POINTS[:-1]:
        prediction_comparisons[name] = error(prediction_hooked[name].reshape(-1), prediction_points[name]['values'])
    parallel = (prediction_hooked['mlp.output'] + prediction_hooked['attention.output']) + prediction_hooked['residual.input']
    prediction_comparisons['parallel_residual_identity'] = error(parallel, prediction_hooked['residual.output'])

    generation_request = {'version': 3, 'integration': INTEGRATION, 'profile': PROFILE,
                          'requestId': 'qualification-generate', 'sessionId': 'qualification',
                          'epoch': 37, 'action': 'generate', 'input': prompt,
                          'generation': {'recipe': GENERATION_RECIPE, 'maxNewTokens': 2}}
    generation_envelope = native.capture(generation_request)
    generation_run = generation_envelope['record']['run']
    generation = generation_envelope['record']['generation']
    generation_points = {point['id']: point for point in generation_run['points']}
    prefixes = [list(prompt_ids), list(prompt_ids)]
    generated_ids = []
    generation_comparisons = {}
    # The first pass is the distinct prompt-processing occurrence. Each generated-token
    # occurrence then reexecutes its exact full prefix with use_cache=False.
    reference_invocations = [('prefill:0', direct(prefixes[0], True), None)]
    for step in range(1, 3):
        prefix = list(prompt_ids) + generated_ids
        plain = direct(prefix, False)
        hooked = direct(prefix, True)
        chosen = int(torch.argmax(plain['logits'][0]).item())
        generated_ids.append(chosen)
        reference_invocations.append((f'generation:{step}', hooked, chosen))
        generation_comparisons[f'generation:{step}/plain_vs_hooks'] = error(plain['logits'], hooked['logits'])
    assert generated_ids == generation['generated']['tokenIds']
    invocation_report = []
    for index, (identity, values, chosen) in enumerate(reference_invocations):
        receipt = generation['invocations'][index]
        prefix = list(prompt_ids) + generated_ids[:max(0, index - 1)]
        assert receipt['identity'] == identity
        assert receipt['effectivePrefixIds'] == prefix
        assert receipt['finalModelPosition'] == len(prefix) - 1
        for name in BASE_POINTS:
            point = generation_points[f'{identity}/{name}']
            candidate = values[name][0].reshape(-1) if name != 'logits' else values[name][0]
            generation_comparisons[f'{identity}/{name}'] = error(candidate, point['values'])
        if chosen is not None:
            choice = receipt['choice']
            assert choice['selectionPolicy'] == SELECTION_POLICY
            assert choice['chosenOutputIndex'] == chosen
            assert generation_points[f'{identity}/choice']['values'] == [chosen]
            assert generation_points[f'{identity}/choice']['origin'] == 'derived'
        invocation_report.append({'identity': identity, 'generatedStep': receipt['generatedStep'],
                                  'effectivePrefixIds': prefix, 'chosenOutputIndex': chosen,
                                  'generatedPosition': None if chosen is None else receipt['choice']['generatedPosition']})

    maximum_absolute = max(item['maxAbsolute'] for item in [*prediction_comparisons.values(), *generation_comparisons.values()])
    maximum_relative = max(item['maxRelativeWith1e-12Floor'] for item in [*prediction_comparisons.values(), *generation_comparisons.values()])
    report = {
        'status': 'PASSED', 'profile': json.loads((ROOT / 'profile-generation.json').read_text()),
        'historicalProfile': json.loads((ROOT / 'profile.json').read_text()),
        'input': generation_run['input'], 'generated': generation['generated'],
        'generation': {'recipe': GENERATION_RECIPE, 'selectionPolicy': SELECTION_POLICY,
                       'cache': generation['cache'], 'termination': generation['termination'],
                       'invocations': invocation_report},
        'tolerance': {'absolute': ATOL, 'relative': RTOL},
        'reference': 'Fresh direct Hugging Face GPTNeoX model; ordinary full-prefix forward loop, use_cache=False, full 50,304-logit argmax. It does not call NativePythia.generate. Selected internal values use separate minimal read-only native hooks.',
        'predictionComparisons': prediction_comparisons,
        'generationComparisons': generation_comparisons,
        'maximumError': {'absolute': maximum_absolute, 'relativeWith1e-12Floor': maximum_relative},
        'recordBytes': len(json.dumps(generation_envelope, separators=(',', ':')).encode()),
        'recordValues': sum(len(point['values']) for point in generation_run['points']),
        'seconds': time.monotonic() - started,
        'maxRSSBytes': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        'torch': torch.__version__, 'storage': native.storage,
        'effectiveParameterDtypes': sorted({str(parameter.dtype) for parameter in native.model.parameters()}),
        'source': native.source_digest,
    }
    write('native-observation.json', json.dumps(report, indent=2) + '\n')
    write('native-recording.json', json.dumps(prediction, separators=(',', ':')))
    write('native-generation-recording.json', json.dumps(generation_envelope, separators=(',', ':')))
    write('completion.json', json.dumps({'status': 'passed'}) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
