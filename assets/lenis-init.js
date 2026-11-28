/* Lenis smooth scroll (self-hosted v1.3.29). Remove the 3 tags in index.html to roll back. */
(function(){
if(!window.Lenis||matchMedia("(prefers-reduced-motion:reduce)").matches)return;
var l=new Lenis({lerp:.1,duration:1.5,smoothWheel:true,anchors:{offset:-72}});
window.__lenis=l;
function raf(t){l.raf(t);requestAnimationFrame(raf)}requestAnimationFrame(raf);
["drawer","modal","searchResults"].forEach(function(id){var e=document.getElementById(id);if(e)e.setAttribute("data-lenis-prevent","")});
var o=Element.prototype.scrollIntoView;
Element.prototype.scrollIntoView=function(a){if(a&&a.behavior==="smooth"){l.scrollTo(this,{offset:-72});return}return o.apply(this,arguments)};
})();
