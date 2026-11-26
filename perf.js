/* Pause looping animations while their section is off screen. */
(function(){
if(!("IntersectionObserver" in window))return;
var io=new IntersectionObserver(function(es){es.forEach(function(e){e.target.classList.toggle("ig-off",!e.isIntersecting)})},{rootMargin:"120px 0px"});
function go(){document.querySelectorAll("#hero,#hotsheet,.marq,#gearup,footer").forEach(function(el){io.observe(el)})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();
})();
