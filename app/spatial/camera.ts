export interface CameraBox { x:number; y:number; width:number; height:number }
export const HOME:CameraBox={x:0,y:0,width:4500,height:1700};
export const PUBLIC_HOME:CameraBox={x:0,y:0,width:4500,height:1300};
export class SpatialCamera {
  box:CameraBox={...HOME};
  private svg?:SVGSVGElement;
  private frame=0;
  private abort?:AbortController;
  private changed?:()=>void;
  private gesture?:()=>void;
  private apply() { this.svg?.setAttribute("viewBox",`${this.box.x} ${this.box.y} ${this.box.width} ${this.box.height}`); this.svg?.classList.toggle("overview",this.box.width>2600); const scale=this.svg?.getScreenCTM()?.a??1;this.svg?.style.setProperty("--world-label-size",`${12/scale}px`);this.svg?.style.setProperty("--world-region-size",`${16/scale}px`);this.svg?.style.setProperty("--world-bank-size",`${11/scale}px`); this.changed?.(); }
  stop() { cancelAnimationFrame(this.frame); this.frame=0; }
  move(box:CameraBox, animate=true) {
    this.stop();
    if (!animate || matchMedia("(prefers-reduced-motion: reduce)").matches) {this.box={...box};this.apply();return;}
    const start={...this.box},time=performance.now();
    const tick=(now:number)=>{const t=Math.min(1,(now-time)/260),s=t*t*(3-2*t);
      this.box={x:start.x+(box.x-start.x)*s,y:start.y+(box.y-start.y)*s,width:start.width+(box.width-start.width)*s,height:start.height+(box.height-start.height)*s};
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
