// Styles: Light and Warm ink. Loaded in <head> so the style is set before
// first paint. The choice in the menu is saved per device; without one the
// style is Light. Picking System follows the system setting live.
(()=>{
  const KEY='nous-theme',root=document.documentElement,system=matchMedia('(prefers-color-scheme: dark)'),still=matchMedia('(prefers-reduced-motion: reduce)');
  const THEMES={light:'Light',warm:'Warm ink'},DARK='warm';
  // 'dark' was saved by the first dark mode; Graphite and Forest were removed.
  // Each now opens in Warm ink.
  const LEGACY_DARK=['dark','graphite','forest'];
  const choice=()=>{try{const v=localStorage.getItem(KEY);return LEGACY_DARK.includes(v)?DARK:v==='system'||v in THEMES?v:'light'}catch{return 'light'}};
  const fromSystem=()=>system.matches?DARK:'light';
  const resolve=c=>c==='system'?fromSystem():c;
  const apply=theme=>{
    root.dataset.theme=theme;
    if(theme==='light')delete root.dataset.mode;else root.dataset.mode='dark';
    const c=choice();
    const b=document.getElementById('theme-button');if(b){b.setAttribute('aria-label',`Style: ${c==='system'?`System (${THEMES[theme]})`:THEMES[theme]}`);b.title=b.getAttribute('aria-label')}
    document.querySelectorAll('[data-theme-option]').forEach(o=>o.setAttribute('aria-pressed',String(o.dataset.themeOption===c)));
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
  apply(resolve(choice()));
  system.addEventListener('change',()=>{if(choice()==='system')switchTo(fromSystem(),innerWidth/2,0)});
  document.addEventListener('DOMContentLoaded',()=>{
    const button=document.getElementById('theme-button'),menu=document.getElementById('theme-menu');if(!button||!menu)return;
    apply(root.dataset.theme);
    const close=focus=>{menu.hidden=true;button.setAttribute('aria-expanded','false');if(focus)button.focus()};
    button.addEventListener('click',()=>{
      if(!menu.hidden){close();return}
      menu.hidden=false;button.setAttribute('aria-expanded','true');
      menu.querySelector('[aria-pressed=true]')?.focus();
    });
    // Options also appear in the agents studio's Settings, which covers this header.
    document.addEventListener('click',e=>{
      const o=e.target.closest('[data-theme-option]');if(!o)return;
      const inMenu=menu.contains(o),option=o.dataset.themeOption,box=o.querySelector('.theme-swatch').getBoundingClientRect();
      try{localStorage.setItem(KEY,option)}catch{}
      switchTo(resolve(option),box.left+box.width/2,box.top+box.height/2,()=>{if(inMenu)close(false)});
      if(inMenu)button.focus();
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
