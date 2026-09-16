// Audio stays on this device until the user explicitly runs an OpenAI audio tool.
(() => {
  const modes={'transcription':'Transcribe recording','speech':'Read aloud','audio-chat':'Audio conversation','realtime':'Live voice'};
  const descriptions={transcription:'Turn a recording into a transcript. Speaker labels are available with diarization models.',speech:'Create an AI-generated voice reading of your text. Preview it before saving it as an artifact.','audio-chat':'Ask a question, optionally attach a recording, and receive an AI-generated spoken response.',realtime:'Talk with an AI-generated voice. Your microphone starts only after you choose Start voice. Stop ends the connection.'};
  let dbPromise,artifactURLs=[];
  function db(){return dbPromise||=(new Promise((resolve,reject)=>{const r=indexedDB.open('nous-audio',1);r.onupgradeneeded=()=>r.result.createObjectStore('clips');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Audio storage is unavailable. Download the audio to keep it.'));}));}
  async function clipStore(id,blob){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('clips','readwrite');t.objectStore('clips').put(blob,id);t.oncomplete=resolve;t.onerror=()=>reject(Error('Audio storage is full. Download the audio to keep it.'));});}
  async function clipRead(id){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('clips').objectStore('clips').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=reject;});}
  window.bindAudioArtifacts=()=>{
    artifactURLs.forEach(URL.revokeObjectURL);artifactURLs=[];
    document.querySelectorAll('[data-audio-id]').forEach(async el=>{try{const blob=await clipRead(el.dataset.audioId);if(!el.isConnected)return;if(!blob)throw Error('Audio is no longer on this device. The transcript is preserved.');const url=URL.createObjectURL(blob);artifactURLs.push(url);el.querySelector('audio').src=url;const a=el.querySelector('a');a.href=url;a.hidden=false;}catch(e){if(el.isConnected){el.querySelector('p[role=status]').textContent=e.message;el.querySelector('audio').hidden=true;}}});
  };
  async function fileData(file){if(!file)return undefined;if(file.size>12*1024*1024)throw Error('Choose a file smaller than 12 MB.');return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve({name:file.name,data:r.result.split(',')[1]});r.onerror=()=>reject(Error('This file could not be read.'));r.readAsDataURL(file);});}
  function audioBlob(data){return new Blob([Uint8Array.from(atob(data.audio),c=>c.charCodeAt(0))],{type:data.mime||'audio/mpeg'});}
  window.openAudioTools=async selected=>{
    const branch=state.branch,linked=state.selected,dialog=document.querySelector('#dialog');
    let catalog=[],request=null,pc=null,stream=null,channel=null,sessionTimer=null,result=null,resultURL=null,closed=false,transcript=[],saved=false;
    modal(`<h2>Think with audio.</h2><p class="audio-description">Recordings, transcripts and spoken drafts, alongside your other objects.</p><form id="audio-form"><div class="audio-layout"><label>Mode<select id="audio-mode">${Object.entries(modes).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label><label>Model<select id="audio-model" disabled><option>Loading models…</option></select></label><p id="audio-description" class="audio-wide audio-note"></p><label data-audio-field="file" class="audio-wide">Recording<input id="audio-file" type="file" accept=".mp3,.wav,.m4a,.mp4,.webm,.ogg,.flac,.mpeg,.mpga"><small id="audio-file-hint" class="audio-note">Up to 12 MB. The file is sent only when you run this tool.</small></label><label data-audio-field="text" class="audio-wide"><span id="audio-text-label">Text</span><textarea id="audio-text" maxlength="4000"></textarea></label><label data-audio-field="voice">Voice<select id="audio-voice">${['alloy','echo','fable','onyx','nova','shimmer'].map(v=>`<option>${v}</option>`).join('')}</select></label></div><p class="audio-note">Uses your OpenAI connection and API billing. Only the recording and text entered here are shared. Results are previews until you save them to this branch. Claude is available for analysing the saved transcript through Ask.</p><div class="audio-status-line"><nous-orb id="audio-orb" state="connecting" size="20"></nous-orb><p id="audio-feedback" class="audio-feedback" role="status" aria-live="polite">Loading available audio models…</p></div><div class="audio-toolbar"><button id="audio-run" class="primary" type="submit" disabled>Transcribe</button><button id="audio-stop" type="button" hidden>Cancel</button><button id="audio-close" type="button">Close</button></div></form><section id="audio-result" class="audio-result" hidden><h3>Preview</h3><p class="audio-note">AI-generated output. Review the transcript for accuracy.</p><audio id="audio-player" controls aria-label="Audio preview"></audio><pre id="audio-transcript"></pre><div class="audio-toolbar"><button id="audio-save" type="button">Save to workspace</button><a id="audio-download" download="nous-audio.mp3" hidden>Download audio</a></div></section>`);
    const q=s=>dialog.querySelector(s),mode=q('#audio-mode'),model=q('#audio-model'),run=q('#audio-run'),stop=q('#audio-stop'),feedback=q('#audio-feedback'),orb=q('#audio-orb'),preview=q('#audio-result'),player=q('#audio-player');
    q('#audio-text').value=document.querySelector('#command').value.slice(0,4000)||(linked?obj(linked)?.body.slice(0,4000):'')||'';
    function message(text,error=false){feedback.textContent=text;feedback.dataset.error=String(error);}
    function setBusy(on){q('#audio-form').setAttribute('aria-busy',String(on));for(const el of dialog.querySelectorAll('select,input,textarea'))el.disabled=on;run.disabled=on||!model.value;stop.hidden=!on;orb.hidden=!on;orb.setAttribute('state',on?'working':'idle');stop.textContent=pc?'Stop voice':'Cancel';}
    function update(){
      const items=catalog.filter(m=>m.mode===mode.value);model.innerHTML=items.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')||'<option value="">No models available</option>';
      const recommended={transcription:'gpt-4o-mini-transcribe',speech:'gpt-4o-mini-tts','audio-chat':'gpt-audio-mini',realtime:'gpt-realtime-mini'}[mode.value];if(items.some(m=>m.id===recommended))model.value=recommended;
      q('#audio-description').textContent=descriptions[mode.value];
      q('[data-audio-field=file]').hidden=!['transcription','audio-chat'].includes(mode.value);q('#audio-file').required=mode.value==='transcription';q('#audio-file').accept=mode.value==='audio-chat'?'.mp3,.wav':'.mp3,.wav,.m4a,.mp4,.webm,.ogg,.flac,.mpeg,.mpga';
      q('#audio-file-hint').textContent=mode.value==='audio-chat'?'Optional WAV or MP3, up to 12 MB.':'MP3, WAV, M4A, MP4, WebM, OGG or FLAC, up to 12 MB.';
      q('[data-audio-field=text]').hidden=mode.value==='transcription';q('#audio-text').required=['speech','audio-chat'].includes(mode.value);q('#audio-text-label').textContent=mode.value==='speech'?'Text to read aloud':mode.value==='realtime'?'Session topic (optional)':'Your question or instruction';
      q('[data-audio-field=voice]').hidden=mode.value==='transcription';run.textContent={transcription:'Transcribe',speech:'Generate speech','audio-chat':'Ask with audio',realtime:'Start voice'}[mode.value];
      run.disabled=!model.value;model.disabled=!model.value;orb.hidden=true;message(items.length?'Ready · '+items.length+(items.length===1?' model available':' models available'):'No compatible models are available to your API account.');
    }
    function clearResult(){result=null;saved=false;transcript=[];preview.hidden=true;player.pause();player.autoplay=false;player.removeAttribute('src');if(resultURL)URL.revokeObjectURL(resultURL);resultURL=null;q('#audio-save').disabled=false;q('#audio-save').textContent='Save to workspace';q('#audio-download').hidden=true;}
    function showResult(data){result=data;preview.hidden=false;q('#audio-transcript').textContent=data.text;player.hidden=!data.audio;if(data.audio){resultURL=URL.createObjectURL(audioBlob(data));player.src=resultURL;q('#audio-download').href=resultURL;q('#audio-download').hidden=false;}q('#audio-save').disabled=false;}
    function stopVoice(){clearTimeout(sessionTimer);sessionTimer=null;channel?.close();channel=null;if(pc){pc.onconnectionstatechange=null;pc.close();pc=null;}stream?.getTracks().forEach(t=>t.stop());stream=null;player.pause();player.srcObject=null;}
    function cleanup(){closed=true;request?.abort();stopVoice();if(resultURL)URL.revokeObjectURL(resultURL);dialog.removeEventListener('close',cleanup);}
    dialog.addEventListener('close',cleanup,{once:true});q('#audio-close').onclick=()=>dialog.close();
    mode.onchange=()=>{clearResult();update();};model.onchange=()=>{clearResult();};
    stop.onclick=()=>{request?.abort();stopVoice();if(transcript.length)showResult({mode:'realtime',model:model.value,text:transcript.join('\n\n')});setBusy(false);message('Stopped. Your microphone is off.');};
    q('#audio-save').onclick=async()=>{
      if(!result||saved)return;if(state.branch!==branch){message('The active branch changed. Return to the original branch before saving.',true);return;}
      const button=q('#audio-save');button.disabled=true;
      try{
        const id='A'+crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase();let audioId;
        if(result.audio){audioId=crypto.randomUUID();await clipStore(audioId,audioBlob(result));}
        state.objects.push({id,type:'artifact',branch,title:({transcription:'Audio transcript',speech:'Spoken draft','audio-chat':'Audio response',realtime:'Voice conversation'})[result.mode],body:result.text.slice(0,30000),links:linked?[linked]:[],state:'Idea',note:result.mode==='transcription'?'AI transcript · verify against the recording':'AI draft · review before relying on it',origin:'OpenAI · '+result.model+' · '+new Date().toLocaleString(),...(audioId?{audioId}:{})});
        state.selected=id;state.showAskResult=false;render();saved=true;button.textContent='Saved to workspace';message('Saved as an artifact in this branch.');
      }catch(e){button.disabled=false;message(e.message,true);}
    };
    q('#audio-form').onsubmit=async e=>{
      e.preventDefault();if(request||pc)return;clearResult();request=new AbortController();setBusy(true);message(mode.value==='realtime'?'Connecting microphone…':'Processing with '+model.value+'…');
      const timer=setTimeout(()=>request?.abort(),95000),controller=request;
      try{
        const input={model:model.value,voice:q('#audio-voice').value,text:q('#audio-text').value};
        if(['transcription','audio-chat'].includes(mode.value))input.file=await fileData(q('#audio-file').files[0]);
        if(mode.value==='realtime'){
          if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection)throw Error('Live voice is unavailable in this browser. Use an audio file instead.');
          const captured=await navigator.mediaDevices.getUserMedia({audio:true});
          if(closed||controller.signal.aborted){captured.getTracks().forEach(t=>t.stop());throw new DOMException('Cancelled','AbortError');}stream=captured;
          pc=new RTCPeerConnection();pc.addTrack(stream.getAudioTracks()[0]);player.hidden=false;preview.hidden=false;player.autoplay=true;
          pc.ontrack=e=>{player.srcObject=e.streams[0];player.play().catch(()=>message('Connected. Press Play to hear the AI voice.'));};
          channel=pc.createDataChannel('oai-events');
          channel.onmessage=e=>{try{const event=JSON.parse(e.data);if(event.type==='error'){message('The voice session reported an error. Stop and reconnect.',true);stopVoice();setBusy(false);return;}const user=event.type==='conversation.item.input_audio_transcription.completed',assistant=event.type==='response.output_audio_transcript.done'||event.type==='response.audio_transcript.done';if((user||assistant)&&event.transcript){transcript.push((user?'You: ':'Nous: ')+event.transcript);q('#audio-transcript').textContent=transcript.join('\n\n');}}catch{}};
          pc.onconnectionstatechange=()=>{if(pc?.connectionState==='connected'){message('Live · microphone on. Session ends automatically after 5 minutes.');orb.setAttribute('state','listening');stop.textContent='Stop voice';}else if(pc&&['failed','disconnected'].includes(pc.connectionState)){stop.click();message('Voice disconnected. Your microphone is off.',true);}};
          const offer=await pc.createOffer();await pc.setLocalDescription(offer);input.sdp=offer.sdp;
        }
        if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
        const r=await fetch('/api/audio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:controller.signal});const data=await r.json();if(!r.ok)throw Error(data.error||'Audio request failed.');if(closed||controller.signal.aborted)return;
        if(mode.value==='realtime'){await pc.setRemoteDescription({type:'answer',sdp:data.sdp});sessionTimer=setTimeout(()=>stop.click(),300000);q('#audio-save').disabled=true;stop.textContent='Stop voice';}
        else{showResult(data);message('Ready to review. Save the result to keep it in your workspace.');}
      }catch(e){if(!closed){stopVoice();message(e.name==='AbortError'?'Cancelled. Your inputs have been kept.':e.name==='NotAllowedError'?'Microphone permission was not granted. You can use a recording instead.':e.message,true);}}
      finally{clearTimeout(timer);request=null;if(!closed&&!pc)setBusy(false);}
    };
    try{const r=await fetch('/api/models?provider=openai');const data=await r.json();if(!r.ok)throw Error(data.error);if(closed)return;catalog=data.models;if(selected)mode.value=selected.mode;update();if(selected&&catalog.some(m=>m.id===selected.id))model.value=selected.id;}
    catch(e){if(!closed){orb.hidden=true;message(e.message,true);}}
  };
  document.querySelector('#audio-tools').onclick=()=>window.openAudioTools();
  window.bindAudioArtifacts();
})();
