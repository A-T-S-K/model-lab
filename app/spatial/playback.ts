/** One bounded explanation clock. It has no model/session command capability. */
export class ExplanationPlayback {
  cursor=0; phase=2; playing=false; exploring=false; follow=true; generation=0;
  source=''; route:'forward'|'learning'='forward'; length=0;
  private timer?:ReturnType<typeof setTimeout>;
  constructor(private readonly changed:()=>void,private readonly apply:()=>void,private readonly delay=2200,private readonly transient=()=>{}){}
  bind(source:string,route:'forward'|'learning',length:number){this.invalidate();this.source=source;this.route=route;this.length=length;this.cursor=0;}
  pause(exploring=false){clearTimeout(this.timer);this.timer=undefined;this.playing=false;this.exploring=exploring;this.generation++;}
  invalidate(){this.pause();this.source='';this.length=0;}
  step(cursor:number){this.pause();this.phase=2;this.cursor=Math.max(0,Math.min(this.length-1,cursor));if(this.source)this.apply();this.changed();}
  resume(){this.step(this.cursor);}
  play(){if(!this.source)return;this.pause();this.phase=0;this.playing=true;this.apply();this.changed();this.schedule();}
  private schedule(){if(!this.playing||!this.source)return;const generation=this.generation;this.timer=setTimeout(()=>{this.timer=undefined;if(!this.playing||generation!==this.generation)return;if(this.phase<2){this.phase++;this.transient();this.schedule();return;}if(this.cursor+1>=this.length){this.pause();this.changed();return;}this.cursor++;this.phase=0;this.apply();this.changed();this.schedule();},this.delay);}
  get pendingTimers(){return Number(this.timer!==undefined);}
}
