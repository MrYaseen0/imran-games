/* Imran Games hero: carousel, tilt, expanding search, hot deals sheet.
   Reads products from the page's existing PRODUCTS array (live Supabase data). Never hardcodes name, price or discount. */
(function(){
"use strict";
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var hero=$("#hero");if(!hero)return;
var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;if(reduce)document.documentElement.classList.add("is-reduced");
var slides=$$(".slide",hero),dots=$$(".h-dots button",hero),bgs=$$(".bgl",hero),chips=$$(".hchip[data-go]",hero);
var cur=0,timer=null,paused=false,busy=false,hoverP=false,focusP=false,touchP=false;
var N=slides.length;

/* ---- slide map: which live product backs each card ---- */
var MATCH={
  ds4:/dualshock 4/i,
  ps4pro:/playstation 4 pro|ps4 pro/i,
  onik:/onikuma k2 pro/i,
  sup:/sup game box/i,
  gta:/grand theft auto v\s+—\s+premium/i,
  ghost:/ghost of tsushima/i
};
function find(key){
  var list=(window.PRODUCTS||[]);
  for(var i=0;i<list.length;i++){if(MATCH[key].test(list[i].name))return list[i]}
  return null;
}
function esc(x){return (typeof escHtml==="function")?escHtml(x):String(x).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function money(n){return (typeof fmt==="function")?fmt(n):"Rs. "+Number(n).toLocaleString("en-PK")}
function pct(p){return (p.old&&p.old>p.price)?Math.round((1-p.price/p.old)*100):0}
function shortName(p){return p.name.split("—")[0].trim()}

function cardHTML(p,thumb){
  var d=pct(p),sold=p.soldOut||p.stock===0;
  var wished=(typeof wish!=="undefined"&&wish[p.id]);
  return '<div class="th"><img src="'+esc(thumb)+'" alt="" loading="lazy" decoding="async"></div>'+
   '<div class="tx"><p class="gh">'+esc(shortName(p))+'</p>'+
   '<div class="pr">'+money(p.price)+(d?'<s>'+money(p.old)+'</s><em>-'+d+'%</em>':'')+'</div>'+
   '<div class="ac">'+(sold?'<button class="add" data-soldout="1" aria-disabled="true">Sold out</button>':'<button class="add" data-add="'+p.id+'">Add to Cart</button>')+
   '<button class="hrt'+(wished?' on':'')+'" data-wish="'+p.id+'" aria-label="Add '+esc(shortName(p))+' to wishlist"><svg width="18" height="18" viewBox="0 0 24 24" fill="'+(wished?'currentColor':'none')+'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/></svg></button></div></div>';
}
function fillCards(){
  $$(".gcard",hero).forEach(function(el){
    var p=find(el.dataset.key);
    if(!p){el.hidden=true;return}
    el.hidden=false;el.dataset.pid=p.id;
    el.innerHTML=cardHTML(p,el.dataset.thumb);
  });
  $$("[data-prodkey]",hero).forEach(function(el){
    var p=find(el.dataset.prodkey);if(p)el.dataset.view=p.id;
  });
}
function refreshWish(){
  $$(".gcard .hrt",hero).forEach(function(b){var on=!!(typeof wish!=="undefined"&&wish[+b.dataset.wish]);b.classList.toggle("on",on);var s=b.querySelector("svg");if(s)s.setAttribute("fill",on?"currentColor":"none")});
}

/* ---- hot deals marquee ---- */
/* Enhanced copies are keyed by the ORIGINAL photo URL. A replaced photo has a new URL, so it falls back to the live original until the copy is rebuilt. */
var DEAL_IMG={"https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/7-1.webp":"assets/deals/7-03cc8cbe.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/8-1.webp":"assets/deals/8-ea23262d.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/9-1.webp":"assets/deals/9-2720e186.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/10-1.webp":"assets/deals/10-e33bc35b.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/11-1.webp":"assets/deals/11-a100f0be.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/12-1.webp":"assets/deals/12-f92efb0b.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/2-1.webp":"assets/deals/2-bc17fd07.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/13-1.webp":"assets/deals/13-f9b3c095.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/14-1.webp":"assets/deals/14-a9b449bb.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/15-1.webp":"assets/deals/15-23ba3058.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/17-1.webp":"assets/deals/17-5659009b.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/18-1.webp":"assets/deals/18-683bf039.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/19-1.webp":"assets/deals/19-b47a09bc.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/21-1.webp":"assets/deals/21-c2c6f794.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/22-1.webp":"assets/deals/22-77b3893c.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/23-1.webp":"assets/deals/23-f7bfa89c.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/24-1.webp":"assets/deals/24-8635bbba.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/25-1.webp":"assets/deals/25-53d69d62.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/26-1.webp":"assets/deals/26-5f63327f.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/27-1.webp":"assets/deals/27-2811135d.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/28-1.webp":"assets/deals/28-12929b5c.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/16-1.webp":"assets/deals/16-e77f5ec8.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/29-1.webp":"assets/deals/29-604d5d42.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/30-1.webp":"assets/deals/30-bfba61af.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/31-1.webp":"assets/deals/31-aedf79ea.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/32-1.webp":"assets/deals/32-da188d8b.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/33-1.webp":"assets/deals/33-09b0d67f.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/34-1.webp":"assets/deals/34-e441782f.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/35-1.webp":"assets/deals/35-5599f90f.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/36-1.webp":"assets/deals/36-9526847d.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/37-1.webp":"assets/deals/37-84255bbd.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/20-1.webp":"assets/deals/20-c93d0e5b.webp","https://vnbaizpqucimomrfvfpd.supabase.co/storage/v1/object/public/product-images/42-1.webp":"assets/deals/1001-688daaa0.webp"};
var dmApi=null;
function dealCard(p,clone,i){
  var orig=(p.imgs&&p.imgs[0])||"logo.png",src=DEAL_IMG[orig]||orig;
  var save=p.old-p.price,nm=shortName(p);
  return '<article class="dd" data-view="'+p.id+'" style="--bg:url(\''+esc(src)+'\')"'+(clone?' aria-hidden="true"':'')+'>'+
   '<div class="dd-img"><img src="'+esc(src)+'" data-fb="'+esc(orig)+'" alt="" '+((!clone&&i<6)?'loading="eager" fetchpriority="high"':'loading="lazy"')+' decoding="async" width="720" height="576" draggable="false" onerror="if(this.dataset.fb&&this.src.indexOf(this.dataset.fb)<0){this.src=this.dataset.fb}"><b class="dd-off">-'+pct(p)+'%</b></div>'+
   '<div class="dd-body"><span class="dd-cat">'+esc(p.catLabel||"")+'</span><h3>'+(clone?esc(nm):'<button type="button" class="dd-view" data-view="'+p.id+'">'+esc(nm)+'</button>')+'</h3>'+
   '<div class="dd-p"><strong>'+money(p.price)+'</strong><s>'+money(p.old)+'</s></div>'+
   '<div class="dd-meter" style="--w:'+pct(p)+'%" aria-hidden="true"><i></i></div><span class="dd-save">Save '+money(save)+' ('+pct(p)+'% off)</span>'+
   '<button class="dd-add" type="button" data-add="'+p.id+'"'+(clone?' tabindex="-1"':' aria-label="Add '+esc(nm)+' to cart"')+'><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.4 11h10.2L20 7H6.2"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></svg>Add to Cart</button></div></article>';
}
function dealMarquee(row){
  var track,g0,W=1;
  var rm=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  function bind(){track=row.querySelector(".dm-track");g0=row.querySelector(".dm-grp");W=g0.getBoundingClientRect().width||1}
  bind();
  if(rm||!track)return null;
  var SPEED=70,x=0,last=0,hover=false,focus=false,hold=false,drag=null,moved=false,vis=true,raf=0,holdT=0,glide=null;
  function put(){x=((x%W)+W)%W;track.style.transform="translate3d("+(-x)+"px,0,0)"}
  function tick(t){
    var dt=last?Math.min(t-last,50):16;last=t;
    if(glide){var k=Math.min(1,(t-glide.t0)/glide.d);var e=1-Math.pow(1-k,3);x=glide.from+glide.by*e;if(k>=1)glide=null}
    else if(!hover&&!focus&&!hold&&!drag)x+=SPEED*dt/1000;
    put();raf=vis&&!document.hidden?requestAnimationFrame(tick):0;
  }
  function start(){if(!raf){last=0;raf=requestAnimationFrame(tick)}}
  if("IntersectionObserver" in window){new IntersectionObserver(function(en){vis=en[0].isIntersecting;if(vis)start()}).observe(row)}
  document.addEventListener("visibilitychange",function(){if(!document.hidden)start()});
  row.addEventListener("mouseenter",function(){hover=true});row.addEventListener("mouseleave",function(){hover=false});
  row.addEventListener("focusin",function(e){focus=true;var c=e.target.closest(".dd");if(!c||c.closest(".dm-grp")!==g0)return;
    var rr=row.getBoundingClientRect(),cr=c.getBoundingClientRect();
    if(cr.left<rr.left+8||cr.right>rr.right-8){glide={t0:performance.now(),d:380,from:x,by:(function(){var by=(cr.left-rr.left-16);return by})()}}});
  row.addEventListener("focusout",function(e){if(!row.contains(e.relatedTarget))focus=false});
  row.addEventListener("pointerdown",function(e){if(e.pointerType==="mouse"&&e.button!==0)return;clearTimeout(holdT);hold=true;glide=null;drag={x:e.clientX,p:x,id:e.pointerId};moved=false});
  row.addEventListener("pointermove",function(e){if(!drag||e.pointerId!==drag.id)return;var dx=e.clientX-drag.x;if(!moved&&Math.abs(dx)>6){moved=true;try{row.setPointerCapture(e.pointerId)}catch(_){}row.classList.add("drag")}if(moved)x=drag.p-dx});
  function up(e){if(!drag)return;drag=null;row.classList.remove("drag");clearTimeout(holdT);holdT=setTimeout(function(){hold=false},e.pointerType==="mouse"?200:1400)}
  row.addEventListener("pointerup",up);row.addEventListener("pointercancel",up);
  row.addEventListener("click",function(e){if(moved){e.stopPropagation();e.preventDefault();moved=false}},true);
  function step(dir){clearTimeout(holdT);hold=true;var c=g0.querySelector(".dd"),s=c.getBoundingClientRect().width+parseFloat(getComputedStyle(g0).columnGap||0)+0;glide={t0:performance.now(),d:480,from:x,by:dir*s*(window.innerWidth<720?1:2)};holdT=setTimeout(function(){hold=false},1800)}
  document.querySelectorAll("[data-dm]").forEach(function(b){b.addEventListener("click",function(){step(+b.dataset.dm)})});
  window.addEventListener("resize",function(){var f=x/W;W=g0.getBoundingClientRect().width;x=f*W});
  if(window.matchMedia&&matchMedia("(hover:hover)").matches){
    row.addEventListener("pointermove",function(e){if(e.pointerType!=="mouse"||drag)return;var c=e.target.closest&&e.target.closest(".dd");if(!c)return;var r=c.getBoundingClientRect(),px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height;c.style.setProperty("--mx",(px*100)+"%");c.style.setProperty("--my",(py*100)+"%");c.style.setProperty("--ry",((px-.5)*7)+"deg");c.style.setProperty("--rx",((.5-py)*5)+"deg")});
    row.addEventListener("pointerout",function(e){var c=e.target.closest&&e.target.closest(".dd");if(c&&!c.contains(e.relatedTarget)){c.style.removeProperty("--rx");c.style.removeProperty("--ry");c.style.removeProperty("--mx");c.style.removeProperty("--my")}});
  }
  start();
  return {step:step,rebind:function(){var f=x/W;bind();x=f*W;put()},pos:function(){return x},width:function(){return W}};
}
function fillSheet(){
  var row=$("#hdRow");if(!row)return;
  var list=(window.PRODUCTS||[]).filter(function(p){return pct(p)>0&&!p.soldOut&&p.stock>0});
  list.sort(function(a,b){return pct(b)-pct(a)||(b.hot?1:0)-(a.hot?1:0)});
  if(!list.length){row.innerHTML='<p class="dnote">New deals land here as soon as they are live.</p>';return}
  var one=list.map(function(p,i){return dealCard(p,false,i)}).join("");
  var two=list.map(function(p,i){return dealCard(p,true,i)}).join("");
  row.innerHTML='<div class="dm-track"><div class="dm-grp">'+one+'</div><div class="dm-grp" aria-hidden="true">'+two+'</div></div>';
  if(dmApi&&dmApi.rebind)dmApi.rebind();else window.dmApi=dmApi=dealMarquee(row);
}

window.igHeroRender=function(){fillCards();fillSheet();refreshWish()};
if(window.PRODUCTS&&window.PRODUCTS.length)window.igHeroRender();

/* ---- carousel ---- */
function setActiveUI(n){
  dots.forEach(function(d,i){d.classList.toggle("on",i===n);d.setAttribute("aria-current",i===n?"true":"false")});
  bgs.forEach(function(b,i){b.classList.toggle("on",i===n)});
  chips.forEach(function(c){c.classList.toggle("on",(+c.dataset.go===4)?n===4:n!==4)});
  slides.forEach(function(s,i){s.setAttribute("aria-hidden",i===n?"false":"true")});
}
function go(n,dir){
  n=(n+N)%N;if(n===cur||busy)return;
  dir=dir||(n>cur?1:-1);
  lazyLoad(n);lazyLoad(n+1);
  var prev=slides[cur],next=slides[n];
  if(reduce){prev.classList.remove("on");next.classList.add("on");cur=n;setActiveUI(n);return}
  busy=true;
  next.classList.remove("out-l","out-r");
  next.classList.add("on",dir>0?"pre-r":"pre-l");
  void next.offsetWidth;
  prev.classList.remove("on");prev.classList.add(dir>0?"out-l":"out-r");
  next.classList.remove("pre-r","pre-l");
  cur=n;setActiveUI(n);
  setTimeout(function(){prev.classList.remove("out-l","out-r");busy=false},940);
  lazyLoad(n+1);
}
function next(){go(cur+1,1)}function prevS(){go(cur-1,-1)}
function play(){stop();if(reduce)return;timer=setInterval(function(){if(!paused&&!document.hidden)next()},5000)}
function stop(){if(timer){clearInterval(timer);timer=null}}
function sync(){paused=hoverP||focusP||touchP}
hero.addEventListener("mouseenter",function(){hoverP=true;sync()});
hero.addEventListener("mouseleave",function(){hoverP=false;sync();resetTilt()});
hero.addEventListener("focusin",function(){focusP=true;sync()});
hero.addEventListener("focusout",function(){focusP=false;sync()});
$(".h-prev",hero).addEventListener("click",function(){prevS();play()});
$(".h-next",hero).addEventListener("click",function(){next();play()});
dots.forEach(function(d,i){d.addEventListener("click",function(){go(i);play()})});
chips.forEach(function(c){c.addEventListener("click",function(){go(+c.dataset.go);play()})});
hero.addEventListener("keydown",function(e){if(e.key==="ArrowRight"){next();play()}else if(e.key==="ArrowLeft"){prevS();play()}});
document.addEventListener("keydown",function(e){
  if(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  var r=hero.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight*.6)return;
  if(e.key==="ArrowRight"){next();play()}else if(e.key==="ArrowLeft"){prevS();play()}
});
document.addEventListener("click",function(e){var p=e.target.closest("#hero [data-view]");if(p&&!e.target.closest("button,a")&&typeof openModal==="function")openModal(+p.dataset.view)});

/* ---- tilt: mouse (+/-6deg) and touch drag; swipe changes slide ---- */
var rx=0,ry=0,trx=0,try_=0,raf=0;
function tiltTick(){
  rx+=(trx-rx)*.08;ry+=(try_-ry)*.08;
  var a=slides[cur];if(a){$$(".tilt",a).forEach(function(t){t.style.setProperty("--rx",rx.toFixed(2)+"deg");t.style.setProperty("--ry",ry.toFixed(2)+"deg")})}
  if(Math.abs(trx-rx)>.02||Math.abs(try_-ry)>.02)raf=requestAnimationFrame(tiltTick);else raf=0;
}
function setTilt(x,y){trx=Math.max(-6,Math.min(6,x));try_=Math.max(-6,Math.min(6,y));if(!raf&&!reduce)raf=requestAnimationFrame(tiltTick)}
function resetTilt(){setTilt(0,0)}
hero.addEventListener("pointermove",function(e){
  if(reduce||e.pointerType==="touch")return;
  var r=hero.getBoundingClientRect();
  setTilt(-((e.clientY-r.top)/r.height-.5)*12,((e.clientX-r.left)/r.width-.5)*12);
});
var sx=0,sy=0,dragging=false,dx=0;
hero.addEventListener("pointerdown",function(e){
  if(e.pointerType!=="touch"||e.target.closest("button,a"))return;
  dragging=true;sx=e.clientX;sy=e.clientY;dx=0;touchP=true;sync();
});
hero.addEventListener("pointermove",function(e){
  if(!dragging)return;dx=e.clientX-sx;setTilt(0,Math.max(-6,Math.min(6,dx/18)));
});
function endDrag(){
  if(!dragging)return;dragging=false;
  if(Math.abs(dx)>56){dx<0?next():prevS();play()}
  resetTilt();setTimeout(function(){touchP=false;sync()},2500);
}
hero.addEventListener("pointerup",endDrag);hero.addEventListener("pointercancel",endDrag);
hero.style.touchAction="pan-y";

/* ---- lazy image load for slides 2-5 ---- */
function lazyLoad(i){
  var s=slides[(i+N)%N];if(!s)return;
  $$("img[data-src]",s).forEach(function(im){im.src=im.dataset.src;im.removeAttribute("data-src")});
}
/* staggered so the Hot deals photos (first 6 are high priority) are not queued behind every hero slide image on a slow connection */
function loadRest(){var i=1;(function nx(){if(i>=N)return;lazyLoad(i++);setTimeout(nx,900)})()}
if(document.readyState==="complete")setTimeout(loadRest,2500);else window.addEventListener("load",function(){setTimeout(loadRest,2500)});

/* ---- header: scrolled state, drawer, search ---- */
var hd=$("#siteHeader");
function onScroll(){hd.classList.toggle("scrolled",scrollY>40)}
addEventListener("scroll",onScroll,{passive:true});onScroll();
var menuBtn=$("#menuBtn"),nav=$("#mainNav"),ov=$("#navOv");
function menu(open){nav.classList.toggle("open",open);ov.classList.toggle("show",open);menuBtn.setAttribute("aria-expanded",open?"true":"false");document.body.style.overflow=open?"hidden":""}
menuBtn.addEventListener("click",function(){menu(!nav.classList.contains("open"))});
ov.addEventListener("click",function(){menu(false)});
$$("a",nav).forEach(function(a){a.addEventListener("click",function(){menu(false)})});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&nav.classList.contains("open"))menu(false)});
/* active underline follows the section in view */
var navLinks=$$("a",nav);
function markNav(id){navLinks.forEach(function(a){if(a.getAttribute("href")==="#"+id)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")})}
if("IntersectionObserver" in window){
  var secs=["top","shop","games","deals","discounts","faq"].map(function(i){return document.getElementById(i)}).filter(Boolean);
  var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting)markNav(en.target.id==="top"?"top":en.target.id)})},{rootMargin:"-40% 0px -55% 0px"});
  secs.forEach(function(s){io.observe(s)});
}
markNav("top");

var sw=$("#shSearch"),sb=$("#searchBtn"),si=$("#navSearch"),sr=$("#searchResults");
var sel=-1,items=[];
function openSearch(){sw.classList.add("open");sb.setAttribute("aria-expanded","true");si.focus();renderRes()}
function closeSearch(){sw.classList.remove("open");sb.setAttribute("aria-expanded","false");sr.classList.remove("show");sel=-1;if(si.value){si.value="";if(typeof doSearch==="function")doSearch("")}}
sb.addEventListener("click",function(){sw.classList.contains("open")?closeSearch():openSearch()});
document.addEventListener("keydown",function(e){
  if(e.key==="/"&&!/INPUT|TEXTAREA|SELECT/.test((e.target||{}).tagName||"")&&!e.metaKey&&!e.ctrlKey){e.preventDefault();openSearch()}
});
document.addEventListener("click",function(e){if(sw.classList.contains("open")&&!e.target.closest("#shSearch"))closeSearch()});
function renderRes(){
  var q=si.value.trim().toLowerCase();sel=-1;
  if(!q){
    items=[];
    sr.innerHTML='<div class="rt">Try searching for</div><div class="sg"><button type="button" data-q="PS4 Pro">PS4 Pro</button><button type="button" data-q="GTA V">GTA V</button><button type="button" data-q="DualShock 4">DualShock 4</button></div>';
    sr.classList.add("show");return;
  }
  var words=q.split(/\s+/);
  items=(window.PRODUCTS||[]).filter(function(p){var h=(p.name+" "+(p.brand||"")+" "+(p.catLabel||"")).toLowerCase();if(/\bgta\b/.test(h)||h.indexOf("grand theft auto")>-1)h+=" gta";if(h.indexOf("dualshock")>-1)h+=" ds4 controller";return words.every(function(w){return h.indexOf(w)>-1})}).slice(0,6);
  if(!items.length){sr.innerHTML='<div class="none">No match for "'+esc(si.value.trim())+'". Try a console, a game or a controller name.</div>';sr.classList.add("show");return}
  sr.innerHTML='<div class="rt">Products</div>'+items.map(function(p,i){return '<div class="row" role="option" data-i="'+i+'" aria-selected="false"><img src="'+esc((p.imgs&&p.imgs[0])||"logo.png")+'" alt="" loading="lazy" width="44" height="44"><div><b>'+esc(shortName(p))+'</b><span>'+money(p.price)+(p.soldOut?" · Sold out":"")+'</span></div></div>'}).join("");
  sr.classList.add("show");
}
function mark(i){$$(".row",sr).forEach(function(r,j){r.setAttribute("aria-selected",j===i?"true":"false");if(j===i)r.scrollIntoView({block:"nearest"})})}
si.addEventListener("input",function(){renderRes();if(typeof doSearch==="function")doSearch(si.value)});
si.addEventListener("keydown",function(e){
  if(e.key==="ArrowDown"){e.preventDefault();if(items.length){sel=(sel+1)%items.length;mark(sel)}}
  else if(e.key==="ArrowUp"){e.preventDefault();if(items.length){sel=(sel-1+items.length)%items.length;mark(sel)}}
  else if(e.key==="Enter"){e.preventDefault();if(sel>-1&&items[sel]){pick(items[sel])}else if(si.value.trim()){var s=document.getElementById("shop");if(s)s.scrollIntoView({behavior:"smooth"});sr.classList.remove("show")}}
  else if(e.key==="Escape"){closeSearch();sb.focus()}
});
function pick(p){var id=p.id;closeSearch();if(typeof openModal==="function")openModal(id)}
sr.addEventListener("mousedown",function(e){e.preventDefault()});
sr.addEventListener("click",function(e){
  var r=e.target.closest(".row");if(r&&items[+r.dataset.i]){pick(items[+r.dataset.i]);return}
  var g=e.target.closest("[data-q]");if(g){si.value=g.dataset.q;si.focus();renderRes();if(typeof doSearch==="function")doSearch(si.value)}
});

/* ---- start ---- */
setActiveUI(0);
requestAnimationFrame(function(){requestAnimationFrame(function(){hero.classList.add("ready")})});
play();
document.addEventListener("visibilitychange",sync);
})();
(function(){var _tw=window.toggleWish;if(typeof _tw==="function"){window.toggleWish=function(id){var r=_tw.apply(this,arguments);if(window.igHeroRender)window.igHeroRender();return r}}})();

/* ---- typography reveal: split headline into characters, slide counter ---- */
(function(){
"use strict";
var hero=document.getElementById("hero");if(!hero)return;
Array.prototype.forEach.call(hero.querySelectorAll(".hl .ln>span"),function(sp,li){
  var t=sp.textContent;sp.textContent="";sp.classList.add("sp");sp.setAttribute("aria-hidden","true");
  var n=0;Array.prototype.forEach.call(t,function(c){
    var e=document.createElement("i");e.className="ch";e.textContent=c===" "?"\u00a0":c;e.style.setProperty("--i",String(li*7+n));n++;sp.appendChild(e);
  });
});
var cnt=document.createElement("div");cnt.className="h-count";cnt.setAttribute("aria-hidden","true");cnt.innerHTML="<b>01</b><span>/ 11</span>";hero.appendChild(cnt);
var dots=hero.querySelectorAll(".h-dots button"),b=cnt.querySelector("b");
function upd(){for(var i=0;i<dots.length;i++){if(dots[i].classList.contains("on")){var v=(i+1<10?"0":"")+(i+1);if(b.textContent!==v){b.textContent=v;cnt.classList.remove("tick");void cnt.offsetWidth;cnt.classList.add("tick")}break}}}
if(window.MutationObserver){var mo=new MutationObserver(upd);Array.prototype.forEach.call(dots,function(d){mo.observe(d,{attributes:true,attributeFilter:["class"]})})}
})();
