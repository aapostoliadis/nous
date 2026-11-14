# Plan 004: Never trim the run that has just started

> **Executor instructions.** Follow the steps in order. Run every verification command and compare with the expected result before moving on. If a STOP condition applies, stop and report instead of improvising. When finished, update this plan's row in `plans/README.md` (unless a reviewer maintains the index for you).
>
> **Drift check (run first):** `git diff --stat 95dd4e8..HEAD -- app/agents.js`
> If the file changed and the excerpts below no longer match, STOP and report.

## Status

| Field | Value |
| --- | --- |
| Priority | P2 |
| Effort | S |
| Risk | LOW |
| Depends on | none (touches run code in `app/agents.js` near plan 003; do them one at a time) |
| Category | bug |
| Planned at | commit `95dd4e8`, 2026-11-13 |

## Why this matters

Nous keeps at most 100 agent runs, but by an earlier decision (#16) it never deletes a finished run the person has not reviewed yet. Once someone has 100 or more unreviewed finished runs, the trimming loop finds nothing else it is allowed to delete, walks to the top of the list and deletes the run that was added a moment ago: the one that is running. The run still completes, but its record is no longer in the saved list, so the result vanishes and the provider call was paid for nothing.

## Current state

`app/agents.js` is a browser script (544 lines, one IIFE, very long lines). Find code by searching for the quoted strings.

Lines 65–67:

```js
const unreviewed=()=>db.runs.filter(r=>r.status==='done'&&!r.reviewed);
const trimRuns=()=>{let over=db.runs.length-100;for(let i=db.runs.length-1;i>=0&&over>0;i--)if(!(db.runs[i].status==='done'&&!db.runs[i].reviewed)){db.runs.splice(i,1);over--;}};
```

Where it is called, inside `async function run(` (line 371):

```js
running.record=record;db.runs.unshift(record);trimRuns();persist();
```

`record` has `status:'running'`. New runs go to the front of `db.runs` (`unshift`), and the loop deletes from the back, oldest first. A run's `status` is `'running'` while in flight and `'done'` on success; other values mark failed or interrupted runs.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Syntax check | `node --check app/agents.js` | no output, exit 0 |
| Full suite | `npm test` | exit 0 |

## Scope

**In scope**

- `app/agents.js`, the `trimRuns` statement only.

**Out of scope**

- The limit of 100.
- The rule that unreviewed finished runs are kept. That is decision #16 and must stay.
- The storage-full warning in `persist`.
- Any change to `run(`.

## Git workflow

- Branch: `advisor/004-keep-running-run-when-trimming`
- Commit style: one imperative sentence, as in `Print the full result, not just the summary card (#43)`. Leave the PR number off.
- Do not push or open a PR unless you were told to.

## Steps

### 1. Reproduce the bug

From the repository root, run:

```bash
node -e "const s=require('fs').readFileSync('app/agents.js','utf8');const src=s.match(/const trimRuns=\(\)=>\{.*?\}\};/)[0];const db={runs:[{status:'running'}]};for(let i=0;i<100;i++)db.runs.push({status:'done',reviewed:false});for(let i=0;i<5;i++)db.runs.push({status:'done',reviewed:true});eval(src+'trimRuns();');console.log(db.runs.length,db.runs[0].status)"
```

**Verify:** prints `100 done`. The running record at index 0 was deleted.

### 2. Fix it

Replace the `const trimRuns=…;` statement with:

```js
// Keeps the list near 100. Unreviewed results are never dropped (#16), and neither is a run still in flight: its record must exist when the answer arrives.
const trimRuns=()=>{let over=db.runs.length-100;for(let i=db.runs.length-1;i>=0&&over>0;i--){const r=db.runs[i];if(r.status!=='running'&&!(r.status==='done'&&!r.reviewed)){db.runs.splice(i,1);over--;}}};
```

**Verify:** `node --check app/agents.js` → no output. Run the command from step 1 again → prints `101 running`.

### 3. Confirm ordinary trimming still works

```bash
node -e "const s=require('fs').readFileSync('app/agents.js','utf8');const src=s.match(/const trimRuns=\(\)=>\{.*?\}\}\};/)[0];const db={runs:[{status:'running'}]};for(let i=0;i<120;i++)db.runs.push({status:'done',reviewed:true,n:i});eval(src+'trimRuns();');console.log(db.runs.length,db.runs[0].status,db.runs.at(-1).n)"
```

**Verify:** prints `100 running 98`. The 21 oldest reviewed runs were removed and the newest were kept.

**Verify:** `npm test` → exit 0.

## Test plan

No permanent test is added here, because `app/agents.js` has no test harness yet. Plan 007 builds one and includes both cases above. The two commands in steps 1–3 are the proof until then.

## Done criteria

- [ ] Step 1's command printed `100 done` before the fix and prints `101 running` after it.
- [ ] Step 3's command prints `100 running 98`.
- [ ] `npm test` exits 0.
- [ ] `grep -c "const r=db.runs\[i\];if(r.status!=='running'&&" app/agents.js` prints `1`. (The shorter string `r.status!=='running'&&` also appears in two unrelated filters, so it prints `3`.)
- [ ] `git status --short` lists only `app/agents.js` (and `plans/README.md`).
- [ ] This plan's row in `plans/README.md` is updated.

## STOP conditions

- `trimRuns` no longer matches the excerpt, or is called from somewhere other than `run(` in a way that needs running records removed. Check with `grep -n -o "trimRuns()" app/agents.js | wc -l` (expected: `1`; only the call matches, because the definition is written `trimRuns=()=>`).
- The step 1 command does not print `100 done` before you change anything. The bug may already be fixed.

## Maintenance notes

- The list can now sit above 100 while runs are in flight or unreviewed. That is intended. Storage pressure is handled by the "Browser storage is full" toast in `persist`.
- Any future status that means "still in flight" (for example a queued state) must be added to the keep rule.
