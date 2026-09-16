// Push-to-record dictation. Never submits Ask or stores the microphone recording.
(() => {
  const input=document.querySelector('#command'),form=document.querySelector('#command-form');
  const mic=document.querySelector('#ask-microphone'),feedback=document.querySelector('#dictation-feedback');
  const status=document.querySelector('#dictation-status'),cancel=document.querySelector('#dictation-cancel');
  const retry=document.querySelector('#dictation-retry'),overflow=document.querySelector('#dictation-overflow'),orb=document.querySelector('#dictation-orb');
  const elapsed=document.querySelector('#dictation-elapsed'),limit=5*60*1000;
  let phase='idle',generation=0,stream=null,recorder=null,timer=null,clock=null,tail=null,watchdog=null,controller=null,recording=null,model=null,anchor=null;
  function message(text,error=false){feedback.hidden=false;status.textContent=text;feedback.dataset.error=String(error);}
  function controls(next){
    phase=next;form.dataset.dictation=next;
    const busy=next!=='idle';mic.disabled=['preparing','finishing','transcribing'].includes(next);
    mic.setAttribute('aria-pressed',String(['recording','finishing'].includes(next)));
    mic.setAttribute('aria-label',next==='recording'?'Stop dictation':next==='finishing'?'Finishing recording':next==='transcribing'?'Transcribing speech':'Start dictation');
    elapsed.hidden=!['recording','finishing'].includes(next);
    mic.title=next==='recording'?'Stop and transcribe into Ask':'Dictate with OpenAI';
    cancel.hidden=!busy&&!recording;retry.hidden=busy||!recording;
    orb.hidden=!['preparing','transcribing'].includes(next);orb.setAttribute('state',next==='preparing'?'connecting':'working');
    form.querySelector('button[type=submit]').disabled=busy||form.getAttribute('aria-busy')==='true';
    document.querySelector('#audio-tools').disabled=busy;
  }
  function release(){clearTimeout(timer);clearInterval(clock);clearTimeout(tail);clearTimeout(watchdog);timer=clock=tail=watchdog=null;stream?.getTracks().forEach(t=>t.stop());stream=null;}
  function discard(text='Dictation cancelled. Your text is unchanged.'){
    generation++;controller?.abort();controller=null;
    if(recorder){recorder.onstart=null;recorder.onstop=null;recorder.ondataavailable=null;recorder.onerror=null;if(recorder.state!=='inactive')recorder.stop();recorder=null;}
    release();recording=null;controls('idle');message(text);
  }
  function encoded(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('The recording could not be read. Please try again.'));reader.readAsDataURL(blob);});}
  async function transcribe(token){
    if(token!==generation||!recording)return;
    controls('transcribing');message('Transcribing with OpenAI. Your microphone is off.');
    controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),90000);
    try{
      // Discover models after capture, so a slow connection cannot lose opening words.
      if(!model){
        const r=await fetch('/api/models?provider=openai',{signal:controller.signal});const data=await r.json();if(!r.ok)throw Error(data.error||'Connect OpenAI to transcribe your speech.');
        if(token!==generation)return;
        const models=data.models.filter(m=>m.mode==='transcription'&&!m.id.includes('diarize'));
        model=models.find(m=>m.id==='gpt-4o-mini-transcribe')?.id||models[0]?.id;
        if(!model)throw Error('Your OpenAI account has no available transcription model.');
      }
      const file={name:'dictation.'+(recording.type.includes('mp4')?'mp4':recording.type.includes('ogg')?'ogg':'webm'),data:await encoded(recording)};
      if(token!==generation)return;
      const response=await fetch('/api/audio',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({model,file})});
      const result=await response.json();if(!response.ok)throw Error(result.error||'Speech could not be transcribed. Retry the recording.');
      if(token!==generation)return;
      const text=typeof result.text==='string'?result.text.trim():'';if(!text)throw Error('No speech was detected. Please record again.');
      // Insert at the original caret only if the user has not edited the field meanwhile.
      const unchanged=input.value===anchor.value;
      const before=unchanged?input.value.slice(0,anchor.start):input.value;
      const after=unchanged?input.value.slice(anchor.end):'';
      const addition=(before&&!/\s$/.test(before)?' ':'')+text+(after&&!/^\s/.test(after)?' ':'');
      if((before+addition+after).length>input.maxLength){overflow.hidden=false;overflow.value=text;message('The transcript exceeds the Ask field’s 5,000-character limit. Your text is unchanged; copy the parts you need below.',true);}
      else{input.value=before+addition+after;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();input.setSelectionRange((before+addition).length,(before+addition).length);message('Speech added to Ask. Review the text, then press Enter to send.');}
      recording=null;
    }catch(e){if(token===generation)message(e.name==='AbortError'?'Transcription timed out. Retry the recording or cancel.':e.message,true);}
    finally{clearTimeout(timeout);if(token===generation){controller=null;controls('idle');}}
  }
  function stop(){
    if(phase!=='recording'||!recorder)return;
    controls('finishing');clearTimeout(timer);clearInterval(clock);message('Finishing your recording…');
    // A short tail protects the final syllable. Tracks stay open until the final data event.
    tail=setTimeout(()=>{
      if(phase!=='finishing'||!recorder)return;
      watchdog=setTimeout(()=>discard('The recording could not finish. Please record again.'),5000);
      if(recorder.state!=='inactive')recorder.stop();
    },400);
  }
  async function start(){
    if(form.getAttribute('aria-busy')==='true'){message('Wait for the current Ask request to finish before dictating.');return;}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){message('This browser cannot record audio. Open Nous in a browser with microphone support.',true);return;}
    const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
    if(!mime){message('This browser does not support a compatible recording format.',true);return;}
    const token=++generation;recording=null;overflow.hidden=true;overflow.value='';
    anchor={value:input.value,start:input.selectionStart??input.value.length,end:input.selectionEnd??input.value.length};
    controls('preparing');message('Starting microphone. Speak when Listening appears. Allow access if prompted.');
    try{
      const captured=await navigator.mediaDevices.getUserMedia({audio:true});
      if(token!==generation){captured.getTracks().forEach(t=>t.stop());return;}stream=captured;
      recorder=new MediaRecorder(stream,{mimeType:mime});let parts=[],bytes=0;
      recorder.ondataavailable=e=>{if(token!==generation)return;if(e.data.size){parts.push(e.data);bytes+=e.data.size;if(bytes>12*1024*1024){discard('The recording was too large. Please try a shorter message.');}}};
      recorder.onerror=()=>{if(token===generation)discard('Microphone recording failed. Your text is unchanged.');};
      recorder.onstop=()=>{release();if(token!==generation)return;recording=new Blob(parts,{type:mime});parts=[];recorder=null;if(!recording.size){recording=null;controls('idle');message('No audio was captured. Please try again.',true);return;}transcribe(token);};
      recorder.onstart=()=>{
        if(token!==generation)return;
        controls('recording');const started=Date.now();let warned=false;
        const update=()=>{const seconds=Math.min(300,Math.floor((Date.now()-started)/1000));elapsed.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} / 5:00`;if(seconds>=270&&!warned){warned=true;message('Listening · 30 seconds remaining. Finish your thought, then click Stop.');}};
        update();clock=setInterval(update,1000);
        message('Listening · click the microphone when finished. Up to 5 minutes.');
        timer=setTimeout(stop,limit);
      };
      recorder.start(250);
    }catch(e){if(token===generation){release();controller=null;controls('idle');message(e.name==='NotAllowedError'?'Microphone access was blocked. Allow it in your browser settings, then try again.':e.name==='NotFoundError'?'No microphone was found. Connect one and try again.':e.name==='NotReadableError'?'Your microphone is in use or unavailable. Close other recording apps and retry.':e.name==='AbortError'?'Dictation cancelled.':e.message,true);}}
  }
  mic.onclick=()=>phase==='recording'?stop():phase==='idle'?start():undefined;
  cancel.onclick=()=>discard();retry.onclick=()=>transcribe(generation);
  form.addEventListener('submit',e=>{if(phase!=='idle'){e.preventDefault();e.stopImmediatePropagation();message(phase==='recording'?'Stop dictation first, then review and send your text.':'Wait for transcription or cancel before sending.');}},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&phase!=='idle'){e.preventDefault();discard();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&['preparing','recording','finishing'].includes(phase))discard('Dictation stopped when you left the page. Nothing was sent.');});
  window.addEventListener('pagehide',()=>discard());
  new MutationObserver(()=>{if(document.querySelector('#dialog').open&&phase!=='idle')discard('Dictation cancelled while opening another tool.');}).observe(document.querySelector('#dialog'),{attributes:true,attributeFilter:['open']});
})();
