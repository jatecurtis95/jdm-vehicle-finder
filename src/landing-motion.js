// Landing motion: one passive scroll handler drives every animation on the
// marketing page, ported from the JDMFinder v2 design handoff's componentDidMount.
// Shipped as an inline <script> inside the page body (brandDoc already inlines
// analytics + the WhatsApp widget, so the page has no nonce-CSP to fight).
//
// It is defensive: every element it touches is looked up by id/selector and
// guarded, so the page still renders correctly when the photo layers are
// placeholders (no #heroImg / #featImg to parallax) and when JS is disabled
// (CSS shows reveals immediately under prefers-reduced-motion; the cost card and
// numbers fall back to their final values via the static markup + this script).
//
// COST_TOTAL is injected so the count-up target stays in sync with the data file.
export function landingMotionScript(costTotal) {
  return `<script>(function(){
  function init(){
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var root = document.querySelector('.jf'); if(!root) return;
    var revealEls = Array.prototype.slice.call(root.querySelectorAll('.rv'));
    var countEls  = Array.prototype.slice.call(root.querySelectorAll('[data-count-to]'));
    var fmt = function(n){ return n.toLocaleString('en-AU'); };

    function runCount(el){
      if(el.dataset.ran==='1') return; el.dataset.ran='1';
      var to=parseFloat(el.getAttribute('data-count-to'));
      var pre=el.getAttribute('data-pre')||'', post=el.getAttribute('data-post')||'';
      if(reduce){ el.textContent=pre+fmt(to)+post; return; }
      var dur=1100, t0=performance.now();
      (function tick(t){ var p=Math.min(1,(t-t0)/dur); var e=1-Math.pow(1-p,3);
        el.textContent=pre+fmt(Math.round(to*e))+post; if(p<1) requestAnimationFrame(tick); })(t0);
    }

    if(reduce){ revealEls.forEach(function(el){el.classList.add('in');}); countEls.forEach(runCount); }
    var useObservers=!reduce&&'IntersectionObserver' in window;
    if(useObservers){
      var revealObserver=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){entry.target.classList.add('in');revealObserver.unobserve(entry.target);}});},{rootMargin:'0px 0px -10% 0px'});
      revealEls.forEach(function(el){if(!el.classList.contains('in'))revealObserver.observe(el);});
      var countObserver=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){runCount(entry.target);countObserver.unobserve(entry.target);}});},{rootMargin:'0px 0px -15% 0px'});
      countEls.forEach(function(el){countObserver.observe(el);});
    }

    // mobile nav
    var burger=document.getElementById('navBurger'), menu=document.getElementById('navMenu');
    if(burger&&menu){
      var menuOpen=false;
      var close=function(restore){ menuOpen=false;menu.hidden=true;menu.inert=true;burger.setAttribute('aria-expanded','false');burger.setAttribute('aria-label','Open menu');if(restore)burger.focus(); };
      var open=function(){menuOpen=true;menu.hidden=false;menu.inert=false;burger.setAttribute('aria-expanded','true');burger.setAttribute('aria-label','Close menu');var first=menu.querySelector('a[href]');if(first)first.focus();};
      burger.addEventListener('click',function(){
        if(menuOpen)close(false);else open();
      });
      menu.querySelectorAll('a').forEach(function(a){ a.addEventListener('click',function(){close(false);}); });
      document.addEventListener('keydown',function(e){if(e.key==='Escape'&&menuOpen){e.preventDefault();close(true);}});
      close(false);
    }

    var nav=document.getElementById('jdmNav');
    var heroImg=document.getElementById('heroImg');
    var featPin=document.getElementById('featPin'), featImg=document.getElementById('featImg');
    var featCallouts=featPin?Array.prototype.slice.call(featPin.querySelectorAll('[data-feat]')):[];
    var featDots=Array.prototype.slice.call(root.querySelectorAll('[data-featdot]'));
    var pin=document.getElementById('costPin'), numEl=document.getElementById('costNum');
    var lines=pin?Array.prototype.slice.call(pin.querySelectorAll('[data-costline]')):[];
    var FINAL=${Number(costTotal) || 0};
    var costMq=window.matchMedia?window.matchMedia('(max-width: 920px)'):{matches:false};

    function updatePin(){
      if(!pin||!numEl) return;
      if(costMq.matches||reduce){ numEl.textContent='A$'+FINAL.toLocaleString('en-AU'); lines.forEach(function(el){el.classList.add('in');}); return; }
      var r=pin.getBoundingClientRect(); var span=r.height-window.innerHeight;
      var p=span>0?(-r.top)/span:0; p=Math.max(0,Math.min(1,p));
      var n=lines.length;
      lines.forEach(function(el,i){ var thr=((i+1)/(n+1.4))*0.92; el.classList.toggle('in',p>=thr); });
      numEl.textContent='A$'+Math.round(FINAL*Math.min(1,p/0.86)).toLocaleString('en-AU');
    }

    var vh=function(){ return window.innerHeight||document.documentElement.clientHeight||800; };
    function onScroll(){
      frame=0;
      if(nav){ if(window.scrollY>36) nav.setAttribute('data-scrolled','1'); else nav.removeAttribute('data-scrolled'); }
      if(!reduce&&!useObservers){
        // Batch reads before writes to avoid forced reflow: read every reveal
        // rect first, collect the hits, then flip the classes in one pass.
        var trg=vh()*0.9, toReveal=[];
        for(var i=0;i<revealEls.length;i++){ var el=revealEls[i]; if(el.classList.contains('in')) continue;
          var rc=el.getBoundingClientRect(); if(rc.top<trg&&rc.bottom>-40) toReveal.push(el); }
        for(var ri=0;ri<toReveal.length;ri++){ toReveal[ri].classList.add('in'); }
        // Count-ups read after the reveal writes (their spans ride the parent's
        // reveal transform), then start in one pass.
        var tc=vh()*0.85, toCount=[];
        for(var j=0;j<countEls.length;j++){ var ce=countEls[j]; if(ce.dataset.ran==='1') continue;
          var cr=ce.getBoundingClientRect(); if(cr.top<tc&&cr.bottom>0) toCount.push(ce); }
        for(var ci=0;ci<toCount.length;ci++){ runCount(toCount[ci]); }
      }
      if(heroImg&&!reduce){ var hy=window.scrollY; if(hy<vh()*1.25) heroImg.style.transform='translate3d(0,'+(hy*0.16).toFixed(1)+'px,0) scale(1.16)'; }
      if(featPin&&featCallouts.length){
        if(reduce){
          // Reduced motion: show the first callout statically, no scroll switching.
          featCallouts.forEach(function(el,i){ el.classList.toggle('show',i===0); });
          featDots.forEach(function(d,i){ var on=i===0; d.style.background=on?'#CAA34C':'rgba(255,255,255,0.22)'; d.style.transform=on?'scaleX(2.75)':'scaleX(1)'; });
        } else {
          var fr=featPin.getBoundingClientRect(); var fspan=fr.height-window.innerHeight;
          var fp=fspan>0?(-fr.top)/fspan:0; fp=Math.max(0,Math.min(0.999,fp));
          var fidx=Math.min(featCallouts.length-1,Math.floor(fp*featCallouts.length));
          featCallouts.forEach(function(el,i){ el.classList.toggle('show',i===fidx); });
          featDots.forEach(function(d,i){ var on=i===fidx; d.style.background=on?'#CAA34C':'rgba(255,255,255,0.22)'; d.style.transform=on?'scaleX(2.75)':'scaleX(1)'; });
          if(featImg) featImg.style.transform='scale('+(1.04+fp*0.06).toFixed(3)+')';
        }
      }
      updatePin();
    }

    var frame=0;
    function scheduleScroll(){if(frame)return;frame=requestAnimationFrame(onScroll);}
    window.addEventListener('scroll',scheduleScroll,{passive:true});
    window.addEventListener('resize',scheduleScroll,{passive:true});
    onScroll(); requestAnimationFrame(onScroll); setTimeout(onScroll,250);
  }
  if(document.readyState!=='loading') init(); else document.addEventListener('DOMContentLoaded',init);
})();</script>`;
}
