# 020. Pin which OpenAI models are marked as supporting structured output

| | |
| --- | --- |
| Priority | P3 |
| Effort | S |
| Risk | LOW |
| Category | tests |
| Depends on | none (021 must come after this plan) |
| Written against | `25910a5` on 2026-11-20 |

## Why

For each OpenAI model in the catalogue, the server decides from the model's name whether it accepts a JSON schema ("structured output"). The decision is one pattern inside a long line at `app/providers.cjs:63`. Nothing tests it. If the pattern is edited wrongly, Nous sends a schema to a model that rejects it, or withholds it from a model that needs it, and `npm test` still passes. This plan adds one table of twelve model names with the flag each must get. It changes no application code.

## What is there now

The code under test, `app/providers.cjs:63`. Read it; do not edit it. The part that matters is the `structured:` property.

```js
  const models=unique.filter(m=>modelMode(provider,m.id)).map(m=>({id:m.id,name:m.display_name||m.id,mode:modelMode(provider,m.id),structured:provider==='anthropic'?m.capabilities?.structured_outputs?.supported!==false:!(/chat-latest|search-|^gpt-3\.5|^gpt-4(?:$|-)|gpt-4o-2024-05/.test(m.id)),created:m.created||Date.parse(m.created_at)||0,maxTokens:m.max_tokens||null})).sort((a,b)=>b.created-a.created||a.name.localeCompare(b.name,undefined,{numeric:true}));
```

The test file, `tests/verify-models.cjs`. Line 2 already imports what the new test needs:

```js
const {listModels,ask,modelMode,status,audioRequest}=require('../app/providers.cjs');
```

Lines 16 and 17, where the new lines go between:

```js
const openai=await listModels('openai',{force:true,fetchImpl:fake});assert.equal(openai.models.length,3);assert.equal(openai.excluded,1);
const claude=await listModels('anthropic',{force:true,fetchImpl:fake});assert.equal(claude.models.length,2);assert.equal(claude.models[0].id,'claude-sonnet-4-6');assert.equal(claude.models[0].structured,true);assert.equal(claude.models[1].structured,false);assert.equal(claude.models[0].maxTokens,64000);
```

If line 17 in your checkout differs after `const claude=await listModels('anthropic',{force:true,fetchImpl:fake});`, that is fine. Only line 16 must match.

`listModels(provider,{force:true,fetchImpl})` fetches the catalogue through the function given as `fetchImpl` and caches the result per provider. `fake` is the test file's stand-in for `fetch`. No test in this file sends a real request, and the new lines must not either.

`tests/verify-models.cjs` has Windows line endings (CRLF) in a Windows working tree. Keep whatever line ending the file already has, and give the new lines the same one. Most editors do this on their own.

## Steps

### 1. Add the table

In `tests/verify-models.cjs`, directly after line 16 (the line that starts with `const openai=await listModels('openai',{force:true,fetchImpl:fake});`), insert these four lines exactly:

```js
// Structured output per model: a wrong flag sends a JSON schema to a model that rejects it, or withholds it from one that needs it.
const flags=await listModels('openai',{force:true,fetchImpl:async()=>({ok:true,json:async()=>({data:['gpt-6-astra','gpt-5.3-chat-latest','gpt-4.1-mini','gpt-4o','gpt-4o-mini','gpt-4o-2024-08-06','o4-mini','gpt-4o-2024-05-13','gpt-4','gpt-4-turbo','gpt-3.5-turbo','chatgpt-4o-latest'].map(id=>({id}))})})});
assert.deepEqual(Object.fromEntries(flags.models.map(m=>[m.id,m.structured])),{'gpt-6-astra':true,'gpt-5.3-chat-latest':false,'gpt-4.1-mini':true,'gpt-4o':true,'gpt-4o-mini':true,'gpt-4o-2024-08-06':true,'o4-mini':true,'gpt-4o-2024-05-13':false,'gpt-4':false,'gpt-4-turbo':false,'gpt-3.5-turbo':false,'chatgpt-4o-latest':true});
await listModels('openai',{force:true,fetchImpl:fake});
```

The fourth line matters. It loads the original fake catalogue again, so the cached OpenAI list is the one the rest of the file expects.

`gpt-6-astra` is an invented name. It checks that an unknown future model defaults to `true`.

**Verify:** `node tests/verify-models.cjs` → exits 0 and prints a line starting with `PASS live catalogue adapters:`.

### 2. Prove the table can fail

In the line you added, change `'gpt-4-turbo':false` to `'gpt-4-turbo':true`.

**Verify:** `node tests/verify-models.cjs` → exits with a non-zero code and the output mentions `gpt-4-turbo`.

Change it back to `'gpt-4-turbo':false`.

**Verify:** `node tests/verify-models.cjs` → exits 0.

### 3. Run the full suite

**Verify:** `npm test` → exits 0 and the last line is `All test files and syntax checks passed.`

## Done criteria

- [ ] `grep -c "Structured output per model" tests/verify-models.cjs` prints `1`.
- [ ] `git diff --numstat` shows exactly one file, `tests/verify-models.cjs`, with 4 insertions and 0 deletions. If it shows every line of the file as changed, the line endings were converted; undo that and insert the lines again.
- [ ] `npm test` exits 0.
- [ ] One commit on branch `advisor/020-pin-structured-output-flags`, with a message such as `Pin the structured-output flag for OpenAI model names`. Do not push or open a PR unless you were told to.

## Out of scope

- `app/providers.cjs`. If the table fails in step 1, do not edit the pattern and do not edit the table to match. Stop and report.
- The Anthropic flag. It comes from the provider's own catalogue data and line 17 already checks it.
- The pass line at the end of the test file.

## If something is off

If line 16 no longer matches the excerpt, or the assertion fails in step 1 with the text copied exactly, stop and report instead of adapting the plan. Include the object the test printed.

## Maintenance notes

When OpenAI ships a model family that needs a different flag, change the pattern at `app/providers.cjs:63` and add the new name to this table in the same commit. One caution for the reader of the table: `chatgpt-4o-latest` is `true` today because the pattern looks for `chat-latest`, which that name does not contain. Whether that model really accepts a schema was not checked against the provider. The table records current behaviour.
