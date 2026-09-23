import {
  padPublicCameraBounds,
  publicLessonCameraPlan,
  unionPublicCameraBounds,
  type PublicCameraBounds,
} from './public-camera.js';
import type { PublicTourState } from './public-tour.js';

export interface CameraBox { x:number; y:number; width:number; height:number }
export const HOME:CameraBox={x:0,y:0,width:4500,height:1700};
// Learning annotations extend just beyond the canonical station bounds.
export const PUBLIC_HOME:CameraBox={x:0,y:0,width:4600,height:1360};
export const PUBLIC_CONTENT_BOUNDS:CameraBox={x:0,y:0,width:4480,height:1280};

export function responsivePublicFrame(
  containerWidth: number,
  containerHeight: number,
  bounds: CameraBox = PUBLIC_CONTENT_BOUNDS
): CameraBox {
  if (containerWidth <= 0 || containerHeight <= 0) {
    return { ...bounds };
  }
  const containerAspect = containerWidth / containerHeight;
  const contentAspect = bounds.width / bounds.height;
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  let frameWidth: number;
  let frameHeight: number;

  if (containerAspect < contentAspect) {
    frameWidth = bounds.width;
    frameHeight = bounds.width / containerAspect;
  } else {
    frameHeight = bounds.height;
    frameWidth = bounds.height * containerAspect;
  }

  return {
    x: Math.round(centerX - frameWidth / 2),
    y: Math.round(centerY - frameHeight / 2),
    width: Math.round(frameWidth),
    height: Math.round(frameHeight),
  };
}

export function responsiveSemanticFrame(
  containerWidth:number,
  containerHeight:number,
  bounds:CameraBox,
  domain:CameraBox=PUBLIC_HOME,
):CameraBox {
  const frame=responsivePublicFrame(containerWidth,containerHeight,bounds);
  let x=frame.x,y=frame.y;
  if(frame.width<=domain.width)x=Math.min(domain.x+domain.width-frame.width,Math.max(domain.x,x));
  if(frame.height<=domain.height)y=Math.min(domain.y+domain.height-frame.height,Math.max(domain.y,y));
  return {...frame,x:Math.round(x),y:Math.round(y)};
}

function sameBox(a:CameraBox,b:CameraBox){
  return a.x===b.x&&a.y===b.y&&a.width===b.width&&a.height===b.height;
}

export class SpatialCamera {
  box:CameraBox={...HOME};
  private svg?:SVGSVGElement;
  private frame=0;
  private abort?:AbortController;
  private changed?:()=>void;
  private gesture?:()=>void;
  private apply() {
    this.svg?.setAttribute("viewBox",`${this.box.x} ${this.box.y} ${this.box.width} ${this.box.height}`);
    this.svg?.classList.toggle("overview",this.box.width>2600);
    const scale=this.svg?.getScreenCTM()?.a??1;
    const isPublic = Boolean(this.svg?.closest('.world-workspace.is-public-profile') || this.svg?.closest('[data-experience-profile="visitor"]') || this.svg?.closest('[data-experience-profile="facilitator"]'));
    const labelBase = isPublic ? 16 : 12;
    const regionBase = isPublic ? 24 : 16;
    const bankBase = isPublic ? 14 : 11;
    this.svg?.style.setProperty("--world-label-size",`${labelBase/scale}px`);
    this.svg?.style.setProperty("--world-region-size",`${regionBase/scale}px`);
    this.svg?.style.setProperty("--world-bank-size",`${bankBase/scale}px`);
    this.changed?.();
  }
  private elementBox(element:Element|null):CameraBox|undefined {
    if(!element)return undefined;
    const graphics=element as SVGGraphicsElement;
    if(typeof graphics.getBBox!=="function")return undefined;
    try{
      const box=graphics.getBBox();
      if(![box.x,box.y,box.width,box.height].every(Number.isFinite)||(box.width<=0&&box.height<=0))return undefined;
      return {x:box.x,y:box.y,width:box.width,height:box.height};
    }catch{return undefined;}
  }
  private boxes(selector:string):CameraBox[]{
    return this.svg
      ? Array.from(this.svg.querySelectorAll(selector)).map(el=>this.elementBox(el)).filter((box):box is CameraBox=>Boolean(box))
      : [];
  }
  private publicSemanticFrame():CameraBox|undefined {
    const svg=this.svg;
    if(!svg)return undefined;
    const shell=svg.closest<HTMLElement>('.spatial-shell');
    const profile=shell?.dataset.experienceProfile;
    const mode=shell?.dataset.publicNavigationMode;
    if((profile!=='visitor'&&profile!=='facilitator')||(mode!=='guided'&&mode!=='detail'))return undefined;
    const pane=svg.closest<HTMLElement>('.world-pane');
    const width=pane?.clientWidth??0,height=pane?.clientHeight??0;
    if(width<=0||height<=0)return undefined;
    const state=(shell?.dataset.publicDisplayedState??shell?.dataset.publicCanonicalState??'cold') as PublicTourState;
    const plan=publicLessonCameraPlan(state);
    if(plan.mode==='overview')return responsivePublicFrame(width,height,PUBLIC_CONTENT_BOUNDS);
    if(plan.mode==='hold')return {...this.box};

    const boxes:PublicCameraBounds[]=[];
    if(plan.includeFocus)boxes.push(...this.boxes('.explanation-input,.explanation-active'));
    if(plan.includeSelected)boxes.push(...this.boxes('[aria-pressed="true"][data-world-kind]'));
    if(plan.kinds?.length)boxes.push(...this.boxes(plan.kinds.map(kind=>`[data-world-kind="${kind}"]`).join(',')));
    if(plan.headKinds?.length){
      const head=svg.querySelector<SVGElement>('.explanation-active[data-world-head],.explanation-input[data-world-head],[aria-pressed="true"][data-world-head]')?.dataset.worldHead??'0';
      boxes.push(...this.boxes(plan.headKinds.map(kind=>`[data-world-kind="${kind}"][data-world-head="${head}"]`).join(',')));
    }
    for(const selector of plan.overlays??[])boxes.push(...this.boxes(selector));
    const semantic=unionPublicCameraBounds(boxes);
    if(!semantic)return undefined;
    const padded=padPublicCameraBounds(semantic,plan,PUBLIC_HOME);
    return responsiveSemanticFrame(width,height,padded,PUBLIC_HOME);
  }
  stop() { cancelAnimationFrame(this.frame); this.frame=0; }
  move(box:CameraBox, animate=true) {
    this.stop();
    const target=this.publicSemanticFrame()??box;
    if (!animate || matchMedia("(prefers-reduced-motion: reduce)").matches) {this.box={...target};this.apply();return;}
    const start={...this.box},time=performance.now();
    const tick=(now:number)=>{const t=Math.min(1,(now-time)/260),s=t*t*(3-2*t);
      this.box={x:start.x+(target.x-start.x)*s,y:start.y+(target.y-start.y)*s,width:start.width+(target.width-start.width)*s,height:start.height+(target.height-start.height)*s};
      this.apply();if(t<1)this.frame=requestAnimationFrame(tick);else this.frame=0;};
    this.frame=requestAnimationFrame(tick);
  }
  zoom(factor:number, anchor?:{x:number;y:number}) {
    this.stop();const width=Math.max(450,Math.min(6500,this.box.width*factor)),ratio=width/this.box.width;
    const point=anchor??{x:this.box.x+this.box.width/2,y:this.box.y+this.box.height/2};
    this.box={x:point.x+(this.box.x-point.x)*ratio,y:point.y+(this.box.y-point.y)*ratio,width,height:this.box.height*ratio};this.apply();
  }
  pan(dx:number,dy:number) {this.stop();this.box={...this.box,x:this.box.x+dx,y:this.box.y+dy};this.apply();}
  attach(svg:SVGSVGElement, changed:()=>void, gesture:()=>void) {
    this.abort?.abort();this.stop();this.svg=svg;this.changed=changed;this.gesture=gesture;this.abort=new AbortController();
    const signal=this.abort.signal;this.apply();
    const semantic=this.publicSemanticFrame();
    if(semantic&&!sameBox(this.box,semantic))this.move(semantic,true);
    let drag:{x:number;y:number;id:number;moved:boolean}|undefined;
    svg.addEventListener("wheel",event=>{
      event.preventDefault();this.gesture?.();const matrix=svg.getScreenCTM();
      const p=matrix?new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()):undefined;
      this.zoom(Math.exp(Math.max(-.4,Math.min(.4,event.deltaY*.002))),p);
    },{signal,passive:false});
    svg.addEventListener("pointerdown",event=>{
      if(event.button!==0)return;this.stop();drag={x:event.clientX,y:event.clientY,id:event.pointerId,moved:false};
    },{signal});
    svg.addEventListener("pointermove",event=>{if(!drag)return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<4)return;
      if(!drag.moved){this.gesture?.();svg.setPointerCapture(drag.id);}drag.moved=true;
      const scale=svg.getScreenCTM()?.a??1;this.pan(-dx/scale,-dy/scale);drag.x=event.clientX;drag.y=event.clientY;
    },{signal});
    svg.addEventListener("click",event=>{if(drag?.moved){event.stopImmediatePropagation();event.preventDefault();drag=undefined;}},{signal,capture:true});
    svg.addEventListener("pointerup",()=>{if(drag&&!drag.moved)drag=undefined;},{signal});
    svg.addEventListener("pointercancel",()=>{drag=undefined;},{signal});
    svg.addEventListener("keydown",event=>{
      if(event.target!==svg)return;
      const delta=this.box.width*.08;
      if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","+","-","="].includes(event.key)){
        event.preventDefault();this.gesture?.();
        if(event.key==="+"||event.key==="=")this.zoom(.8);else if(event.key==="-")this.zoom(1.25);
        else this.pan(event.key==="ArrowLeft"?-delta:event.key==="ArrowRight"?delta:0,event.key==="ArrowUp"?-delta:event.key==="ArrowDown"?delta:0);
      }
    },{signal});
  }
  detach(){this.abort?.abort();this.stop();this.svg=undefined;}
}
