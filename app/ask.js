// Local, evidence-based Ask. No network request or simulated model answer.
function askCurrentResult() { return state.askResults?.[state.branch]; }
function renderAskResult() {
  const r = askCurrentResult();
  if (!r) return renderContext();
  const objects = (r.ids || []).map(obj).filter(Boolean);
  return `<div class="inspector-eyebrow">ASK RESULT <button data-dismiss-ask aria-label="Close Ask result">×</button></div>
    <div class="ask-query">${esc(r.query)}</div><span class="ask-status ${r.kind}">${esc(r.label)}</span>
    <h2 class="inspector-title">${esc(r.title)}</h2><p class="inspector-body ask-answer">${esc(r.answer)}</p>
    ${r.change ? `<div class="ask-change"><span>WORKSPACE UPDATE</span>${esc(r.change)}</div>` : ''}
    ${objects.length ? `<div class="inspector-label">${r.kind === 'changed' ? 'UPDATED OBJECTS' : 'WORKSPACE REFERENCES'}</div><div class="ask-object-list">${objects.map(o => `<button data-ask-object="${esc(o.id)}"><span class="type ${o.type}">${esc(o.type)}</span><strong>${esc(o.title)}</strong><span class="ask-excerpt">${esc(o.body.slice(0,180))}${o.body.length>180?'…':''}</span></button>`).join('')}</div>` : ''}
    ${r.branches ? `<div class="ask-object-list">${state.branches.map(b => `<button data-ask-branch="${esc(b.id)}"><span class="type">${esc(b.state)}</span><strong>${esc(b.name)}</strong><span class="ask-excerpt">${esc(b.note)}</span></button>`).join('')}</div>` : ''}
    ${r.kind === 'unmatched' ? '<button class="ask-save-question subtle-button" data-save-ask>Keep as an open question</button>' : ''}
    <p class="ask-footnote">${r.provider ? esc(r.provider+' · '+r.model)+'<br>AI draft · review before relying on it.' : 'Local workspace result.'}<br>Seed source material is fictional.</p>`;
}
function bindAskResults() {
  const r = askCurrentResult();
  const last = document.querySelector('#last-ask-result');
  last.hidden = !r;
  last.onclick = () => { state.showAskResult = true; render(); };
  document.querySelectorAll('[data-dismiss-ask]').forEach(b => b.onclick = () => { state.showAskResult = false; render(); });
  document.querySelectorAll('[data-ask-object]').forEach(b => b.onclick = () => select(b.dataset.askObject));
  document.querySelectorAll('[data-ask-branch]').forEach(b => b.onclick = () => { state.branch = b.dataset.askBranch; setView('map'); });
  document.querySelector('[data-save-ask]')?.addEventListener('click', () => {
    const id = createObject('question', r.query.slice(0,150), r.query);
    document.querySelector('#command').value = '';
    finishAsk(r.query, { kind:'changed', title:'Question saved.', answer:'This request is now an open question. It still needs an answer.', ids:[id], change:'Added one question to the current branch.', view:'map' });
    revealAskObject(id);
  });
}
function finishAsk(query, result) {
  state.askResults ||= {};
  const labels = { changed:'Workspace updated', found:'From your workspace', unmatched:'No matching information', pending:'Your input is needed', error:'Connection needs attention' };
  state.askResults[state.branch] = { query, kind:'found', ...result, label:labels[result.kind || 'found'] };
  if (result.view) state.view = result.view;
  state.showAskResult = true;
  render();
  document.querySelector('#inspector .inspector-scroll').scrollTop = 0;
  // A visible, persistent answer replaces the old transient-only feedback.
  clearTimeout(toastTimer);
  document.querySelector('#toast').classList.remove('show');
  document.querySelector('#ask-announcement').textContent = `${result.title} ${result.change || result.answer}`;
  return result.kind !== 'unmatched';
}
function revealAskObject(id) {
  requestAnimationFrame(() => {
    const surface = document.querySelector('#surface');
    const card = [...surface.querySelectorAll('[data-object]')].find(e => e.dataset.object === id);
    if (card && !document.body.classList.contains('map-fullscreen')) {
      const a = surface.getBoundingClientRect(), b = card.getBoundingClientRect();
      surface.scrollTop += b.top - a.top - 28;
    }
    if (innerWidth <= 850) document.querySelector('#inspector').scrollIntoView({ block:'start' });
  });
}
function askPending(query, open, inspect) {
  const requestedBranch = state.branch;
  open();
  const dialog = document.querySelector('#dialog');
  if (!dialog.open) return;
  finishAsk(query, { kind:'pending', title:'Complete the details.', answer:'Finish the open form to apply this request. Nothing has been committed yet.' });
  dialog.addEventListener('workspaceformcomplete', event => {
    if (event.detail.saved) {
      finishAsk(query, inspect());
      if (state.branch !== requestedBranch) { state.askResults[requestedBranch] = structuredClone(askCurrentResult()); save(); }
    }
    else finishAsk(query, { title:'Change cancelled.', answer:'The form was closed. No changes were applied.' });
  }, { once:true });
}
function askTokens(text) {
  const ignored = new Set('a an and are as at be by can could do does for from how i in is it me my of on or our please should show tell that the their them there these this to us was we what when where which who why will with would you your about find information'.split(' '));
  return [...new Set((text.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]).filter(w => w.length>2&&!ignored.has(w)).map(w=>w.replace(/(?:ing|s)$/,'')))];
}
function answerAsk(raw) {
  const text = raw.trim();
  const t = text.replace(/^please\s+/i,'');
  const lower = t.toLowerCase();
  const reference = t.match(/@([a-z0-9]+)/i)?.[1]?.toUpperCase();
  const target = reference ? obj(reference) : obj(state.selected);
  const finish = result => finishAsk(text,result);
  const change = result => finish({kind:'changed',...result});
  let m;
  if (reference && !target) return finish({kind:'unmatched',title:'Object not found.',answer:`@${reference} does not exist in this branch. Check the ID or open the branch containing it.`});

  if ((m=t.match(/^(?:set|change|update|make) (?:the |our |shared )?goal\s*(?:to|as|:)\s*(.+)$/i))) {
    if(m[1].length>140) return finish({kind:'unmatched',title:'Use a shorter goal.',answer:'The goal can contain up to 140 characters. Your request is still in the Ask field.'});
    state.goal=m[1].trim();
    return change({title:'Shared goal updated.',answer:state.goal,change:'The goal has changed across every view and branch.',view:'map'});
  }
  if ((m=t.match(/^(?:add|set|include) (?:a |the |this )?constraint\s*(?::|that|to)?\s+(.+)$/i))) {
    const constraint=m[1].trim();
    if(state.constraints.some(c=>c.toLowerCase()===constraint.toLowerCase())) return finish({title:'Constraint already included.',answer:constraint,change:'No duplicate was added.'});
    state.constraints.push(constraint);
    return change({title:'Constraint added.',answer:constraint,change:'Shared context now includes this constraint in every branch.',view:'map'});
  }
  if ((m=t.match(/^(?:create|add|save|note|capture)\s+(?:a |an |new )?(question|claim|assumption|evidence|decision|artifact|source)\b\s*(?::|called|titled|about|that)?\s*(.*)$/i))) {
    if (!m[2]) { askPending(text,()=>{addObject();document.querySelector('#dialog select').value=m[1].toLowerCase();},()=>({kind:'changed',title:'Object created.',answer:'Your new object has been saved.',ids:[state.selected],change:'Added one object to this branch.',view:'map'})); return true; }
    const id=createObject(m[1].toLowerCase(),m[2].slice(0,150),m[2]);
    change({title:`${m[1][0].toUpperCase()+m[1].slice(1).toLowerCase()} created.`,answer:m[2],ids:[id],change:'Added one persistent object to the current branch.',view:'map'});
    revealAskObject(id);return true;
  }
  if ((m=t.match(/^(?:create|add|fork) (?:a |another |new )?branch(?:\s+(?:called|named|for)|\s*:)\s*(.+)$/i))) {
    const parent=state.branch, id='b'+crypto.randomUUID().slice(0,8);
    state.branches.push({id,name:m[1].slice(0,60),note:`Explore ${m[1]}.`,parent,state:'Exploring'});
    state.objects.push(...current().map(o=>({...structuredClone(o),branch:id})));
    state.history.push(...state.history.filter(h=>h.branch===parent||(!h.branch&&parent==='main')).map(h=>({...h,branch:id})));
    state.branch=id;state.selected=null;
    return change({title:'New branch created.',answer:`“${m[1].slice(0,60)}” is ready to explore.`,change:'Copied the current objects and decision history into an independent branch.',branches:true,view:'branches'});
  }
  if (/^(?:create|add|fork) (?:a |another |new )?branch\b/i.test(t)) {
    askPending(text,()=>branchDialog(state.selected),()=>({kind:'changed',title:'Branch created.',answer:'Your independent branch is ready.',branches:true,view:'branches',change:'Objects and history were copied into the new branch.'}));return true;
  }
  if (/^(?:challenge|question|test) (?:the |this |my |selected |an? )*(?:assumption|claim|@)/i.test(t)) {
    challenge(target?.id||'A01');const id=state.selected;
    change({title:'Challenge added.',answer:'A linked research question now records what would make us revise this idea. No new evidence has been invented.',ids:[id],change:'Added one question and linked it to the challenged object.',view:'map'});revealAskObject(id);return true;
  }
  if ((m=t.match(/^(?:mark|set|change)\s+@(\w+)\s+(?:as|to)\s+(idea|candidate|decided|superseded|rejected)\b(?:\s+(?:because|reason:)\s+(.+))?\.?$/i))) {
    const o=obj(m[1].toUpperCase()), next=states.find(s=>s.toLowerCase()===m[2].toLowerCase());
    if(o.type!=='decision')return finish({kind:'unmatched',title:'Choose a decision object.',answer:'Decision-state changes apply to objects with the decision type.'});
    if (!m[3]) { askPending(text,()=>decisionDialog(o.id,next),()=>({kind:'changed',title:'Decision recorded.',answer:`${o.title} is now ${o.state}.`,ids:[o.id],change:'The state and rationale are reflected in the document and decision history.',view:'decisions'}));return true; }
    const previous=o.state;o.state=next;o.origin='Reviewed by you';o.note='Decision recorded';
    state.history.push({id:o.id,branch:state.branch,text:`${previous} → ${next}`,reason:m[3],time:new Date().toLocaleString()});
    return change({title:'Decision recorded.',answer:m[3],ids:[o.id],change:`${previous} → ${next}. The document and history now reflect this decision.`,view:'decisions'});
  }
  if (/^(?:compare|show|explore|open|view)\s+(?:the |our |my )?(?:alternatives|branches|options)\b/i.test(t)) return finish({title:'Alternatives, side by side.',answer:`${state.branches.length} branches preserve their own objects and decisions. Open one to continue exploring.`,branches:true,change:'Opened the branch comparison.',view:'branches'});
  if (/^(?:draft|write|create|generate|prepare|show|open)\s+(?:the |a |my |pilot )*(?:brief|document)\b/i.test(t)) {
    const artifact=obj('O01');if(artifact){artifact.body=briefText();artifact.note='Draft assembled from current workspace';artifact.origin='Compiled locally from workspace objects';artifact.links=current().filter(o=>['claim','decision','question','evidence'].includes(o.type)).map(o=>o.id);}
    return change({title:'Brief assembled.',answer:'The brief uses the current goal, constraints, claims and decisions. References and decision states stay attached.',ids:artifact?['O01']:[],change:'Updated the pilot brief and opened the document view.',view:'document'});
  }
  if (/^(?:edit|change|update)\s+(?:the |shared |our )?(?:context|goal)\s*$/i.test(t)) { askPending(text,editContext,()=>({kind:'changed',title:'Context updated.',answer:state.goal,change:'Goal and constraints updated across all branches.'}));return true; }
  if (/^(?:show|open|review|approve|execute)\s+(?:the |proposed )?actions?\b/i.test(t)) return finish({title:'Action ready for review.',answer:'Inspect the proposed brief, its inputs and its destination. Approval is required before the local download.',view:'actions',change:'Opened the action review. Nothing has run.'});
  if (/^(?:show|open|go to|view)\s+(?:the )?(?:map|workspace)\s*$/i.test(t)) return finish({title:'Map opened.',answer:`${current().length} objects belong to this branch. Select an object to inspect its context.`,view:'map'});
  if (target && /^(?:open|show|inspect|explain|summari[sz]e|what is|tell me about)\s+@/i.test(t)) return finish({title:target.title,answer:target.body,ids:[target.id,...target.links],view:target.type==='decision'?'decisions':target.type==='evidence'||target.type==='source'?'evidence':'map'});

  // Questions return existing material with references, never invented research.
  if (/\b(goal|purpose|trying to achieve|constraints?|boundaries)\b/.test(lower)) return finish({title:'The shared context.',answer:`${state.goal}\n\n${state.subtitle}\n\nConstraints:\n${state.constraints.map(c=>'• '+c).join('\n')}`,view:'map'});
  if (/\b(summary|summarise|summarize|overview|what next|next steps|where are we|what should we do next)\b/.test(lower)) {
    const decision=current().find(o=>o.type==='decision'&&o.state!=='Rejected');const question=current().find(o=>o.type==='question');const claim=current().find(o=>o.type==='claim');
    return finish({title:'Where the work stands.',answer:[claim&&`Current direction: ${claim.title}`,decision&&`Next decision: ${decision.title} (${decision.state}).`,question&&`Still open: ${question.title}`].filter(Boolean).join('\n\n'),ids:[claim?.id,decision?.id,question?.id].filter(Boolean),view:'map'});
  }
  if (/\b(risks?|assumptions?|uncertain|unknowns?|missing|unanswered|still open)\b/.test(lower)) {
    const ids=current().filter(o=>['question','assumption'].includes(o.type)||o.type==='evidence'&&/contradict|caveat/i.test(o.origin+' '+o.note)).map(o=>o.id);
    return finish({title:'What still needs testing.',answer:`${ids.length} existing objects describe assumptions, open questions or contradictory evidence. These are uncertainties to investigate.`,ids,view:'map'});
  }
  if (/\b(decisions?|decided|rejected)\b/.test(lower)) {
    const decisions=current().filter(o=>o.type==='decision'&&(!/rejected/.test(lower)||o.state==='Rejected'));
    const reasons=state.history.filter(h=>decisions.some(o=>o.id===h.id)&&(h.branch===state.branch||!h.branch&&state.branch==='main'));
    return finish({title:'The decision record.',answer:decisions.map(o=>`${o.title}: ${o.state}`).join('\n')+(reasons.length?'\n\nRecorded reasons:\n'+reasons.map(h=>`${h.id}: ${h.reason}`).join('\n'):''),ids:decisions.map(o=>o.id),view:'decisions'});
  }
  if (/\b(evidence|sources?|provenance)\b/.test(lower)) {
    const evidence=current().filter(o=>o.type==='evidence');return finish({title:'Evidence behind the work.',answer:`${evidence.length} evidence objects are available. Follow their links to the original source excerpts. These illustrative sources do not establish validated demand.`,ids:evidence.flatMap(o=>[o.id,...o.links]),view:'evidence'});
  }
  const tokens=askTokens(text);
  const matches=current().map(o=>{const title=askTokens(o.title),all=askTokens(o.body+' '+o.note);return {o,score:tokens.reduce((sum,w)=>sum+(title.includes(w)?3:all.includes(w)?1:0),0)}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,5).map(x=>x.o);
  if(matches.length) return finish({title:'Relevant workspace information.',answer:matches[0].body,ids:matches.map(o=>o.id),view:matches[0].type==='decision'?'decisions':matches[0].type==='evidence'||matches[0].type==='source'?'evidence':'map'});
  return finish({kind:'unmatched',title:'No matching information yet.',answer:'This request cannot be answered from the current workspace. No live model or web search is connected. Keep it as an open question, or ask about the goal, evidence, decisions or next steps.',change:'No objects were changed. Your request remains in the Ask field.'});
}
function submitAsk() {
  const input=document.querySelector('#command'), text=input.value.trim();
  if(!text){input.focus();return;}
  try {
    if(answerAsk(text)) input.value='';
    if(innerWidth<=850&&!document.querySelector('#dialog').open) document.querySelector('#inspector').scrollIntoView({block:'start'});
  } catch(error) {
    console.error(error);
    document.querySelector('#ask-announcement').textContent='The request could not be completed. Your text has been kept so you can try again.';
    toast('The request could not be completed. Your text has been kept.');
  }
}
window.submitAsk=submitAsk;
const askAnnouncement=document.createElement('div');
askAnnouncement.id='ask-announcement';askAnnouncement.className='sr-only';askAnnouncement.setAttribute('role','status');askAnnouncement.setAttribute('aria-live','polite');document.body.append(askAnnouncement);
if(state.showAskResult && askCurrentResult()?.kind === 'unmatched') document.querySelector('#command').value = askCurrentResult().query;
render();
