/* Premium layer: category sections with their own intro + a different reveal per section, card light/tilt, heading text reveal. Additive: nothing here changes data, prices, cart or checkout. */
(function(){
"use strict";
var reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion:reduce)").matches;
var fine=window.matchMedia&&matchMedia("(hover:hover) and (pointer:fine)").matches;
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]})}
function money(n){try{return typeof fmt==="function"?fmt(n):"Rs. "+Number(n).toLocaleString("en-PK")}catch(e){return "Rs. "+n}}
var SECS=[
 {k:"consoles",raw:["Consoles"],t:"Consoles",line:"PlayStation, Xbox and more",d:"New and used consoles in PKR with cash on delivery across Pakistan.",a:"#EC008C",b:"#7B2FF7",fx:"rise"},
 {k:"tech",raw:["Premium Tech"],t:"Premium tech",line:"Headsets, VR and big-ticket gear",d:"Higher-end tech from the shop, priced in PKR.",a:"#00AEEF",b:"#7B2FF7",fx:"flip"},
 {k:"controllers",raw:["Controllers"],t:"Controllers",line:"Pads for every playstyle",d:"DualSense, DualShock, Xbox and third-party pads.",a:"#EC008C",b:"#00AEEF",fx:"spin"},
 {k:"headsets",raw:["Headsets"],t:"Headsets",line:"Hear every step",d:"Gaming headsets for console and PC.",a:"#00E5FF",b:"#EC008C",fx:"drop"},
 {k:"wheels",raw:["Racing Wheels"],t:"Racing wheels",line:"Get closer to the track",d:"Wheel and pedal sets for racing games.",a:"#FFB36B",b:"#EC008C",fx:"slide"},
 {k:"games",raw:["PS4 Games","PS5 Games"],t:"Games",line:"Discs for PS4 and PS5",d:"Original discs for PS4 and PS5. Tap a game for photos and details.",a:"#7B2FF7",b:"#00AEEF",fx:"curtain"},
 {k:"setup",raw:["Gaming Chairs","Gaming Setups","Room Lighting"],t:"Setup and comfort",line:"Build the whole corner",d:"Chairs, complete setups and room lighting.",a:"#00AEEF",b:"#EC008C",fx:"pop"},
 {k:"gift",raw:["Gift Cards"],t:"Gift cards",line:"Top up and play",d:"Gift cards for your console account.",a:"#FFC531",b:"#EC008C",fx:"pop"}
];
var FX_ORDER=["rise","flip","spin","drop","slide","curtain","pop"];
function group(list){
 var out=SECS.map(function(s){return {s:s,items:[]}}),more={s:{k:"more",raw:[],t:"More gear",line:"Everything else in the shop",d:"More products from Imran Games Officials.",a:"#00AEEF",b:"#EC008C",fx:"rise"},items:[]};
 list.forEach(function(p){var g=null;for(var i=0;i<out.length&&!g;i++){if(out[i].s.raw.indexOf(p.raw)>-1)g=out[i]}(g||more).items.push(p)});
 out.push(more);return out.filter(function(g){return g.items.length});
}
window.igSections=function(host,list){
 if(!host)return;
 host.classList.remove("grid");host.classList.add("igsecs");
 var gs=group(list);
 host.innerHTML=gs.map(function(g,n){
  var s=g.s,stk=g.items.filter(function(p){return !p.soldOut}),min=stk.length?Math.min.apply(null,stk.map(function(p){return p.price})):null;
  g.items.sort(function(a,b){return (a.soldOut?1:0)-(b.soldOut?1:0)});
  return '<section class="igsec" id="sec-'+s.k+'" data-fx="'+s.fx+'" style="--ac:'+s.a+';--ac2:'+s.b+'" aria-label="'+esc(s.t)+'">'+
   '<header class="igsec-h"><span class="igsec-n" aria-hidden="true">'+String(n+1).padStart(2,"0")+'</span>'+
   '<div class="igsec-tx"><span class="igsec-k">'+esc(s.line)+'</span><h3 class="igsec-t">'+esc(s.t)+'</h3><p>'+esc(s.d)+'</p></div>'+
   '<div class="igsec-meta"><b>'+g.items.length+'</b><span>item'+(g.items.length===1?"":"s")+'</span><em>'+(min==null?'Sold out right now':'from '+esc(money(min))+' in stock')+'</em></div><i class="igsec-line" aria-hidden="true"></i></header>'+
   '<div class="grid igsec-grid" data-igg="'+s.k+'"></div></section>';
 }).join("");
 gs.forEach(function(g){var el=host.querySelector('[data-igg="'+g.s.k+'"]');if(el&&typeof renderGrid==="function")renderGrid(el,g.items)});
 tag(host);
};
/* reveal engine */
var io=null;
function ensureIO(){if(io||!("IntersectionObserver" in window))return io;
 io=new IntersectionObserver(function(es){es.forEach(function(en){if(!en.isIntersecting&&!(en.boundingClientRect.top<0))return;var t=en.target;io.unobserve(t);
  if(t.classList.contains("igsec-h")){t.classList.add("rv");return}
  t.classList.add("rv")})},{threshold:0,rootMargin:"0px 0px 400px 0px"});return io}
function fxOf(card){var h=card.closest("[data-fx]");if(h)return h.getAttribute("data-fx");var g=card.closest("#gameGrid");if(g)return "curtain";if(card.closest("#discGrid"))return "pop";if(card.closest("[data-catgrid]")){var k=card.closest("[data-catgrid]").getAttribute("data-catgrid");return k==="hardware"?"rise":k==="controls"?"flip":"slide"}return "rise"}
function tag(root){
 root=root||document;
 if(reduce){return}
 var obs=ensureIO();
 root.querySelectorAll(".igsec-h:not(.igp)").forEach(function(h){h.classList.add("igp");obs?obs.observe(h):h.classList.add("rv")});
 var seen={};
 root.querySelectorAll(".card:not(.igp)").forEach(function(c){
  if(c.closest("#dealGrid")||c.closest(".dm-track"))return;
  var gr=c.parentElement;var key=gr&&(gr.id||gr.getAttribute("data-igg")||gr.getAttribute("data-catgrid")||"g");
  seen[key]=(seen[key]||0);var i=seen[key]++;
  c.classList.add("igp");c.setAttribute("data-fx",fxOf(c));c.style.setProperty("--ig",(i%6)*35+"ms");c.style.setProperty("--igs",i%2?1:-1);
  obs?obs.observe(c):c.classList.add("rv");
 });
}
/* grids rendered elsewhere (games, discount zone, category previews) get tagged when they change */
function watch(){
 ["gameGrid","discGrid"].forEach(function(id){var el=document.getElementById(id);if(!el||el.__igw)return;el.__igw=1;
  new MutationObserver(function(){tag(el)}).observe(el,{childList:true})});
 document.querySelectorAll("[data-catgrid]").forEach(function(el){if(el.__igw)return;el.__igw=1;new MutationObserver(function(){tag(el)}).observe(el,{childList:true})});
 tag(document);
}
/* headings: words rise in one by one */
function words(){
 if(reduce)return;
 var o=ensureIO();
 document.querySelectorAll(".sec-head h2,.dh-title h2").forEach(function(h){
  if(h.__igw||h.children.length>2&&!h.classList.contains("sec-head"))return;h.__igw=1;
  var txt=h.textContent;if(!txt||h.querySelector("span.dh-w"))return;
  h.setAttribute("aria-label",txt);
  h.innerHTML=txt.split(" ").map(function(w,i){return '<span class="igw" aria-hidden="true" style="--w:'+i*70+'ms"><span>'+esc(w)+'&nbsp;</span></span>'}).join("");
  h.classList.add("ighd");o?o.observe(h):h.classList.add("rv");
 });
}
/* pointer light + gentle tilt on desktop */
function pointer(){
 if(!fine||reduce)return;
 document.addEventListener("pointermove",function(e){
  var c=e.target.closest&&e.target.closest(".card.igp");if(!c||!c.classList.contains("rv"))return;
  var r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
  c.style.setProperty("--px",(x*100).toFixed(1)+"%");c.style.setProperty("--py",(y*100).toFixed(1)+"%");
  c.style.setProperty("--rx",((.5-y)*5).toFixed(2)+"deg");c.style.setProperty("--ry",((x-.5)*6).toFixed(2)+"deg");
 },{passive:true});
 document.addEventListener("pointerout",function(e){var c=e.target.closest&&e.target.closest(".card.igp");if(c&&!c.contains(e.relatedTarget)){c.style.removeProperty("--rx");c.style.removeProperty("--ry")}},{passive:true});
}
function boot(){document.documentElement.classList.add("igp-on");watch();words();pointer();
 /* if the grid was already rendered before this script ran, rebuild it in sections */
 var tg=document.getElementById("topGrid");
 if(tg&&!tg.classList.contains("igsecs")&&typeof applyFilters==="function"&&typeof PRODUCTS!=="undefined"&&PRODUCTS.length)applyFilters();
 setTimeout(function(){watch();words()},1200);setTimeout(function(){watch()},3500);}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();

/* safety net: anything the viewport has reached or passed is revealed when scrolling pauses or reverses (fast flicks can skip the observer) */
(function(){var t=0,last=0;
 function sweep(){var vh=innerHeight;document.querySelectorAll(".igp:not(.rv)").forEach(function(e){var r=e.getBoundingClientRect();if(r.top<vh*0.98){e.classList.add("rv");if(io)io.unobserve(e)}})}
 function onS(){var y=scrollY;if(y<last)sweep();last=y;clearTimeout(t);t=setTimeout(sweep,120)}
 addEventListener("scroll",onS,{passive:true});addEventListener("resize",function(){clearTimeout(t);t=setTimeout(sweep,150)},{passive:true});
 addEventListener("scrollend",sweep);
 setInterval(function(){if(!document.hidden)sweep()},1500);
})();
})();
