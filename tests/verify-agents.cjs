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
  await assert.rejects(()=>run({...base,agent,request:'x',context:{goal:'g',objects:Array(201).fill({})}},fake({})),/too large/);
  await assert.rejects(()=>run({...base,agent,request:'x'},fake({title:'t',answer:' ',highlights:[],nextSteps:[]})),{status:502});
  console.log('PASS agents: design questions and identity, run with workspace context, validation and unusable model output');
})().catch(e=>{console.error(e);process.exit(1);});
