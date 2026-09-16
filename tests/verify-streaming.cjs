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
  assert.ok(requested);assert.equal(result.answer,value.answer);assert.ok(previews.some(a=>a.length>0&&a.length<value.answer.length));
  await assert.rejects(()=>readProviderStream(response(frames(mode,output,false)),mode,()=>{}),/before the answer was complete/);
 }
 await assert.rejects(()=>readProviderStream(response(sse({type:'error'})),'messages',()=>{}),/interrupted/);
 const aborted=new AbortController();aborted.abort();await assert.rejects(()=>readProviderStream(response(frames('responses')),'responses',()=>{},aborted.signal),{name:'AbortError'});
 const invalid=JSON.stringify({...value,references:['invented']});
 await assert.rejects(()=>ask({provider:'openai',model:'gpt-4.1-mini',prompt:'Test',workspace:{goal:'Test',constraints:[],objects:[]}},async()=>response(frames('responses',invalid)),undefined,()=>{}),/unknown workspace reference/);
 console.log('PASS streaming: all three provider adapters, partial text before completion, split UTF-8/SSE/JSON escapes, top-level answer only, cancellation, interrupted streams and final validation. No provider calls.');
})().catch(e=>{console.error(e);process.exitCode=1});
