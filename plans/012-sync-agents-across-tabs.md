# Plan 012: Keep agents and runs in step when Nous is open in two tabs

> **Executor instructions.** Follow the steps in order. Run every verification command and compare with the expected result before moving on. If a STOP condition applies, stop and report instead of improvising. When finished, update this plan's row in `plans/README.md` (unless a reviewer maintains the index for you).
>
> **Drift check (run first):** `git diff --stat 95dd4e8..HEAD -- app/agents.js tests/verify-agents-client.cjs`
> Plans 001, 003, 004 and 007 also edit `app/agents.js`; that is expected. Plan 007 must already be done: `tests/verify-agents-client.cjs` must exist. If it does not, STOP. If any line quoted under "Current state" cannot be found by its search string, STOP and report.

## Status

| Field | Value |
| --- | --- |
| Priority | P3 |
| Effort | M |
| Risk | MED |
| Depends on | 007 (test harness). Do not run at the same time as 001, 003, 004 or 007 (same file) |
| Category | bug |
| Planned at | commit `95dd4e8`, 2026-11-13 |

## Why this matters

Agents, runs and drafts live in one localStorage entry. Each tab reads it once when the page loads and from then on writes its whole in-memory copy back on every change. With two tabs open, whichever tab saves last wins and silently erases what the other tab did: an agent created in tab A disappears the next time tab B saves anything. A tab with a run in progress saves every three seconds, so it erases the other tab's work almost at once. Scheduled agents have a second problem: both tabs run the same timer, see the same due schedule and both start the run, so the person pays for it twice.

## Current state

`app/agents.js` is one 544-line IIFE with very long lines. Find each line by its search string, not by line number alone. Use `grep -n "<string>" app/agents.js`.

Loading (lines 4–6):

```js
const KEY='nous-agents-v1',MODE='nous-mode';
let db;try{db=JSON.parse(localStorage.getItem(KEY));}catch{}
if(!Array.isArray(db?.agents)||!Array.isArray(db?.runs))db={agents:[],runs:[],draft:null};
```

Saving (line 10, start of the line):

```js
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(db));storageWarned=false;}catch(e){…
```

Drafts default (line 54):

```js
if(!db.drafts||typeof db.drafts!=='object'||Array.isArray(db.drafts))db.drafts={};
```

UI state (line 55, start of the line). `w` is the wizard draft and `drafts` holds unsent request text per agent. Both point into `db`:

```js
let view='agents',tplCat='All',openId=null,running=null,ticker=null,loading='',w=db.draft,drafts=db.drafts,…
```

The schedule timer (line 145, whole line):

```js
function tick(){if(running||!navigator.onLine||!pick().ok)return;const a=listed().find(a=>a.schedule&&schReady(a)&&slot(a)>(a.ranAt||0));if(!a)return;a.ranAt=Date.now();persist();fill(schText(a)).then(r=>run(a,r.trim(),undefined,undefined,{scheduled:true}));}
```

While a run is in progress, `running` is an object and `running.record` is the run's entry in `db.runs` (search `running.record=record;db.runs.unshift(record)`). The run code keeps writing to that `record` object until the run ends, so it must stay inside `db.runs`.

The existing redraw guard, used when the model list changes (line 543). The new code copies its conditions:

```js
const models=$('#ai-model');if(models)new MutationObserver(()=>{if(!document.body.classList.contains('mode-agents')||view==='wizard'||running)return;const m=document.activeElement?.dataset?.mirror;draw();…
```

Window-level listeners already exist near the end of the file, written as bare calls (line 528):

```js
addEventListener('pagehide',()=>{if(running){Object.assign(running.record,{answer:running.answer,beat:0});persist();}});
```

There is no `storage` listener: `grep -c "addEventListener('storage'" app/agents.js` prints `0`.

Why replacing `db` is safe: every other piece of UI state holds ids or its own plain objects (`openId`, `compare`, `picked`, `editing`, `retrying`, `trial`, `improving`, `asks`, `finished`), and handlers look agents and runs up by id each time. Only `w`, `drafts` and `running.record` point into `db`.

How the browser helps: when one tab calls `localStorage.setItem`, every *other* tab on the same origin receives a `storage` event with `key` and `newValue`. The tab that wrote does not receive it.

The test harness from plan 007, `tests/verify-agents-client.cjs`, has `load(stored)`, which runs `app/agents.js` in a fresh `vm` context with a `Map`-backed `localStorage` and returns `{t,toasts,storage,fire}`. `t` is the test seam object. The seam line in `app/agents.js` reads:

```js
if(window.__agentsTest)Object.assign(window.__agentsTest,{md,trimRuns,withParent,db:()=>db});
```

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Syntax check | `node --check app/agents.js` | no output |
| Client tests | `node tests/verify-agents-client.cjs` | its `PASS` lines, exit 0 |
| Full suite | `npm test` | exit 0 |

## Scope

**In scope**

- `app/agents.js`: one new `storage` listener, a small change inside `tick`, and (only if needed) names added to the test seam line.
- `tests/verify-agents-client.cjs`: new tests, and a window-level `addEventListener` in the harness if it lacks one.

**Out of scope**

- Merging two tabs' edits field by field. The last save still wins for a single agent edited in both tabs at once.
- `BroadcastChannel`, service workers, a server store or IndexedDB.
- `app/app.js`, `app/ask.js` and the workspace store. They have the same pattern, but that is separate work.
- Showing a "changed in another tab" message.
- Reformatting or splitting any existing line.

## Git workflow

- Branch: `advisor/012-sync-agents-across-tabs`
- Commit style: one imperative sentence, as in `Print the full result, not just the summary card (#43)`. Leave the PR number off.
- Do not push or open a PR unless you were told to.

## Steps

### 1. Make the harness able to fire a window event

Open `tests/verify-agents-client.cjs`. `app/agents.js` registers window listeners with a bare `addEventListener(...)`, which in the `vm` context resolves to a function on the context object. Check whether the harness records those handlers and whether `fire` can call them. If the context's `addEventListener` is a no-op, change it to record handlers by event name in a separate map (for example `winHandlers`) and return a `fireWindow(name,event)` function from `load` alongside the existing fields. Do not change how document handlers are recorded.

**Verify:** `node tests/verify-agents-client.cjs` → still passes, exit 0.

### 2. Write the failing tests first

Add three tests to `tests/verify-agents-client.cjs`, in the style of the tests already there. Use a small helper to build an agent: it needs at least `id`, `name`, `instructions` and `version`; copy the shape the existing tests use.

Test A, another tab's agent appears:

1. `load({agents:[A],runs:[],draft:null})`.
2. Build `next={agents:[A,B],runs:[],draft:null}`. Fire a window `storage` event with `{key:'nous-agents-v1',newValue:JSON.stringify(next)}`.
3. Assert `t.db().agents.length===2` and that `t.db().drafts` is an object.

Test B, bad input is ignored:

1. `load({agents:[A],runs:[],draft:null})`.
2. Fire `storage` with `{key:'nous-agents-v1',newValue:'not json'}`, then `{key:'nous-agents-v1',newValue:'{"agents":5}'}`, then `{key:'some-other-key',newValue:JSON.stringify({agents:[],runs:[]})}`, then `{key:'nous-agents-v1',newValue:null}`.
3. Assert `t.db().agents.length===1` after each and that nothing threw.

Test C, a schedule claimed by another tab does not run here:

1. Load with one agent that has a due schedule. Read `function slot(a)` and `schReady` in `app/agents.js` to see what a due schedule needs: `schedule:{time:'00:00',day:'daily'}`, no blanks in `starter`, and no `ranAt`.
2. In the `Map`-backed storage, overwrite `nous-agents-v1` with the same data but with the agent's `ranAt` set to `Date.now()` (this is the other tab's claim). Do not fire a `storage` event; the test is that `tick` re-reads storage itself.
3. Call `t.tick()`.
4. Assert the stored value still has exactly the other tab's `ranAt`, and `t.db().runs.length===0`.

Test C needs `tick` on the seam, and `tick` returns early unless `navigator.onLine` is true and `pick().ok` is true. Read what `pick` is in `app/agents.js` (`grep -n "pick=" app/agents.js`) and give the harness the smallest fake that makes it return `{ok:true}`. If that takes more than about ten lines of harness, leave Test C out, say so in your report, and rely on step 4's manual check.

**Verify:** `node tests/verify-agents-client.cjs` → fails. Test A fails on the agent count (still `1`), or Test C fails because `t.tick` is not a function.

### 3. Add the storage listener

In `app/agents.js`, directly after the `pagehide` line quoted above, add:

```js
  // Another tab saved. Take its copy so this tab does not overwrite it with stale data on its next save.
  // A run in progress here stays: its record is put back, because the other tab's copy has only the last heartbeat of it.
  addEventListener('storage',e=>{if(e.key!==KEY||e.newValue==null)return;let next;try{next=JSON.parse(e.newValue);}catch{return;}if(!Array.isArray(next?.agents)||!Array.isArray(next?.runs))return;if(running?.record){const i=next.runs.findIndex(r=>r.id===running.record.id);if(i<0)next.runs.unshift(running.record);else next.runs[i]=running.record;}if(!next.drafts||typeof next.drafts!=='object'||Array.isArray(next.drafts))next.drafts={};if(view==='wizard')next.draft=w;else w=next.draft;db=next;drafts=db.drafts;if(document.body.classList.contains('mode-agents')&&view!=='wizard'&&!running)draw();});
```

Notes on what each part is for, so you can check it rather than copy it blind:

- The shape check is the same one line 6 uses at load.
- `running.record` is put back so the run code keeps writing to an object that is in `db.runs`.
- While the wizard is open, the wizard's draft in this tab wins (`next.draft=w`), so typing is not lost. Otherwise `w` follows the other tab.
- The redraw conditions are the ones the model-list observer uses. If the page is not on Agents, the next `draw()` picks the new data up anyway.
- The listener never calls `persist()`. Writing in response to a `storage` event would make two tabs echo each other forever.

Match the file's two-space indent for top-level statements inside the IIFE.

**Verify:** `node --check app/agents.js` → no output. `grep -c "addEventListener('storage'" app/agents.js` → `1`. Tests A and B pass.

### 4. Make `tick` re-read the claim

In `tick`, replace `if(!a)return;a.ranAt=Date.now();persist();` with:

```js
if(!a)return;
    // Two tabs run this timer. Read the stored claim again, so a schedule another tab just started is not started twice.
    try{const s=JSON.parse(localStorage.getItem(KEY))?.agents?.find(x=>x.id===a.id);if(s&&slot(a)<=(s.ranAt||0)){a.ranAt=s.ranAt;return;}}catch{}
    a.ranAt=Date.now();persist();
```

Keep the rest of the function as it is. Then add `tick` to the seam line if Test C is in: `{md,trimRuns,withParent,tick,db:()=>db}`.

This narrows the window in which both tabs start the run to the few milliseconds between the read and the write. It does not close it entirely; say so in your report and do not add a lock.

**Verify:** `node --check app/agents.js` → no output. `node tests/verify-agents-client.cjs` → all tests pass.

### 5. Check it in a browser if you have one

Start the app with `npm start` (http://localhost:4179) and open it in two tabs, both on Agents.

1. Create an agent in tab A. Tab B's list shows it without a reload.
2. Rename an agent in tab B. Tab A shows the new name.
3. Open the new-agent wizard in tab A and type a name. Create another agent in tab B. Tab A's wizard keeps what you typed.

Do not run a real agent for this check; it would send a request to a provider. If you have no browser, say "not verified in a browser" in your report.

**Verify:** `npm test` → exit 0.

## Test plan

Tests A, B and C in `tests/verify-agents-client.cjs` (step 2). They cover: another tab's data replaces this tab's, malformed or unrelated events change nothing, and a schedule already claimed in storage is skipped. The running-run branch (put the record back) is exercised only if the harness can start a run without a network call; if it cannot, state that it is covered by reading only.

## Done criteria

- [ ] `node tests/verify-agents-client.cjs` failed after step 2 and passes after step 4.
- [ ] `npm test` exits 0.
- [ ] `grep -c "addEventListener('storage'" app/agents.js` prints `1`.
- [ ] `grep -c "Read the stored claim again" app/agents.js` prints `1`.
- [ ] The new listener contains no call to `persist(`.
- [ ] `git status --short` lists only `app/agents.js` and `tests/verify-agents-client.cjs` (and `plans/README.md`).
- [ ] This plan's row in `plans/README.md` is updated, saying whether step 5 was done.

## STOP conditions

- `tests/verify-agents-client.cjs` does not exist. Plan 007 has not been done.
- `app/agents.js` already has a `storage` listener or uses `BroadcastChannel`.
- `db` has become a `const`, or more variables than `w`, `drafts` and `running.record` hold references into `db`. Check with `grep -o "=db\.[a-z]*[,;]" app/agents.js`; anything beyond `=db.draft,` and `=db.drafts,` needs a decision.
- After step 3 any existing test in `tests/verify-agents-client.cjs` or `tests/verify-agents.cjs` fails.
- In the browser check, the two tabs redraw each other in a loop, or a typed field loses its text.

## Maintenance notes

- Any new variable that keeps a reference into `db` (rather than an id) must be re-pointed in the `storage` listener, or it will go stale when another tab saves.
- The listener redraws the whole Agents view. If someone is typing a request in tab B when tab A saves, `draw()` restores focus and the text comes from `drafts`, which the request box keeps current on every keystroke. If a new free-text field is added that is not backed by `db`, it will lose text on a cross-tab redraw.
- Two tabs editing the same agent at the same moment still end with the last save. That is accepted here.
- Plan 010's README sentence about storage stays true after this change.
