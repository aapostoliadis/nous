# 021. Remove a line in `modelMode` that can never run

| | |
| --- | --- |
| Priority | P3 |
| Effort | S |
| Risk | LOW |
| Category | tech debt |
| Depends on | 020 (it adds the test that protects this file) |
| Written against | `25910a5` on 2026-11-20 |

## Why

`modelMode` in `app/providers.cjs` decides how a model is called. Line 38 returns `null` for every search-preview and search-api model. Line 39 then tests for the same two names and returns `'chat'`. Line 39 can never run, because line 38 has already returned. A reader could believe search models are routed to Chat Completions when they are in fact left out of the catalogue. Deleting the line removes the false signal. Behaviour does not change.

## What is there now

`app/providers.cjs`, lines 30 to 42. Lines 33 to 37 are shortened here to their first words; they are not part of this change.

```js
function modelMode(provider,id) {
  if(provider==='anthropic') return 'messages';
  const base=id.startsWith('ft:')?id.split(':')[1]:id;
  ...
  if(/deep-research|search-preview|search-api/.test(base)) return null; // Requires research tools, outside the text workspace.
  if(/search-preview|search-api/.test(base)) return 'chat';
  if(/chat-latest/.test(base)||/^gpt-3\.5|^gpt-4(?:$|-(?:0|turbo|32k|vision))/.test(base)) return 'chat';
  return 'responses';
}
```

The existing test already states the intended behaviour, at `tests/verify-models.cjs:6`:

```js
for(const id of ['gpt-image-2','text-embedding-3-small','o4-mini-deep-research','gpt-4o-search-preview'])assert.equal(modelMode('openai',id),null);
```

## Steps

### 1. Confirm the starting point

**Verify:** `grep -c "search-preview|search-api" app/providers.cjs` → prints `2`.

**Verify:** `grep -c "Structured output per model" tests/verify-models.cjs` → prints `1`. If it prints `0`, plan 020 has not been merged. Stop and report.

### 2. Delete the line

In `app/providers.cjs`, delete this whole line (line 39), including its line break:

```js
  if(/search-preview|search-api/.test(base)) return 'chat';
```

Do not change line 38 above it or the `chat-latest` line below it.

**Verify:** `grep -c "search-preview|search-api" app/providers.cjs` → prints `1`.

**Verify:** `node tests/verify-models.cjs` → exits 0 and prints a line starting with `PASS live catalogue adapters:`.

### 3. Run the full suite

**Verify:** `npm test` → exits 0 and the last line is `All test files and syntax checks passed.`

## Done criteria

- [ ] `grep -c "search-preview|search-api" app/providers.cjs` prints `1`.
- [ ] `git diff --numstat` shows exactly one file, `app/providers.cjs`, with 0 insertions and 1 deletion.
- [ ] `npm test` exits 0.
- [ ] One commit on branch `advisor/021-remove-unreachable-model-branch`, with a message such as `Remove an unreachable line from modelMode`. Do not push or open a PR unless you were told to.

## Out of scope

- Making search models usable. That needs research tools the workspace does not have, and line 38 says so.
- Any other line of `modelMode` and any other pattern in `app/providers.cjs`.
- The test files. No test changes, because behaviour does not change.

## If something is off

If lines 38 and 39 no longer match the excerpt, or the first check in step 1 does not print `2`, stop and report instead of adapting the plan.
