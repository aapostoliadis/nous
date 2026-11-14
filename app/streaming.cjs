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
// onProgress receives the partial answer string, or a {step} object naming what the model is doing now.
// Search sources are reported through onSource(url,title) when the provider's web search tool runs.
async function readProviderStream(response,mode,onProgress,signal,onSource=()=>{}){
  if(!response.body)streamError('The provider returned no response stream. No changes were made.');
  let buffer='',output='',previous='',finished=false,reason='',done=false,total=0,parsedAt=0,lastParse=0,searched=false,lastStep='';
  const blocks={},step=s=>{if(s!==lastStep){lastStep=s;onProgress({step:s});}};
  const query=json=>{try{const q=JSON.parse(json||'{}').query;return typeof q==='string'&&q.trim()?q.trim().slice(0,120):'';}catch{return '';}};
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
      if(e.type==='response.web_search_call.in_progress'||e.type==='response.web_search_call.searching')step('Searching the web');
      if(e.type==='response.output_item.done'&&e.item?.type==='web_search_call'&&e.item.action?.query)step(`Searched “${String(e.item.action.query).slice(0,120)}”`);
      if(e.type==='response.output_item.added'&&e.item?.type==='message')step('Writing');
      if(e.type==='response.output_text.annotation.added'&&e.annotation?.type==='url_citation')onSource(e.annotation.url,e.annotation.title);
      if(e.type==='response.completed')finished=e.response?.status==='completed';
    }else if(mode==='chat'){
      const choice=e.choices?.find(c=>c.index===0);delta=choice?.delta?.content||'';
      if(choice?.finish_reason)reason=choice.finish_reason;
    }else{
      if(e.type==='content_block_delta'&&e.delta?.type==='text_delta')delta=e.delta.text||'';
      const b=e.content_block;
      if(e.type==='content_block_start'&&b){
        blocks[e.index]={type:b.type,json:''};
        if(b.type==='server_tool_use'){searched=true;step('Searching the web');}
        if(b.type==='web_search_tool_result'){searched=true;if(Array.isArray(b.content)){b.content.forEach(r=>onSource(r?.url,r?.title));step(`Reading ${b.content.length} source${b.content.length===1?'':'s'}`);}}
        if(b.type==='text'){
          // Text before a search is the model thinking aloud; only what follows the last search is the deliverable.
          if(searched){output='';previous='';parsedAt=0;searched=false;}
          step('Writing');delta=b.text||'';
        }
      }
      if(e.type==='content_block_delta'&&e.delta?.type==='input_json_delta'&&blocks[e.index])blocks[e.index].json+=e.delta.partial_json||'';
      if(e.type==='content_block_stop'&&blocks[e.index]?.type==='server_tool_use'){const q=query(blocks[e.index].json);if(q)step(`Searching “${q}”`);}
      if(e.type==='message_delta')reason=e.delta?.stop_reason||reason;
      if(e.type==='message_stop'){finished=reason==='end_turn';if(reason==='pause_turn')streamError('The web search ran long and the model paused before answering. Try the run again with a narrower request.');}
    }
    if(typeof delta==='string'&&delta){
      output+=delta;if(output.length>180000)streamError('The response exceeded the supported size. No changes were made.');
      // Parse only when enough new text has arrived or enough time has passed. Parsing on every fragment re-reads the whole output each time.
      if(output.length-parsedAt>=48||Date.now()-lastParse>=120){
        parsedAt=output.length;lastParse=Date.now();
        const answer=partialAnswer(output).slice(0,20000);
        if(answer!==previous){previous=answer;onProgress(answer);}
      }
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
