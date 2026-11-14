# Plan 001: Stop imported agent ids from injecting markup

> **Executor instructions.** Follow the steps in order. Run every verification command and compare with the expected result before moving on. If a STOP condition applies, stop and report instead of improvising. When finished, update this plan's row in `plans/README.md` (unless a reviewer maintains the index for you).
>
> **Drift check (run first):** `git diff --stat 95dd4e8..HEAD -- app/agents.js`
> If the file changed and the excerpts below no longer match what you see, STOP and report.

## Status

| Field | Value |
| --- | --- |
| Priority | P1 |
| Effort | S |
| Risk | LOW |
| Depends on | none |
| Category | security |
| Planned at | commit `95dd4e8`, 2026-11-13 |

## Why this matters

Nous lets people share agents as a JSON file and import them (Agents → Import). The import code copies each agent's `id` and `chainTo` from the file without checking their shape. Those ids are later written straight into HTML attributes with template strings, for example `data-open="${a.id}"`. A file whose `id` is `x"><img src=x onerror="…">` therefore runs script in the Nous page the next time the agent list is drawn, and keeps doing so on every load because the agent is saved in `localStorage`.

Script running in the Nous origin can read the provider API keys the user saved in the browser (storage keys named `nous-key-<provider>`). So one imported file from an untrusted source can leak a paid OpenAI or Anthropic key. Every locally created id is a UUID, so restricting ids to a plain token loses nothing.

## Current state

Nous is a static HTML/CSS/JS app under `app/` served by `app/server.cjs`. There is no build step, no dependencies and no linter. `app/agents.js` (544 lines) is one IIFE, `(() => { … })();`, and its lines are very long. **Find code by searching for the quoted strings below, not by line number alone.**

Storage, near the top of `app/agents.js` (lines 4–6):

```js
const KEY='nous-agents-v1',MODE='nous-mode';
let db;try{db=JSON.parse(localStorage.getItem(KEY));}catch{}
if(!Array.isArray(db?.agents)||!Array.isArray(db?.runs))db={agents:[],runs:[],draft:null};
```

The import handler (around line 479–480). Search for `t.id==='ag-import'`. The relevant parts:

```js
// Imports agents only: results stay in the browser that made them, and an agent already here (same id) is left as it is.
if(t.id==='ag-import'&&t.files[0])t.files[0].text().then(text=>{const list=JSON.parse(text)?.agents;if(!Array.isArray(list))throw 0;const str=v=>typeof v==='string'?v.trim():'';let added=0,updated=0;for(const x of list){if(!str(x?.name)||!str(x?.instructions))continue;const now=new Date().toISOString(),old=db.agents.find(a=>a.id===str(x.id));
```

and further along the same line:

```js
...(str(x.chainTo)&&{chainTo:str(x.chainTo)}),
```

```js
if(old)Object.assign(old,fields);else db.agents.push({id:str(x.id)||crypto.randomUUID(),created:str(x.created)||now,...fields});
```

Note the comment says an existing agent "is left as it is", but the code updates it (`Object.assign(old,fields)`). The comment is wrong.

Ids written into markup without escaping (examples; there are about 35 sites):

- line 115: `data-open="${running.agentId}"`
- line 120: `data-rerun="${r.id}"`, `data-reuse="${r.id}"`
- line 150: `id="ag-run-${r.id}"`, `data-pick="${r.id}"`
- lines 154–155: `id="ag-ans-${r.id}"`, `data-open="${r.agentId}"`
- line 189: `data-open="${a.id}"`, `id="ag-pin-${a.id}" data-pin="${a.id}"`
- line 194: `data-untemplate="${t.id}"`
- line 227: `data-edit="${a.id}"` and siblings
- line 228: `<option value="${x.id}"${a.chainTo===x.id?' selected':''}>`
- line 230: `data-unfollow="${a.id}"`, `data-run="${a.id}"`

The file already escapes other values correctly, which is the convention to follow. Line 207: `value="${esc(o.value)}"`.

`esc` is a global defined in `app/app.js` line 2. It escapes `& < > " '`, so it is safe inside double-quoted attributes:

```js
esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp…
```

All locally created ids come from `crypto.randomUUID()` (lines 316, 370, 426, 450, 468, 480).

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Syntax check | `node --check app/agents.js` | no output, exit 0 |
| Test suite | `npm test` | exit 0; last lines start `Hosting local:` and `Hosting Vercel:` and end `passed.` |
| Run locally | `npm start` | serves http://localhost:4179 |

Node 24 is required. There is nothing to install.

## Scope

**In scope**

- `app/agents.js`

**Out of scope**

- `app/app.js` (do not change `esc`).
- `app/index.html` (do not bump the `agents.js?v=19` query unless a reviewer asks).
- The Markdown renderer `md()` in `agents.js`. It already escapes its input.
- Any other import field. Only `id`, `chainTo` and stored ids are in scope.
- A Content-Security-Policy. That is plan 008.
- Automated tests for this code. That is plan 007.

## Git workflow

- Branch: `advisor/001-sanitize-imported-agent-ids`
- Commit style: one imperative sentence, as in `Print the full result, not just the summary card (#43)`. Leave the PR number off.
- Do not push or open a PR unless you were told to.

## Steps

### 1. Add one id check next to the storage code

Directly after the line that starts `if(!Array.isArray(db?.agents)||!Array.isArray(db?.runs))db=`, add:

```js
// Ids are written into HTML attributes, so only plain tokens are allowed. Imported or stored data that fails this is given a fresh id.
const safeId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v);
```

**Verify:** `node --check app/agents.js` → no output.

### 2. Repair anything already stored

A browser may already hold a bad id from an earlier import. Directly after the line from step 1, add a one-time repair that runs on every load:

```js
{const swap=new Map();
 for(const a of db.agents)if(a&&!safeId(a.id)){const id=crypto.randomUUID();swap.set(a.id,id);a.id=id;}
 for(const a of db.agents)if(a&&a.chainTo!=null&&!safeId(a.chainTo)){if(swap.has(a.chainTo))a.chainTo=swap.get(a.chainTo);else delete a.chainTo;}
 for(const r of db.runs){if(!r)continue;if(!safeId(r.id))r.id=crypto.randomUUID();if(r.agentId!=null&&!safeId(r.agentId))r.agentId=swap.get(r.agentId)||'';}}
```

Then search the file for every other id field that is stored and later written into markup. Run `grep -n -o 'parentId\|\.from\b\|t\.id' app/agents.js | sort | uniq -c`. For each stored id field you find on a run or agent (for example a run's `parentId`), add the same treatment inside the block above: keep it if `safeId`, map it through `swap` if present, otherwise clear it. If `t` in `data-untemplate="${t.id}"` comes from a hard-coded list in the file, leave it alone. If it comes from stored or imported data, treat it the same way.

Do not call `persist()` here. `toast` may not be ready this early, and the repaired values are saved on the next ordinary change.

**Verify:** `node --check app/agents.js` → no output. `npm test` → exit 0.

### 3. Check ids at import

In the import handler (search `t.id==='ag-import'`):

1. Replace `old=db.agents.find(a=>a.id===str(x.id))` with `xid=safeId(str(x.id))?str(x.id):'',old=xid&&db.agents.find(a=>a.id===xid)`.
2. Replace `...(str(x.chainTo)&&{chainTo:str(x.chainTo)}),` with `...(safeId(str(x.chainTo))&&{chainTo:str(x.chainTo)}),`.
3. Replace `db.agents.push({id:str(x.id)||crypto.randomUUID(),` with `db.agents.push({id:xid||crypto.randomUUID(),`.
4. Fix the comment above the handler so it matches the code. New text: `// Imports agents only: results stay in the browser that made them. An agent already here (same id) is updated; an id that is not a plain token is replaced.`

`old` is used later as a truthy check (`if(old)updated++`), so an empty-string result behaves like "not found". Read the rest of the handler and confirm nothing else reads `x.id` or `x.chainTo` directly.

**Verify:** `node --check app/agents.js` → no output. `grep -c "str(x.id)||crypto.randomUUID()" app/agents.js` → `0`.

### 4. Escape ids where they are written into markup

Defence in depth, in case some id reaches the page by a path this plan did not find. In every template string in `app/agents.js`, wrap ids that sit inside an HTML attribute with `esc(...)`.

List the sites with:

```bash
grep -n -o '\(id\|data-[a-z]*\|value\)="[^"]*\${[^}]*\(\.id\|agentId\|chainTo\|parentId\)}' app/agents.js
```

For each hit, change `${a.id}` to `${esc(a.id)}` (and likewise `r.id`, `x.id`, `t.id`, `r.agentId`, `running.agentId`). Do not touch a `${…}` that is not inside an attribute value, and do not touch comparisons such as `a.chainTo===x.id`. Reading an attribute back through `dataset` or `getAttribute` returns the original value, so lookups keep working.

**Verify:** the grep above → no output. `node --check app/agents.js` → no output. `npm test` → exit 0.

### 5. Check it in a browser

1. Outside the repository (for example your temp directory), create `bad-agent.json`:

   ```json
   {"agents":[{"id":"x\"><img src=x onerror=\"document.title='INJECTED'\">","name":"Probe","instructions":"Say hello.","chainTo":"y\"><b>"}]}
   ```

2. `npm start`, open http://localhost:4179, open Agents, and import the file.
3. Expected: a toast `Added 1 agent.`, an agent named Probe in the list, and the page title still starts `Nous`. It must never read `INJECTED`.
4. In the browser console run `JSON.parse(localStorage.getItem('nous-agents-v1')).agents.at(-1)`. Expected: `id` is a UUID and there is no `chainTo` key.
5. Open Probe, edit its name, pin it, archive it and restore it. Each action must still work.
6. Delete Probe, stop the server and delete `bad-agent.json`.

If you have no browser, say so in your report and mark this step `Not verified`. Do not claim it passed.

## Test plan

No automated test is added here. `app/agents.js` has no test harness yet; plan 007 builds one and covers this import path. Until then the browser check in step 5 is the proof.

## Done criteria

- [ ] `node --check app/agents.js` exits 0.
- [ ] `npm test` exits 0.
- [ ] `grep -c "const safeId=" app/agents.js` prints `1`.
- [ ] `grep -c "str(x.id)||crypto.randomUUID()" app/agents.js` prints `0`.
- [ ] The grep in step 4 prints nothing.
- [ ] Step 5 passed, or is reported as `Not verified` with the reason.
- [ ] `git status --short` lists only `app/agents.js` (and `plans/README.md`).
- [ ] This plan's row in `plans/README.md` is updated.

## STOP conditions

- The import handler no longer matches the excerpts (for example it was moved to another file).
- You find an id that is not a UUID and is created by the app itself, such as a template id containing spaces or punctuation. Report the format instead of widening the pattern.
- Any step makes a previously working action in step 5.5 fail.
- `npm test` fails before you change anything.

## Maintenance notes

- Any new field that holds an id and is written into markup must pass `safeId` at import and at load, and be wrapped in `esc()` where it is written.
- If ids ever stop being UUID-like, change the `safeId` pattern in one place.
- Reviewers: check that `chainTo` still survives a normal export → import round trip between two agents (both ids are UUIDs, so it should).
- Plan 008 (Content-Security-Policy) limits what injected markup could do. It does not replace this fix.
