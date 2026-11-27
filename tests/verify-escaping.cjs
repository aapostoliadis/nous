// Checks that object ids, object types and branch ids cannot break out of the markup the workspace views build.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','app','app.js'),'utf8');

const line=pattern=>{const found=source.match(pattern);assert.ok(found,`app.js must keep ${pattern} on one line`);return found[0];};
const names=['node','renderObjectList','renderMapHeading','renderTray','renderInspector','renderBranches','renderEvidence','renderDecisions','renderDocument'];
const code=[line(/^const esc = [^\n]*$/m),line(/^const badge = [^\n]*$/m),...names.map(name=>line(new RegExp(`^function ${name}[(].*$`,'m')))].join('\n');

// A stored workspace is read back without checks, so an id or a type can hold anything.
const bad='x"><img src=x onerror=1>';
const object=(id,type,extra={})=>({id,type,title:'Title',body:'Body',state:'Idea',origin:'You',note:'Note',branch:bad,links:[],...extra});
const objects=[object(bad,'evidence'),object(bad+'2','decision'),object(bad+'3','claim',{links:[bad,'A1'],pos:{x:1,y:2}}),object('A1',bad),object('A2','assumption')];
const state={view:'map',selected:null,branch:bad,goal:'Goal',subtitle:'Subtitle',history:[],objects,branches:[{id:bad,name:'Main',note:'Note',state:'Active'},{id:bad+'2',name:'Other',note:'Note',state:'Archived',parent:bad}]};
const views=new Function('state',`${code}
const mapCore=[],listOrder=[],states=['Idea','Candidate','Decided','Superseded','Rejected'],trayOpen=false;
const current=()=>state.objects,obj=id=>state.objects.find(o=>o.id===id),isRelated=()=>false,renderMapMode=()=>'',plural=(n,word)=>n+' '+word;
return {${names.join(',')}};`)(state);

const pages={node:objects.map(views.node).join(''),inspector:objects.map(views.renderInspector).join('')};
for(const name of names.filter(name=>name.startsWith('render')&&name!=='renderInspector'))pages[name]=views[name]();
objects[2].pos=null;pages.tray=views.renderTray();
for(const [name,html] of Object.entries(pages)){
  assert.ok(html.includes('&quot;&gt;&lt;img'),`${name} must show the unsafe value as text`);
  assert.equal(html.includes('<img'),false,`${name} must not let an id or a type add an element`);
}

// The edit dialog and the two selectors are not reached above, so pin them in the source.
assert.ok(source.includes('<h2>Edit the ${esc(o.type)}.</h2>'),'The edit dialog must escape the object type');
assert.ok(source.includes('[data-view="${CSS.escape(state.view)}"]'),'The view selector must escape the stored view name');
assert.ok(source.includes('.node[data-object="${CSS.escape(id)}"]'),'The placed-object selector must escape the id');
assert.ok(source.includes('class="state ${esc(s.toLowerCase())}"'),'The state badge must escape its class name');
console.log('PASS escaping: ids, types and branch ids stay text in every workspace view');
