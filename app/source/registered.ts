import nativeSource from '../../research/pythia/source.json';
import witnessProfile from '../../research/witnesses/profile.json';
import mlp from '../../research/witnesses/mlp.py?raw';
import fixtures from '../../research/witnesses/fixtures.py?raw';
import { RUNTIME_REVISION } from '../../runtime/revision.js';
import { sourceFiles } from './catalog.js';
const sources=new Map<string,string>([
  ...Object.entries(sourceFiles).map(([file,code])=>[`${RUNTIME_REVISION}:${file}`,code] as [string,string]),
  [`${nativeSource.revision}:${'transformers/models/gpt_neox/modeling_gpt_neox.py'}`,nativeSource.code],
  [`${witnessProfile.runtime}:research/witnesses/mlp.py`,mlp],
  [`${witnessProfile.runtime}:research/witnesses/fixtures.py`,fixtures],
]);
export function boundSource(source:{revision:string;file:string}){
  return sources.get(`${source.revision}:${source.file}`);
}
