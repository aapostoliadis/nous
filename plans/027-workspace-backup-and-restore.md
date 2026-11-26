# 027. Back up the workspace to a file and restore it

| | |
|---|---|
| Priority | P2 |
| Effort | M |
| Risk | MED |
| Category | feature, tests |
| Depends on | none |
| Written against | `444227e` on 2026-11-26 |

## Why

The whole workspace (goal, constraints, branches, objects, decision history) lives in one `localStorage` entry in one browser. Clearing site data, switching browser or moving to another computer loses it. Agents can already be exported and imported; the workspace cannot. This plan adds a backup file and a restore, both in the Help dialog.

Restore replaces the user's data and reads a file the user picked, so the reader is the risky part. Two facts shape it:

- `app/app.js` writes object ids, object types and branch ids into HTML attributes without escaping. A crafted file could inject markup through them. The reader therefore keeps only ids that match `^[A-Za-z0-9_-]{1,40}$` and types the app already knows.
- Nothing tests `app/app.js` today. This plan adds `tests/verify-workspace.cjs`, which covers the reader and pins the load fallback on line 26.

## What is there now

`app/app.js`, 155 lines. Line 26 loads the workspace and falls back to the starting one:

```js
let state;try{const stored=JSON.parse(localStorage.getItem(key));state=stored?.objects?.length&&stored?.branches?.length?stored:structuredClone(seed)}catch{state=structuredClone(seed)}
```

Lines 143 and 144 hold the download helper and the brief download:

```js
function download(name,text,type){const a=document.createElement('a');const u=URL.createObjectURL(new Blob([text],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function downloadBrief(){download('Nous-pilot-brief.md',briefText(),'text/markdown');toast('The current branch brief was downloaded.')}
```

Line 145 is `function help(){modal(...)}`. It ends:

```
<div class="help-row"><strong>(5) Keep</strong><span>Download the current brief.</span></div><div class="dialog-actions"><button data-cancel class="primary">Start exploring</button></div>`)}
```

`app/index.html` line 3 loads `ux-refinements.css?v=tokens-3` and line 10 loads `app.js?v=heading-1`. `app/ux-refinements.css` is 222 lines and ends with the `overscroll-behavior:contain` rule.

`let state` is a top-level binding shared by every script in `app/` (there is no module system), so assigning a new object to it in `app.js` is seen by `ask.js`, `agents.js` and `map-fullscreen.js`.

The data shape, read from the code on 2026-11-26:

- Workspace: `goal`, `subtitle`, `constraints` (strings), `branch`, `view`, `selected`, `action` (`Proposed`, `Completed`, `Declined`), `branches`, `objects`, `history`. `askResults` and `showAskResult` are added at run time by `app/ask.js` and are not worth keeping.
- Branch: `id`, `name`, `note`, `state` (`Active`, `Exploring`, `Parked`, `Archived`), `parent`.
- Object: `id`, `type` (a key of `typeHints`), `title`, `body`, `note`, `state` (one of `states`), `branch`, `links`, `origin`, and optionally `quote`, `audioId`, `pos` (`{x,y}` numbers).
- History entry: `id`, optional `branch`, `text`, `reason`, `time`.
- The same object id may appear on two branches. Uniqueness and links are per branch.

## Steps

### 1. Start clean

```
git status --short
git switch -c advisor/027-workspace-backup-and-restore
```

**Verify:** `git status --short` prints nothing before the switch. `git log --oneline -1` shows `444227e` or a later commit that did not touch `app/app.js`, `app/index.html` or `app/ux-refinements.css`. If one of them changed, re-read "What is there now" against the file before going on.

### 2. Write the test first

Create `tests/verify-workspace.cjs` with exactly this content. `tests/run.cjs` picks up every `tests/verify-*.cjs`, so nothing else needs registering.

```js
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
```

**Verify:** `node tests/verify-workspace.cjs` fails with `app.js must define readWorkspace(text) on one line`. If it passes, stop: something already defines the function.

### 3. Add backup, reader and restore to `app/app.js`

Insert these five lines directly after line 144 (`function downloadBrief()...`). Keep each function on one line. The test finds `readWorkspace` by that shape, and the file's style is one-line functions.

```js
// A backup holds the workspace only: goal, constraints, branches, objects and decision history. Audio clips, agents and model settings stay in this browser.
function backupWorkspace(){download('Nous-workspace.json',JSON.stringify({nous:'workspace',version:1,exported:new Date().toISOString(),workspace:{...state,askResults:undefined,showAskResult:undefined}},null,2),'application/json');toast('Workspace backup downloaded. Audio clips are not included.')}
// Reads a backup file. Returns null when the text is not a workspace, otherwise the cleaned workspace and how many branches and objects were left out. Ids and types go into HTML attributes unescaped, so anything outside the safe pattern is dropped here.
function readWorkspace(text){let w;try{w=JSON.parse(text)}catch{return null}if(w?.nous==='workspace')w=w.workspace;if(!w||!Array.isArray(w.objects)||!Array.isArray(w.branches))return null;const str=v=>typeof v==='string'?v:'',safe=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,40}$/.test(v),ids=new Set(),branches=[];for(const b of w.branches){if(!b||!safe(b.id)||ids.has(b.id))continue;ids.add(b.id);branches.push({id:b.id,name:str(b.name)||b.id,note:str(b.note),state:['Active','Exploring','Parked','Archived'].includes(b.state)?b.state:'Exploring',parent:b.parent});}for(const b of branches)b.parent=ids.has(b.parent)&&b.parent!==b.id?b.parent:null;const seen=new Set(),objects=[];for(const o of w.objects){if(!o||!safe(o.id)||!Object.hasOwn(typeHints,o.type)||!states.includes(o.state)||!ids.has(o.branch)||seen.has(o.branch+' '+o.id))continue;seen.add(o.branch+' '+o.id);const kept={id:o.id,type:o.type,title:str(o.title)||o.id,body:str(o.body),note:str(o.note),state:o.state,branch:o.branch,links:Array.isArray(o.links)?o.links:[],origin:str(o.origin)};if(typeof o.quote==='string')kept.quote=o.quote;if(typeof o.audioId==='string')kept.audioId=o.audioId;if(Number.isFinite(o.pos?.x)&&Number.isFinite(o.pos?.y))kept.pos={x:o.pos.x,y:o.pos.y};objects.push(kept);}if(!branches.length||!objects.length)return null;for(const o of objects)o.links=o.links.filter(l=>seen.has(o.branch+' '+l));const history=(Array.isArray(w.history)?w.history:[]).filter(h=>h&&safe(h.id)&&(h.branch===undefined||ids.has(h.branch))).map(h=>({id:h.id,...(h.branch===undefined?{}:{branch:h.branch}),text:str(h.text),reason:str(h.reason),time:str(h.time)}));return{workspace:{goal:str(w.goal)||'Untitled workspace',subtitle:str(w.subtitle),constraints:(Array.isArray(w.constraints)?w.constraints:[]).filter(c=>typeof c==='string'),branch:ids.has(w.branch)?w.branch:branches[0].id,view:'map',selected:null,action:['Proposed','Completed','Declined'].includes(w.action)?w.action:'Proposed',branches,objects,history},skipped:w.branches.length-branches.length+w.objects.length-objects.length};}
function restoreWorkspace(file){file.text().then(text=>{const read=readWorkspace(text);if(!read){toast('That file is not a Nous workspace backup. Choose a file made with Back up workspace.');return;}const w=read.workspace;if(!confirm(`Replace this workspace with “${w.goal}” (${w.objects.length} objects, ${w.branches.length} branches)? The workspace open now cannot be recovered unless you backed it up. Agents are not affected.`))return;state=w;save();$('#dialog').close();render();toast(`Workspace restored: ${w.objects.length} objects, ${w.branches.length} branches.${read.skipped?` ${read.skipped} damaged entries were left out.`:''}`)}).catch(()=>toast('That file could not be read. Try choosing it again.'))}
```

Why each choice:

- The file is labelled (`nous:'workspace'`, `version:1`) so a later format change can tell old files apart. The reader also accepts a bare workspace object.
- The reader builds new objects field by field. It never keeps the parsed object, so unknown fields cannot ride along.
- A file with no usable branch or no usable object is refused. Line 26 would discard such a workspace on the next load anyway.
- Restore asks with `confirm(...)`, the same way the Agents "wipe" action does.

**Verify:** `node --check app/app.js` prints nothing.

### 4. Put the two buttons in the Help dialog

In `function help()` (now line 150), replace the ending quoted under "What is there now" with:

```
<div class="help-row"><strong>(5) Keep</strong><span>Download the current brief, or back up the whole workspace to a file and restore it later, here or in another browser.</span></div><div class="workspace-backup"><button type="button" class="subtle-button" id="workspace-backup">Back up workspace</button><button type="button" class="subtle-button" id="workspace-restore">Restore from file</button><input type="file" id="workspace-import" accept="application/json,.json" hidden aria-label="Workspace file to restore"></div><div class="dialog-actions"><button data-cancel class="primary">Start exploring</button></div>`);$('#workspace-backup').onclick=backupWorkspace;$('#workspace-restore').onclick=()=>$('#workspace-import').click();$('#workspace-import').onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)restoreWorkspace(file)}}
```

The input is cleared before the file is read so that choosing the same file twice still fires `change`.

Append one line to `app/ux-refinements.css`. `.dialog-actions` does not wrap and `.subtle-button` is `white-space:nowrap`, so the two buttons need a row of their own that wraps on a narrow screen:

```css
.workspace-backup{display:flex;flex-wrap:wrap;gap:12px;margin-top:16px}
```

In `app/index.html`, change `ux-refinements.css?v=tokens-3` to `ux-refinements.css?v=backup-1` and `app.js?v=heading-1` to `app.js?v=backup-1`, so returning visitors get the new files.

**Verify:** `node tests/verify-workspace.cjs` prints `PASS workspace: a backup restores unchanged and damaged files are cleaned or refused`. `npm test` ends with `All test files and syntax checks passed.`

### 5. Check it in a browser

Start the server (`npm start`, http://localhost:4179) and open the app. Do not connect a model; none is needed.

1. Open Help. Both buttons show, in the site's button style, with a visible focus ring when reached by Tab.
2. Set the viewport to 320px wide. The two buttons wrap and nothing is clipped or scrolls sideways.
3. Add an object with a title you will recognise, then choose "Back up workspace". A file named `Nous-workspace.json` downloads and a toast says so.
4. Delete that object. Open Help, choose "Restore from file", pick the downloaded file. A confirmation names the workspace with its object and branch counts. Cancel: nothing changes.
5. Repeat and accept. The dialog closes, the object is back, the toast gives the counts and the status reads "Saved on this device". Reload: the object is still there.
6. Choose a file that is not a backup (any other `.json`). A toast says it is not a Nous workspace backup and the workspace is unchanged.

**Verify:** all six hold. If you cannot open a browser, say so in your report. Do not mark this step as done.

### 6. Commit

```
git add app/app.js app/index.html app/ux-refinements.css tests/verify-workspace.cjs
git commit -m "Back up the workspace to a file and restore it"
```

**Verify:** `git status --short` prints nothing.

## Done criteria

- [ ] `git diff --numstat main` lists exactly four files: `app/app.js` (6 added, 1 removed), `app/index.html` (2 added, 2 removed), `app/ux-refinements.css` (1 added), `tests/verify-workspace.cjs` (new).
- [ ] `node tests/verify-workspace.cjs` failed before step 3 and passes after step 4.
- [ ] `npm test` ends with `All test files and syntax checks passed.`
- [ ] Step 5 was done in a browser, or the report says plainly that it was not.
- [ ] One commit on branch `advisor/027-workspace-backup-and-restore`. Do not push or open a PR unless you were told to.

## Out of scope

- Audio clips. They are stored apart from the workspace and only their `audioId` is in the backup. A restored object in another browser keeps its text and loses its recording. The backup toast says so.
- Agents, schedules, model choices, theme and the Map/List preference. Agents has its own export.
- Merging a backup into the open workspace. Restore replaces.
- Automatic or cloud backup.
- Escaping ids and types where `app/app.js` writes them into attributes. The reader makes unsafe values impossible to import; the rendering code is left as it is.
- A top bar button. The top bar is already tight at 280px.

## If something is off

- **The test cannot find `seed`, `states` or `typeHints`.** It reads them from `app/app.js` by pattern (`const seed = {` … a line that is exactly `};`, `const states = [...]`, `const typeHints={...}`). If one was reformatted, fix the pattern in the test. Do not reformat `app.js`.
- **The round-trip assertion fails on a field.** The starting workspace gained a field the reader does not copy. Add the field to the reader, with a type check, and to the list under "What is there now".
- **A backup with no `main` branch.** It loads, and the first branch in the file becomes current. That is intended.
- **Restore succeeds but the status reads "Session only · storage unavailable".** Storage is blocked or full. The workspace is restored for this tab only. This is `save()`'s existing behaviour.
- **The buttons look unstyled.** `.subtle-button` comes from `app/kit-theme.css`. Check the class name. Do not add new button styles.

## Maintenance notes

- A new workspace, branch, object or history field must be added to `readWorkspace` or a restore will silently drop it. The round-trip test catches this only if the starting workspace uses the field.
- A new object type added to `typeHints` or a new state added to `states` is accepted automatically. A new branch state or action value is not: both lists are written out inside `readWorkspace`.
- If the format changes, raise `version` in `backupWorkspace` and branch on it at the top of `readWorkspace`. Keep reading version 1.
