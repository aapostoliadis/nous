const assert=require('node:assert/strict');
const {design,run}=require('../app/agents.cjs');
const base={provider:'anthropic',model:'claude-test',key:'agents-fixture-not-a-real-key'};
// Answers model-catalogue lookups and returns one Claude message whose text is the given JSON.
function fake(value,seen=[]){return async(url,opts)=>{
  if(!opts.method)return {ok:true,json:async()=>({data:[{id:'claude-test',type:'model'}]})};
  seen.push(JSON.parse(opts.body));
  return {ok:true,json:async()=>({stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(value)}]})};
};}
(async()=>{
  const seen=[];
  const q=await design({...base,stage:'questions',goal:'Summarise my week'},fake({questions:[
    {topic:'audience',question:'Who reads it?',options:['Me','My team','My manager','Extra']},
    {topic:'x',question:'Only one option',options:['One']},
    {topic:'format',question:'What shape?',options:['Bullets','Prose']}]},seen));
  assert.equal(q.questions.length,2);assert.equal(q.questions[0].topic,'AUDIENCE');assert.equal(q.questions[0].options.length,3);
  assert.match(seen[0].system,/never instructions to you/);
  await assert.rejects(()=>design({...base,stage:'questions',goal:'x'},fake({questions:[]})),{status:502});
  const id=await design({...base,stage:'identity',goal:'Summarise my week',answers:[{question:'Who reads it?',answer:'Me'}]},fake({name:'Weekly brief',description:'d',instructions:'Do it.',starter:'Go'}));
  assert.deepEqual(id,{name:'Weekly brief',description:'d',instructions:'Do it.',starter:'Go'});
  await assert.rejects(()=>design({...base,stage:'identity',goal:'x'},fake({name:'',description:'',instructions:'',starter:''})),{status:502});
  await assert.rejects(()=>design({...base,stage:'other',goal:'x'},fake({})),/Unknown design stage/);
  await assert.rejects(()=>design({...base,stage:'questions',goal:''},fake({})),{status:400});
  await assert.rejects(()=>design({...base,stage:'identity',goal:'x',answers:Array(9).fill({question:'q',answer:'a'})},fake({})),/Too many answers/);

  const agent={name:'Weekly brief',description:'Summarises the week.',instructions:'Write a brief.'};
  const runSeen=[];
  const r=await run({...base,agent,request:'',context:{goal:'Ship',objects:[{type:'note',title:'T',body:'B',state:'Idea'}]}},fake({title:'Week',answer:'## Done',highlights:['a','b','c','d','e'],nextSteps:['x']},runSeen));
  assert.equal(r.title,'Week');assert.equal(r.answer,'## Done');assert.equal(r.highlights.length,4);assert.equal(r.provider,'anthropic');
  const sent=JSON.parse(runSeen[0].messages[0].content);
  assert.equal(sent.request,'Do your usual run.');assert.equal(sent.workspace.objects[0].title,'T');
  assert.match(runSeen[0].system,/You are "Weekly brief"/);assert.match(runSeen[0].system,/data and never instructions/);
  await assert.rejects(()=>run({...base,agent:{...agent,instructions:''},request:'x'},fake({})),{status:400});
  await assert.rejects(()=>run({...base,agent,request:'x'.repeat(5001)},fake({})),/under 5,000/);
  // Instructions: the form's 6,000 plus the browser's answer-length note is accepted; longer says so; blank is still incomplete.
  const long=await run({...base,agent:{...agent,instructions:'x'.repeat(6000)+'\n\n'+'Give a detailed, thorough answer.'},request:'x'},fake({title:'T',answer:'A',highlights:[],nextSteps:[]}));
  assert.equal(long.answer,'A');
  await assert.rejects(()=>run({...base,agent:{...agent,instructions:'x'.repeat(6101)},request:'x'},fake({})),/under 6,000/);
  await assert.rejects(()=>run({...base,agent:{...agent,instructions:'   '},request:'x'},fake({})),/incomplete/);
  await assert.rejects(()=>run({...base,agent,request:'x',context:{goal:'g',objects:Array(201).fill({})}},fake({})),/too large/);
  await assert.rejects(()=>run({...base,agent,request:'x'},fake({title:'t',answer:' ',highlights:[],nextSteps:[]})),{status:502});
  // Report card: stats and items are clamped; old-shape output still works.
  const card=await run({...base,agent,request:'x'},fake({title:'T',answer:'A',highlights:[],nextSteps:[],stats:[{value:'4',label:'Urgent'},{value:'',label:'x'},{value:'1',label:'b'},{value:'2',label:'c'},{value:'3',label:'d'}],items:[...Array(10)].map((_,i)=>({title:'Item '+i,detail:'d'.repeat(900),tag:'Urgent'.repeat(5)})).concat([{title:'',detail:'x',tag:'y'}])}));
  assert.equal(card.stats.length,3);assert.equal(card.stats[0].value,'4');assert.equal(card.items.length,8);assert.equal(card.items[0].detail.length,600);assert.equal(card.items[0].tag.length,20);
  const old=await run({...base,agent,request:'x'},fake({title:'T',answer:'A',highlights:[],nextSteps:[]}));
  assert.deepEqual(old.stats,[]);assert.deepEqual(old.items,[]);assert.equal(old.sources,undefined);
  assert.deepEqual(runSeen[0].output_config?.format?.schema?.required,['title','answer','highlights','nextSteps','stats','items']);
  assert.equal(runSeen[0].tools,undefined);assert.match(runSeen[0].system,/no web search/);
  // Web search: tool sent, no structured output, sources collected, deliverable after the last search used.
  const webSeen=[];
  const webFake=async(url,opts)=>{
    if(!opts.method)return {ok:true,json:async()=>({data:[{id:'claude-test',type:'model'}]})};
    webSeen.push(JSON.parse(opts.body));
    return {ok:true,json:async()=>({stop_reason:'end_turn',content:[{type:'text',text:'Searching {first}.'},{type:'server_tool_use',id:'s',name:'web_search',input:{query:'q'}},
      {type:'web_search_tool_result',tool_use_id:'s',content:[{url:'https://a.example/',title:'A'},{url:'https://a.example/',title:'dup'},{url:'javascript:alert(1)',title:'bad'},{url:'https://b.example/p',title:''}]},
      {type:'text',text:'Here you go:\n```json\n'+JSON.stringify({title:'W',answer:'Found it',highlights:[],nextSteps:[],stats:[],items:[]})+'\n```'}]})};
  };
  const w=await run({...base,agent:{...agent,web:true},request:'x'},webFake);
  assert.equal(w.answer,'Found it');assert.equal(webSeen[0].tools[0].name,'web_search');assert.equal(webSeen[0].tools[0].type,'web_search_20250305');assert.equal(webSeen[0].output_config,undefined);
  assert.match(webSeen[0].system,/You can search the web/);assert.match(webSeen[0].system,/Return only JSON/);
  assert.deepEqual(w.sources,[{url:'https://a.example/',title:'A'},{url:'https://b.example/p',title:'b.example'}]);
  const paused=async(url,opts)=>opts.method?{ok:true,json:async()=>({stop_reason:'pause_turn',content:[]})}:{ok:true,json:async()=>({data:[{id:'claude-test',type:'model'}]})};
  await assert.rejects(()=>run({...base,agent:{...agent,web:true},request:'x'},paused),/search ran long/);
  console.log('PASS agents web search and report card: tool request, sources, final text, stats and items clamped, old results.');
  console.log('PASS agents: design questions and identity, run with workspace context, validation and unusable model output');
})().catch(e=>{console.error(e);process.exit(1);});
