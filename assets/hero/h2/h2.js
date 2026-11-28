(function(){
"use strict";
var slide=document.querySelector("#hero .slide.s1"),root=slide&&slide.querySelector(".h2s");
if(!root)return;
var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches,timer=null,was=false;
function fit(){
  var sw=root.clientWidth;if(!sw)return;
  [[".h2-hl.h2-l1",.519],[".h2-hl.h2-l2",.44],[".h2-script",.22]].forEach(function(p){
    var el=root.querySelector(p[0]);el.style.fontSize="";
    var w0=el.getBoundingClientRect().width;if(!w0)return;
    el.style.fontSize=(parseFloat(getComputedStyle(el).fontSize)*(p[1]*sw/w0)).toFixed(1)+"px";
  });
}
function arrive(){
  clearTimeout(timer);
  root.classList.remove("h2-rest","h2-arriving");
  if(reduce){root.classList.add("h2-rest");return}
  void root.offsetWidth;
  root.classList.add("h2-arriving");
  timer=setTimeout(function(){root.classList.remove("h2-arriving");root.classList.add("h2-rest")},2700);
}
function leave(){clearTimeout(timer);root.classList.remove("h2-arriving","h2-rest")}
function check(){
  var c=slide.classList,on=c.contains("on")&&!c.contains("pre-r")&&!c.contains("pre-l"),out=c.contains("out-l")||c.contains("out-r");
  if(on&&!was){was=true;fit();arrive()}
  else if(!on&&!out&&was){was=false;leave()}
}
new MutationObserver(check).observe(slide,{attributes:true,attributeFilter:["class"]});
(document.fonts&&document.fonts.ready||Promise.resolve()).then(function(){fit();check()});
addEventListener("resize",fit);
if(!reduce&&matchMedia("(pointer:fine)").matches){
  var tx=0,ty=0,cx=0,cy=0,L=[].slice.call(root.querySelectorAll(".h2-px")),run=false;
  addEventListener("mousemove",function(e){tx=(e.clientX/innerWidth-.5)*2;ty=(e.clientY/innerHeight-.5)*2});
  (function loop(){
    if(was&&!document.hidden){
      cx+=(tx-cx)*.06;cy+=(ty-cy)*.06;
      L.forEach(function(l){var d=parseFloat(l.style.getPropertyValue("--d"))||0;l.style.transform="translate("+(-cx*12*d).toFixed(2)+"px,"+(-cy*12*d).toFixed(2)+"px)"});
    }
    requestAnimationFrame(loop);
  })();
}
window.h2Replay=function(){fit();arrive()};
})();
