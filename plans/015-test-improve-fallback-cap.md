# 015. Test the 6,000-character cap on the Improve instructions fallback

| | |
| --- | --- |
| Priority | P3 |
| Effort | S |
| Risk | LOW |
| Category | tests |
| Depends on | 003 and 007 (both merged) |
| Written against | `1bee2d1` on 2026-11-14 |

## Why

Plan 003 capped the text the browser builds when "Improve instructions" gets nothing back from the model. The cap is one `.slice(0,6000)` at `app/agents.js:360`. Nothing tests it. If a later edit drops the slice, an agent with long instructions and long feedback notes gets instructions the server rejects, and the agent stops running. The person sees "Keep the instructions under 6,000 characters." on an agent they never edited by hand.

## What is there now

`app/agents.js:360`:

```js
improving={id:a.id,next:next||`${a.instructions.trim()}\n\nFeedback to apply:\n${list}`.slice(0,6000),notes:feedback(a).map(r=>r.id)};
```

`improving` is a variable inside the file's closure. The test seam at `app/agents.js:561` does not expose it:

```js
if(window.__agentsTest)Object.assign(window.__agentsTest,{md,trimRuns,withParent,tick,db:()=>db});
```

The function that sets `improving` starts a few lines above line 360. It reads the agent's unapplied "Not quite" runs through `feedback(a)` (`app/agents.js:335`: runs with `rating==='down'` and no `applied`), takes up to eight notes, and calls the provider only when `pick()` reports a provider and model. With no provider it goes straight to the fallback, so the test needs no network.

`tests/verify-agents-client.cjs` loads `app/agents.js` in a `vm` context with a fake page. Its `load(stored)` helper returns `{t, toasts, storage, fire, fireWindow}`. Its `fetch` throws `The agents client test never calls a provider.`

## Steps

### 1. Expose the improve state to the test seam

In `app/agents.js:561`, add one read-only accessor to the object, next to `db`:

```js
improving:()=>improving
```

Change nothing else in `app/agents.js`.

### 2. Find how the improve function is reached

Search `app/agents.js` for `data-act="improve"` (the button) and for where `data-act` values are dispatched (a click listener on the Agents root or the document). Read enough to know which event, which `target` shape, and which state (the open agent) the handler needs. The existing `importFile` helper in the test file shows how a handler is fired through `h.fire`.

If the handler cannot be reached through `h.fire` with a plain fake event because it depends on state the fake page cannot set, stop and report that. Do not restructure `app/agents.js` to make it reachable.

### 3. Add the test

In `tests/verify-agents-client.cjs`, after the follow-up block and before the import block, add a block with a one-line comment that says what would go wrong for the person. Cases:

- Load one agent whose `instructions` is 5,900 characters, with two finished runs for it rated `down`, not `applied`, each with a `note` of 400 characters. Load with no provider. Trigger Improve. After `await settle()`, `h.t.improving().next.length` is at most 6,000, and `next` starts with the agent's instructions.
- Load one agent with short instructions and one short note. Trigger Improve. `next` ends with the note, so the cap does not cut short text.

Add `'improving'` to the list of names the test checks on the seam (`for(const name of ['md','trimRuns','withParent'])`).

The test must not call a provider. If the fake `fetch` throws, the test is wrong, not the harness.

### 4. Prove the test catches the regression

Temporarily remove `.slice(0,6000)` from `app/agents.js:360`, run `node tests/verify-agents-client.cjs`, and confirm it fails on the new assertion. Restore the line. Confirm `git diff app/agents.js` shows only the step 1 change.

**Verify:** `node tests/verify-agents-client.cjs` → exit 0, one line ending `passed.`. `npm test` → exit 0.

## Done criteria

- [ ] `grep -c "improving:()=>improving" app/agents.js` prints `1`.
- [ ] With the slice removed, `node tests/verify-agents-client.cjs` exits non-zero on the new assertion. With it restored, exit 0.
- [ ] `npm test` exits 0.
- [ ] `git status --short` lists only `app/agents.js` and `tests/verify-agents-client.cjs`.
- [ ] One commit on branch `advisor/015-test-improve-fallback-cap`.

## Out of scope

- Capping the text the model returns (`next`). Plan 003 left that path alone on purpose.
- Any other change to the improve flow or its wording.

## If something is off

If line numbers have moved, search for `Feedback to apply:` and `__agentsTest`. If the code no longer matches the excerpts above, stop and report instead of adapting the plan.
