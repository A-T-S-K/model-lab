"""Verify the declared current binding without rewriting historical profiles."""
import json
from pathlib import Path

from adapter import (GENERATION_RECIPE, MAX_GENERATION_PROMPT_TOKENS,
                     MAX_NEW_TOKENS, MAX_TOKENS, OUTPUT_SIZE, PROFILE,
                     SELECTION_POLICY, NativePythia)

if __name__ == '__main__':
    root = Path(__file__).parent
    model = NativePythia()
    lock = model.lock
    base = json.loads((root / 'profile.json').read_text())
    declared = json.loads((root / 'profile-generation.json').read_text())
    expected = {
        'profile': PROFILE,
        'runtime': model.runtime,
        'definition': 'pythia-14m:' + lock['files']['config.json']['sha256'],
        'checkpoint': 'sha256:' + lock['files']['model.safetensors']['sha256'],
        'inputTransform': model.input_transform,
        'tokenizerSourceRevision': 'sha256:' + lock['files']['tokenizer.json']['sha256'],
        'sourceRevision': 'sha256:' + model.source_digest,
        'adapterSourceRevision': 'sha256:' + model.adapter_digest,
        'compatibilityBaseProfile': base['profile'],
        'architectureProfile': 'profile.json',
        'binding': 'native torch module hooks and ordinary GPTNeoXForCausalLM forward calls; no TransformerBridge, model reimplementation, provider fallback, remote code or pickle',
        'versions': {'python': '3.14.7', 'torch': '2.14.0', 'transformers': '5.17.0'},
        'modelRevision': lock['revision'],
        'tokenizerSize': len(model.tokenizer),
        'outputSize': OUTPUT_SIZE,
        'prediction': {'maxInputTokens': MAX_TOKENS, 'captureSchema': 'profile.json#captureSchema'},
        'generation': {'recipe': GENERATION_RECIPE, 'selectionPolicy': SELECTION_POLICY,
                       'minNewTokens': 1, 'maxNewTokens': MAX_NEW_TOKENS,
                       'maxPromptTokens': MAX_GENERATION_PROMPT_TOKENS,
                       'maxTotalTokens': MAX_TOKENS, 'honorEos': False,
                       'stochastic': False, 'captureSchema': 'profile.json#captureSchema'},
        'cache': {'capability': 'unsupported', 'qualified': False,
                  'strategy': 'full-prefix-reexecution', 'useCache': False,
                  'retainedState': False},
    }
    if declared != expected:
        raise ValueError('profile-generation.json does not match the installed pinned binding')
    print(json.dumps(expected, indent=2))
