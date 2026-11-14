# Plan 007: Put the browser side of Agents under test

> **Executor instructions.** Follow the steps in order. Run every verification command and compare with the expected result before moving on. If a STOP condition applies, stop and report instead of improvising. When finished, update this plan's row in `plans/README.md` (unless a reviewer maintains the index for you).
>
> **Drift check (run first):** `git diff --stat 95dd4e8..HEAD -- app/agents.js tests/`
> `app/agents.js` is expected to have changed if plans 001, 003 or 004 landed. Read "Which assertions apply" below before writing tests.

## Status

| Field | Value |
| --- | --- |
| Priority | P2 |
| Effort | M |
| Risk | LOW |
| Depends on | 006 (test runner). Best after 001, 003 and 004, whose fixes it locks in |
| Category | tests |
| Planned at | commit `95dd4e8`, 2026-11-13 |

## Why this matters

`app/agents.js` is the largest file in the app (544 lines) and holds the logic most likely to lose someone's data or leak a key: the Markdown renderer that turns model output into HTML, the import of agent files from other people, the trimming of stored runs, and the text built for follow-up runs. None of it has a test. `tests/verify-agents.cjs` covers only the server module `app/agents.cjs`. Plans 001, 003 and 004 fix real bugs in this file and can only prove themselves with one-off commands. This plan gives those fixes permanent tests.

## Current state

- `app/agents.js` is one IIFE: `(() => { … })();`. Nothing inside is reachable from outside, so a test cannot call `md`, `trimRuns` or `withParent` today.
- It reads `localStorage` key `nous-agents-v1` on load (`let db;try{db=JSON.parse(localStorage.getItem(KEY));}catch{}`), and saves with `persist()`.
- It uses these globals from other scripts: `esc`, `toast`, `toastTimer`, `$`, `state`, `save`, `render`, `current`, `setMode`, `window.providerHeaders`, `window.providerReady`, and the browser's `localStorage`, `document`, `crypto`, `MutationObserver`, `setTimeout`, `setInterval`. The end of the file starts timers (`setTimeout(tick,3000);setInterval(tick,60000);`) and a `MutationObserver` on `#ai-model`.
- `esc` is defined in `app/app.js` line 2 and escapes `& < > " '`.
- The exemplar for this kind of test is `tests/verify-dictation.cjs`. It loads a browser script into a `node:vm` context with a fake `document` and fake `fetch`, then drives it. **Read it in full before starting and copy its structure.**
- Test files are plain Node scripts using `node:assert/strict`. They print one line ending `passed.` and exit non-zero on failure. After plan 006, any file named `tests/verify-*.cjs` runs automatically.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| This test only | `node tests/verify-agents-client.cjs` | one line ending `passed.`, exit 0 |
| Syntax check | `node --check app/agents.js` | no output |
| Full suite | `npm test` | exit 0 |

## Scope

**In scope**

- `tests/verify-agents-client.cjs` (new)
- `app/agents.js`: **one added line only**, the test seam in step 2

**Out of scope**

- Any behaviour change in `app/agents.js`. If a test exposes a bug, report it; do not fix it here.
- Tests that need a real browser (layout, focus, printing).
- Real provider calls. Never run a real agent. Use a fake `fetch` and the stub model name `claude-test`.

## Git workflow

- Branch: `advisor/007-test-agents-client`
- Commit style: one imperative sentence, as in `Agents: web search toggle, live steps, report card (#39)`. Leave the PR number off.
- Do not push or open a PR unless you were told to.

## Steps

### 1. Build the harness

Create `tests/verify-agents-client.cjs`. It needs a `load(stored)` function that:

1. Creates a fresh `vm` context each time, so tests do not share state.
2. Provides `localStorage` as a `Map`-backed object with `getItem`, `setItem`, `removeItem`. If `stored` is given, pre-set `nous-agents-v1` to `JSON.stringify(stored)`.
3. Provides a permissive fake `document`: `getElementById`, `querySelector`, `createElement` return a fake element; `querySelectorAll` returns `[]`; `addEventListener` records handlers by event name so tests can fire them. A fake element accepts any property assignment and has no-op `addEventListener`, `setAttribute`, `removeAttribute`, `append`, `remove`, `focus`, `scrollIntoView`, `closest` (returns `null`), `querySelector` (returns another fake element), `querySelectorAll` (returns `[]`), plus `classList` with no-op `add`, `remove`, `toggle` and `contains` returning `false`, `dataset:{}` and `style:{}`. A `Proxy` that returns a no-op function for unknown properties keeps this short.
4. Provides `esc` (copy the one-line definition from `app/app.js` line 2 exactly), `toast` (record messages in an array), `$` (same as `querySelector`), `state:{}`, no-op `save`, `render`, `setMode`, `current:()=>null`, `crypto:require('node:crypto').webcrypto`, a `MutationObserver` class with no-op `observe` and `disconnect`, and **`setTimeout`/`setInterval` that do nothing and return `0`** so the script's timers never keep the process alive.
5. Sets `window` to the context itself, and sets `window.__agentsTest={}` before running the script.
6. Runs `fs.readFileSync(path.join(__dirname,'../app/agents.js'),'utf8')` in the context and returns `{t:context.__agentsTest,toasts,storage,fire}`.

Add globals only as the script asks for them: run the file, read the `ReferenceError` or `TypeError`, add the missing piece, repeat.

**Verify:** `node tests/verify-agents-client.cjs` loads the script without throwing (at this point `t` is an empty object).

### 2. Add the test seam

At the very end of the IIFE in `app/agents.js`, directly before the closing `})();`, add:

```js
// Test seam: tests/verify-agents-client.cjs sets window.__agentsTest before loading this file. It is never set in the app.
if(window.__agentsTest)Object.assign(window.__agentsTest,{md,trimRuns,withParent,db:()=>db});
```

Confirm the three function names exist with `grep -c "const md=\|function md(" app/agents.js` and the same for `trimRuns` and `withParent`. If the Markdown renderer has another name, use the real one.

**Verify:** `node --check app/agents.js` → no output. In the harness, `typeof t.md`, `typeof t.trimRuns` and `typeof t.withParent` are all `'function'`.

### 3. Write the tests

Cover these. Use `assert` messages that say what a person would lose.

**Markdown renderer (`md`)**

- `md('<img src=x onerror=alert(1)>')` contains no `<img`.
- `md('[x](javascript:alert(1))')` contains no `href="javascript:`.
- `md('[x](https://example.com/a"onmouseover="b)')` contains no `"onmouseover=` (no attribute break-out).
- `md('**bold** and `code`')` contains `<strong>bold</strong>` and `<code>code</code>` (adjust tags to what the renderer really emits; read it first).
- A fenced code block containing `<script>` comes out escaped.

**Run trimming (`trimRuns`)** — load with a stored `runs` array, call `t.trimRuns()`, inspect `t.db().runs`:

- 120 reviewed finished runs → 100 remain and the newest (index 0) is kept.
- 100 unreviewed finished runs plus 5 reviewed → no unreviewed run is removed.
- One `{status:'running'}` at index 0 plus 100 unreviewed finished runs → the running record is still at index 0.

**Follow-up text (`withParent`)**

- `withParent('q',null)` is `'q'`.
- With a parent whose answer is 9,000 characters, the result is at most 5,000 characters and ends with `Follow-up: q`.
- With a 4,700-character request the result is at most 5,000 characters and still contains the whole request.

**Import and stored ids** — find how the import handler is reached (a `change` event with `target.id==='ag-import'` and `target.files[0].text()`), and fire it through the recorded handler with a fake file:

- An agent whose `id` is `x"><img src=x onerror=1>` is added with an id matching `/^[A-Za-z0-9_-]{1,64}$/`, and its `chainTo` of the same shape is dropped.
- Importing an agent whose id matches an existing one updates it instead of adding a duplicate.
- Loading with a stored agent that already has a bad id gives it a fresh id on load.

### Which assertions apply

Some of these describe behaviour that only exists after another plan lands:

| Assertion | Needs plan |
| --- | --- |
| Running record survives trimming | 004 |
| Follow-up stays within 5,000 with a 4,700-character request | 003 |
| Bad ids replaced at import and at load | 001 |

Check whether each fix is present (`grep -c "const safeId=" app/agents.js`, `grep -c "const r=db.runs\[i\];if(r.status!=='running'&&" app/agents.js`, `grep -c "for(const quote of \[500,100\])" app/agents.js`). For a fix that is **not** present, still write the test, wrap it so it is skipped, and print one line such as `Skipped: running-run trimming (plan 004 not applied)`. Do not leave a failing test and do not delete the case.

**Verify:** `node tests/verify-agents-client.cjs` → exit 0, one line ending `passed.`, plus any `Skipped:` lines. `npm test` → exit 0, and the new file appears in its output.

### 4. Prove the tests can fail

Temporarily change one character in `app/agents.js` (for example make `trimRuns` use `-99` instead of `-100`), run the test, confirm it fails, and undo the change.

**Verify:** `git diff --stat app/agents.js` shows only the one added seam line.

## Test plan

This plan is the test plan. The exemplar is `tests/verify-dictation.cjs`.

## Done criteria

- [ ] `node tests/verify-agents-client.cjs` exits 0.
- [ ] `npm test` exits 0 and runs the new file.
- [ ] `git diff --numstat app/agents.js` shows 2 added lines (comment and seam) and 0 removed, apart from changes made by other plans.
- [ ] Every skipped case is listed in your report with the plan it waits for.
- [ ] The process exits on its own (no hanging timers).
- [ ] This plan's row in `plans/README.md` is updated.

## STOP conditions

- Plan 006 has not landed (`tests/run.cjs` does not exist). The new file would not run in CI.
- The script cannot load in `vm` without changing more than the one seam line.
- A Markdown test fails on the unmodified renderer. That is a security finding: report the input and output, do not fix it here.
- The maintainer has not agreed to a test seam in shipped code. The seam is one inert line, but it is a judgement call; if you were told not to touch `app/agents.js`, stop after step 1 and report.

## Maintenance notes

- When a function is added to `app/agents.js` that handles imported data or model output, add it to the seam and test it here.
- The alternative to a seam is moving the pure functions into their own file loaded by both the page and the tests. That is cleaner but changes `index.html` and the static file allowlist in `server.cjs`, so it was left for later.
