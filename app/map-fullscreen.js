// Fullscreen is a temporary presentation mode, never part of saved workspace data.
(() => {
  const control = document.querySelector('#map-fullscreen');
  const surface = document.querySelector('#surface');
  const frame = document.querySelector('.surface-frame');
  const main = document.querySelector('#main');
  let active = false;
  let ownsFullscreen = false;
  let fitting;
  let priorScroll = { x: 0, y: 0 };

  let zoom=1, pan={x:0,y:0}, autoFit=false, initial=true, branch=null, drag=null;
  const toolbar=document.createElement('div');
  toolbar.className='map-tools';toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','Map controls');
  toolbar.innerHTML='<button type="button" id="map-zoom-out" aria-label="Zoom out map" title="Zoom out">−</button><button type="button" id="map-fit" aria-label="Fit map to view" title="Fit all objects"><span id="map-zoom-level">100%</span><small>Fit</small></button><button type="button" id="map-zoom-in" aria-label="Zoom in map" title="Zoom in">+</button>';
  control.before(toolbar);toolbar.append(control);const hint=document.createElement("div");hint.className="map-pan-hint";hint.textContent="Drag background to pan · + / − zoom · 0 fit";const navigation=document.createElement("div");navigation.className="map-navigation";frame.append(navigation);navigation.append(hint,toolbar);
  const minus=toolbar.querySelector('#map-zoom-out'),plus=toolbar.querySelector('#map-zoom-in'),fit=toolbar.querySelector('#map-fit');
  function geometry(){const viewport=surface.querySelector('.map-viewport'),content=surface.querySelector('.map-content');return viewport&&content?{viewport,content,w:viewport.clientWidth,h:Math.max(1,viewport.clientHeight),cw:content.offsetWidth,ch:content.offsetHeight}:null;}
  function paint(){
    const g=geometry();if(!g)return;
    pan.x=g.cw*zoom<=g.w?(g.w-g.cw*zoom)/2:Math.min(24,Math.max(g.w-g.cw*zoom-24,pan.x));
    pan.y=g.ch*zoom<=g.h?(g.h-g.ch*zoom)/2:Math.min(24,Math.max(g.h-g.ch*zoom-24,pan.y));
    g.content.style.transform=`translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
    toolbar.querySelector('#map-zoom-level').textContent=Math.round(zoom*100)+'%';
    minus.disabled=zoom<=.1;plus.disabled=zoom>=2.5;
  }
  function fitMap(){cancelAnimationFrame(fitting);fitting=requestAnimationFrame(()=>{const g=geometry();if(!g)return;if(initial&&!active){zoom=Math.max(.6,Math.min((g.w-24)/g.cw,1));pan={x:0,y:12};initial=false;}else if(autoFit)zoom=Math.max(.1,Math.min((g.w-24)/g.cw,(g.h-24)/g.ch,1.25));paint();});}
  function changeZoom(factor){const g=geometry();if(!g)return;autoFit=false;const next=Math.max(.1,Math.min(2.5,zoom*factor));pan={x:g.w/2-(g.w/2-pan.x)*next/zoom,y:g.h/2-(g.h/2-pan.y)*next/zoom};zoom=next;paint();}
  minus.onclick=()=>changeZoom(1/1.2);plus.onclick=()=>changeZoom(1.2);fit.onclick=()=>{autoFit=true;fitMap();};
  surface.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button,select,a,input')||!geometry())return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};surface.classList.add('map-is-dragging','map-pointer-focused');surface.focus({preventScroll:true});e.preventDefault();surface.setPointerCapture(e.pointerId);});
  // Pointer panning should not draw a keyboard focus ring around the canvas.
  document.addEventListener('keydown',()=>surface.classList.remove('map-pointer-focused'),true);
  surface.addEventListener('blur',()=>surface.classList.remove('map-pointer-focused'));
  surface.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;autoFit=false;pan={x:drag.px+e.clientX-drag.x,y:drag.py+e.clientY-drag.y};paint();});
  function endDrag(){drag=null;surface.classList.remove('map-is-dragging');}
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>surface.addEventListener(type,endDrag));window.addEventListener('blur',endDrag);
  surface.addEventListener('keydown',e=>{if(!geometry()||e.target.matches('select,input,textarea')||e.ctrlKey||e.metaKey||e.altKey)return;
    if(['+','=','-','0','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.key==='+'||e.key==='=')changeZoom(1.2);else if(e.key==='-')changeZoom(1/1.2);else if(e.key==='0'){autoFit=true;fitMap();}else{autoFit=false;pan.x+=e.key==='ArrowLeft'?60:e.key==='ArrowRight'?-60:0;pan.y+=e.key==='ArrowUp'?60:e.key==='ArrowDown'?-60:0;paint();}}});
  surface.addEventListener('focusin',e=>{if(!e.target.matches('[data-object]'))return;const g=geometry();if(!g)return;const r=e.target.getBoundingClientRect(),v=g.viewport.getBoundingClientRect();if(r.left<v.left+12)pan.x+=v.left+12-r.left;else if(r.right>v.right-12)pan.x-=r.right-v.right+12;if(r.top<v.top+12)pan.y+=v.top+12-r.top;else if(r.bottom>v.top+g.h-12)pan.y-=r.bottom-v.top-g.h+12;paint();});

  function sync() {
    const isMap = Boolean(surface.querySelector('.map-viewport'));
    control.hidden = !isMap; toolbar.hidden = !isMap;hint.hidden=!isMap;navigation.hidden=!isMap;if(!isMap)endDrag();
    frame.classList.toggle("is-map",isMap);
    if(branch!==state.branch){branch=state.branch;autoFit=active;initial=!active;}
    if (active && !isMap) { exit(); return; }
    document.body.classList.toggle('map-fullscreen', active);
    main.classList.toggle('map-has-selection', active && Boolean(document.querySelector('#inspector [data-close]')));
    document.querySelector('#map-focus-goal').textContent = document.querySelector('#goal-title').textContent;
    const label = active ? 'Exit full screen map' : 'Enter full screen map';
    control.setAttribute('aria-label', label);
    control.setAttribute('title', active ? 'Exit full screen map (Esc)' : 'Full screen map');
    control.setAttribute('aria-pressed', String(active));
    if(isMap){surface.scrollTo(0,0);fitMap();}
  }

  async function enter() {
    if (active) return;
    priorScroll = { x: surface.scrollLeft, y: surface.scrollTop };
    active = true;autoFit=true;
    sync();
    // Use the app viewport so embedded browsers keep full screen stable.
    fitMap();
    control.focus({ preventScroll: true });
  }

  async function exit() {
    if (!active) return;
    active = false;autoFit=false;initial=true;
    const leaveNative = ownsFullscreen && Boolean(document.fullscreenElement);
    ownsFullscreen = false;
    sync();
    if (leaveNative) {
      try { await document.exitFullscreen(); } catch { /* Viewport mode is already restored. */ }
    }
    surface.scrollTo(priorScroll.x, priorScroll.y);
    if (!control.hidden) control.focus({ preventScroll: true });
  }

  control.addEventListener('click', () => active ? exit() : enter());
  document.addEventListener('fullscreenchange', () => {
    if (active && ownsFullscreen && !document.fullscreenElement) exit();
    else fitMap();
  });
  document.addEventListener('keydown', event => {
    if (active && event.key === 'Escape' && !document.querySelector('#dialog').open && !document.querySelector('select:open')) {
      event.preventDefault();
      exit();
    }
  });
  new ResizeObserver(fitMap).observe(frame);
  window.addEventListener('resize', fitMap);
  document.fonts.ready.then(fitMap);
  window.syncMapFullscreen = sync;
  sync();
})();
