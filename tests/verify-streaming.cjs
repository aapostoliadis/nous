const assert=require('node:assert/strict');
const {ask}=require('../app/providers.cjs');
const {partialAnswer,readProviderStream}=require('../app/streaming.cjs');
process.env.OPENAI_API_KEY='stream-fixture';process.env.ANTHROPIC_API_KEY='stream-fixture';
const value={title:'Test',answer:'First paragraph.\n\nSecond paragraph with "quotes", a slash \\ and Greek Ελληνικά.',references:[],objects:[]};
const output=JSON.stringify(value);
const sse=e=>'data: '+(typeof e==='string'?e:JSON.stringify(e))+'\r\n\r\n';
function frames(mode,text=output,complete=true){
 const chunks=[text.slice(0,45),text.slice(45,90),text.slice(90)];
 const events=chunks.map(delta=>mode==='responses'?{type:'response.output_text.delta',delta}:mode==='chat'?{choices:[{index:0,delta:{content:delta}}]}:{type:'content_block_delta',delta:{type:'text_delta',text:delta}});
 if(complete)events.push(...(mode==='responses'?[{type:'response.completed',response:{status:'completed'}}]:mode==='chat'?[{choices:[{index:0,delta:{},finish_reason:'stop'}]},'[DONE]']:[{type:'message_delta',delta:{stop_reason:'end_turn'}},{type:'message_stop'}]));
 return events.map(sse).join('');
}
function response(text){const bytes=Buffer.from(text);return {ok:true,body:(async function*(){for(let i=0;i<bytes.length;i+=7)yield bytes.subarray(i,i+7)})()};}
(async()=>{
 for(let i=0;i<=output.length;i++){const answer=partialAnswer(output.slice(0,i));assert.ok(value.answer.startsWith(answer));}
 assert.equal(partialAnswer(JSON.stringify({objects:[{answer:'wrong'}],answer:'right'})),'right');
 assert.equal(partialAnswer('{"answer":"\\uD83D'),'');assert.equal(partialAnswer('{"answer":"\\uD83D\\uDE00"}'),'😀');
 for(const [provider,model,mode] of [['openai','gpt-4.1-mini','responses'],['openai','gpt-3.5-turbo','chat'],['anthropic','claude-test','messages']]){
  const previews=[];let requested=false;
  const fake=async(url,opts)=>{
   if(!opts.method)return {ok:true,json:async()=>({data:[{id:'gpt-4.1-mini'},{id:'gpt-3.5-turbo'},{id:'claude-test'}]})};
   requested=JSON.parse(opts.body).stream===true;return response(frames(mode));
  };
  const result=await ask({provider,model,prompt:'Test',workspace:{goal:'Test',constraints:[],objects:[]}},fake,undefined,a=>previews.push(a));
  assert.ok(requested);assert.equal(result.answer,value.answer);assert.ok(previews.some(a=>typeof a==='string'&&a.length>0&&a.length<value.answer.length));
  await assert.rejects(()=>readProviderStream(response(frames(mode,output,false)),mode,()=>{}),/before the answer was complete/);
 }
 await assert.rejects(()=>readProviderStream(response(sse({type:'error'})),'messages',()=>{}),/interrupted/);
 const aborted=new AbortController();aborted.abort();await assert.rejects(()=>readProviderStream(response(frames('responses')),'responses',()=>{},aborted.signal),{name:'AbortError'});
 const invalid=JSON.stringify({...value,references:['invented']});
 await assert.rejects(()=>ask({provider:'openai',model:'gpt-4.1-mini',prompt:'Test',workspace:{goal:'Test',constraints:[],objects:[]}},async()=>response(frames('responses',invalid)),undefined,()=>{}),/unknown workspace reference/);
 // Web search: step events, sources, and text written before the search is dropped from the answer.
 const steps=[],found=[];
 const web=[{type:'content_block_start',index:0,content_block:{type:'text',text:'Let me look that up.'}},{type:'content_block_stop',index:0},
  {type:'content_block_start',index:1,content_block:{type:'server_tool_use',id:'s1',name:'web_search',input:{}}},
  {type:'content_block_delta',index:1,delta:{type:'input_json_delta',partial_json:'{"query":"nous '}},{type:'content_block_delta',index:1,delta:{type:'input_json_delta',partial_json:'news"}'}},{type:'content_block_stop',index:1},
  {type:'content_block_start',index:2,content_block:{type:'web_search_tool_result',tool_use_id:'s1',content:[{type:'web_search_result',url:'https://a.example/x',title:'A'},{type:'web_search_result',url:'https://b.example/y',title:'B'}]}},{type:'content_block_stop',index:2},
  {type:'content_block_start',index:3,content_block:{type:'text',text:''}},{type:'content_block_delta',index:3,delta:{type:'text_delta',text:output}},{type:'content_block_stop',index:3},
  {type:'message_delta',delta:{stop_reason:'end_turn'}},{type:'message_stop'}];
 const webOut=await readProviderStream(response(web.map(sse).join('')),'messages',p=>{if(typeof p==='object')steps.push(p.step);},undefined,(url,title)=>found.push(url));
 assert.equal(webOut,output);
 assert.deepEqual(steps,['Writing','Searching the web','Searching “nous news”','Reading 2 sources','Writing']);
 assert.deepEqual(found,['https://a.example/x','https://b.example/y']);
 await assert.rejects(()=>readProviderStream(response([{type:'message_delta',delta:{stop_reason:'pause_turn'}},{type:'message_stop'}].map(sse).join('')),'messages',()=>{}),/search ran long/);
 const oSteps=[];
 await readProviderStream(response([{type:'response.web_search_call.searching'},{type:'response.output_item.done',item:{type:'web_search_call',action:{query:'q'}}},{type:'response.output_item.added',item:{type:'message'}},{type:'response.output_text.delta',delta:output},{type:'response.completed',response:{status:'completed'}}].map(sse).join('')),'responses',p=>{if(typeof p==='object')oSteps.push(p.step);});
 assert.deepEqual(oSteps,['Searching the web','Searched “q”','Writing']);
 // A long answer arriving one character at a time must not be re-parsed from the start for every character.
 {
  const long=JSON.stringify({title:'T',answer:'word '.repeat(12000),references:[],objects:[]});
  let text='';for(const ch of long)text+='data: '+JSON.stringify({type:'response.output_text.delta',delta:ch})+'\n\n';
  text+='data: '+JSON.stringify({type:'response.completed',response:{status:'completed'}})+'\n\n';
  const bytes=Buffer.from(text);
  const body=(async function*(){for(let i=0;i<bytes.length;i+=65536)yield bytes.subarray(i,i+65536);})();
  let calls=0,last='';const started=Date.now();
  const result=await readProviderStream({body},'responses',p=>{if(typeof p==='string'){calls++;last=p;}});
  const took=Date.now()-started;
  assert(calls>10,'Progress must still be reported while streaming');
  assert(last.startsWith('word word'),'Progress must carry the answer text');
  assert(took<3000,`A 60,000-character answer in 1-character fragments took ${took} ms; the partial answer is being re-parsed too often`);
  assert(result);
 }
 console.log('PASS streaming web search: step events, sources, pre-search text dropped, paused searches.');
 console.log('PASS streaming: all three provider adapters, partial text before completion, split UTF-8/SSE/JSON escapes, top-level answer only, cancellation, interrupted streams and final validation. No provider calls.');
})().catch(e=>{console.error(e);process.exitCode=1});
