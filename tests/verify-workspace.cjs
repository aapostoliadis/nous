// Checks that a workspace backup file is read safely: a good file comes back whole, a damaged one loses only its damaged entries, and anything else is refused.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','app','app.js'),'utf8');

const found=source.match(/function readWorkspace\(text\)\{[^\n]*\}/);
assert.ok(found,'app.js must define readWorkspace(text) on one line');
const states=new Function('return '+source.match(/const states = (\[[^\n]*\]);/)[1])();
const typeHints=new Function('return '+source.match(/const typeHints=(\{[^\n]*\})/)[1])();
const seed=new Function(source.match(/const seed = \{[\s\S]*?\n\};/)[0]+';return seed;')();
const readWorkspace=new Function('states','typeHints',found[0]+';return readWorkspace;')(states,typeHints);
const read=value=>readWorkspace(JSON.stringify(value));
const copy=()=>structuredClone(seed);

// The starting workspace is the reference: a backup of it must come back unchanged.
const whole=read({nous:'workspace',version:1,exported:'2026-11-26T00:00:00.000Z',workspace:seed});
assert.deepEqual(whole.workspace,seed,'A backup of the starting workspace must restore unchanged');
assert.equal(whole.skipped,0,'Nothing in the starting workspace may be left out');
assert.deepEqual(read(seed).workspace,seed,'A bare workspace, without the backup wrapper, must also load');

// Files that are not a workspace are refused, so the open workspace is never replaced by an empty one.
assert.equal(readWorkspace('not json'),null,'Text that is not JSON must be refused');
assert.equal(read(null),null,'null must be refused');
assert.equal(read([1,2]),null,'A list must be refused');
assert.equal(read({agents:[]}),null,'Another kind of Nous file must be refused');
assert.equal(read({...copy(),objects:[]}),null,'A workspace with no objects must be refused');
assert.equal(read({...copy(),branches:[]}),null,'A workspace with no branches must be refused');
assert.equal(read({...copy(),objects:'x'}),null,'Objects must be a list');

// Ids and types are written into HTML attributes unescaped, so unsafe ones never get in.
const first=seed.objects[0];
let w=copy();w.objects.push({...first,id:'"><img src=x onerror=alert(1)>'},{...first,id:'ok-1',type:'script'},{...first,id:'ok-2',state:'Unknown'},{...first,id:'ok-3',branch:'nowhere'},null,{...first});
let r=read(w);
assert.deepEqual(r.workspace.objects,seed.objects,'Objects with an unsafe id, unknown type, unknown state, unknown branch or a repeated id must be left out');
assert.equal(r.skipped,6,'Every object left out must be counted');
w=copy();w.branches.push({id:'a b',name:'Bad id'},{id:'main',name:'Repeat'},{id:'fresh',state:'Odd',parent:'gone'});
r=read(w);
assert.deepEqual(r.workspace.branches.map(b=>b.id),[...seed.branches.map(b=>b.id),'fresh'],'Branches with an unsafe or repeated id must be left out');
assert.deepEqual(r.workspace.branches.at(-1),{id:'fresh',name:'fresh',note:'',state:'Exploring',parent:null},'A kept branch gets a name, a known state and a parent that exists');
assert.equal(r.skipped,2,'Every branch left out must be counted');

// The same object id may live on two branches. That is how a branch copies its parent.
w=copy();w.objects.push({...first,branch:'digital',links:[first.id,'missing']});
r=read(w);
assert.equal(r.workspace.objects.filter(o=>o.id===first.id).length,seed.objects.filter(o=>o.id===first.id).length+1,'The same id on another branch must be kept');
assert.equal(r.workspace.objects.at(-1).links.includes('missing'),false,'A link to an object that is not on the same branch must be dropped');

// Fields are kept as plain text and nothing unknown comes along.
w=copy();w.branch='gone';w.view='<b>';w.selected='x';w.action='Odd';w.goal=5;w.constraints=['keep',7];w.askResults=[{html:'<script>'}];w.showAskResult=true;w.extra=1;
w.objects[0]={...first,title:'<b>Bold</b>',body:9,pos:{x:'10',y:20},audioId:4,quote:'said',extra:1};w.objects[1]={...w.objects[1],pos:{x:12.5,y:340}};
r=read(w).workspace;
assert.deepEqual(Object.keys(r).sort(),Object.keys(seed).sort(),'Only known workspace fields may be restored');
assert.equal(r.branch,seed.branches[0].id,'An unknown current branch falls back to the first branch');
assert.deepEqual([r.view,r.selected,r.action,r.goal,r.constraints],['map',null,'Proposed','Untitled workspace',['keep']],'View, selection, action, goal and constraints fall back to safe values');
assert.equal(r.objects[0].title,'<b>Bold</b>','Titles are kept as written. The app escapes them when it shows them');
assert.deepEqual([r.objects[0].body,r.objects[0].pos,r.objects[0].audioId,r.objects[0].quote,r.objects[0].extra],['',undefined,undefined,'said',undefined],'Wrong kinds of value are dropped');
assert.deepEqual(r.objects[1].pos,{x:12.5,y:340},'A numeric map position is kept');
w=copy();w.history=[{id:'h9',branch:'digital',text:'Kept',reason:'r',time:'now'},{id:'h8',branch:'gone',text:'Dropped'},'x'];
assert.deepEqual(read(w).workspace.history,[{id:'h9',branch:'digital',text:'Kept',reason:'r',time:'now'}],'History for a branch that does not exist is dropped');

// The parts around the reader: what is written, how it is chosen, and that a restore asks first.
assert.ok(source.includes("download('Nous-workspace.json',JSON.stringify({nous:'workspace',version:1,"),'The backup must be a labelled, versioned file');
assert.ok(source.includes('askResults:undefined,showAskResult:undefined'),'Answers from Ask are not part of a backup');
assert.ok(source.includes('<input type="file" id="workspace-import" accept="application/json,.json" hidden aria-label="Workspace file to restore">'),'The Help dialog must hold the file input');
assert.ok(/function restoreWorkspace\(file\)\{[^\n]*if\(!read\)\{toast\([^\n]*if\(!confirm\([^\n]*state=w;save\(\);/.test(source),'A restore must refuse a bad file, then ask, then replace and save');
assert.ok(source.includes("state=stored?.objects?.length&&stored?.branches?.length?stored:structuredClone(seed)"),'Loading must still fall back to the starting workspace');
console.log('PASS workspace: a backup restores unchanged and damaged files are cleaned or refused');
