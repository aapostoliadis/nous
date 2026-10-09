const assert=require('node:assert/strict');
const {listModels,ask,modelMode,status,audioRequest}=require('../app/providers.cjs');
const workspace={goal:'Test',constraints:[],objects:[]};
const output={title:'Answer',answer:'Test response',references:[],objects:[]};
(async()=>{
for(const id of ['gpt-image-2','text-embedding-3-small','o4-mini-deep-research','gpt-4o-search-preview'])assert.equal(modelMode('openai',id),null);
assert.equal(modelMode('openai','gpt-6-astra'),'responses');assert.equal(modelMode('openai','gpt-3.5-turbo'),'chat');assert.equal(modelMode('openai','gpt-5.3-chat-latest'),'chat');
process.env.OPENAI_API_KEY='test-model-discovery-only';process.env.ANTHROPIC_API_KEY='test-claude-discovery-only';
let urls=[],posted,headers;
const fake=async(url,opts)=>{
urls.push(url);headers=opts.headers;
if(!opts.method){return {ok:true,json:async()=>url.includes('openai')?{data:[{id:'gpt-4.1-mini'},{id:'gpt-6-astra'},{id:'gpt-3.5-turbo'},{id:'gpt-image-2'}]}:url.includes('after_id=')?{data:[{id:'claude-second',display_name:'Second',capabilities:{structured_outputs:{supported:false}}}],has_more:false}:{data:[{id:'claude-first',display_name:'First',capabilities:{structured_outputs:{supported:true}}}],has_more:true,last_id:'claude-first'}};}
posted=JSON.parse(opts.body);
return {ok:true,json:async()=>url.includes('anthropic')?{stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(output)}]}:url.includes('chat/completions')?{choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}]}:{status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}]}};
};
const openai=await listModels('openai',{force:true,fetchImpl:fake});assert.equal(openai.models.length,3);assert.equal(openai.excluded,1);
const claude=await listModels('anthropic',{force:true,fetchImpl:fake});assert.equal(claude.models.length,2);assert.ok(urls.some(u=>u.includes('after_id=claude-first')));
for(const [provider,model] of [['openai','gpt-6-astra'],['openai','gpt-3.5-turbo'],['anthropic','claude-first'],['anthropic','claude-second']]){
const result=await ask({provider,model,prompt:'Test',workspace},fake);assert.equal(posted.model,model);assert.equal(result.model,model);
if(model==='gpt-3.5-turbo')assert.ok(posted.messages[0].content.includes('schema'));
if(model==='claude-first')assert.ok(posted.output_config);if(model==='claude-second')assert.ok(!posted.output_config);
}
await assert.rejects(()=>ask({provider:'openai',model:'not-available',prompt:'Test',workspace},fake),/not in your available/);
// Bring your own key: a request key replaces the env key, and hosted deployments never fall back to env keys.
const userKey='sk-user-supplied-key-0123456789';
await ask({provider:'openai',model:'gpt-6-astra',prompt:'Test',workspace,key:userKey},fake);assert.equal(headers.Authorization,'Bearer '+userKey);
await ask({provider:'anthropic',model:'claude-first',prompt:'Test',workspace,key:userKey},fake);assert.equal(headers['x-api-key'],userKey);
for(const bad of ['short','x'.repeat(501),'sk-has a space-0123456789',42])await assert.rejects(()=>listModels('openai',{fetchImpl:fake,key:bad}),e=>e.status===400,String(bad));
process.env.VERCEL='1';
try{
  assert.ok(status().every(p=>!p.configured),'Hosted status must not report env keys as connected');
  const before=urls.length;
  await assert.rejects(()=>listModels('openai',{force:true,fetchImpl:fake}),e=>e.status===401&&/Connections/.test(e.message));
  await assert.rejects(()=>ask({provider:'anthropic',model:'claude-first',prompt:'Test',workspace},fake),e=>e.status===401);
  await assert.rejects(()=>audioRequest({model:'gpt-4o-mini-transcribe'},fake),e=>e.status===401);
  assert.equal(urls.length,before,'No provider call may use the deployment key');
  await ask({provider:'openai',model:'gpt-6-astra',prompt:'Test',workspace,key:userKey},fake);assert.equal(headers.Authorization,'Bearer '+userKey);
}finally{delete process.env.VERCEL;}
console.log('PASS live catalogue adapters: pagination, filtering, model validation, selected-model routing, legacy Chat Completions, Claude capability handling and bring-your-own keys.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
