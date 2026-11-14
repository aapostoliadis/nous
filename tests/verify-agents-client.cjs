// Loads the browser side of Agents (app/agents.js) into a vm context with a fake page, and tests the parts most likely
// to lose someone's data or leak a key: the Markdown renderer, run trimming, follow-up text, and import of agent files.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../app/agents.js'),'utf8');
const KEY='nous-agents-v1';
// Each fix below comes from another plan. A case whose fix is missing is skipped, not dropped.
const has={ids:source.includes('const safeId='),running:/const trimRuns=.*r\.status!=='running'&&/.test(source),followUp:source.includes('for(const quote of [500,100])')};
const skipped=[];
const needs=(ok,label,plan,fn)=>ok?fn():skipped.push(`Skipped: ${label} (plan ${plan} not applied)`);

// With a provider, the page looks as if a key and model are chosen, so the schedule timer is allowed to start runs.
function load(stored,{provider}={}){
  const toasts=[],handlers={},winHandlers={},storage=new Map();
  if(stored)storage.set(KEY,JSON.stringify(stored));
  const record=(name,fn)=>{(handlers[name]??=[]).push(fn);};
  const noop=()=>{};
  // A permissive element: any property can be set, known ones have plain values, anything else is a no-op function.
  const element=()=>{
    const own={dataset:{},style:{},value:'',innerHTML:'',textContent:'',children:[],options:[],classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},
      addEventListener:record,closest:()=>null,querySelector:()=>element(),querySelectorAll:()=>[]};
    return new Proxy(own,{get:(o,k)=>k in o?o[k]:typeof k==='symbol'?undefined:noop,set:(o,k,v)=>{o[k]=v;return true;}});
  };
  const document={title:'Nous',body:element(),documentElement:element(),activeElement:null,getElementById:()=>element(),querySelector:s=>Object.assign(element(),provider&&{'#ai-provider':{value:'anthropic'},'#ai-model':{value:'claude-test'}}[s]),querySelectorAll:()=>[],createElement:()=>element(),addEventListener:record};
  const ctx={document,toast:m=>toasts.push(m),toastTimer:0,$:s=>document.querySelector(s),state:{},save:noop,render:noop,setMode:noop,current:()=>null,
    esc:v=>String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    localStorage:{getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>{storage.set(k,String(v));},removeItem:k=>{storage.delete(k);}},
    crypto:require('node:crypto').webcrypto,MutationObserver:class{observe(){}disconnect(){}},setTimeout:()=>0,setInterval:()=>0,
    location:{hash:'',search:'',pathname:'/',href:'http://localhost/'},navigator:{onLine:true},addEventListener:(name,fn)=>{(winHandlers[name]??=[]).push(fn);},
    fetch:async()=>{throw Error('The agents client test never calls a provider.');}};
  ctx.window=ctx;ctx.__agentsTest={};
  vm.runInNewContext(source,ctx);
  // Calls every handler the script registered for this event, on the document or on an element (the Agents root listens for change).
  const fire=(name,event)=>{for(const fn of handlers[name]||[])fn(event);};
  // Window-level events, such as the storage event another tab's save causes.
  const fireWindow=(name,event)=>{for(const fn of winHandlers[name]||[])fn(event);};
  return {t:ctx.__agentsTest,toasts,storage,fire,fireWindow};
}
const settle=()=>new Promise(r=>setImmediate(r));
const agent=(over={})=>({id:'agent-1',name:'Weekly brief',description:'Summarises the week.',instructions:'Write a brief.',version:1,...over});
const done=(n,reviewed)=>({id:'run-'+n,agentId:'agent-1',status:'done',reviewed,n,answer:'A',title:'T',time:new Date(0).toISOString()});
const importFile=async(h,agents)=>{h.fire('change',{target:{id:'ag-import',dataset:{},value:'x',files:[{text:async()=>JSON.stringify({agents})}]}});await settle();await settle();};
const idShape=/^[A-Za-z0-9_-]{1,64}$/;

(async()=>{
  let h=load();
  for(const name of ['md','trimRuns','withParent'])assert.equal(typeof h.t[name],'function',`the test seam does not expose ${name}`);
  const {md,withParent}=h.t;

  // Markdown renderer: model output becomes HTML, so anything that survives as markup can run in the person's page.
  assert.ok(!md('<img src=x onerror=alert(1)>').includes('<img'),'an image tag in a result would run its onerror script');
  assert.ok(!md('[x](javascript:alert(1))').includes('href="javascript:'),'a javascript: link in a result would run on click');
  assert.ok(!md('[x](https://example.com/a"onmouseover="b)').includes('"onmouseover='),'a quote in a link broke out of the href attribute');
  const styled=md('**bold** and `code`');
  assert.ok(styled.includes('<strong>bold</strong>')&&styled.includes('<code>code</code>'),'bold and inline code no longer render');
  const fenced=md('```\n<script>alert(1)</script>\n```');
  assert.ok(fenced.includes('<pre><code>&lt;script&gt;')&&!fenced.includes('<script'),'a script tag inside a code block would run instead of showing');

  // Run trimming: the list stays near 100 without losing results the person has not seen.
  h=load({agents:[agent()],runs:[...Array(120)].map((_,i)=>done(i,true)),draft:null});h.t.trimRuns();
  assert.equal(h.t.db().runs.length,100,'reviewed runs beyond 100 are no longer trimmed');
  assert.equal(h.t.db().runs[0].n,0,'trimming removed the newest run instead of the oldest');
  h=load({agents:[agent()],runs:[...[...Array(100)].map((_,i)=>done(i,false)),...[...Array(5)].map((_,i)=>done(100+i,true))],draft:null});h.t.trimRuns();
  assert.equal(h.t.db().runs.filter(r=>!r.reviewed).length,100,'a finished result was deleted before the person reviewed it');
  assert.equal(h.t.db().runs.length,100,'reviewed runs were kept although the list was over 100');
  needs(has.running,'running-run trimming',4,()=>{
    h=load({agents:[agent()],runs:[{id:'live',agentId:'agent-1',status:'running',beat:Date.now(),time:new Date().toISOString()},...[...Array(100)].map((_,i)=>done(i,false))],draft:null});h.t.trimRuns();
    assert.equal(h.t.db().runs[0].status,'running','the run in flight was trimmed, so its result would vanish after being paid for');
    assert.equal(h.t.db().runs[0].id,'live');
  });

  // Follow-up text: must fit the server's 5,000-character request limit without cutting what the person typed.
  assert.equal(withParent('q',null),'q');
  const parent={request:'r'.repeat(900),answer:'a'.repeat(9000)};
  const follow=withParent('q',parent);
  assert.ok(follow.length<=5000&&follow.endsWith('Follow-up: q'),'a follow-up on a long result is over the limit or lost the new request');
  needs(has.followUp,'follow-up within 5,000 characters for a 4,700-character request',3,()=>{
    const long='q'.repeat(4700),out=withParent(long,parent);
    assert.ok(out.length<=5000,'a long follow-up request the form allowed is rejected by the server');
    assert.ok(out.includes(long),'part of the follow-up request the person typed was cut');
  });

  // Import and stored ids: ids are written into HTML attributes, so a crafted agents file must not be able to carry markup.
  const bad='x"><img src=x onerror=1>';
  needs(has.ids,'bad ids replaced at import and at load',1,()=>{});
  if(has.ids){
    h=load({agents:[],runs:[],draft:null});
    await importFile(h,[{id:bad,chainTo:bad,name:'Imported',instructions:'Do it.'}]);
    assert.equal(h.t.db().agents.length,1,'an agent from an import file was not added');
    assert.match(h.t.db().agents[0].id,idShape,'an imported agent kept an id that can break out of an HTML attribute');
    assert.equal(h.t.db().agents[0].chainTo,undefined,'an imported agent kept an unsafe chainTo');
    assert.match(JSON.parse(h.storage.get(KEY)).agents[0].id,idShape,'the unsafe id was saved to storage');
    h=load({agents:[agent({id:bad})],runs:[],draft:null});
    assert.match(h.t.db().agents[0].id,idShape,'a stored agent with an unsafe id was not given a fresh one on load');
  }
  h=load({agents:[agent()],runs:[],draft:null});
  await importFile(h,[{id:'agent-1',name:'Renamed brief',instructions:'Write a better brief.'}]);
  assert.equal(h.t.db().agents.length,1,'importing an agent that is already here made a duplicate');
  assert.equal(h.t.db().agents[0].name,'Renamed brief','importing an agent that is already here did not update it');
  h=load({agents:[],runs:[],draft:null});
  await importFile(h,null);
  assert.ok(h.toasts.some(m=>/not a Nous agents export/.test(m)),'a file that is not an agents export gave no message');

  // Two tabs: each holds its own copy and saves the whole of it, so a tab must take in what another tab saved.
  const other=agent({id:'agent-2',name:'Other tab'});
  h=load({agents:[agent()],runs:[],draft:null});
  h.fireWindow('storage',{key:KEY,newValue:JSON.stringify({agents:[agent(),other],runs:[],draft:null})});
  assert.equal(h.t.db().agents.length,2,'an agent made in another tab is missing here, and the next save here would erase it');
  assert.equal(typeof h.t.db().drafts,'object','unsent request drafts broke after another tab saved');
  h=load({agents:[agent()],runs:[],draft:null});
  for(const event of [{key:KEY,newValue:'not json'},{key:KEY,newValue:'{"agents":5}'},{key:'some-other-key',newValue:JSON.stringify({agents:[],runs:[]})},{key:KEY,newValue:null}]){
    h.fireWindow('storage',event);
    assert.equal(h.t.db().agents.length,1,'a damaged or unrelated storage event wiped the agents in this tab');
  }
  // A schedule another tab has already started must not start here too: the person would pay for the run twice.
  const due=agent({starter:'Go',schedule:{time:'00:00',day:'daily'}}),claim=Date.now();
  h=load({agents:[due],runs:[],draft:null},{provider:true});
  h.storage.set(KEY,JSON.stringify({agents:[{...due,ranAt:claim}],runs:[],draft:null}));
  h.t.tick();await settle();
  assert.equal(JSON.parse(h.storage.get(KEY)).agents[0].ranAt,claim,'this tab overwrote a schedule another tab had already claimed');
  assert.equal(h.t.db().runs.length,0,'a scheduled run another tab already started was started again');

  for(const line of skipped)console.log(line);
  console.log('PASS agents client: Markdown escaping, run trimming, follow-up text, import and stored ids, changes from another tab and claimed schedules passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
