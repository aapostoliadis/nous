// Only expose the top-level answer string, never raw JSON or internal reasoning.
function partialAnswer(source){
  let depth=0,keyExpected=false;
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(c==='{'||c==='['){depth++;if(depth===1)keyExpected=true;continue;}
    if(c==='}'||c===']'){depth--;continue;}
    if(c===','&&depth===1){keyExpected=true;continue;}
    if(c!=='"')continue;
    const start=i++;let closed=false;
    for(;i<source.length;i++){if(source[i]==='\\'){i++;continue;}if(source[i]==='"'){closed=true;break;}}
    if(!closed)return '';
    if(depth!==1||!keyExpected)continue;
    keyExpected=false;let key;try{key=JSON.parse(source.slice(start,i+1));}catch{return '';}
    if(key!=='answer')continue;
    const match=/^\s*:\s*"/.exec(source.slice(i+1));if(!match)return '';
    let value='',cursor=i+1+match[0].length;
    for(;cursor<source.length;cursor++){
      const ch=source[cursor];if(ch==='"')break;
      if(ch!=='\\'){value+=ch;continue;}
      const size=source[cursor+1]==='u'?6:2;
      if(cursor+size>source.length)break;
      try{value+=JSON.parse('"'+source.slice(cursor,cursor+size)+'"');}catch{break;}
      cursor+=size-1;
    }
    // A split Unicode surrogate pair is held until the second half arrives.
    return /[\uD800-\uDBFF]$/.test(value)?value.slice(0,-1):value;
  }
  return '';
}
function streamError(message){const e=Error(message);e.status=502;throw e;}
async function readProviderStream(response,mode,onProgress,signal){
  if(!response.body)streamError('The provider returned no response stream. No changes were made.');
  let buffer='',output='',previous='',finished=false,reason='',done=false,total=0,lastUpdate=0;
  const decoder=new TextDecoder();
  function event(block){
    const data=block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
    if(!data)return;
    if(data==='[DONE]'){done=true;return;}
    let e;try{e=JSON.parse(data);}catch{streamError('The response stream was unreadable. Please try again.');}
    if(e.type==='error'||e.error||['response.failed','response.incomplete'].includes(e.type))streamError('The provider interrupted the answer. No changes were made.');
    let delta='';
    if(mode==='responses'){
      if(e.type==='response.output_text.delta')delta=e.delta||'';
      if(e.type==='response.completed')finished=e.response?.status==='completed';
    }else if(mode==='chat'){
      const choice=e.choices?.find(c=>c.index===0);delta=choice?.delta?.content||'';
      if(choice?.finish_reason)reason=choice.finish_reason;
    }else{
      if(e.type==='content_block_delta'&&e.delta?.type==='text_delta')delta=e.delta.text||'';
      if(e.type==='content_block_start'&&e.content_block?.type==='text')delta=e.content_block.text||'';
      if(e.type==='message_delta')reason=e.delta?.stop_reason||reason;
      if(e.type==='message_stop')finished=reason==='end_turn';
    }
    if(typeof delta==='string'&&delta){
      output+=delta;if(output.length>180000)streamError('The response exceeded the supported size. No changes were made.');
      const answer=partialAnswer(output).slice(0,20000);
      if(answer!==previous&&(answer.length-previous.length>=48||Date.now()-lastUpdate>=120)){previous=answer;lastUpdate=Date.now();onProgress(answer);}
    }
  }
  for await(const chunk of response.body){
    signal?.throwIfAborted();total+=chunk.byteLength;if(total>4000000)streamError('The response stream exceeded the supported size.');
    buffer+=decoder.decode(chunk,{stream:true});buffer=buffer.replace(/\r\n/g,'\n');
    let boundary;while((boundary=buffer.indexOf('\n\n'))!==-1){event(buffer.slice(0,boundary));buffer=buffer.slice(boundary+2);}
  }
  buffer+=decoder.decode();if(buffer.trim())event(buffer);
  signal?.throwIfAborted();
  if(mode==='chat')finished=reason==='stop'&&done;
  if(!finished)streamError('The connection ended before the answer was complete. No changes were made. Please retry.');
  return output;
}
module.exports={partialAnswer,readProviderStream};
