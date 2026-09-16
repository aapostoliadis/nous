// Credentials stay on the local server. Only provider preferences enter browser storage.
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
  let providers=[],active=null,preferred,progress=null,checking=0;
  const orb=document.querySelector('#connection-orb');
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
    connection.textContent=selector.value==='local'?'Local commands':p?.configured?(modelsLoading?'Loading models…':modelError||'Ready'):p?'API key needed':'Checking connection…';
    connection.dataset.ready=String(!!p?.configured);
  }
  async function refresh() {
    checking++;syncOrb();
    try{const r=await fetch('/api/providers');if(!r.ok)throw Error();providers=(await r.json()).providers;if(!active){describe();await loadModels(false);}}
    catch{if(!active)connection.textContent='Restart Nous to enable connections';}
    finally{checking--;syncOrb();}
  }
  async function loadModels(force=false) {
    const request=++modelRequest,provider=selector.value;
    const p=providers.find(p=>p.id===provider);
    modelError='';modelSelect.hidden=provider==='local';refreshModels.hidden=provider==='local';
    if(!p?.configured){modelsLoading=false;modelSelect.innerHTML='<option value="">Connect provider first</option>';modelSelect.disabled=true;refreshModels.disabled=true;syncOrb();describe();return;}
    modelsLoading=true;modelSelect.disabled=true;refreshModels.disabled=true;syncOrb();describe();
    modelSelect.innerHTML='<option value="">Loading models…</option>';
    try {
      let catalog=modelCatalogs.get(provider);
      if(force||!catalog){const response=await fetch('/api/models?provider='+encodeURIComponent(provider)+(force?'&refresh=1':''));const data=await response.json();if(!response.ok)throw Error(data.error||'Models unavailable');catalog=data;modelCatalogs.set(provider,catalog);}
      if(request!==modelRequest)return;
      const wanted=chosenModels[provider]||catalog.defaultModel;
      modelSelect.innerHTML=['responses','chat','messages','transcription','speech','audio-chat','realtime'].map(mode=>{const models=catalog.models.filter(m=>m.mode===mode);return models.length?`<optgroup label="${({'responses':'Text · current','chat':'Text · other','messages':'Claude','transcription':'Audio · Transcribe','speech':'Audio · Read aloud','audio-chat':'Audio · Conversation','realtime':'Audio · Live voice'})[mode]}">${models.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}</optgroup>`:'';}).join('')||'<option value="">No text models available</option>';
      modelSelect.value=catalog.models.some(m=>m.id===wanted)?wanted:(catalog.models.find(m=>m.id===catalog.defaultModel)?.id||catalog.models[0]?.id||'');
      if(modelSelect.value){chosenModels[provider]=modelSelect.value;saveModelPreference();}
      modelSelect.title=`${catalog.models.length} models available to your API account. Audio models open their specialist tools. App-only, image and research modes are separate.`;
    }catch(error){if(request!==modelRequest)return;modelError=error.message;modelSelect.innerHTML='<option value="">Models unavailable</option>';}
    finally{if(request===modelRequest){modelsLoading=false;modelSelect.disabled=!!active||!modelSelect.value;refreshModels.disabled=!!active;syncOrb();describe();}}
  }
  function saveModelPreference(){try{localStorage.setItem('nous-models',JSON.stringify(chosenModels));}catch{}}
  modelSelect.onchange=()=>{chosenModels[selector.value]=modelSelect.value;saveModelPreference();describe();};
  refreshModels.onclick=()=>loadModels(true);
  selector.onchange=()=>{try{localStorage.setItem('nous-provider',selector.value);}catch{}loadModels(false);};
  document.querySelector('#connections').onclick=()=>{
    modal(`<h2>Your thinking partners.</h2><p>Choose a provider and model beside the Ask field. Models come from your API account; availability differs from the ChatGPT and Claude apps. Your request, shared goal, constraints and current branch objects are sent to that provider.</p>${providers.map(p=>`<div class="connection-card"><strong>${esc(p.label)}</strong><span>${p.configured?'API key configured':'API key needed'}</span><small>${esc(chosenModels[p.id]||p.model)}</small></div>`).join('')}<p>API usage uses each provider’s API billing. Responses become linked drafts; model output is not verified evidence. Original objects and decision states stay intact.</p><p class="source-note">Credentials are stored on this computer, outside the exported prototype. Claude setup requires an Anthropic API key.</p><div class="dialog-actions"><button type="button" id="refresh-connections">Refresh status</button><button data-cancel class="primary">Done</button></div>`);
    const setup=document.createElement('form');
    setup.id='claude-key-form';
    setup.innerHTML='<label>Claude API key<input type="password" name="anthropic-key" aria-label="Claude API key" autocomplete="off" spellcheck="false" required placeholder="Paste your new Claude key here"></label><p class="source-note">Save to this workspace’s .env.local file as ANTHROPIC_API_KEY. Stored on this computer only; never included in exports.</p><button class="primary" type="submit">Save Claude key locally</button><p id="key-save-status" role="status"></p>';
    document.querySelector('#dialog .dialog-actions').before(setup);
    setup.onsubmit=async event=>{
      event.preventDefault();const field=setup.querySelector('input'),button=setup.querySelector('button'),feedback=setup.querySelector('#key-save-status');
      button.disabled=true;button.innerHTML='<nous-orb state="connecting" size="20"></nous-orb> Saving…';setup.setAttribute('aria-busy','true');
      try{const response=await fetch('/api/connections/anthropic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:field.value})});field.value='';const result=await response.json();if(!response.ok)throw Error(result.error);modelCatalogs.delete('anthropic');await refresh();feedback.textContent='Claude key saved. Choose Claude beside Ask to use it.';selector.value='anthropic';selector.onchange();}
      catch(e){field.value='';feedback.textContent=e.message||'Could not save the key.';}
      finally{button.disabled=false;button.textContent='Save Claude key locally';setup.setAttribute('aria-busy','false');}
    };
    document.querySelector('#refresh-connections').onclick=async event=>{const button=event.currentTarget;button.disabled=true;button.innerHTML='<nous-orb state="connecting" size="20"></nous-orb> Checking…';modelCatalogs.clear();await refresh();if(button.isConnected&&document.querySelector('#dialog').open){document.querySelector('#dialog').close();document.querySelector('#connections').click();}};
  };
  function snapshot(){return JSON.stringify({goal:state.goal,constraints:state.constraints,objects:current()});}
  function busy(on){send.disabled=on;selector.disabled=on;modelSelect.disabled=on||modelsLoading||!modelSelect.value;refreshModels.disabled=on||modelsLoading;cancel.hidden=!on;document.querySelector('#command-form').setAttribute('aria-busy',String(on));if(!on){progress=null;describe();}syncOrb();render();}
  cancel.onclick=()=>active?.abort();
  window.submitAsk=async()=>{
    if(active)return;
    const audioModel=modelCatalogs.get(selector.value)?.models.find(m=>m.id===modelSelect.value);
    if(audioModel&&['transcription','speech','audio-chat','realtime'].includes(audioModel.mode))return window.openAudioTools?.(audioModel);
    if(selector.value==='local')return localSubmit();
    const input=document.querySelector('#command'),prompt=input.value.trim();
    if(!prompt){input.focus();return;}
    const provider=selector.value, model=modelSelect.value, branch=state.branch, before=snapshot();
    const p=providers.find(p=>p.id===provider);
    if(!p?.configured){finishAsk(prompt,{kind:'error',title:'Connect this provider first.',answer:provider==='anthropic'?'Claude needs an Anthropic API key. Open Connections to check setup.':'OpenAI is not configured or the local server needs restarting.',change:'No workspace objects were changed.'});return;}
    if(modelsLoading||!model){finishAsk(prompt,{kind:'error',title:'Choose a model first.',answer:modelsLoading?'The model list is still loading.':'Refresh the model list and select an available model.',change:'No workspace objects were changed.'});return;}
    active=new AbortController();progress={branch,prompt,label:model,answer:''};busy(true);if(innerWidth<=850)document.querySelector('#inspector').scrollIntoView({block:'start'});connection.textContent='Thinking…';
    const timer=setTimeout(()=>active?.abort(),95000);
    try {
      const response=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},signal:active.signal,body:JSON.stringify({provider,model,prompt,stream:true,workspace:{goal:state.goal,constraints:state.constraints,selected:state.selected,objects:current()}})});
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
