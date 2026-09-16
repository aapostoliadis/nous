const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('app/connections.js','utf8');
const tick=()=>new Promise(r=>setImmediate(r));
async function fixture(){
 const elements=new Map();const element=id=>elements.get(id)||elements.set(id,{value:'',dataset:{},textContent:'',hidden:false,disabled:false,setAttribute(){},scrollIntoView(){},focus(){}}).get(id);
 let resolveAsk, rejectAsk;const pending=new Promise((r,j)=>{resolveAsk=r;rejectAsk=j});
 const state={goal:'Test',constraints:[],branch:'main',objects:[{id:'Q01',branch:'main',type:'question',title:'Timing?',body:'Needs research',links:[]}],selected:null};
 const results=[];const context={state,render(){},window:{submitAsk(){results.push('local')},addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},document:{querySelector:element},AbortController,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,innerWidth:1200,current:()=>state.objects.filter(o=>o.branch===state.branch),finishAsk:(query,result)=>results.push(result),toast:msg=>results.push(msg),esc:x=>x,modal(){},fetch:async(url,opts)=>{
  if(url.startsWith('/api/models'))return {ok:true,json:async()=>({defaultModel:'test-model',models:[{id:'test-model',name:'Test model'}]})};
  if(url==='/api/providers')return {ok:true,json:async()=>({providers:[{id:'openai',label:'OpenAI',configured:true,model:'test-model'},{id:'anthropic',label:'Claude',configured:false,model:'test-model'}]})};
  opts.signal.addEventListener('abort',()=>rejectAsk(Object.assign(new Error('cancelled'),{name:'AbortError'})));return pending;
 }};
 vm.runInNewContext(source,context);await tick();element('#command').value='Propose a question';
 return {context,state,results,element,resolve:()=>resolveAsk({ok:true,json:async()=>({title:'Answer',answer:'Draft answer',references:['Q01'],objects:[{type:'decision',title:'Test timing',body:'Try a weekend.',links:['Q01']}],providerLabel:'OpenAI',model:'test-model',time:new Date().toISOString()})})};
}
(async()=>{
 let f=await fixture();let run=f.context.window.submitAsk();assert.equal(f.element('#command-form button[type=submit]').disabled,true);f.resolve();await run;assert.equal(f.state.objects.length,3);assert.equal(f.state.objects[1].state,'Candidate');assert.equal(f.state.objects[1].origin.includes('OpenAI'),true);assert.equal(f.element('#command').value,'');assert.equal(f.results[0].kind,'changed');
 f=await fixture();run=f.context.window.submitAsk();f.state.objects[0].body='Edited during request';f.resolve();await run;assert.equal(f.state.objects.length,1);assert.equal(f.results[0].kind,'error');assert.equal(f.element('#command').value,'Propose a question');
 f=await fixture();run=f.context.window.submitAsk();f.state.branch='elsewhere';f.resolve();await run;assert.equal(f.state.objects.length,1);assert.equal(typeof f.results[0],'string');
 f=await fixture();run=f.context.window.submitAsk();f.element('#cancel-ask').onclick();await run;assert.equal(f.state.objects.length,1);assert.equal(f.results[0].kind,'error');assert.equal(f.element('#command-form button[type=submit]').disabled,false);
 f=await fixture();f.element('#ai-provider').value='anthropic';await f.context.window.submitAsk();assert.equal(f.results[0].title,'Connect this provider first.');
 f=await fixture();f.element('#ai-provider').value='local';await f.context.window.submitAsk();assert.equal(f.results[0],'local');
 console.log('PASS frontend request lifecycle: objects, candidate decisions, provenance, retained input, stale edits, branch switch, cancellation, missing keys, local mode.');
})().catch(e=>{console.error(e);process.exitCode=1});
