# 017. Keep the workspace scroll position when returning from Agents

| | |
| --- | --- |
| Priority | P3 |
| Effort | S |
| Risk | LOW |
| Category | bug |
| Depends on | 007 (merged) |
| Written against | `92411ad` on 2026-11-15 |

## Why

Someone reading far down a workspace opens Agents and comes back with "Workspace ↗". The page jumps to the top and they have to find their place again.

Measured on the live site on 2026-11-15: workspace scrolled to 300, open Agents (still 300), return → `scrollY` is 0. The cause is the focus call at the end of `setMode`. It puts focus back on the "✦ Agents" button, which sits at the top of the page, and the browser scrolls to it. With `focus({preventScroll:true})` the position stayed at 300.

## What is there now

`app/agents.js:398`, the end of `setMode`:

```js
if(mode==='agents')draw();else{document.title=BASE_TITLE;render();$('#agents-toggle')?.focus();}}
```

`preventScroll` is already used in this file (for example `app/agents.js:441`) and in `app/app.js` and `app/map-fullscreen.js`.

The test seam at `app/agents.js:561`:

```js
if(window.__agentsTest)Object.assign(window.__agentsTest,{md,trimRuns,withParent,tick,db:()=>db,improving:()=>improving});
```

`tests/verify-agents-client.cjs` loads the file in a `vm` context. Its fake `document.querySelector` returns a fresh permissive element for every selector, so a `focus` call is a silent no-op and its argument is not recorded.

## Steps

### 1. Fix the focus call

In `app/agents.js:398` replace `$('#agents-toggle')?.focus();` with:

```js
$('#agents-toggle')?.focus({preventScroll:true});
```

Focus still returns to the button. Only the scroll is suppressed.

### 2. Expose `setMode` to the test seam

In `app/agents.js:561`, add `setMode` to the object, next to `tick`. Change nothing else in `app/agents.js`.

### 3. Add the test

In `tests/verify-agents-client.cjs`:

- In `load`, make the fake `document.querySelector` return, for `'#agents-toggle'` only, an element whose `focus` pushes its first argument onto an array. Return that array from `load` as `focused`. Keep every other selector as it is.
- Add a block before the import block, with a one-line comment that says what the person would lose (their place in the workspace). Load with no stored data, call `h.t.setMode('workspace',false)`, and assert that `h.focused` has exactly one entry and that its `preventScroll` is `true`.
- Add `'setMode'` to the list of names the test checks on the seam.
- Add `the workspace return focus` to the pass line, after `the improved-instructions cap`.

The fake page has no `history`. `setMode('workspace',false)` should not reach it, because the route and `location.hash` are both empty. If it does, stop and report instead of adding a fake.

### 4. Prove the test catches the regression

Temporarily change the call back to `.focus()`, run `node tests/verify-agents-client.cjs`, confirm it fails on the new assertion, and restore the line.

**Verify:** `node --check app/agents.js` → no output. `node tests/verify-agents-client.cjs` → exit 0, one line ending `passed.`. `npm test` → exit 0.

## Done criteria

- [ ] `grep -c "#agents-toggle')?.focus({preventScroll:true})" app/agents.js` prints `1`.
- [ ] With the plain `.focus()` restored, `node tests/verify-agents-client.cjs` exits non-zero on the new assertion. With the fix, exit 0.
- [ ] `npm test` exits 0.
- [ ] `git status --short` lists only `app/agents.js` and `tests/verify-agents-client.cjs`.
- [ ] One commit on branch `advisor/017-keep-workspace-scroll-on-return-from-agents`.

## Out of scope

- Saving and restoring a scroll position by hand. The page never scrolls while Agents is open, so suppressing the focus scroll is enough.
- Where focus lands on return, and any other focus call.
- The scroll position inside the Agents view.

## If something is off

If line numbers have moved, search for `#agents-toggle')?.focus(` and `__agentsTest`. If the code no longer matches the excerpts above, stop and report instead of adapting the plan.
