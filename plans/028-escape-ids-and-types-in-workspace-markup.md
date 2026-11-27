# 028. Escape ids and types in the workspace markup

| | |
|---|---|
| Priority | P2 |
| Effort | S |
| Risk | LOW |
| Category | security |
| Depends on | none |
| Written against | `f559008` on 2026-11-27 |

## Why

`app/app.js` builds every workspace view as an HTML string. Titles, bodies and notes go through `esc(...)`. Object ids, object types and branch ids do not: they are written straight into attributes, class names and text.

The app itself only makes safe ids and types, and the file reader added in plan 027 (`readWorkspace`, line 148) refuses unsafe ones. The stored workspace is different. Line 26 reads it back from the browser's storage with no checks at all. Anything that can write that storage entry, such as an older build, a browser extension or a hand edit, can put markup into an id, and the views will render it as markup.

This was tried on the unchanged app on 2026-11-27: one object in the stored workspace was given the id `x"><img src=x>`, the page was reloaded, and the Map view contained 5 `img` elements that the id had added.

Escaping where the values are written closes this whatever the source of the workspace is. It changes nothing for a normal workspace: `esc` leaves letters, digits, `-` and `_` as they are, and the click handlers read ids back through `dataset`, which returns the original value.

## What is there now

All in `app/app.js` (160 lines, long one-line functions). `esc` is on line 2 and escapes `&`, `<`, `>`, `"` and `'`.

| Line | Function | What is written unescaped |
|---|---|---|
| 38 | `badge` | the lower-cased state, as a class name |
| 62 | `render` | `state.view`, inside a selector |
| 79 | `node` | object id (attributes), object type (class name and text) |
| 85 | `renderObjectList` | the type used as a group heading, object ids |
| 86 | `renderMapHeading` | object ids |
| 90 | `renderTray` | object ids and types |
| 91 | `bindMap` | an object id, inside a selector |
| 96 | `renderInspector` | object ids and types, for the object and for each linked object |
| 97 | `renderBranches` | branch ids |
| 98 | `renderEvidence` | object ids and types |
| 99 | `renderDecisions` | object ids and types |
| 100 | `renderDocument` | object ids and types |
| 135 | `editObject` | the object type, in the dialog heading |

Values in a selector need `CSS.escape`, not `esc`. `app/agents.js` already does this (lines 270, 288, 410).

`app/index.html` line 10 loads the script as `app.js?v=backup-1`.

## Steps

### 1. Start clean

```
git status --short
git switch -c advisor/028-escape-ids-and-types
```

**Verify:** the first command prints nothing. `git log --oneline -1` shows `f559008` or a later commit on `main` that does not touch `app/app.js`. If `app/app.js` changed since `f559008`, read "If something is off" first.

### 2. Add the test first

Create `tests/verify-escaping.cjs` with exactly this content:

```js
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
```

How it works: it takes `esc`, `badge` and nine view functions out of `app/app.js` by pattern, runs them on a small workspace whose ids and types contain `"><img …>`, and checks that every piece of markup shows that text escaped and holds no real `<img`. One object links to another whose type is unsafe, so the linked-object row in the inspector is covered too. The four places it cannot run (a dialog, two selectors, the badge class) are pinned as source text.

**Verify:** `node tests/verify-escaping.cjs` fails with `AssertionError [ERR_ASSERTION]: node must show the unsafe value as text`. A failure with any other message means the test is not reading the source correctly: see "If something is off".

### 3. Escape the values

In `app/app.js`, replace every occurrence of each string on the left with the string on the right. The number is how many occurrences there are. Find them as plain text, not as patterns.

```
1×   <span class="state ${s.toLowerCase()}">${esc(s)}</span>
 →   <span class="state ${esc(s.toLowerCase())}">${esc(s)}</span>

1×   [data-view="${state.view}"]
 →   [data-view="${CSS.escape(state.view)}"]

1×   .node[data-object="${id}"]
 →   .node[data-object="${CSS.escape(id)}"]

14×  ="${o.id}"
 →   ="${esc(o.id)}"

1×   ="${x.id}"
 →   ="${esc(x.id)}"

3×   ="${b.id}"
 →   ="${esc(b.id)}"

1×   class="node ${o.type} 
 →   class="node ${esc(o.type)} 

4×   class="type ${o.type}">
 →   class="type ${esc(o.type)}">

1×   class="type ${x.type}">
 →   class="type ${esc(x.type)}">

3×   ">${o.type}</span>
 →   ">${esc(o.type)}</span>

1×   ">${x.type}</span>
 →   ">${esc(x.type)}</span>

1×   ||''} ${o.type}</span>
 →   ||''} ${esc(o.type)}</span>

1×   <h3>${t} <span>
 →   <h3>${esc(t)} <span>

1×   ↗ ${o.id} · Inspect
 →   ↗ ${esc(o.id)} · Inspect

1×   <h2>Edit the ${o.type}.</h2>
 →   <h2>Edit the ${esc(o.type)}.</h2>
```

The seventh string ends with one space (`class="node ${o.type} `), in both the old and the new form.

Why each choice:

- `esc` in markup, `CSS.escape` in the two selectors. They escape for different grammars and are not interchangeable.
- Ids are escaped only where they are written out. Comparisons such as `o.id===id` and `mapCore.includes(o.id)` stay as they are.
- `o.type==='evidence'` and similar tests stay as they are. Only the places that print the type change.
- No change to line 26. Cleaning the stored workspace on load is a separate, larger decision (see "Out of scope").

Then, in `app/index.html` line 10, change `app.js?v=backup-1` to `app.js?v=escape-1`, so returning visitors get the new file.

**Verify:**

- `git diff --numstat` shows `13	13	app/app.js` and `1	1	app/index.html`.
- `node --check app/app.js` prints nothing.
- `node tests/verify-escaping.cjs` prints `PASS escaping: ids, types and branch ids stay text in every workspace view`.
- `npm test` ends with `All test files and syntax checks passed.`

### 4. Check it in a browser

Start the server (`npm start`, http://localhost:4179) and open the app. Do not connect a model; none is needed. The steps below change the stored workspace of the browser you use and then put it back, so use a test browser or profile if you have one.

1. With the console open, look at each view (Map, Branches, Evidence, Decisions, Document), open an object in the inspector, and open its edit dialog. Everything looks and works as before and the console shows no errors. Click a placed object on the map: it is selected and the inspector opens.
2. In the console, keep a copy of the stored workspace, then give one object in the current branch an unsafe id and type, save and reload:

   ```js
   sessionStorage.setItem('p028-keep',JSON.stringify(localStorage.getItem('folio-prototype-v1')));
   const o=state.objects.find(o=>o.branch===state.branch);o.id='x"><img src=x>';o.type='claim"><img src=x>';save();location.reload();
   ```

3. After the reload, run `document.querySelectorAll('img[src=x]').length`. It must be `0`. On the unchanged app the same steps give `5`. The object shows on the map with its id and type as plain text, and clicking it still opens the inspector.
4. Put the stored workspace back and reload:

   ```js
   const k=JSON.parse(sessionStorage.getItem('p028-keep'));k===null?localStorage.removeItem('folio-prototype-v1'):localStorage.setItem('folio-prototype-v1',k);sessionStorage.removeItem('p028-keep');location.reload();
   ```

   The workspace is as it was before step 2.

**Verify:** all four hold. If you cannot open a browser, say so in your report. Do not mark this step as done.

### 5. Commit

```
git add app/app.js app/index.html tests/verify-escaping.cjs
git commit -m "Escape ids and types in the workspace markup"
```

**Verify:** `git status --short` prints nothing.

## Done criteria

- [ ] `git diff --numstat main` lists exactly three files: `app/app.js` (13 added, 13 removed), `app/index.html` (1 added, 1 removed), `tests/verify-escaping.cjs` (34 added, new).
- [ ] `node tests/verify-escaping.cjs` failed before step 3 and passes after it.
- [ ] `npm test` ends with `All test files and syntax checks passed.`
- [ ] Step 4 was done in a browser, or the report says plainly that it was not.
- [ ] One commit on branch `advisor/028-escape-ids-and-types`. Do not push or open a PR unless you were told to.

## Out of scope

- Checking or cleaning the stored workspace when line 26 loads it. After this plan an unsafe id is harmless in the markup, but a stored workspace with a missing field or an unknown type can still break a view. Running the stored workspace through `readWorkspace` on load would cover that; it also changes what happens to every existing visitor's data, so it needs its own plan.
- Line 141 (the challenge prompt) and line 142 (the downloaded brief). Both use the id and type as plain text that is never parsed as HTML.
- `app/agents.js`, `app/map-fullscreen.js` and the other scripts. They were not part of this finding.
- Validating ids where objects are created. The app's own ids are already safe.

## If something is off

- **A find string has a different count, or is missing.** `app/app.js` changed after `f559008`. Do not guess. Search the file for `${o.id}`, `${x.id}`, `${b.id}`, `${o.type}`, `${x.type}` and `${t}`; every one that is written into markup (an attribute, a class name or text between tags) gets `esc(...)`, and every one inside a `querySelector` string gets `CSS.escape(...)`. Comparisons and the plain-text uses on lines 141 and 142 stay. Then the numstat in the done criteria will differ; report the real numbers.
- **The test fails in step 2 with `app.js must keep … on one line`.** One of the functions it reads was renamed or split over several lines. Fix the name or the pattern in the test. Do not reformat `app.js`.
- **The test fails after step 3 with `… must not let an id or a type add an element`.** The name at the start of the message is the view that still writes a raw value. `node` is line 79, `inspector` is line 96, `tray` is line 90; the others are the function of that name.
- **The test fails after step 3 with a `ReferenceError`.** A view function now uses a helper the test does not supply. Add a stand-in for it on the line that defines `mapCore`, `current` and the others.
- **An object's colour or icon is missing after the change.** The type is used as a class name, and `esc` returns it unchanged for every type the app makes. Check that the class attribute still has a space after the type on line 79.
- **Step 4.3 gives a number above 0.** A raw value is still written somewhere the test does not reach. Find the element with `document.querySelector('img[src=x]').parentElement.outerHTML` and escape the value at its source.

## Maintenance notes

- New markup that prints an id, a type or a branch id must use `esc(...)`. The test only protects the nine functions it lists; add a new view function to `names` in the test when you add one to `app.js`.
- The test finds each function by a pattern that expects it on one line. If the file is ever reformatted, the test has to load the functions another way.
- If the stored workspace is later cleaned on load, keep the escaping. It is the last line of defence and costs nothing.
