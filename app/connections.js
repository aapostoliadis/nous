// Bring your own key: provider keys stay in this browser (this tab, or this device when remembered) and travel
// with each request in the X-Provider-Key header. The server passes them to the provider and never stores them.
(() => {
  const localSubmit=window.submitAsk;
  const selector=document.querySelector('#ai-provider');
  const connection=document.querySelector('#connection-status');
  const modelSelect=document.querySelector('#ai-model');
  const refreshModels=document.querySelector('#refresh-models');
  const modelCatalogs=new Map();
  let modelsLoading=false,modelRequest=0,modelError='';
  const chosenModels={};
  try{Object.assign(chosenModels,JSON.parse(localStorage.getItem('nous-models')||'{}'));}catch{}
  const send=document.querySelector('#command-form button[type=submit]');
  const cancel=document.querySelector('#cancel-ask');
  let hosted=false,providers=[],active=null,preferred,progress=null,checking=0;
  const keyName=id=>'nous-key-'+id;
  const store=place=>{try{return place==='device'?localStorage:sessionStorage;}catch{return null;}};
  function saved(id){for(const place of ['tab','device'])try{const key=store(place)?.getItem(keyName(id));if(key)return {key,place};}catch{}return null;}
  function forgetKey(id){for(const place of ['tab','device'])try{store(place)?.removeItem(keyName(id));}catch{}}
  function saveKey(id,key,remember){forgetKey(id);const s=store(remember?'device':'tab');if(!s)throw Error('This browser is blocking storage, so the key cannot be kept.');s.setItem(keyName(id),key);}
  window.providerHeaders=id=>{const key=saved(id)?.key;return key?{'X-Provider-Key':key}:{};};
  const ready=p=>!!p&&(p.configured||!!saved(p.id));
  const vendor=p=>({openai:'OpenAI',anthropic:'Anthropic'})[p.id]||p.label;
  const keyStatus=p=>({tab:'Your key · this tab',device:'Your key · this device'})[saved(p.id)?.place]||(p.configured?'Server key · .env.local':'API key needed');
  const orb=document.querySelector('#connection-orb');
  // The picker sits behind a chip: most asks reuse the last model, so the controls only take space when changed.
  const chip=document.querySelector('#model-chip'),controls=chip.parentElement;
  const textModes=['responses','chat','messages'],ALL='__all__',showAllModels=new Set();
  function setPicker(open){controls.classList.toggle('picker-open',open);chip.setAttribute('aria-expanded',String(open));}
  chip.onclick=()=>{const open=!controls.classList.contains('picker-open');setPicker(open);if(open)selector.focus();};
  controls.addEventListener('keydown',e=>{if(e.key==='Escape'&&controls.classList.contains('picker-open')){e.stopPropagation();setPicker(false);chip.focus();}});
  document.addEventListener('click',e=>{if(!controls.contains(e.target))setPicker(false);});
  // Ask only sends text; audio models live under Audio tools. Long catalogs start with a short suggested list.
  function fillModels(provider,catalog,wanted){
    const text=catalog.models.filter(m=>textModes.includes(m.mode)),option=m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`;
    if(showAllModels.has(provider)||text.length<=4)modelSelect.innerHTML=textModes.map(mode=>{const models=text.filter(m=>m.mode===mode);return models.length?`<optgroup label="${({'responses':'Text · current','chat':'Text · other','messages':'Claude'})[mode]}">${models.map(option).join('')}</optgroup>`:'';}).join('')||'<option value="">No text models available</option>';
    else{const picks=[...new Set([catalog.defaultModel,wanted,...text.filter(m=>m.structured).map(m=>m.id)])].map(id=>text.find(m=>m.id===id)).filter(Boolean).slice(0,4);modelSelect.innerHTML=`<optgroup label="Suggested">${picks.map(option).join('')}</optgroup><option value="${ALL}">Show all ${text.length} models…</option>`;}
    modelSelect.value=text.some(m=>m.id===wanted)?wanted:(text.find(m=>m.id===catalog.defaultModel)?.id||text[0]?.id||'');
    modelSelect.title=`${text.length} text models available to your API account. Audio models are under Audio tools; app-only, image and research modes are separate.`;
  }
  function syncOrb(){orb.setAttribute('state',active?'working':'connecting');orb.hidden=!active&&!checking&&!modelsLoading;}
  window.renderModelProgress=()=>progress&&progress.branch===state.branch?`<section class="model-progress" aria-label="Answer in progress"><div class="inspector-eyebrow">THINKING WITH ${esc(progress.label)}</div><div class="stream-status"><nous-orb state="working" size="24"></nous-orb><span role="status">${progress.answer?'Writing your answer…':'Working through your request…'}</span></div><p class="ask-query">${esc(progress.prompt)}</p><p class="inspector-body ask-answer model-stream-answer">${esc(progress.answer||'')}</p><p class="source-note">${progress.answer?'Answer in progress. Workspace changes appear when complete.':'Using this branch’s goal, constraints and linked objects.'}</p></section>`:'';
  function showAnswer(answer){
    if(!progress)return;const first=!progress.answer;progress.answer=answer;
    if(progress.branch!==state.branch)return;
    // Update only the answer nodes, preserving the user's scroll and focused controls.
    const panel=document.querySelector('.model-progress');if(!panel)return;
    panel.querySelector('.model-stream-answer').textContent=answer;
    if(first&&answer){panel.querySelector('[role=status]').textContent='Writing your answer…';panel.querySelector('.source-note').textContent='Answer in progress. Workspace changes appear when complete.';connection.textContent='Writing…';}
  }
  async function readAnswer(response,signal){
    if(!response.ok){const data=await response.json();throw Error(data.error||'The provider could not finish the request.');}
    if(!response.headers?.get('content-type')?.includes('application/x-ndjson'))return response.json();
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',result=null,total=0;
    function event(line){
      if(!line.trim())return;const item=JSON.parse(line);
      if(item.type==='error')throw Error(item.error||'The provider interrupted the answer.');
      if(item.type==='answer'&&typeof item.answer==='string')showAnswer(item.answer);
      if(item.type==='complete')result=item.result;
    }
    try{
      while(true){signal.throwIfAborted();const chunk=await reader.read();if(chunk.done)break;total+=chunk.value.byteLength;if(total>16000000)throw Error('The response was too large. Please retry with a smaller request.');buffer+=decoder.decode(chunk.value,{stream:true});let end;while((end=buffer.indexOf('\n'))!==-1){event(buffer.slice(0,end));buffer=buffer.slice(end+1);}}
      buffer+=decoder.decode();if(buffer.trim())event(buffer);signal.throwIfAborted();
      if(!result)throw Error('The connection ended before the answer was complete. Please retry.');return result;
    }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  }

  try {preferred=localStorage.getItem('nous-provider');}catch{}
  selector.value=['openai','anthropic','local'].includes(preferred)?preferred:'openai';
  function describe() {
    const p=providers.find(p=>p.id===selector.value);
    connection.textContent=selector.value==='local'?'Local commands':ready(p)?(modelsLoading?'Loading models…':modelError||'Ready'):p?'API key needed':'Checking connection…';
    connection.dataset.ready=String(ready(p));
    const model=!modelSelect.hidden&&modelSelect.value?modelSelect.selectedOptions[0]?.text:'';
    chip.textContent=[selector.selectedOptions[0]?.text.split(' · ')[0],model].filter(Boolean).join(' · ');
  }
  async function refresh() {
    checking++;syncOrb();
    try{const r=await fetch('/api/providers');if(!r.ok)throw Error();const data=await r.json();providers=data.providers;hosted=data.hosted===true;if(!active){describe();await loadModels(false);}}
    catch{if(!active)connection.textContent='Restart Nous to enable connections';}
    finally{checking--;syncOrb();}
  }
  async function loadModels(force=false) {
    const request=++modelRequest,provider=selector.value;
    const p=providers.find(p=>p.id===provider);
    modelError='';modelSelect.hidden=provider==='local';refreshModels.hidden=provider==='local';
    if(!ready(p)){modelsLoading=false;modelSelect.innerHTML='<option value="">Connect provider first</option>';modelSelect.disabled=true;refreshModels.disabled=true;syncOrb();describe();return;}
    modelsLoading=true;modelSelect.disabled=true;refreshModels.disabled=true;syncOrb();describe();
    modelSelect.innerHTML='<option value="">Loading models…</option>';
    try {
      let catalog=modelCatalogs.get(provider);
      if(force||!catalog){const response=await fetch('/api/models?provider='+encodeURIComponent(provider)+(force?'&refresh=1':''),{headers:window.providerHeaders(provider)});const data=await response.json();if(!response.ok)throw Error(data.error||'Models unavailable');catalog=data;modelCatalogs.set(provider,catalog);}
      if(request!==modelRequest)return;
      const wanted=chosenModels[provider]||catalog.defaultModel;
      fillModels(provider,catalog,wanted);
      if(modelSelect.value){chosenModels[provider]=modelSelect.value;saveModelPreference();}
    }catch(error){if(request!==modelRequest)return;modelError=error.message;modelSelect.innerHTML='<option value="">Models unavailable</option>';}
    finally{if(request===modelRequest){modelsLoading=false;modelSelect.disabled=!!active||!modelSelect.value;refreshModels.disabled=!!active;syncOrb();describe();}}
  }
  function saveModelPreference(){try{localStorage.setItem('nous-models',JSON.stringify(chosenModels));}catch{}}
  modelSelect.onchange=()=>{if(modelSelect.value===ALL){showAllModels.add(selector.value);fillModels(selector.value,modelCatalogs.get(selector.value),chosenModels[selector.value]);try{modelSelect.showPicker();}catch{}return;}setPicker(false);chosenModels[selector.value]=modelSelect.value;saveModelPreference();describe();};
  refreshModels.onclick=()=>loadModels(true);
  selector.onchange=()=>{try{localStorage.setItem('nous-provider',selector.value);}catch{}loadModels(false);};
  document.querySelector('#connections').onclick=()=>{
    const card=p=>{const place=saved(p.id)?.place;return `<form class="connection-card" data-provider="${esc(p.id)}"><strong>${esc(p.label)}</strong><span data-key-status>${keyStatus(p)}</span><small>${esc(chosenModels[p.id]||p.model)}</small><label class="key-field">${esc(vendor(p))} API key<input type="password" name="key" autocomplete="off" spellcheck="false" required placeholder="Paste your ${esc(vendor(p))} key"></label><label class="key-remember"><input type="checkbox" name="remember"${place==='device'?' checked':''}> Remember on this device</label><div class="key-actions"><button class="primary" type="submit">Check and save</button><button type="button" data-forget${place?'':' hidden'}>Forget key</button></div><p role="status"></p></form>`;};
    modal(`<h2>Your thinking partners.</h2><p>Choose a provider and model beside the Ask field. Models come from your API account; availability differs from the ChatGPT and Claude apps. Your request, shared goal, constraints and current branch objects are sent to that provider.</p>${providers.map(card).join('')}<p>Use your own API keys; usage is billed to your provider account. Responses become linked drafts; model output is not verified evidence. Original objects and decision states stay intact.</p><p class="source-note">Keys stay in this browser: for this tab only, or on this device if you tick Remember. Each request sends your key to ${hosted?'this site over HTTPS':'the Nous server on this computer'}, which passes it to the provider and never stores it.${hosted?'':' Locally, keys in .env.local are used when no browser key is saved.'}</p><div class="dialog-actions"><button type="button" id="refresh-connections">Refresh status</button><button data-cancel class="primary">Done</button></div>`);
    // modal() binds only its first form; each provider card gets its own handlers instead.
    document.querySelectorAll('#dialog form.connection-card').forEach(form=>{
      const p=providers.find(p=>p.id===form.dataset.provider),field=form.elements.key,button=form.querySelector('[type=submit]'),forget=form.querySelector('[data-forget]'),status=form.querySelector('[data-key-status]'),feedback=form.querySelector('[role=status]');
      form.onsubmit=async event=>{
        event.preventDefault();const key=field.value.trim();
        if(!/^[\x21-\x7e]{20,500}$/.test(key)){feedback.textContent=`Enter a valid ${vendor(p)} API key.`;field.focus();return;}
        button.disabled=true;button.innerHTML='<nous-orb state="connecting" size="20"></nous-orb> Checking…';form.setAttribute('aria-busy','true');
        try{
          // Check the key against the provider before keeping it, so a typo never becomes a saved connection.
          const response=await fetch('/api/models?provider='+encodeURIComponent(p.id)+'&refresh=1',{headers:{'X-Provider-Key':key}});field.value='';
          const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'The key could not be checked.');
          saveKey(p.id,key,form.elements.remember.checked);modelCatalogs.set(p.id,data);
          status.textContent=keyStatus(p);forget.hidden=false;feedback.textContent=`Key works · ${data.models.length} models available.`;
          selector.value=p.id;selector.onchange();
        }catch(e){field.value='';feedback.textContent=e.message||'The key could not be checked.';}
        finally{button.disabled=false;button.textContent='Check and save';form.setAttribute('aria-busy','false');}
      };
      forget.onclick=()=>{forgetKey(p.id);modelCatalogs.delete(p.id);status.textContent=keyStatus(p);forget.hidden=true;form.elements.remember.checked=false;feedback.textContent='Key removed from this browser.';if(selector.value===p.id)loadModels(false);else describe();};
    });
    document.querySelector('#refresh-connections').onclick=async event=>{const button=event.currentTarget;button.disabled=true;button.innerHTML='<nous-orb state="connecting" size="20"></nous-orb> Checking…';modelCatalogs.clear();await refresh();if(button.isConnected&&document.querySelector('#dialog').open){document.querySelector('#dialog').close();document.querySelector('#connections').click();}};
  };
  function snapshot(){return JSON.stringify({goal:state.goal,constraints:state.constraints,objects:current()});}
  function busy(on){send.disabled=on;selector.disabled=on;modelSelect.disabled=on||modelsLoading||!modelSelect.value;refreshModels.disabled=on||modelsLoading;cancel.hidden=!on;document.querySelector('#command-form').setAttribute('aria-busy',String(on));if(!on){progress=null;describe();}syncOrb();render();}
  cancel.onclick=()=>active?.abort();
  window.submitAsk=async()=>{
    if(active)return;
    if(selector.value==='local')return localSubmit();
    const input=document.querySelector('#command'),prompt=input.value.trim();
    if(!prompt){input.focus();return;}
    // Workspace commands (goal, constraint, add, branch, mark…) run locally whichever provider is selected.
    if(localSubmit(true))return;
    const provider=selector.value, model=modelSelect.value, branch=state.branch, before=snapshot();
    const p=providers.find(p=>p.id===provider);
    if(!ready(p)){finishAsk(prompt,{kind:'error',title:'Connect this provider first.',answer:p?`Add your ${vendor(p)} API key in Connections.`:'The provider list is still loading or the local server needs restarting.',change:'No workspace objects were changed.'});return;}
    if(modelsLoading||!model){finishAsk(prompt,{kind:'error',title:'Choose a model first.',answer:modelsLoading?'The model list is still loading.':'Refresh the model list and select an available model.',change:'No workspace objects were changed.'});return;}
    active=new AbortController();progress={branch,prompt,label:model,answer:''};busy(true);if(innerWidth<=850)document.querySelector('#inspector').scrollIntoView({block:'start'});connection.textContent='Thinking…';
    const timer=setTimeout(()=>active?.abort(),95000);
    try {
      const response=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json',...window.providerHeaders(provider)},signal:active.signal,body:JSON.stringify({provider,model,prompt,stream:true,workspace:{goal:state.goal,constraints:state.constraints,selected:state.selected,objects:current()}})});
      const data=await readAnswer(response,active.signal);active.signal.throwIfAborted();
      // Fail closed if the user changed context while the provider was working.
      if(state.branch!==branch||snapshot()!==before){throw new Error('The workspace changed while the model was working. Send the request again using the current context.');}
      const requestId=crypto.randomUUID();
      const origin=`${data.providerLabel} · ${data.model} · ${new Date(data.time).toLocaleString()}`;
      const drafts=[...data.objects,{type:'artifact',title:data.title.slice(0,150),body:data.answer,links:data.references}];
      const additions=drafts.map(o=>({...o,id:o.type[0].toUpperCase()+crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase(),branch,state:o.type==='decision'?'Candidate':'Idea',note:'AI draft · review before relying on it',origin,requestId}));
      state.objects.push(...additions);
      state.selected=null;
      finishAsk(prompt,{kind:'changed',title:data.title,answer:data.answer,ids:additions.map(o=>o.id),provider:data.providerLabel,model:data.model,requestId,change:`Added ${additions.length} linked draft objects to this branch. Existing objects are preserved.`,view:'map'});
      if(input.value.trim()===prompt)input.value='';
      connection.textContent=`${data.model} · Connected`;
      if(innerWidth<=850)document.querySelector('#inspector').scrollIntoView({block:'start'});
    } catch(e) {
      const error=e.name==='AbortError'?'The request was cancelled or timed out. Your text has been kept.':e.message;
      const answer=error+(progress?.answer?'\n\nIncomplete answer. No workspace objects were added:\n'+progress.answer:'');
      if(state.branch===branch)finishAsk(prompt,{kind:'error',title:'No changes made.',answer,provider:p.label,model,change:'Your request remains in the Ask field.'});else toast(answer);
    } finally{clearTimeout(timer);active=null;busy(false);}
  };
  window.addEventListener('focus',()=>{if(!active)refresh();});
  refresh();
})();
