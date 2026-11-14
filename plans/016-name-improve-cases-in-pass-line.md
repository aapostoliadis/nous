# 016. Name the Improve cases in the agents client test's pass line

| | |
| --- | --- |
| Priority | P3 |
| Effort | S |
| Risk | LOW |
| Category | tests |
| Depends on | 015 (merged) |
| Written against | `de36785` on 2026-11-14 |

## Why

`tests/verify-agents-client.cjs` prints one line that lists what it covered. Plan 015 added cases for the 6,000-character cap on improved instructions, but the line does not name them. Someone reading the `npm test` output cannot tell that the cap is tested.

## What is there now

`tests/verify-agents-client.cjs:138`:

```js
  console.log('PASS agents client: Markdown escaping, run trimming, follow-up text, import and stored ids, changes from another tab and claimed schedules passed.');
```

The Improve block sits after the follow-up block and before the import block.

## Steps

### 1. Change the line

Replace the string with:

```js
  console.log('PASS agents client: Markdown escaping, run trimming, follow-up text, the improved-instructions cap, import and stored ids, changes from another tab and claimed schedules passed.');
```

Change nothing else in the file.

**Verify:** `node tests/verify-agents-client.cjs` → exit 0 and prints exactly that line. `npm test` → exit 0.

## Done criteria

- [ ] `grep -c "the improved-instructions cap" tests/verify-agents-client.cjs` prints `1`.
- [ ] `git diff --numstat` shows 1 added and 1 removed line in `tests/verify-agents-client.cjs`, and no other file.
- [ ] `npm test` exits 0.
- [ ] One commit on branch `advisor/016-name-improve-cases-in-pass-line`.

## Out of scope

- Any change to the test cases or to `app/`.

## If something is off

If the line no longer matches the excerpt, stop and report instead of adapting the plan.
