(function(){
if(matchMedia('(prefers-reduced-motion:reduce)').matches||!('IntersectionObserver' in window))return;
var els=[].slice.call(document.querySelectorAll('main .card,main .pwrap>div,main h2'));
els.forEach(function(e,i){e.classList.add('ig-r');e.style.setProperty('--d',((i%4)*90)+'ms')});
var io=new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){x.target.classList.add('ig-in');io.unobserve(x.target)}})},{threshold:.08});
els.forEach(function(e){io.observe(e)});
setTimeout(function(){els.forEach(function(e){e.classList.add('ig-in')})},4000);
function sweep(){var vh=innerHeight;els.forEach(function(e){if(!e.classList.contains('ig-in')&&e.getBoundingClientRect().top<vh*0.98){e.classList.add('ig-in');io.unobserve(e)}})}
var t=0,last=0;addEventListener('scroll',function(){if(scrollY<last)sweep();last=scrollY;clearTimeout(t);t=setTimeout(sweep,120)},{passive:true});
addEventListener('scrollend',sweep);setInterval(sweep,1500);
})();
