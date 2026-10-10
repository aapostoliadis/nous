// Styles: light plus three dark palettes. Loaded in <head> so the style is set
// before first paint. A style picked in the menu is saved per device; without
// one, the system setting decides (light or Warm ink) and is followed live.
(()=>{
  const KEY='nous-theme',root=document.documentElement,system=matchMedia('(prefers-color-scheme: dark)'),still=matchMedia('(prefers-reduced-motion: reduce)');
  const THEMES={light:'Light',graphite:'Graphite',forest:'Forest',warm:'Warm ink'},DARK_DEFAULT='warm';
  // 'dark' was saved by the single dark mode that Warm ink replaced.
  const saved=()=>{try{const v=localStorage.getItem(KEY);return v==='dark'?DARK_DEFAULT:v in THEMES?v:null}catch{return null}};
  const fromSystem=()=>system.matches?DARK_DEFAULT:'light';
  const apply=theme=>{
    root.dataset.theme=theme;
    if(theme==='light')delete root.dataset.mode;else root.dataset.mode='dark';
    const b=document.getElementById('theme-button');if(b){b.setAttribute('aria-label',`Style: ${THEMES[theme]}`);b.title=b.getAttribute('aria-label')}
    document.querySelectorAll('[data-theme-option]').forEach(o=>o.setAttribute('aria-pressed',String(o.dataset.themeOption===theme)));
  };
  // Reveal the new style in a circle growing from (x,y); fade colours where
  // View Transitions are unavailable; switch instantly under reduced motion.
  const switchTo=(theme,x,y,update=()=>{})=>{
    const run=()=>{apply(theme);update()};
    if(still.matches||theme===root.dataset.theme){run();return}
    if(document.startViewTransition){
      const t=document.startViewTransition(run);
      const r=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
      t.ready.then(()=>root.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${r}px at ${x}px ${y}px)`]},{duration:650,easing:'cubic-bezier(.4,0,.2,1)',pseudoElement:'::view-transition-new(root)'})).catch(()=>{});
      return;
    }
    root.classList.add('theme-fading');run();
    clearTimeout(switchTo.timer);switchTo.timer=setTimeout(()=>root.classList.remove('theme-fading'),500);
  };
  apply(saved()||fromSystem());
  system.addEventListener('change',()=>{if(!saved())switchTo(fromSystem(),innerWidth/2,0)});
  document.addEventListener('DOMContentLoaded',()=>{
    const button=document.getElementById('theme-button'),menu=document.getElementById('theme-menu');if(!button||!menu)return;
    apply(root.dataset.theme);
    const close=focus=>{menu.hidden=true;button.setAttribute('aria-expanded','false');if(focus)button.focus()};
    button.addEventListener('click',()=>{
      if(!menu.hidden){close();return}
      menu.hidden=false;button.setAttribute('aria-expanded','true');
      menu.querySelector('[aria-pressed=true]')?.focus();
    });
    menu.addEventListener('click',e=>{
      const o=e.target.closest('[data-theme-option]');if(!o)return;
      const theme=o.dataset.themeOption,box=o.querySelector('.theme-swatch').getBoundingClientRect();
      try{localStorage.setItem(KEY,theme)}catch{}
      switchTo(theme,box.left+box.width/2,box.top+box.height/2,()=>close(false));
      button.focus();
    });
    menu.addEventListener('keydown',e=>{
      const items=[...menu.querySelectorAll('button')],i=items.indexOf(document.activeElement);
      if(e.key==='Escape'){e.preventDefault();close(true)}
      else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();items[(i+(e.key==='ArrowDown'?1:items.length-1))%items.length].focus()}
    });
    document.addEventListener('click',e=>{if(!menu.hidden&&!e.target.closest('.theme-picker'))close()});
    menu.addEventListener('focusout',e=>{if(!menu.hidden&&!e.relatedTarget?.closest('.theme-picker'))close()});
  });
})();
