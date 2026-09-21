import { sceneConstruction } from './construction.js';
import { outputSummary, componentComparison, type OutputPair } from './comparison.js';
import type { ForwardModel } from './forward.js';
import { liveLearningScene, liveLearningInspector } from './live-learning.js';
import { publicLearningScene, publicLearningCameraBox, type PublicLearningCameraPhase } from './public-learning.js';
import type { TrainingPhase } from '../worker/training-execution.js';
import type { ForwardDriver } from '../worker/forward-driver.js';
import type { ForwardBoundary } from '../../model/microgpt.js';
import { ExplanationPlayback } from "./playback.js";
import { learningScene, learningInspector, parameterLabel, learningStations } from "./learning-view.js";
import { learningPhasePresentation, type LearningModel, type LearningPhasePresentation, type LearningStage, type ParameterPin } from "./learning.js";
export { learningPhasePresentation, type LearningPhasePresentation } from "./learning.js";
import { isRegisteredWorld, type AnySpatialReadModel, type MicrogptSelection, type SpatialReadModel } from "./bindings.js";
import { SpatialCamera, HOME, PUBLIC_HOME, PUBLIC_CONTENT_BOUNDS, responsivePublicFrame, type CameraBox } from "./camera.js";
import { headKinds, operations, parameterOwners, type Address } from "./forward.js";
import { layerKinds } from "./microgpt-topology.js";
import { sceneSvg, stationFor, stationForWorld } from "./scene.js";
import { forwardInspector, addressLabel } from "./inspector.js";
import { escapeHtml as esc } from "../views/evidence.js";
import { experienceCapabilities, type ExperienceProfile } from "../presentation/experience-profile.js";
import { renderContextualDock, type DockDepth, type PublicTrainingActionState } from "./contextual-dock.js";
export { type PublicTrainingActionState } from "./contextual-dock.js";
import type { PublicLessonFocus, PublicTourState } from './public-tour.js';
import { getPendingTourActionLabel, getPublicExecutionStatus } from './public-tour.js';
import type { PublicLessonEvent, PublicLessonView } from '../presentation/public-lesson-controller.js';

export function computeTrainingActionState(
  execution: ForwardDriver | undefined,
  pin: ParameterPin,
  isPublic = false,
  tourTargetState?: PublicTourState,
  currentTourState?: PublicTourState,
): PublicTrainingActionState | undefined {
  if (!execution) return undefined;
  const progress = execution.progress;
  if (!progress?.training) return undefined;
  const e = execution;
  const t = progress.training;
  const ready = t.phase === 'ready';
  const objectivePending = isPublic
    && currentTourState === 'p2_objective'
    && tourTargetState === undefined
    && t.mean === undefined;
  const disabled = e.phase !== 'paused' || e.pending || objectivePending;
  const cancelling = e.phase === 'cancelling';
  const canPin = !t.final || t.phase === 'optimizer proposal';
  const pinLabel = t.phase === 'optimizer proposal'
    ? 'Continue to next proposal to pinned parameter'
    : 'Run to next gradient contribution';
  const frontierText = isPublic
    ? getPublicExecutionStatus({
        currentState: currentTourState ?? 'cold',
        targetState: tourTargetState,
        phase: t.phase,
        driverPhase: e.phase,
        final: t.final,
      })
    : ready
      ? 'Candidate ready — not accepted'
      : `${t.phase} · ${e.phase}${e.runningToGradient ? ' · seeking pinned contribution' : ''}${t.stopped ? (t.final ? (t.phase === 'optimizer proposal' && t.count === 0 ? ' · backward complete — no remaining contributions for this parameter in this pass' : ' · stopped at pinned proposal boundary') : ' · stopped after matching backward node') : ''}`;
  return {
    executionId: progress.executionId,
    sequence: progress.sequence,
    phase: t.phase,
    ready,
    disabled,
    cancelling,
    canPin,
    pinLabel,
    frontierText,
    acceptedStep: t.acceptedStep,
    pinnedParameter: parameterLabel(pin),
  };
}
export const waypoints=["tokenEmbedding","positionEmbedding","embeddingSum","embeddingNorm","preAttentionNorm","q","k","v","attentionLogits","attentionProbabilities","headOutput","attentionOutput","attentionProjection","attentionResidual","preMlpNorm","mlpUp","mlpRelu","mlpDown","mlpResidual","logits","probabilities"];
export interface RouteLandmark { readonly name: string; readonly purpose: string; readonly kind: string; readonly layer?: number; }
export const TOP_LEVEL_LANDMARKS: readonly RouteLandmark[] = [
  { name: 'Prediction payoff', purpose: "What does the model predict comes next? Compare token probabilities with the known target. We already know the next character, so we can compare the model's prediction with the real answer.", kind: 'probabilities' },
  { name: 'REPRESENT', purpose: "Turn the token and its position into the model's working representation and prepare it for attention.", kind: 'preAttentionNorm', layer: 0 },
  { name: 'MIX CONTEXT', purpose: 'Use causally available earlier information to update this position.', kind: 'attentionResidual', layer: 0 },
  { name: 'TRANSFORM', purpose: 'Transform the context-enriched representation before scoring possible next tokens.', kind: 'mlpResidual', layer: 0 },
  { name: 'SCORE', purpose: 'Give each possible next token a raw score.', kind: 'logits' },
  { name: 'PREDICT', purpose: 'Turn the raw token scores into a probability distribution.', kind: 'probabilities' },
];
export interface AttentionSubstep { readonly name: string; readonly technical: string; readonly purpose: string; readonly kind: string; }
export const ATTENTION_SUBSTEPS: readonly AttentionSubstep[] = [
  { name: 'Compare positions', technical: 'Q/K scores', purpose: "Compare this position's query with allowed earlier keys to produce attention scores.", kind: 'attentionLogits' },
  { name: 'Turn scores into normalized weights', technical: 'Softmax', purpose: 'Turn the causal scores into normalized attention weights across allowed earlier keys.', kind: 'attentionProbabilities' },
  { name: 'Combine carried information', technical: 'Value mixture', purpose: "Use normalized attention weights to combine information from allowed value vectors into this head's output.", kind: 'headOutput' },
  { name: 'Combine/project and add it back', technical: 'Residual', purpose: 'Project the attention result and add it back to the saved residual stream.', kind: 'attentionResidual' },
];
export const ROUTE_LANDMARKS: readonly RouteLandmark[] = TOP_LEVEL_LANDMARKS;

export interface ReverseLandmark {
  readonly stop: number;
  readonly name: string;
  readonly technical: string;
  readonly purpose: string;
  readonly kind: string;
  readonly layer?: number;
}

export const REVERSE_LANDMARKS: readonly ReverseLandmark[] = [
  { stop: 0, name: 'PREDICT', technical: 'Prediction & Objective', purpose: 'Start at the prediction: cross-entropy compares predicted probabilities with the known target token at all positions.', kind: 'probabilities' },
  { stop: 1, name: 'SCORE', technical: 'Unembedding Gradient', purpose: 'Propagate loss gradients backward into raw token scores (logits) and unembedding parameters.', kind: 'logits' },
  { stop: 2, name: 'TRANSFORM', technical: 'MLP Backward', purpose: 'Pass gradients backward through the MLP block (down-projection, ReLU activation, up-projection, and layernorm).', kind: 'mlpResidual', layer: 0 },
  { stop: 3, name: 'MIX CONTEXT', technical: 'Attention Backward', purpose: 'Pass gradients backward through multi-head attention (residual, projection, value combination, softmax probabilities, and Q/K projections).', kind: 'attentionResidual', layer: 0 },
  { stop: 4, name: 'REPRESENT', technical: 'Embedding Backward', purpose: 'Accumulate final backward gradients into token and position embeddings.', kind: 'preAttentionNorm', layer: 0 },
  { stop: 5, name: 'PARAMETER', technical: 'Gradient Accumulation', purpose: 'Accumulate scalar autograd contributions into the pinned parameter bank and its forward owner.', kind: 'tokenEmbedding' },
  { stop: 6, name: 'ADAM', technical: 'Optimizer Proposal', purpose: 'Adam computes provisional candidate weights from accumulated gradients and persistent moments.', kind: 'wte' },
];
interface Location {selection:MicrogptSelection;kind:string;element:number;parameter?:string;row:number;column:number;lens:boolean;learningStage?:LearningStage;box:CameraBox}
export interface PresentationState {profile?:ExperienceProfile;idleResetEnabled?:boolean;idleResetSeconds?:number;retention?:{bytes:number;runs:number;snapshots:number;experiments:number;hardLimitBytes?:number};attract?:boolean;exhibit?:boolean;interventionPending?:boolean;inspectedArm?:string;intervention?:{snapshot:string;arm:string;summary:string;receipt?:{policy:string;donor:readonly number[];original:readonly number[];replacement:readonly number[];noOp:boolean}};patchDonor?:{head:number;token:number};comparison?:{before:ForwardModel;after:ForwardModel}; outputPair?:OutputPair; comparisonLabels?:[string,string]; execution?:ForwardDriver;publicLesson?:PublicLessonView;publicLessonDispatch?:(event:PublicLessonEvent)=>boolean;document:string;busy:boolean;ready:boolean;status:string;error:string;scalar:string; learning?:LearningModel; experiments?:readonly {id:string;step:number}[]; experimentsWindow?:{offset:number;end:number;total:number;hasPrevious:boolean;hasNext:boolean}; experimentId?:string; liveStep?:number; canLearn?:boolean; evidenceWorld?:{label:string;replay:boolean}}
export class SpatialPresenter {
  profile?: ExperienceProfile;
  dockDepth: DockDepth = 'explain';
  construction=false;
  operatorControls=false;
  freeExplore=false;
  shortStop=-1;
  attentionSubstep?:number;
  learningRouteStop?:number;
  private publicLessonVisualKey="";
  private shortSelection?:MicrogptSelection;
  private shortMessage="";
  private shortDetour=false;
  private worldPaneObserver?: ResizeObserver;

  get derivedShortStop(): number {
    if (!this.isPublicProfile()) return this.shortStop;
    return -1;
  }

  get derivedLearningRouteStop(): number | undefined {
    if (!this.isPublicProfile()) return this.learningRouteStop;
    return this.state?.publicLesson?.content.selectionIntent.derivedReverseStop;
  }

  getResponsivePublicFrame(): CameraBox {
    const wp = document.querySelector<HTMLElement>('.world-workspace.is-public-profile > .world-pane') ?? document.querySelector<HTMLElement>('.world-pane');
    if (wp && wp.clientWidth > 0 && wp.clientHeight > 0) {
      return responsivePublicFrame(wp.clientWidth, wp.clientHeight, PUBLIC_CONTENT_BOUNDS);
    }
    return { ...PUBLIC_CONTENT_BOUNDS };
  }

  isPublicProfile(): boolean {
    const profile = this.profile ?? this.state?.profile;
    if (profile) return profile === 'visitor' || profile === 'facilitator';
    return Boolean(this.state?.exhibit);
  }

  resetVisitor(){
    const wasPublic = this.isPublicProfile();
    this.publicLessonVisualKey="";
    this.invalidate(); this.playback.cursor=0; this.playback.phase=2; this.playback.follow=true; this.playback.route="forward"; this.camera.detach();
    this.worldPaneObserver?.disconnect(); this.worldPaneObserver = undefined;
    this.camera.box = wasPublic ? this.getResponsivePublicFrame() : { ...HOME };
    this.camera.move(this.camera.box, false);
    this.history=[]; this.boundSelection=undefined; this.boundPin=undefined;
    this.model=undefined; this.state=undefined; this.routeChoice='forward';this.worldIdentity="";this.worldDefinition="";
    Object.assign(this.selection,{layer:0,query:4,key:0,head:0,feature:0});
    this.kind='attentionLogits'; this.element=0; this.parameter=undefined;
    this.row=0; this.column=0; this.pin={name:'wte',row:0,column:0};
    this.learningStage=undefined; this.learningRouteStop=undefined; this.lens=false; this.expanded=false;
    this.operatorControls=false; this.construction=false; this.shortStop=-1; this.attentionSubstep=undefined; this.shortDetour=false; this.shortSelection=undefined; this.shortMessage="";
    this.freeExplore=false; this.dockDepth='explain';
  }
  applyPublicLessonView(view: PublicLessonView, force = false) {
    if (!this.isPublicProfile()) return;
    const visualState = view.currentState;
    const visualMode = view.navigation.mode;
    const key = `${visualState}:${view.outcome ?? ''}:${visualMode}`;
    this.freeExplore = visualMode === 'explore';
    if (visualMode === 'detail' || visualMode === 'explore') {
      this.publicLessonVisualKey = key;
      return;
    }
    if (!this.model) return;
    if (!force && key === this.publicLessonVisualKey) return;
    this.publicLessonVisualKey = key;
    const intent = view.content.selectionIntent;
    this.attentionSubstep = undefined;
    this.dockDepth = 'explain';
    this.construction = Boolean(view.content.focus);
    this.lens = false;
    this.shortDetour = false;
    this.shortMessage = '';
    if (visualState === 'candidate_ready') {
      this.go({ kind: 'probabilities', token: intent.token ?? 3 }, true);
    } else if (intent.derivedReverseStop === 5) {
      const ownerKind = parameterOwners[this.pin.name] ?? 'tokenEmbedding';
      this.go({ kind: ownerKind, token: intent.token }, true);
    } else if (intent.derivedReverseStop === 6) {
      this.go({ kind: this.pin.name, token: intent.token }, true);
    } else {
      this.go({kind:intent.kind,token:intent.token,...(intent.layer !== undefined ? { layer: intent.layer } : {}),...(intent.head !== undefined ? { head: intent.head } : {})}, true);
    }
    if (intent.key !== undefined) this.selection.key = intent.key;
    this.frame();
  }
  private applyPublicLessonFocus(root: HTMLElement, focus: PublicLessonFocus | undefined, view: PublicLessonView, model: SpatialReadModel) {
    root.querySelectorAll('.explanation-active,.explanation-input,.explanation-link').forEach(el =>
      el.classList.remove('explanation-active', 'explanation-input', 'explanation-link')
    );
    if (
      view.navigation.mode === 'detail' ||
      view.navigation.mode === 'explore' ||
      this.state?.attract ||
      view.content.state === 'cold' ||
      view.content.state === 'tour_complete'
    ) return;

    const repeated = model.forward.descriptor.presentation === 'microgpt-repeated-blocks';
    const nodeSelector = (kind: string, layer?: number, head?: number) =>
      `[data-world-kind="${kind}"]${repeated && layer !== undefined ? `[data-world-layer="${layer}"]` : ''}${head !== undefined ? `[data-world-head="${head}"]` : ''}`;

    for (const node of focus?.nodes ?? []) {
      root.querySelectorAll(nodeSelector(node.kind, node.layer, node.head))
        .forEach(el => el.classList.add('explanation-input'));
    }

    const anchor = view.content.selectionIntent;
    const anchorElements = anchor.parameter
      ? Array.from(root.querySelectorAll('[data-world-parameter]')).filter(el => el.getAttribute('data-world-parameter') === anchor.parameter)
      : Array.from(root.querySelectorAll(nodeSelector(anchor.kind, anchor.layer, anchor.head)));
    for (const el of anchorElements) {
      el.classList.remove('explanation-input');
      el.classList.add('explanation-active');
    }

    for (const edge of focus?.edges ?? []) {
      const headSelector = edge.head === undefined ? '' : `[data-edge-head="${edge.head}"]`;
      const selectedSelector = edge.selected === 'key'
        ? '[data-selected-key-edge]'
        : edge.selected === 'value'
          ? '[data-selected-value-edge]'
          : '';
      root.querySelectorAll(
        `[data-edge-from="${edge.from}"][data-edge-to="${edge.to}"]${headSelector}${selectedSelector}`
      ).forEach(el => el.classList.add('explanation-link'));
    }
  }
  private positionPublicTeachingLocator(root: HTMLElement) {
    const locator = root.querySelector<HTMLElement>('[data-testid="teaching-locator"]');
    const pane = root.querySelector<HTMLElement>('.world-workspace.is-public-profile > .world-pane');
    const view = this.state?.publicLesson;
    if (!locator || !pane || !view || view.navigation.mode !== 'guided') return;

    const intent = view.content.selectionIntent;
    const repeated = this.model?.forward.descriptor.presentation === 'microgpt-repeated-blocks';
    const nodeSelector = (kind: string, layer?: number, head?: number) =>
      `[data-world-kind="${kind}"]${repeated && layer !== undefined ? `[data-world-layer="${layer}"]` : ''}${head !== undefined ? `[data-world-head="${head}"]` : ''}`;
    const anchor = intent.parameter
      ? Array.from(root.querySelectorAll('[data-world-parameter]')).find(el => el.getAttribute('data-world-parameter') === intent.parameter)
      : root.querySelector(nodeSelector(intent.kind, intent.layer, intent.head));
    if (!anchor) return;

    const anchorRect = (anchor.querySelector('rect.field, rect') ?? anchor).getBoundingClientRect();
    const paneRect = pane.getBoundingClientRect();
    const locatorRect = locator.getBoundingClientRect();
    if (paneRect.width <= 0 || paneRect.height <= 0 || locatorRect.width <= 0 || locatorRect.height <= 0) return;

    const margin = 12;
    const gap = 14;
    const width = locatorRect.width;
    const height = locatorRect.height;
    const anchorCenterX = anchorRect.left - paneRect.left + anchorRect.width / 2;
    const anchorCenterY = anchorRect.top - paneRect.top + anchorRect.height / 2;
    const candidates = [
      { placement: 'above', left: anchorCenterX - width / 2, top: anchorRect.top - paneRect.top - height - gap },
      { placement: 'below', left: anchorCenterX - width / 2, top: anchorRect.bottom - paneRect.top + gap },
      { placement: 'right', left: anchorRect.right - paneRect.left + gap, top: anchorCenterY - height / 2 },
      { placement: 'left', left: anchorRect.left - paneRect.left - width - gap, top: anchorCenterY - height / 2 },
    ];
    const fits = (candidate: { left: number; top: number }) =>
      candidate.left >= margin &&
      candidate.top >= margin &&
      candidate.left + width <= paneRect.width - margin &&
      candidate.top + height <= paneRect.height - margin;
    const preferred = candidates.find(fits);
    const fallback = preferred ?? (
      paneRect.bottom - anchorRect.bottom >= anchorRect.top - paneRect.top ? candidates[1] : candidates[0]
    );
    const maxLeft = Math.max(margin, paneRect.width - width - margin);
    const maxTop = Math.max(margin, paneRect.height - height - margin);
    locator.style.left = `${Math.round(Math.min(maxLeft, Math.max(margin, fallback.left)))}px`;
    locator.style.top = `${Math.round(Math.min(maxTop, Math.max(margin, fallback.top)))}px`;
    locator.dataset.placement = fallback.placement;
    locator.style.visibility = 'visible';
  }
  private dispatchPublicLesson(event: PublicLessonEvent): boolean {
    return this.state?.publicLessonDispatch?.(event) ?? false;
  }
  private shortRoute(index:number){
    this.attentionSubstep=undefined; this.learningRouteStop=undefined; this.dockDepth='explain';
    const landmark=TOP_LEVEL_LANDMARKS[index]??TOP_LEVEL_LANDMARKS[0];
    this.go({kind:landmark.kind,token:this.selection.query,...(landmark.layer!==undefined?{layer:landmark.layer}:{}),...(headKinds.has(landmark.kind)?{head:this.selection.head}:{})});
    this.shortStop=index; this.shortSelection={...this.selection}; this.shortMessage=""; this.shortDetour=false; this.construction=true; this.lens=false;
  }
  private attentionRoute(substep:number){
    this.shortStop=2; this.learningRouteStop=undefined;
    this.attentionSubstep=substep; this.dockDepth='explain';
    const step=ATTENTION_SUBSTEPS[substep]??ATTENTION_SUBSTEPS[0];
    this.go({kind:step.kind,token:this.selection.query,layer:0,...(headKinds.has(step.kind)?{head:this.selection.head}:{})});
    this.shortSelection={...this.selection}; this.shortMessage=""; this.shortDetour=false; this.construction=true; this.lens=false;
  }
  reverseRoute(stop: number) {
    this.shortStop = -1;
    this.attentionSubstep = undefined;
    this.learningRouteStop = stop;
    this.dockDepth = 'explain';
    this.construction = false;
    this.lens = false;
    const landmark = REVERSE_LANDMARKS[stop] ?? REVERSE_LANDMARKS[0];
    if (stop === 5) {
      const ownerKind = parameterOwners[this.pin.name] ?? 'tokenEmbedding';
      this.go({ kind: ownerKind, token: this.selection.query }, true);
    } else if (stop === 6) {
      this.go({ kind: this.pin.name, token: this.selection.query }, true);
    } else {
      this.go({
        kind: landmark.kind,
        token: this.selection.query,
        ...(landmark.layer !== undefined ? { layer: landmark.layer } : {}),
        ...(headKinds.has(landmark.kind) ? { head: this.selection.head } : {}),
      }, true);
    }
    this.shortDetour = false;
    this.frame();
  }
  private redraw=()=>{};
  private guideApply=()=>{};
  readonly playback=new ExplanationPlayback(()=>this.redraw(),()=>this.guideApply(),2200,()=>this.emphasize());
  private emphasize(){const root=document.querySelector<HTMLElement>(".spatial-shell");if(root)root.dataset.explanationPhase=String(this.playback.phase);}
  private boundSelection?:MicrogptSelection;
  private boundPin?:ParameterPin;
  private state?:PresentationState;
  private phase?:(phase:string)=>void;
  private model?:SpatialReadModel;
  private worldIdentity="";
  private worldDefinition="";
  private routeChoice:'forward'|'learning'='forward';
  /** A new model definition or run clears semantic/history state before any DOM is composed. */
  bindWorld(model:AnySpatialReadModel,preserveMappedState=false):boolean {
    const descriptor=isRegisteredWorld(model)?model.world.descriptor:model.forward.descriptor;
    const runId=isRegisteredWorld(model)?model.world.run:model.forward.runId;
    const identity=`${descriptor.modelDefinition}/${runId}`;
    if(identity===this.worldIdentity)return false;
    const sameDefinition=this.worldDefinition===descriptor.modelDefinition;
    this.worldDefinition=descriptor.modelDefinition;
    if(sameDefinition&&preserveMappedState){this.worldIdentity=identity;return false;}
    this.worldIdentity=identity;this.invalidate();this.history=[];this.parameter=undefined;this.learningStage=undefined;this.lens=false;this.row=0;this.column=0;
    if(isRegisteredWorld(model)){
      this.camera.move({...model.presentation.viewport},false);return true;
    }
    if(!sameDefinition||this.selection.layer>=model.forward.layers||this.selection.head>=model.forward.heads||this.selection.query>=model.forward.input.length||this.selection.key>=model.forward.input.length||this.selection.feature>=model.width)
      Object.assign(this.selection,{layer:0,query:Math.max(0,model.forward.input.length-1),key:0,head:0,feature:0});
    this.kind='attentionLogits';this.element=0;this.pin={name:'wte',row:0,column:0};
    this.camera.move(model.forward.descriptor.presentation==='microgpt-canonical-curated'?(this.isPublicProfile()?this.getResponsivePublicFrame():{...HOME}):{x:0,y:0,width:1250+model.forward.layers*2500,height:Math.max(1500,420+model.forward.heads*270)},false);
    return true;
  }
  interrupt(preserveFrame=false){this.playback.pause(true);this.camera.stop();if(!preserveFrame)this.pendingBox=undefined;this.detour=this.guided;
    const root=document.querySelector('.spatial-shell'),button=root?.querySelector('#explanation-play');if(button)button.textContent='Play';
    root?.querySelectorAll('.explanation-active,.explanation-input,.explanation-link').forEach(el=>el.classList.remove('explanation-active','explanation-input','explanation-link'));
  }
  invalidate(){this.shortStop=-1;this.attentionSubstep=undefined;this.learningRouteStop=undefined;this.shortDetour=false;this.shortSelection=undefined;this.shortMessage="";this.playback.invalidate();this.guided=false;this.detour=false;this.step=0;this.camera.stop();this.pendingBox=undefined;}
  private guide(){
    if(!this.boundSelection)return;
    Object.assign(this.selection,this.boundSelection);
    if(this.boundPin)this.pin={...this.boundPin};
    this.guided=true;this.detour=false;
    if(this.playback.route==='forward'){
      this.step=this.playback.cursor;const kind=waypoints[this.step];
      this.go({kind,token:['k','v'].includes(kind)?this.selection.key:this.selection.query,...(headKinds.has(kind)?{head:this.selection.head}:{})},true);
    }else{
      const stages:LearningStage[]=['objective','gradient','adam','checkpoint','compare'];
      this.openLearning(stages[this.playback.cursor]);this.parameter=undefined;
      if(this.learningStage==='compare')this.kind='probabilities';
      const node=learningStations.find(s=>s.stage===this.learningStage)??learningStations[3];
      this.pendingBox={x:node.x-50,y:1160,width:820,height:460};
      if(!this.playback.follow)this.pendingBox=undefined;
      this.phase?.(this.playback.cursor>=3?'after':'training');
    }
    if(!this.playback.follow)this.pendingBox=undefined;
  }
  private start(){
    const source=this.routeChoice==='forward'?this.model?.source.sourceRunId:this.state?.learning?.available?this.state.learning.experiment.id:undefined;
    if(!source)return;
    this.boundSelection={...this.selection};this.boundPin={...this.pin};
    this.playback.bind(source,this.routeChoice,this.routeChoice==='forward'?waypoints.length:5);
  }
  followBoundary(boundary: ForwardBoundary) {
    if (this.isPublicProfile()) return;
    if(this.kind === boundary.kind && this.address().token === boundary.token && (boundary.head===undefined || this.selection.head === boundary.head)) return;
    this.go(boundary, true);
  }
  private controls(){
    const e=this.state?.execution;
    const isKiosk = Boolean(this.state?.exhibit);
    const profile = this.state?.profile ?? (isKiosk ? (this.operatorControls ? 'facilitator' : 'visitor') : 'workbench');
    const capabilities = experienceCapabilities(profile, this.freeExplore);
    if(e?.progress?.training) {
      const t=e.progress.training,ready=t.phase==='ready',disabled=e.phase!=='paused'||e.pending;
      const bridge = `<div class="learning-bridge" data-testid="learning-bridge" aria-label="Prediction to learning causal bridge"><div class="bridge-chain"><span class="bridge-step">1 · Predictions for known targets</span><span class="bridge-arrow" aria-hidden="true">→</span><span class="bridge-step">2 · Per-position losses combine into training objective</span><span class="bridge-arrow" aria-hidden="true">→</span><span class="bridge-step">3 · Backpropagation carries backward signal</span><span class="bridge-arrow" aria-hidden="true">→</span><span class="bridge-step">4 · Parameter uses produce gradient contributions</span><span class="bridge-arrow" aria-hidden="true">→</span><span class="bridge-step">5 · Contributions accumulate into final gradient</span><span class="bridge-arrow" aria-hidden="true">→</span><span class="bridge-step">6 · Adam uses final gradient for parameter proposal</span><span class="bridge-arrow" aria-hidden="true">→</span><span class="bridge-step">7 · Provisional candidate: Accept or Discard</span></div><p class="bridge-scope">We follow one selected parameter (${esc(parameterLabel(this.pin))}) to observe one real contribution arrive and accumulate into its partial gradient. The combined training objective uses losses across all target positions, and candidate proposals remain provisional until accepted.</p></div>`;
      if(!capabilities.executionDiagnostics) {
        return `<section class="explanation execution" id="execution-controls" data-execution-id="${esc(e.progress.executionId)}" data-sequence="${e.progress.sequence}" data-training-phase="${t.phase}">${bridge}<nav aria-label="Live training execution">${ready?`<button id="execution-accept" ${disabled?'disabled':''}>Accept update</button>`:`<button id="execution-continue" ${disabled?'disabled':''}>Continue</button>${!t.final || t.phase==='optimizer proposal'?`<button id="execution-pin" ${disabled?'disabled':''}>${t.phase==='optimizer proposal'?'Continue to next proposal to pinned parameter':'Run to next gradient contribution'}</button>`:''}`}<button id="execution-cancel" ${e.phase==='cancelling'?'disabled':''}>${ready?'Discard candidate':'Cancel training'}</button><span data-testid="execution-frontier">${ready?'Candidate ready — not accepted':`${esc(t.phase)} · ${e.phase}${e.runningToGradient?' · seeking pinned contribution':''}${t.stopped?(t.final?(t.phase==='optimizer proposal'&&t.count===0?' · backward complete — no remaining contributions for this parameter in this pass':' · stopped at pinned proposal boundary'):' · stopped after matching backward node'):''}`}</span></nav>${!ready?'<p class="learning-guidance" data-testid="learning-guidance">Run to next gradient contribution runs the required phases, then pauses after the next matching backward node for the pinned parameter. Repeated operands in one node finish together. Continue runs to Candidate ready; Accept / Discard remains your decision.</p>':""}${t.final&&!ready?'<p data-testid="gradient-stop-unavailable">No future backward contributions in this transaction. Continue toward Ready or inspect the completed gradient; new learning is a separate action.</p>':''}<p>Accepted step ${t.acceptedStep} · pinned ${esc(parameterLabel(this.pin))} → proposed step ${t.acceptedStep+1} · candidate remains provisional${t.proposal?` · θ ${t.proposal.before} → ${t.proposal.after} (one part of the full update)`:""}</p></section>`;
      }
      return `<section class="explanation execution" id="execution-controls" data-execution-id="${esc(e.progress.executionId)}" data-sequence="${e.progress.sequence}" data-training-phase="${t.phase}">${bridge}<nav aria-label="Live training execution">${ready?`<button id="execution-accept" ${disabled?'disabled':''}>Accept update</button>`:`<button id="execution-next" ${disabled?'disabled':''}>${t.phase==='backward'?'Next backward node':t.phase==='optimizer proposal'?'Next parameter proposal':'Next step'}</button><button id="execution-continue" ${disabled?'disabled':''}>Continue</button><button id="execution-pause" ${e.phase!=='running'?'disabled':''}>Pause</button>${!t.final || t.phase==='optimizer proposal'?`<button id="execution-pin" ${disabled?'disabled':''}>${t.phase==='optimizer proposal'?'Continue to next proposal to pinned parameter':'Run to next gradient contribution'}</button>`:''}`}<button id="execution-cancel" ${e.phase==='cancelling'?'disabled':''}>${ready?'Discard candidate':'Cancel training'}</button><label><input id="execution-follow" type="checkbox" ${e.follow?'checked':''}>Follow execution</label><span data-testid="execution-frontier">${ready?'Candidate ready — not accepted':`${esc(t.phase)} · ${e.phase}${e.runningToGradient?' · seeking pinned contribution':''}${t.stopped?(t.final?(t.phase==='optimizer proposal'&&t.count===0?' · backward complete — no remaining contributions for this parameter in this pass':' · stopped at pinned proposal boundary'):' · stopped after matching backward node'):''}`}</span></nav>${!ready?'<p class="learning-guidance" data-testid="learning-guidance">Run to next gradient contribution runs the required phases, then pauses after the next matching backward node for the pinned parameter. Repeated operands in one node finish together. Continue runs to Candidate ready; Accept / Discard remains your decision. Manual Next step remains available.</p>':""}${t.final&&!ready?'<p data-testid="gradient-stop-unavailable">No future backward contributions in this transaction. Continue toward Ready or inspect the completed gradient; new learning is a separate action.</p>':''}<p>Accepted step ${t.acceptedStep} · pinned ${esc(parameterLabel(this.pin))} → proposed step ${t.acceptedStep+1} · candidate remains provisional${t.proposal?` · θ ${t.proposal.before} → ${t.proposal.after} (one part of the full update)`:""}</p><details><summary>Execution diagnostics</summary><p>${t.count} units · last permit ${t.processed} · one explicit baseline pass · Continue ≤128 backward nodes/proposals per permit</p></details></section>`;
    }
    if(e){const label=(b?:ForwardBoundary)=>b?`${b.kind} · p${b.token}${b.layer===undefined?'':` / layer ${b.layer}`}${b.head===undefined?'':` / head ${b.head}`}`:'none';
      if(!capabilities.executionDiagnostics) {
        return `<section class="explanation execution" id="execution-controls" data-execution-id="${esc(e.progress?.executionId??'')}" data-sequence="${e.progress?.sequence??0}"><nav aria-label="Live prediction execution"><button id="execution-continue" ${e.phase!=='paused'||e.pending?'disabled':''}>Continue</button><button id="execution-cancel" ${e.phase==='cancelling'?'disabled':''}>Cancel execution</button><span data-testid="execution-frontier">${e.pending&&e.phase==='paused'?'stepping':esc(e.phase)} · ${e.progress?.sequence??0}/${e.progress?.total??'—'}</span></nav><p>Real operator permits · partial evidence is not history · paced control, not processor timing</p></section>`;
      }
      return `<section class="explanation execution" id="execution-controls" data-execution-id="${esc(e.progress?.executionId??'')}" data-sequence="${e.progress?.sequence??0}"><nav aria-label="Live prediction execution"><button id="execution-next" ${e.phase!=='paused'||e.pending?'disabled':''}>Next operator</button><button id="execution-continue" ${e.phase!=='paused'||e.pending?'disabled':''}>Continue</button><button id="execution-pause" ${e.phase!=='running'?'disabled':''}>Pause</button><button id="execution-cancel" ${e.phase==='cancelling'?'disabled':''}>Cancel execution</button><label><input id="execution-follow" type="checkbox" ${e.follow?'checked':''}>Follow execution</label><span data-testid="execution-frontier">${e.pending&&e.phase==='paused'?'stepping':esc(e.phase)} · ${e.progress?.sequence??0}/${e.progress?.total??'—'} · Last: ${label(e.progress?.last)} → Next: ${label(e.progress?.next)}</span></nav><p>Real operator permits · partial evidence is not history · paced control, not processor timing</p></section>`;
    }
    if(this.state?.evidenceWorld){const p=this.playback,available=this.model?.valid;return `<section class="explanation"><nav aria-label="Explanation playback"><strong>Forward evidence</strong><button id="explanation-play" ${available?'':'disabled'}>${p.playing?'Pause':'Play'}</button><button id="waypoint-previous" ${p.source?'':'disabled'}>Previous</button><button id="waypoint-next" ${p.source?'':'disabled'}>Next</button><button id="explanation-restart" ${available?'':'disabled'}>Restart explanation</button><button id="waypoint-resume" ${available?'':'disabled'}>Resume explanation</button><label><input id="explanation-follow" type="checkbox" ${p.follow?'checked':''}>Camera follow</label><span id="waypoint-status" data-testid="explanation-status">${p.source?`${p.exploring?'Explore detour':p.playing?'Playing':'Paused'} · ${p.cursor+1}/${p.length}`:available?'Ready':'Unavailable'}</span></nav><p>Saved/retained evidence playback only · no native request, worker, training, optimizer, scalar continuation or state mutation.</p></section>`;}
const p=this.playback,available=this.routeChoice==='forward'?this.model?.valid:this.state?.learning?.available;
    return `<section class="explanation"><nav aria-label="Explanation playback"><label>Explain<select id="explanation-route"><option value="forward" ${this.routeChoice==='forward'?'selected':''}>Forward</option><option value="learning" ${this.routeChoice==='learning'?'selected':''}>Learning</option></select></label><button id="explanation-play" ${available?'':'disabled'}>${p.playing?'Pause':'Play'}</button><button id="waypoint-previous" ${p.source?'':'disabled'}>Previous</button><button id="waypoint-next" ${p.source?'':'disabled'}>Next</button><button id="explanation-restart" ${available?'':'disabled'}>Restart explanation</button><button id="waypoint-resume" ${available?'':'disabled'}>Resume explanation</button><label><input id="explanation-follow" type="checkbox" ${p.follow?'checked':''}>Camera follow</label><span class="explanation-phase" aria-hidden="true"><span>Inputs</span> → <span>Calculation</span> → <span>Result / consumer</span></span><span id="waypoint-status" data-testid="explanation-status">${p.source?`${p.exploring?'Explore detour':p.playing?'Playing':'Paused'} · ${p.cursor+1}/${p.length}`:available?'Ready':'Unavailable: select a complete retained transition'}</span></nav><p>Completed evidence · explanation controls never execute or pause Predict / Learn.</p></section>`;
  }
  readonly camera=new SpatialCamera();
  learningStage?:LearningStage;
  pin:ParameterPin={name:"wte",row:0,column:0};
  expanded=false;
  openLearning(stage:LearningStage){if(this.shortStop>=0)this.shortDetour=true;this.learningStage=stage;this.lens=true;this.construction=false;}
  focusLearning(stage:LearningStage){if(this.shortStop>=0)this.shortDetour=true;this.interrupt();this.remember();this.openLearning(stage);const node=learningStations.find(s=>s.stage===stage)??learningStations[2];this.pendingBox={x:node.x-50,y:1160,width:820,height:460};}
  followLearning(stage: LearningStage) {
    if (this.isPublicProfile()) return;
    if (this.learningStage === stage && this.lens) return;
    this.openLearning(stage); const node = learningStations.find(s => s.stage === stage) ?? learningStations[2];
    this.pendingBox = { x: node.x-50, y:1160, width:820, height:460 };
  }
  followPublicLearning(phase: TrainingPhase, rowsCount = 4) {
    if (this.isPublicProfile()) {
      this.pendingBox = undefined;
      return;
    }
    if (phase.endsWith('forward')) return;
    const target: PublicLearningCameraPhase = phase === 'loss'
      ? 'objective'
      : phase === 'backward seed' || phase === 'backward'
        ? 'parameter'
        : 'adam';
    const box = publicLearningCameraBox(target, this.pin, { rowsCount });
    if (
      this.camera.box.x === box.x &&
      this.camera.box.y === box.y &&
      this.camera.box.width === box.width &&
      this.camera.box.height === box.height
    ) {
      return;
    }
    this.pendingBox = box;
  }
  captureLocation(): Location { return { selection:{...this.selection},kind:this.kind,element:this.element,parameter:this.parameter,row:this.row,column:this.column,lens:this.lens,learningStage:this.learningStage,box:{...this.camera.box} }; }
  restoreLocation(location: Location) {
    Object.assign(this.selection,location.selection);this.kind=location.kind;this.element=location.element;this.parameter=location.parameter;
    this.row=location.row;this.column=location.column;this.lens=location.lens;this.learningStage=location.learningStage;this.pendingBox=location.box;
  }
  showOwner(){this.go({kind:this.pin.name,token:this.selection.query});}

  kind="attentionLogits";
  element=0;
  parameter?:string;
  private headWidth=4;
  row=0;column=0;lens=false;step=0;guided=false;detour=false;
  private history:Location[]=[];
  private pendingBox?:CameraBox;
  constructor(readonly selection:MicrogptSelection){
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.interrupt();this.redraw();}});
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{this.camera.stop();});
  }
  address():Address{return {kind:this.kind,token:["k","v"].includes(this.kind)?this.selection.key:this.selection.query,...(layerKinds.has(this.kind)?{layer:this.selection.layer}:{}),...(headKinds.has(this.kind)?{head:this.selection.head}:{})};}
  private remember(){this.history.push({selection:{...this.selection},kind:this.kind,element:this.element,parameter:this.parameter,row:this.row,column:this.column,lens:this.lens,learningStage:this.learningStage,box:{...this.camera.box}});if(this.history.length>40)this.history.shift();}
  focusSelection(){this.frame();if(this.pendingBox){this.camera.move(this.pendingBox,false);this.pendingBox=undefined;}}
  private frame(){
    if (this.isPublicProfile()) {
      this.pendingBox = undefined;
      return;
    }
    if(this.learningRouteStop !== undefined && this.learningRouteStop >= 0){
      if(this.learningRouteStop === 0){
        this.pendingBox = publicLearningCameraBox('objective', this.pin);
        return;
      }
      if(this.learningRouteStop === 5){
        this.pendingBox = publicLearningCameraBox('parameter', this.pin);
        return;
      }
      if(this.learningRouteStop === 6){
        this.pendingBox = publicLearningCameraBox('adam', this.pin);
        return;
      }
      const landmark = REVERSE_LANDMARKS[this.learningRouteStop];
      if(landmark){
        const s = stationFor(landmark.kind);
        this.pendingBox = { x: s.x - 440, y: s.y - 260, width: 1040, height: 740 };
        return;
      }
    }
    if(this.learningStage){const node=learningStations.find(s=>s.stage===this.learningStage)??learningStations[2];this.pendingBox={x:node.x-50,y:1160,width:820,height:460};return;}
    const s=this.model?stationForWorld(this.model.forward,this.parameter??this.kind,this.selection.head,this.selection.layer):stationFor(this.parameter??this.kind,this.selection.head);
    this.pendingBox={x:s.x-440,y:s.y-260,width:1040,height:740};
  }
  private go(address:Address, guided=false){
    if(!guided){this.interrupt();this.remember();}
    this.learningStage=undefined;
    const owner=this.model?.forward.parameterOwners[address.kind];this.parameter=owner?address.kind:parameterOwners[address.kind]?address.kind:undefined;
    if(!this.parameter)this.kind=address.kind;else this.pin={name:this.parameter,row:this.row,column:this.column};
    if(["k","v"].includes(address.kind))this.selection.key=address.token;else this.selection.query=address.token;
    if(address.head!==undefined)this.selection.head=address.head;
    if(address.layer!==undefined)this.selection.layer=address.layer;
    this.element=address.kind==="attentionLogits"?this.selection.key:["q","k","v"].includes(address.kind)?this.selection.head*this.headWidth+this.selection.feature:0;this.lens=true;this.construction=false;this.detour=this.guided&&!guided;this.frame();
  }
  render(m:AnySpatialReadModel|undefined,state:PresentationState) {
    if(m&&isRegisteredWorld(m))return m.presentation.render({status:state.status,error:state.error,replay:Boolean(state.evidenceWorld?.replay)});
    this.model=m;this.state=state;if(state.profile)this.profile=state.profile;
    if(state.publicLesson&&this.isPublicProfile())this.applyPublicLessonView(state.publicLesson);
    const p=this.playback;
    if(p.source && (state.busy||!m||!m.valid|| (p.route==='forward'?m.source.sourceRunId!==p.source:!state.learning?.available||state.learning.experiment.id!==p.source)))this.invalidate();
    const s=this.selection,a=this.address();
    const isKiosk = Boolean(state.exhibit);
    const profile = state.profile ?? (isKiosk ? (this.profile === 'facilitator' ? 'facilitator' : 'visitor') : 'workbench');
    if (state.profile) this.profile = state.profile;
    const capabilities = experienceCapabilities(profile, this.freeExplore);
    const isVisitor = profile === 'visitor';
    const isFacilitator = profile === 'facilitator';
    const isWorkbench = profile === 'workbench';
    const isPublicProfile = isVisitor || isFacilitator;
    const lensActive = this.lens && (!isWorkbench || !this.construction);
    const sceneOpen = this.construction && !lensActive && !this.learningStage && (!state.intervention || !lensActive);
    const prepared=state.execution?.progress?.training?.readyOutputs;
    const pair=prepared??state.outputPair;
    const labels:[string,string]=prepared?['Current','Candidate']:state.comparisonLabels??['Before','After'];
    const options=(labels:string[],selected:number)=>`${selected>=labels.length?`<option value="${selected}" selected>${selected} · unavailable</option>`:""}${labels.map((label,i)=>`<option value="${i}" ${selected===i?"selected":""}>${esc(label)}</option>`).join("")}`;
    const label=this.learningStage?`${this.learningStage} · ${parameterLabel(this.pin)}`:this.parameter??`${m?.forward.operations.find(operation=>operation.kind===a.kind)?.title??addressLabel(a)}${a.layer===undefined?'':` · L${a.layer}`} · p${a.token}${a.head===undefined?'':` / h${a.head}`}`;
    const showDeeperControls = capabilities.defaultSemanticSelectors;
    const hardLimitMiB = ((state.retention?.hardLimitBytes ?? 32 * 1024 * 1024) / 1048576).toFixed(0);
    const retainedMiB = ((state.retention?.bytes ?? 0) / 1048576).toFixed(1);
    const retentionWording = `${state.retention?.runs??0} retained runs · ${retainedMiB} MiB retained of ${hardLimitMiB} MiB durable archive limit; this is durable retained evidence capacity, not total page/process memory.`;
    const isAttn = this.attentionSubstep !== undefined;
    const currSubstep = this.attentionSubstep ?? 0;
    const currentAttnStep = ATTENTION_SUBSTEPS[currSubstep];
    const currStop = this.shortStop < 0 ? 0 : this.shortStop;
    const currentLandmark = TOP_LEVEL_LANDMARKS[currStop];

    let lessonProgress = "";
    let routePurpose = "";
    let primaryAction = "";
    let attentionAction = "";

    const tourContent = isPublicProfile ? state.publicLesson?.content : undefined;
    const publicCurrentState = state.publicLesson?.canonicalState ?? 'cold';
    const publicTargetState = state.publicLesson?.targetState;
    const publicNavigationMode = state.publicLesson?.navigation.mode ?? 'guided';
    const trainingState = computeTrainingActionState(
      state.execution,
      this.pin,
      isPublicProfile,
      publicTargetState,
      publicCurrentState,
    );
    const publicTeachingLocator = (() => {
      if (!tourContent || state.attract || state.evidenceWorld || publicNavigationMode !== 'guided') return '';
      if (tourContent.state === 'cold' || tourContent.state === 'p1_complete' || tourContent.state === 'tour_complete') return '';
      const intent = tourContent.selectionIntent;
      const occurrence = [
        intent.parameter ? `${intent.parameter}[${this.pin.row},${this.pin.column}]` : `p${intent.token}`,
        intent.head === undefined ? '' : `h${intent.head}`,
      ].filter(Boolean).join(' · ');
      return `<div class="teaching-locator" data-testid="teaching-locator" data-world-kind="${esc(intent.kind)}" data-world-parameter="${esc(intent.parameter ?? '')}"><strong>${esc(tourContent.headline)}</strong>${occurrence ? `<span>${esc(occurrence)}</span>` : ''}</div>`;
    })();
    if (tourContent) {
      if (state.attract) {
        lessonProgress = "";
        routePurpose = tourContent.routePurpose;
        primaryAction = `<button id="exhibit-start" class="primary-action" ${state.ready && !state.busy ? '' : 'disabled'}>Start · explore a real prediction</button>`;
        attentionAction = "";
      } else if (publicNavigationMode !== 'guided') {
        lessonProgress = tourContent.progress;
        routePurpose = tourContent.routePurpose;
        primaryAction = '';
        attentionAction = '';
      } else if (tourContent.state === 'candidate_ready') {
        lessonProgress = tourContent.progress;
        routePurpose = tourContent.routePurpose;
        primaryAction = '';
        attentionAction = '';
      } else {
        lessonProgress = tourContent.progress;
        routePurpose = tourContent.routePurpose;
        if (tourContent.primaryAction) {
          const isPending = Boolean(publicTargetState);
          const isMeasuringObjective = tourContent.state === 'p2_objective'
            && !isPending
            && trainingState?.disabled === true
            && state.execution?.progress?.training?.mean === undefined;
          const isWorking = isPending || isMeasuringObjective;
          const label = isMeasuringObjective
            ? 'Measuring error...'
            : isPending
              ? getPendingTourActionLabel(publicCurrentState)
              : tourContent.primaryAction.label;
          const disabled = isWorking || Boolean(tourContent.primaryAction.disabled);
          primaryAction = `<button id="${tourContent.primaryAction.id}" class="primary-action${isWorking ? ' is-working' : ''}" ${disabled ? 'disabled' : ''}>${esc(label)}</button>`;
        }
        if (tourContent.optionalActions.length > 0) {
          attentionAction = tourContent.optionalActions.map(act =>
            `<button id="${act.id}" class="secondary-action" ${act.disabled ? 'disabled' : ''}>${esc(act.label)}</button>`
          ).join('');
        } else {
          attentionAction = '';
        }
      }
    } else if (this.learningRouteStop !== undefined && this.learningRouteStop >= 0) {
      const stop = this.learningRouteStop;
      const landmark = REVERSE_LANDMARKS[stop] ?? REVERSE_LANDMARKS[0];
      lessonProgress = `Learning · Stop ${stop + 1} of ${REVERSE_LANDMARKS.length} · ${landmark.name}`;
      routePurpose = landmark.purpose;
      if (stop < REVERSE_LANDMARKS.length - 1) {
        primaryAction = `<button id="reverse-continue" class="primary-action">Continue: ${REVERSE_LANDMARKS[stop + 1].name}</button>`;
      } else {
        primaryAction = `<button id="reverse-continue" class="primary-action">Back to Predict</button>`;
      }
      if (stop > 0) {
        attentionAction = `<button id="reverse-previous" class="secondary-action">Previous: ${REVERSE_LANDMARKS[stop - 1].name}</button>`;
      } else {
        attentionAction = `<button id="reverse-exit" class="secondary-action">Forward route</button>`;
      }
    } else if (state.execution?.progress?.training) {
      const t = state.execution.progress.training;
      const presentation = learningPhasePresentation(t.phase, {
        final: t.final,
        count: t.count,
        pinLabel: parameterLabel(this.pin),
      });
      lessonProgress = presentation.label;
      routePurpose = presentation.purpose;
      primaryAction = "";
      attentionAction = "";
    } else if (isAttn) {
      lessonProgress = `Attention detail · Step ${currSubstep + 1} of 4 · ${currentAttnStep.name}`;
      routePurpose = currentAttnStep.purpose;
      if (currSubstep < 3) {
        primaryAction = `<button id="short-continue" class="primary-action">Continue: ${ATTENTION_SUBSTEPS[currSubstep + 1].name}</button>`;
      } else {
        primaryAction = `<button id="short-continue" class="primary-action">Return to Mix Context</button>`;
      }
      attentionAction = `<button id="attention-return" class="secondary-action">Return to Mix Context</button>`;
    } else if (currStop === 0) {
      lessonProgress = `Prediction payoff`;
      routePurpose = currentLandmark.purpose;
      primaryAction = `<button id="short-continue" class="primary-action">See how it got there</button>`;
    } else {
      lessonProgress = `Step ${currStop} of 5 · ${currentLandmark.name}`;
      routePurpose = currentLandmark.purpose;
      if (currStop < 5) {
        primaryAction = `<button id="short-continue" class="primary-action">Continue: ${TOP_LEVEL_LANDMARKS[currStop + 1].name}</button>`;
        if (currStop === 2) {
          attentionAction = `<button id="attention-drill-down" class="secondary-action">How does attention work?</button>`;
        }
      } else {
        primaryAction = `<button id="short-teach" class="primary-action">Teach: step through learning</button>`;
        attentionAction = `<button id="start-reverse-learning" class="secondary-action">Walk through backward pass</button>`;
      }
    }
    const publicLearningMarkup = isPublicProfile
      ? (m ? publicLearningScene({
          f: m.forward,
          pin: this.pin,
          training: state.execution?.progress?.training,
          learning: state.learning,
          learningRouteStop: this.derivedLearningRouteStop,
          tourState: state.publicLesson?.currentState,
          isLearningActive: Boolean(
            state.execution?.progress?.training ||
            this.derivedLearningRouteStop !== undefined ||
            this.learningStage
          ),
          query: this.selection.query,
          head: this.selection.head,
        }) : '')
      : '';
    const facilitatorLessonControls = state.publicLesson?.facilitatorDestinations.map(destination => `<button data-public-lesson-state="${destination.state}" ${destination.available ? '' : 'disabled'} aria-pressed="${destination.state === state.publicLesson?.currentState}">${esc(destination.label)}</button>`).join('') ?? '';
    const expertLearningMarkup = !isPublicProfile
      ? (state.execution?.progress?.training
          ? liveLearningScene(state.execution.progress.training, this.pin)
          : learningScene(state.learning, this.learningStage, this.pin))
      : '';

    return `<div data-retention="${esc(JSON.stringify(state.retention))}" class="spatial-shell ${state.attract?"spatial-attract":""} ${isVisitor&&!this.operatorControls?"visitor-controls":""}" data-experience-profile="${profile}"><header class="spatial-header"><div class="world-brand"><strong>MODEL LAB</strong><small>${esc(m?.forward.descriptor.label??"one tiny transformer")} · one connected computation</small></div>${state.evidenceWorld?`<strong>${esc(state.evidenceWorld.label)}</strong><button id="return-canonical-world">Return to canonical world</button>`:isPublicProfile?`${this.freeExplore?`<label>Input<input id="document" type="text" maxlength="7" value="${esc(state.document)}" ${state.busy?"disabled":""}></label><button id="predict" ${state.busy||state.execution||!state.ready?"disabled":""}>Predict</button>`:""}<button id="clear-session">Public Reset</button>`:`<label>Input<input id="document" type="text" maxlength="7" value="${esc(state.document)}" ${state.busy?"disabled":""}></label><button id="predict" ${state.busy||state.execution||!state.ready?"disabled":""}>Predict</button>${state.execution?"":`<button id="step-prediction" ${state.busy||!state.ready?"disabled":""}>Step through prediction</button><button id="step-learning" ${state.busy||!state.ready?"disabled":""}>Step through learning</button>`}<button id="spatial-learn" ${state.canLearn?"":"disabled"}>Learn · one update</button>${capabilities.classicToggle?`<button id="presentation-toggle">Classic presentation</button>`:""}<button id="clear-session">${isVisitor||state.exhibit?'Public Reset':'Clear session'}</button>`}<button id="spatial-home">⌂ Home</button>${isPublicProfile?'':`<button id="spatial-back" ${!this.history.length?"disabled":""}>← Back</button>`}${showDeeperControls?`<button id="spatial-focus">◎ Focus</button><button id="spatial-lens">Q/K lens</button>`:""}<span class="spatial-badge">${state.evidenceWorld?(state.evidenceWorld.replay?"SAVED REPLAY · NO EXECUTION":"RETAINED EVIDENCE · READ ONLY"):state.attract?"RECORDED RUN · REPLAY":state.execution?(state.execution.progress?.training?(isPublicProfile?"LIVE TRAINING":"LIVE TRAINING · WAVE 2B"):(isPublicProfile?"LIVE PREDICTION":"LIVE FORWARD · WAVE 2A")):(isPublicProfile?"COMPLETED EVIDENCE":"COMPLETED EVIDENCE · WAVE 1D")}</span></header>
      <div class="spatial-status"><span role="status" data-testid="status">${esc(state.status.replace(/ · [a-f0-9-]{36}:.*$/, ""))}</span>${state.interventionPending?'<button id="cancel-ablation">Cancel intervention</button>':""}<span data-testid="spatial-relationship">${m?`${state.execution?'ACTIVE EXECUTION':m.source.relationship} · captured input ${esc(m.source.capturedDocument)}`:"NO SELECTED RUN"}</span></div>${state.error?`<p role="alert">${esc(state.error)}</p>`:""}${!isPublicProfile && !m&&state.execution?this.controls():""}${!isPublicProfile && state.attract?`<section class="exhibit-entry"><div><strong>RECORDED RUN · REPLAY</strong><h1>How does a tiny model choose what comes next?</h1><p>Recorded real run. Not live. Start to make a fresh prediction, then follow the numbers through attention.</p></div><button id="exhibit-start" ${state.ready&&!state.busy?'':'disabled'}>Start · explore a real prediction</button></section>`:m&&!state.execution&&!state.intervention&&!state.evidenceWorld?`${isVisitor?'':isFacilitator?(this.operatorControls?`<div class="facilitator-panel" data-testid="facilitator-panel"><p class="facilitator-retention">${retentionWording}</p><nav class="facilitator-landmarks" aria-label="Shared Guided lesson"><button id="operator-controls">Hide operator controls</button><button id="short-sample">Sample abca · q3 / h0 / k0</button>${facilitatorLessonControls}${capabilities.configurableIdleReset?`<button id="exhibit-opt-out">${state.idleResetEnabled?"Disable idle reset · facilitated session":`Enable idle reset · ${state.idleResetSeconds} seconds`}</button>`:""}</nav><p role="status">${esc(this.shortMessage)} ${this.shortDetour?'Exploring a detour. Resume explicitly to return. ':''}</p></div>`:''):`<details class="short-guide" ${state.exhibit?'open':''}><summary>Short teaching route · causal prediction explanation</summary><div class="short-guide-body">${this.operatorControls?`<div class="facilitator-panel" data-testid="facilitator-panel"><p class="facilitator-retention">${retentionWording}</p><p class="route-purpose" data-testid="route-purpose"><strong style="color:#F2F5F7;">${isAttn ? currentAttnStep.name : currentLandmark.name}:</strong> ${esc(isAttn ? currentAttnStep.purpose : currentLandmark.purpose)}</p></div>`:""}<nav aria-label="Short teaching route"><button id="operator-controls">${this.operatorControls?"Hide":"Show"} operator controls</button><button id="short-sample">Sample abca · q3 / h0 / k0</button><button data-short-stop="0">Prediction</button><button data-short-stop="1">Represent</button><button data-short-stop="2">Mix Context</button><button data-short-stop="3">Transform</button><button data-short-stop="4">Score</button><button data-short-stop="5">Predict</button><button id="facilitator-attention-detail">Attention detail</button>${this.shortDetour?'<button id="short-resume">Resume short route</button>':''}</nav><p role="status">${esc(this.shortMessage)} ${this.shortDetour?'Exploring a detour. Resume explicitly to return. ':''}${currStop<1?"Teacher-forced prediction · selected position and known target; learning uses all positions.":"Follow the selected operands → calculation → result. Exact values and source remain available."}</p></div></details>`}`:''}
      ${m?`${showDeeperControls?`<nav class="spatial-selection" aria-label="Semantic selection"><label>Layer<select id="spatial-layer">${options(Array.from({length:m.forward.layers},(_,i)=>`Layer ${i}`),s.layer)}</select></label><label>Position<select id="spatial-query">${options(m.labels,s.query)}</select></label><label>Head<select id="spatial-head">${options(m.heads.map(h=>`Head ${h.head}`),s.head)}</select></label><label>Key<select id="spatial-key">${options(m.labels,s.key)}</select></label><label>Q feature<select id="spatial-feature">${options(Array.from({length:m.width},(_,i)=>String(i)),s.feature)}</select></label><label>${state.execution?.progress?.training?"Forward selection":"Operation"}<select id="spatial-operation">${m.forward.operations.map(o=>`<option value="${o.kind}" ${o.kind===this.kind?"selected":""}>${esc(o.title)}</option>`).join("")}</select></label><span class="scope-note">Full semantic identity · run / node / port / layer / position / head</span></nav>`:""}
      ${capabilities.teachingSelectors && (capabilities.profile === 'workbench' || (state.experiments?.length ?? 0) > 0) ? `<nav ${state.execution||state.intervention||state.evidenceWorld?'hidden':''} class="learning-toolbar" aria-label="Learning transition"><strong>Live model step <span data-testid="spatial-live-step">${state.liveStep??0}</span></strong><span>Pinned ${esc(parameterLabel(this.pin))}</span><button id="learning-owner">Owner</button><label>Transition<select id="spatial-experiment"><option value="">Choose completed transition</option>${state.experiments?.map(e=>`<option value="${esc(e.id)}" ${e.id===state.experimentId?"selected":""}>Update ${e.step}</option>`).join("")??""}</select></label><button id="spatial-experiment-prev" ${state.experimentsWindow?.hasPrevious?'':'disabled'}>Previous transitions</button><button id="spatial-experiment-next" ${state.experimentsWindow?.hasNext?'':'disabled'}>Next transitions</button><span>${state.experimentsWindow?`showing ${state.experimentsWindow.total?state.experimentsWindow.offset+1:0}–${state.experimentsWindow.end} of ${state.experimentsWindow.total} retained transitions`:''}</span><button data-learning-phase="before">Before</button><button data-learning-phase="training">Training</button><button data-learning-phase="after">After</button><button ${state.intervention?'':'id="spatial-current"'}>Return to current model</button><button data-learning-stage="gradient">Contributions</button><button data-learning-stage="adam">Adam</button><button data-learning-stage="compare">Compare</button></nav>`:""}
      ${!isPublicProfile ? (state.intervention?`<details class="comparison-playback"><summary>Explanation playback · completed evidence</summary>${this.controls()}</details>`:this.controls()) : ""}${state.intervention?`<div class="intervention-banner" data-testid="spatial-intervention">READ-ONLY · ${esc(state.intervention.arm)} · ${esc(state.intervention.summary)}. Same checkpoint <code title="${esc(state.intervention.snapshot)}">${esc(state.intervention.snapshot.slice(0,19))}…</code>. The comparison policy is matched intervention; recorded values remain observed evidence.${state.intervention.receipt?`<details data-testid="intervention-receipt"><summary>Donor / target receipt</summary><p>Policy: ${esc(state.intervention.receipt.policy)} · ${state.intervention.receipt.noOp?'truthful no-op':'numerical replacement observed'}</p><p>Donor [${state.intervention.receipt.donor.join(', ')}]<br>Original target [${state.intervention.receipt.original.join(', ')}]<br>Effective replacement [${state.intervention.receipt.replacement.join(', ')}]</p></details>`:''}</div>`:""}${!isPublicProfile && pair?`<div class="decision-summary">${state.inspectedArm?`<small data-testid="inspected-arm">Inspecting ${esc(state.inspectedArm)}${state.comparison?" · paired map enabled":""}</small>`:""}${outputSummary(pair,s.query,labels)}<nav>${state.intervention?`<span>Accepted model step ${state.liveStep??0}</span><button id="spatial-current">Return to current model</button>`:""}<button data-compare-arm="before">Inspect ${labels[0].toLowerCase()}</button><button data-compare-arm="after">Inspect ${labels[1].toLowerCase()}</button><button data-compare-arm="pair">Shared-scale comparison</button></nav></div>`:""}${isPublicProfile ? `<div class="world-workspace is-public-profile ${this.freeExplore ? 'is-free-explore' : ''}"><div class="world-pane">${sceneSvg(m.forward,a,s.key,this.learningStage?this.pin.name:this.parameter,m.labels,s.query,state.comparison??(this.learningStage==="compare"&&state.learning?.available?state.learning.comparison:undefined),publicLearningMarkup,state.execution?.progress,this.element)}${publicTeachingLocator}<div data-testid="landmark-occurrence" data-semantic-anchor="${a.kind}" data-position="${a.token}" data-layer="${a.layer !== undefined ? a.layer : ''}" data-run-id="${esc(m?.source.sourceRunId ?? '')}" style="display:none;" aria-hidden="true"></div>${this.freeExplore ? `<div class="camera-controls"><button id="zoom-in" aria-label="Zoom in">+</button><button id="zoom-out" aria-label="Zoom out">−</button><button data-pan="-1,0" aria-label="Pan left">←</button><button data-pan="1,0" aria-label="Pan right">→</button><button data-pan="0,-1" aria-label="Pan up">↑</button><button data-pan="0,1" aria-label="Pan down">↓</button></div><svg class="world-minimap" viewBox="0 0 ${m.forward.descriptor.presentation==='microgpt-canonical-curated'?4500:1250+m.forward.layers*2500} ${m.forward.descriptor.presentation==='microgpt-canonical-curated'?1700:Math.max(1500,420+m.forward.heads*270)}" aria-label="Same world camera footprint"><path d="M100 600 H${m.forward.descriptor.presentation==='microgpt-canonical-curated'?4300:1050+m.forward.layers*2500}"/>${m.forward.operations.map((o)=>{const t=stationForWorld(m.forward,o.kind,s.head,s.layer);return `<rect x="${t.x}" y="${t.y}" width="100" height="160" class="${o.kind===this.kind?"selected":""}"/>`;}).join("")}<rect id="camera-footprint"/></svg>` : ''}</div>${renderContextualDock({
        model: m,
        address: a,
        element: this.element,
        parameter: this.parameter,
        row: this.row,
        column: this.column,
        pin: this.pin,
        scalar: state.scalar,
        depth: this.dockDepth,
        profile,
        freeExplore: this.freeExplore,
        attract: Boolean(state.attract && isPublicProfile),
        trainingState,
        lessonProgress,
        routePurpose,
        primaryAction,
        attentionAction,
        shortDetour: isPublicProfile ? publicNavigationMode !== 'guided' : this.shortDetour,
        shortMessage: this.shortMessage,
        operatorControls: this.operatorControls,
        executionProgress: state.execution?.progress,
        trainingProgress: state.execution?.progress?.training,
        learningStage: this.learningStage,
        learningModel: state.learning,
        comparison: state.comparison,
        outputPair: pair,
        comparisonLabels: labels,
        hasComparison: Boolean(state.comparison || pair),
        learningRouteStop: isPublicProfile ? this.derivedLearningRouteStop : this.learningRouteStop,
        selectedLabel: label,
        tourContent,
      })}</div>` : `<div class="world-workspace ${lensActive?"has-lens":""}"><div class="world-pane ${sceneOpen?"has-construction":""}">${sceneSvg(m.forward,a,s.key,this.learningStage?this.pin.name:this.parameter,m.labels,s.query,state.comparison??(this.learningStage==="compare"&&state.learning?.available?state.learning.comparison:undefined),expertLearningMarkup,state.execution?.progress,this.element)}<div class="camera-controls"><button id="zoom-in" aria-label="Zoom in">+</button><button id="zoom-out" aria-label="Zoom out">−</button><button data-pan="-1,0" aria-label="Pan left">←</button><button data-pan="1,0" aria-label="Pan right">→</button><button data-pan="0,-1" aria-label="Pan up">↑</button><button data-pan="0,1" aria-label="Pan down">↓</button></div>
      <div class="selection-card" data-landmark-anchor="${a.kind}" data-landmark-token="${a.token}" data-landmark-layer="${a.layer ?? ''}" data-landmark-run="${esc(m?.source.sourceRunId ?? '')}"><div data-testid="landmark-occurrence" data-semantic-anchor="${a.kind}" data-position="${a.token}" data-layer="${a.layer !== undefined ? a.layer : ''}" data-run-id="${esc(m?.source.sourceRunId ?? '')}" style="display:none;" aria-hidden="true"></div><small>SELECTED WORLD OBJECT</small><strong data-testid="selected-world-object" data-semantic-anchor="${a.kind}" data-position="${a.token}" data-layer="${a.layer ?? ''}" data-run-id="${esc(m?.source.sourceRunId ?? '')}">${esc(label)}</strong><span>layer ${a.layer??'model'} · position ${a.token} · query ${s.query} / key ${s.key} · head ${s.head}</span><span>${state.comparison?`${labels[0]}: neutral. ${labels[1]}: cyan. Shared scale per pair.`:this.learningStage==="compare"?"Before: neutral. After: cyan. Shared scale per pair.":"Signed strips: independent scales. Q/K lens: shared scale."}</span><div class="selection-actions"><button id="open-spatial-detail">Values / arithmetic / source</button><button id="scene-construction">${this.construction?"Close scene math":"Scene math"}</button></div>${this.kind==="headOutput"&&!state.evidenceWorld?`${capabilities.headAblation?`<button id="spatial-ablate" ${state.execution||state.busy?"disabled":""}>Test without this head</button>`:""}${capabilities.donorPatch?`<button id="spatial-patch" ${state.execution||state.busy?"disabled":""}>Patch from observed donor</button>`:""}<small class="head-action-scope">${state.execution?"Finish/cancel execution or accept/discard candidate first.":`Selected checkpoint ${esc((m.source.sourceSnapshotId??"unavailable").slice(0,19))}… · ablation: all positions; patch target: p${s.query}/h${s.head}, donor: p${state.patchDonor?.token??0}/h${state.patchDonor?.head??0}; after aggregation / before concat.`}</small>`:""}${!m.valid?'<p role="alert">Selection unavailable in this run. Choose valid indices; prior evidence is not rebound.</p>':""}</div>
      <svg class="world-minimap" viewBox="0 0 ${m.forward.descriptor.presentation==='microgpt-canonical-curated'?4500:1250+m.forward.layers*2500} ${m.forward.descriptor.presentation==='microgpt-canonical-curated'?1700:Math.max(1500,420+m.forward.heads*270)}" aria-label="Same world camera footprint"><path d="M100 600 H${m.forward.descriptor.presentation==='microgpt-canonical-curated'?4300:1050+m.forward.layers*2500}"/>${m.forward.operations.map((o)=>{const t=stationForWorld(m.forward,o.kind,s.head,s.layer);return `<rect x="${t.x}" y="${t.y}" width="100" height="160" class="${o.kind===this.kind?"selected":""}"/>`;}).join("")}<rect id="camera-footprint"/></svg>${sceneOpen?sceneConstruction(m,a,this.element,state.execution?.progress):""}</div>
      <svg class="context-tether" aria-hidden="true"><path id="context-tether-path"/></svg><aside class="context-lens" ${lensActive?"":"hidden"} data-selection="${esc(JSON.stringify([this.kind,a.token,a.head,this.parameter,this.learningStage,state.experimentId,m.source.sourceRunId]))}" aria-label="Contextual arithmetic lens">${this.learningStage&&state.execution?.progress?.training?liveLearningInspector(state.execution.progress.training,this.pin,state.scalar):this.learningStage?learningInspector(state.learning,this.learningStage,this.pin,a,state.scalar,this.expanded):forwardInspector(m,a,this.element,this.parameter,this.row,this.column,state.scalar,state.execution?.progress,sceneOpen).replace('<details open><summary>Calculation and complete values</summary>',`${state.comparison?componentComparison(state.comparison,a,labels):""}<details open><summary>Calculation and complete values</summary>`)}</aside></div>`}`:`<section class="spatial-empty"><h1>One model, a complete forward computation</h1><p>Enter a, b or c, then Predict. Explore its actual operations and their sources.</p></section>`}</div>`;
  }
  bind(m:AnySpatialReadModel|undefined,changed:()=>void,render:()=>void,phase?:(phase:string)=>void) {
    if(m&&isRegisteredWorld(m)){m.presentation.bind(changed,render);return;}
    this.redraw=render;this.phase=phase;this.guideApply=()=>{this.guide();changed();};
    if(m)this.headWidth=m.width;
    const root=document.querySelector<HTMLElement>(".spatial-shell")!;
    this.emphasize();
    if (this.isPublicProfile() && this.state?.publicLesson && m) {
      this.applyPublicLessonFocus(root, this.state.publicLesson.content.focus, this.state.publicLesson, m);
    } else if(this.playback.source&&!this.playback.exploring&&m){
      const headSelector=['q','k','v'].includes(this.kind)||headKinds.has(this.kind)?`[data-world-head="${this.selection.head}"]`:'';
      const layerSelector=m.forward.descriptor.presentation==='microgpt-repeated-blocks'&&layerKinds.has(this.kind)?`[data-world-layer="${this.selection.layer}"]`:'';
      const active=this.learningStage?root.querySelector(`svg [data-learning-stage="${this.learningStage==='compare'?'checkpoint':this.learningStage}"]`):root.querySelector(`[data-world-kind="${this.kind}"]${layerSelector}${headSelector}`);
      active?.classList.add('explanation-active');
      if(!this.learningStage)for(const d of m.forward.upstream(this.address()))root.querySelectorAll(`[data-world-kind="${d.address.kind}"],[data-world-parameter="${d.address.kind}"]`).forEach(el=>el.classList.add('explanation-input'));
      if(!this.learningStage)root.querySelectorAll(`[data-edge-from="${this.kind}"],[data-edge-to="${this.kind}"]`).forEach(el=>el.classList.add('explanation-link'));
    }
    const on=(id:string,fn:()=>void)=>root.querySelector(id)?.addEventListener("click",fn);
    const change=()=>{if(this.isPublicProfile()&&this.state?.publicLesson?.navigation.mode==='guided'){const entered=this.dispatchPublicLesson({type:'ENTER_EXPLORE'});if(!entered&&this.state?.publicLesson)this.applyPublicLessonView(this.state.publicLesson,true);}if(this.shortStop>=0)this.shortDetour=true;this.interrupt(true);if(this.parameter&&!this.learningStage)this.pin={name:this.parameter,row:this.row,column:this.column};changed();render();};
    on('#short-continue',()=>{
      if (this.isPublicProfile()) { this.dispatchPublicLesson({ type: 'PRIMARY_ACTION' }); changed(); render(); return; }
      if (this.attentionSubstep !== undefined) {
        const next = this.attentionSubstep + 1;
        if (next < ATTENTION_SUBSTEPS.length) this.attentionRoute(next);
        else this.shortRoute(2);
        changed(); render(); return;
      }
      const next=(this.shortStop<0?0:this.shortStop)+1;
      if(next<=5){this.shortRoute(next);changed();render();}
    });
    on('#attention-drill-down', () => {
      if (this.isPublicProfile()) return;
      this.attentionRoute(0); changed(); render();
    });
    on('#attention-return', () => {
      if (this.isPublicProfile()) return;
      this.shortRoute(2); changed(); render();
    });
    on('#facilitator-attention-detail', () => {
      if (this.isPublicProfile()) return;
      this.attentionRoute(0); changed(); render();
    });
    on('#visitor-explore-toggle',()=>{
      if (this.isPublicProfile()) {
        const navigation = this.state?.publicLesson?.navigation.mode;
        this.dispatchPublicLesson({ type: navigation === 'explore' ? 'RESUME_GUIDED' : 'ENTER_EXPLORE' });
      } else this.freeExplore=!this.freeExplore;
      changed(); render();
    });
    root.querySelectorAll<HTMLElement>('[data-public-lesson-state]').forEach(el=>el.addEventListener('click',()=>{
      const target = el.dataset.publicLessonState as PublicTourState | undefined;
      if (!target) return;
      this.dispatchPublicLesson({ type: 'FACILITATOR_GOTO', target }); changed(); render();
    }));
    root.querySelectorAll<HTMLElement>('[data-short-stop]').forEach(el=>el.addEventListener('click',()=>{
      if (this.isPublicProfile()) return;
      this.shortRoute(Number(el.dataset.shortStop)); changed(); render();
    }));
    root.querySelectorAll<HTMLElement>('[data-reverse-stop]').forEach(el=>el.addEventListener('click',()=>{
      if (this.isPublicProfile()) return;
      this.reverseRoute(Number(el.dataset.reverseStop)); changed(); render();
    }));
    on('#reverse-continue',()=>{
      if (this.isPublicProfile()) { this.dispatchPublicLesson({ type: 'PRIMARY_ACTION' }); changed(); render(); return; }
      if (this.learningRouteStop !== undefined) {
        const next = this.learningRouteStop + 1;
        if (next < REVERSE_LANDMARKS.length) this.reverseRoute(next); else this.reverseRoute(0);
        changed(); render();
      }
    });
    on('#reverse-previous',()=>{
      if (this.isPublicProfile()) { this.dispatchPublicLesson({ type: 'RESUME_GUIDED' }); changed(); render(); return; }
      if (this.learningRouteStop !== undefined && this.learningRouteStop > 0) { this.reverseRoute(this.learningRouteStop - 1); changed(); render(); }
    });
    on('#reverse-exit',()=>{
      if (this.isPublicProfile()) { this.dispatchPublicLesson({ type: 'RESUME_GUIDED' }); changed(); render(); return; }
      this.learningRouteStop = undefined; this.shortRoute(0); changed(); render();
    });
    on('#start-reverse-learning',()=>{
      if (this.isPublicProfile()) { this.dispatchPublicLesson({ type: 'START_PART2' }); changed(); render(); return; }
      this.reverseRoute(0); changed(); render();
    });
    on('#operator-controls',()=>{this.operatorControls=!this.operatorControls;render();});
    on('#short-resume',()=>{
      if (this.isPublicProfile()) {
        this.dispatchPublicLesson({ type: 'RESUME_GUIDED' });
        this.camera.move(this.getResponsivePublicFrame(), true); this.pendingBox = undefined; changed(); render(); return;
      }
      if(this.shortSelection)Object.assign(this.selection,this.shortSelection);
      if(this.attentionSubstep !== undefined) this.attentionRoute(this.attentionSubstep); else this.shortRoute(Math.max(0,this.shortStop));
      changed(); render();
    });
    on('#short-sample',()=>{
      if(m?.source.capturedDocument!=='abca'){this.shortMessage='The sample selection needs an abca prediction. Enter abca and explicitly Predict first.';render();return;}
      if (this.isPublicProfile()) { this.dispatchPublicLesson({ type: 'FACILITATOR_GOTO', target: 'p1_prediction_preview' }); changed(); render(); return; }
      Object.assign(this.selection,{query:3,key:0,head:0,feature:0});this.shortRoute(0);changed();render();
    });
    on('#scene-construction',()=>{
      this.construction=!this.construction;
      if(this.construction) this.lens=false;
      render();
    });
    const home=()=>{
      if(this.shortStop>=0)this.shortDetour=true;
      this.interrupt();
      this.remember();
      this.lens=false;
      if (this.isPublicProfile()) {
        this.camera.move(this.getResponsivePublicFrame(), true);
        this.pendingBox = undefined;
        render();
        return;
      }
      const svg=root.querySelector<SVGSVGElement>('#spatial-world'),width=Number(svg?.dataset.worldWidth)||HOME.width,height=Number(svg?.dataset.worldHeight)||HOME.height;
      this.pendingBox={x:0,y:0,width,height};
      render();
    };
    const back=()=>{this.interrupt();if(this.isPublicProfile()){this.dispatchPublicLesson({type:'RESUME_GUIDED'});changed();render();return;}const prior=this.history.pop();if(!prior)return;Object.assign(this.selection,prior.selection);this.kind=prior.kind;this.element=prior.element;this.parameter=prior.parameter;this.row=prior.row;this.column=prior.column;this.lens=prior.lens;this.learningStage=prior.learningStage;this.pendingBox=prior.box;change();};
    for(const id of ["#spatial-home","#lens-home"])on(id,home);
    for(const id of ["#spatial-back","#lens-back"])on(id,back);
    on("#spatial-focus",()=>{this.remember();this.lens=true;this.construction=false;this.frame();render();});
    on("#spatial-lens",()=>{this.lens=true;this.construction=false;this.go({kind:"attentionLogits",token:this.selection.query,head:this.selection.head});change();});
    on("#open-spatial-detail",()=>{this.lens=true;this.construction=false;this.frame();render();});
    on("#close-spatial-lens",()=>{this.lens=false;render();});
    const gesture=()=>{if(this.isPublicProfile()&&this.state?.publicLesson?.navigation.mode==='guided')this.dispatchPublicLesson({type:'ENTER_EXPLORE'});this.interrupt();const status=root.querySelector('[data-testid="explanation-status"]');if(status&&this.playback.source)status.textContent=`Explore detour · ${this.playback.cursor+1}/${this.playback.length}`;this.remember();this.detour=this.guided;const label=root.querySelector("#waypoint-status");if(label&&this.guided)label.textContent=`Explore detour · ${this.playback.cursor+1}/${this.playback.length} · Resume explanation to return`;};
    const svg=root.querySelector<SVGSVGElement>("#spatial-world");
    this.worldPaneObserver?.disconnect();
    const wp = root.querySelector<HTMLElement>(".world-workspace.is-public-profile > .world-pane") ?? root.querySelector<HTMLElement>(".world-pane");
    if (wp && typeof ResizeObserver !== "undefined") {
      this.worldPaneObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0 && this.isPublicProfile() && !this.freeExplore) {
            const frame = responsivePublicFrame(width, height, PUBLIC_CONTENT_BOUNDS);
            if (
              this.camera.box.x !== frame.x ||
              this.camera.box.y !== frame.y ||
              this.camera.box.width !== frame.width ||
              this.camera.box.height !== frame.height
            ) {
              this.camera.move(frame, false);
            }
            this.positionPublicTeachingLocator(root);
          }
        }
      });
      this.worldPaneObserver.observe(wp);
    }
    if(svg){this.camera.attach(svg,()=>{this.positionPublicTeachingLocator(root);const p=root.querySelector("#camera-footprint"),b=this.camera.box;p?.setAttribute("x",String(b.x));p?.setAttribute("y",String(b.y));p?.setAttribute("width",String(b.width));p?.setAttribute("height",String(b.height));
      const lensEl=root.querySelector<HTMLElement>(".context-lens"),tether=root.querySelector<SVGPathElement>("#context-tether-path");
      if(this.lens && !this.construction && lensEl && tether){
        const workspace=root.querySelector(".world-workspace")!.getBoundingClientRect(),lens=lensEl.getBoundingClientRect();
        const object=this.parameter?root.querySelector(`[data-world-parameter="${this.parameter}"]`):root.querySelector(`[data-world-kind="${this.kind}"]${layerKinds.has(this.kind)?`[data-world-layer="${this.selection.layer}"]`:''}${["q","k","v"].includes(this.kind)||headKinds.has(this.kind)?`[data-world-head="${this.selection.head}"]`:""}`);
        const from=object?.querySelector("rect")?.getBoundingClientRect();
        if(from&&from.right>workspace.left&&from.left<lens.left) tether.setAttribute("d",`M${from.right-workspace.left} ${from.top+from.height/2-workspace.top} H${lens.left-workspace.left-7} V34 H${lens.left-workspace.left}`);else tether.setAttribute("d","");
      }else if(tether){tether.setAttribute("d","");}},gesture);if(this.pendingBox){this.camera.move(this.pendingBox,!this.state?.execution);this.pendingBox=undefined;}}
    on("#zoom-in",()=>{gesture();this.camera.zoom(.8);});on("#zoom-out",()=>{gesture();this.camera.zoom(1.25);});
    root.querySelectorAll<HTMLElement>("[data-pan]").forEach(b=>b.addEventListener("click",()=>{gesture();const [x,y]=b.dataset.pan!.split(",").map(Number);this.camera.pan(x*this.camera.box.width*.15,y*this.camera.box.height*.15);}));
    for(const field of ["layer","query","key","head","feature"] as const)root.querySelector(`#spatial-${field}`)?.addEventListener("change",event=>{this.remember();this.selection[field]=Number((event.target as HTMLSelectElement).value);if((field==="feature"||field==="head")&&["q","k","v"].includes(this.kind))this.element=this.selection.head*this.headWidth+this.selection.feature;if((field==="head"||field==="layer")&&this.lens)this.frame();if(field==="key"&&this.kind==="attentionLogits")this.element=this.selection.key;this.detour=this.guided;change();});
    root.querySelector("#spatial-operation")?.addEventListener("change",event=>{const kind=(event.target as HTMLSelectElement).value;this.go({kind,token:["k","v"].includes(kind)?this.selection.key:this.selection.query,...(layerKinds.has(kind)?{layer:this.selection.layer}:{}),...(headKinds.has(kind)?{head:this.selection.head}:{})});change();});
    root.querySelectorAll<HTMLElement>('button[data-dock-depth]').forEach(el=>{
      el.addEventListener('click',event=>{
        event.stopPropagation();
        const depth=el.dataset.dockDepth as DockDepth;
        if(depth){
          const nextDepth = depth===this.dockDepth&&depth!=='explain' ? 'explain' : depth;
          if(this.isPublicProfile()){
            const navigation = this.state?.publicLesson?.navigation.mode;
            if(nextDepth==='explain'&&navigation==='detail'){if(!this.dispatchPublicLesson({type:'RETURN_FROM_DETAIL'}))return;}
            else if(nextDepth!=='explain'&&navigation==='guided'){if(!this.dispatchPublicLesson({type:'OPEN_DETAIL'}))return;}
          }
          this.dockDepth=nextDepth; render();
        }
      });
    });
    const select=(el:HTMLElement|SVGElement)=>{
      if(el.dataset.worldKind){this.go({kind:el.dataset.worldKind,token:["k","v"].includes(el.dataset.worldKind)?this.selection.key:this.selection.query,...(el.dataset.worldLayer===undefined?{}:{layer:Number(el.dataset.worldLayer)}),...(el.dataset.worldHead===undefined?{}:{head:Number(el.dataset.worldHead)})});}
      else if(el.dataset.worldParameter)this.go({kind:el.dataset.worldParameter,token:this.selection.query});
      else if(el.dataset.worldToken!==undefined){this.remember();this.selection.query=Number(el.dataset.worldToken);}
      change();
    };
    root.querySelectorAll<SVGElement>("[data-world-kind],[data-world-parameter],[data-world-token]").forEach(el=>{el.addEventListener("click",()=>select(el));el.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();select(el);}});});
    root.querySelectorAll<HTMLElement>("[data-dependency]").forEach(el=>el.addEventListener("click",()=>{this.go(JSON.parse(el.dataset.dependency!));change();}));
    root.querySelectorAll<HTMLElement>("[data-forward-element]").forEach(el=>el.addEventListener("click",()=>{this.element=Number(el.dataset.forwardElement);change();}));
    root.querySelectorAll<HTMLElement>("[data-spatial-key]").forEach(el=>el.addEventListener("click",()=>{this.selection.key=Number(el.dataset.spatialKey);if(this.kind==="attentionLogits")this.element=this.selection.key;change();}));
    for(const field of ["row","column"] as const)root.querySelector(`#parameter-${field}`)?.addEventListener("change",event=>{this[field]=Number((event.target as HTMLSelectElement).value);change();});
    root.querySelectorAll<HTMLElement>("[data-parameter-cell]").forEach(el=>el.addEventListener("click",()=>{[this.row,this.column]=el.dataset.parameterCell!.split(",").map(Number);change();}));
    on("#parameter-output",()=>{
      if(!this.parameter||!m)return;const name=this.parameter,owner=m.forward.parameterOwners[name],kind=owner?.kind??parameterOwners[name];
      let token=this.selection.query;
      if(name==="wte")token=m.forward.input.findIndex(id=>id===this.row);
      if(name==="wpe")token=this.row;
      if(token<0||token>=m.forward.input.length){root.querySelector("#parameter-output")?.insertAdjacentHTML("afterend",'<p role="status">This lookup row has no occurrence in the selected run; checkpoint values remain available.</p>');return;}
      this.go({kind,token,...(owner?.layer===undefined?{}:{layer:owner.layer})});this.element=name==="wte"||name==="wpe"?this.column:this.row;change();
    });
    root.addEventListener('click',event=>{const el=(event.target as Element).closest<HTMLElement>('button,[data-world-kind],[data-learning-stage]');if(el&&!el.id.startsWith('explanation-')&&!el.id.startsWith('waypoint-')&&!el.id.startsWith('short-')&&!el.id.startsWith('attention-')&&!el.id.startsWith('reverse-')&&el.id!=='start-reverse-learning'&&el.id!=='short-teach'&&el.id!=='tour-restart'&&el.id!=='execution-accept'&&el.id!=='execution-cancel'&&el.id!=='facilitator-attention-detail'&&el.dataset.shortStop===undefined&&el.dataset.reverseStop===undefined&&el.dataset.dockDepth===undefined&&!el.classList.contains('dock-tab')&&!el.classList.contains('dock-tab-close')&&el.id!=='visitor-explore-toggle'&&el.id!=='operator-controls'&&el.id!=='scene-construction'&&el.id!=='open-spatial-detail'&&el.id!=='close-spatial-lens'&&el.id!=='spatial-focus'&&!el.id.startsWith('zoom-')&&el.dataset.pan===undefined){this.interrupt();const status=root.querySelector('[data-testid="explanation-status"]');if(status&&this.playback.source)status.textContent=`Explore detour · ${this.playback.cursor+1}/${this.playback.length}`;}},{capture:true});
    root.querySelector('#explanation-route')?.addEventListener('change',event=>{this.invalidate();this.routeChoice=(event.target as HTMLSelectElement).value as 'forward'|'learning';render();});
    root.querySelector('#explanation-follow')?.addEventListener('change',event=>{this.playback.follow=(event.target as HTMLInputElement).checked;this.interrupt();render();});
    on('#explanation-play',()=>{if(this.playback.playing){this.playback.pause();render();}else{if(!this.playback.source)this.start();this.playback.play();}});
    on('#waypoint-previous',()=>this.playback.step(this.playback.cursor-1));
    on('#waypoint-next',()=>this.playback.step(this.playback.cursor+1));
    on('#waypoint-resume',()=>{
      if(!this.playback.source)this.start();
      if (this.isPublicProfile()) {
        this.camera.move(this.getResponsivePublicFrame(), true);
        this.pendingBox = undefined;
      }
      this.playback.resume();
    });
    on('#explanation-restart',()=>{this.start();this.playback.step(0);});
  }
}
