(function(){
"use strict";
var reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion:reduce)").matches;
var doc=document.documentElement;
function clamp(v,a,b){return v<a?a:v>b?b:v}
function ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
/* progress bar */
var bar=document.createElement("div");bar.className="wprog";bar.setAttribute("aria-hidden","true");document.body.appendChild(bar);
/* chapter */
var ch=document.getElementById("gearup");
var st,core,its=[],lines=[],barI,cta,grid;
if(ch){
  st=ch.querySelector(".ch-stage");core=ch.querySelector(".ch-core");
  its=[].slice.call(ch.querySelectorAll(".ch-it"));lines=[].slice.call(ch.querySelectorAll(".ch-svg line"));
  barI=ch.querySelector(".ch-bar");cta=ch.querySelector(".ch-cta");grid=ch.querySelector(".ch-grid");
  if(reduce)ch.classList.add("static");
}
var vis=false,dirty=true,lastY=0,vel=0,marq=document.querySelector(".marq-t");
function renderChapter(){
  var r=ch.getBoundingClientRect(),total=r.height-innerHeight;
  var p=reduce?1:clamp(-r.top/total,0,1);
  var W=st.clientWidth,H=st.clientHeight,cx=W/2,cy=H*(small?.63:.61);
  var small=W<721;
  var R=Math.min(W*(small?.34:.3),H*(small?.25:.27));
  var gather=ease(clamp(p/.38,0,1)),burst=ease(clamp((p-.38)/.4,0,1));
  var far=Math.max(W,H)*.85;
  var cs=.72+.28*gather+.06*burst;
  core.style.transform="translate3d(-50%,-50%,0) scale("+cs.toFixed(3)+") rotate("+((1-gather)*-14+burst*0).toFixed(2)+"deg)";
  core.style.opacity=clamp(p/.12,0,1).toFixed(2);
  for(var i=0;i<its.length;i++){
    var el=its[i],a=+el.dataset.a*Math.PI/180,rr=+el.dataset.r;
    var d0=far,d1=R*.22,d2=R*(small?1.05:1.12)*rr;
    var d=d0+(d1-d0)*gather;d=d+(d2-d1)*burst;
    var sc=(.4+.12*gather)+.6*burst;
    var rot=(1-gather)*(i%2?220:-220)+(1-burst)*(i%2?-16:16)*(gather);
    var x=Math.cos(a)*d*(small?1.12:1.7),y=Math.sin(a)*d*(small?1.05:.95);
    var o=clamp(p/.14,0,1);
    el.style.transform="translate3d(calc(-50% + "+x.toFixed(1)+"px),calc(-50% + "+y.toFixed(1)+"px),0) scale("+sc.toFixed(3)+") rotate("+rot.toFixed(1)+"deg)";
    el.style.opacity=o.toFixed(2);
    el.style.setProperty("--lo",clamp((burst-.55)/.4,0,1).toFixed(2));
    var ln=lines[i];
    if(ln){
      ln.setAttribute("x1",cx);ln.setAttribute("y1",cy);
      ln.setAttribute("x2",(cx+x*.9).toFixed(1));ln.setAttribute("y2",(cy+y*.9).toFixed(1));
      ln.style.opacity=clamp((burst-.15)/.5,0,1).toFixed(2);
    }
  }
  st.style.setProperty("--p",p.toFixed(3));
  if(cta)cta.style.setProperty("--co",clamp((p-.82)/.14,0,1).toFixed(2));
  if(grid)grid.style.setProperty("--gy",(p*-120).toFixed(0)+"px");
}
function frame(){
  var y=window.pageYOffset||doc.scrollTop;
  var h=doc.scrollHeight-innerHeight;
  bar.style.transform="scaleX("+(h>0?clamp(y/h,0,1):0).toFixed(4)+")";
  if(!reduce){
    vel+=((y-lastY)-vel)*.15;lastY=y;
    if(marq){marq.style.animationDuration=clamp(32-Math.abs(vel)*1.4,10,32)+"s"}
    var hb=document.querySelector(".h-bg"),hs=document.querySelector(".h-shards");
    var k=y<innerHeight*1.2?y:innerHeight*1.2;
    if(hb)hb.style.transform="translate3d(0,"+(k*.18).toFixed(1)+"px,0)";
    if(hs)hs.style.transform="translate3d(0,"+(k*.32).toFixed(1)+"px,0)";
  }
  if(ch&&vis)renderChapter();
  dirty=false;
}
var raf=0;
function req(){if(!raf)raf=requestAnimationFrame(function(){raf=0;frame()})}
addEventListener("scroll",req,{passive:true});addEventListener("resize",req);
if(ch&&"IntersectionObserver"in window){
  new IntersectionObserver(function(e){vis=e[0].isIntersecting;if(vis)req()},{rootMargin:"100px"}).observe(ch);
}else vis=!!ch;
frame();
/* 3D tilt on cards, fine pointers only */
if(!reduce&&matchMedia("(hover:hover) and (pointer:fine)").matches){
  var cur=null,tm=0;
  document.addEventListener("pointermove",function(e){
    var c=e.target.closest&&e.target.closest(".card,.gcard,.dcard");
    if(cur&&cur!==c){cur.style.removeProperty("--rx");cur.style.removeProperty("--ry")}
    cur=c;if(!c)return;
    if(tm)return;tm=requestAnimationFrame(function(){tm=0;var b=c.getBoundingClientRect();
      var px=(e.clientX-b.left)/b.width-.5,py=(e.clientY-b.top)/b.height-.5;
      c.style.setProperty("--ry",(px*8).toFixed(2)+"deg");c.style.setProperty("--rx",(-py*8).toFixed(2)+"deg")})
  },{passive:true});
}
})();
