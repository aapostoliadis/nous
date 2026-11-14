# Plan 005: Show a readable error when the server answers with something that is not JSON

> **Executor instructions.** Follow the steps in order. Run every verification command and compare with the expected result before moving on. If a STOP condition applies, stop and report instead of improvising. When finished, update this plan's row in `plans/README.md` (unless a reviewer maintains the index for you).
>
> **Drift check (run first):** `git diff --stat 95dd4e8..HEAD -- app/connections.js app/dictation.js app/audio-tools.js`
> If a file changed and the excerpts below no longer match, STOP and report.

## Status

| Field | Value |
| --- | --- |
| Priority | P2 |
| Effort | S |
| Risk | LOW |
| Depends on | none |
| Category | bug |
| Planned at | commit `95dd4e8`, 2026-11-13 |

## Why this matters

Six places in the browser code call `response.json()` before checking whether the request succeeded. When the response is not JSON, `json()` throws and the person sees the parser's message, such as `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`, instead of Nous's own error text. This happens in normal operation on the hosted site: when a function times out or crashes, Vercel answers 502 or 504 with an HTML page. A proxy or captive portal does the same. The message tells the person nothing about what to do.

One call site in the same file already does this correctly. This plan copies that pattern to the others.

## Current state

Nous is a static app under `app/` with no build step. The files are browser scripts with long lines. Find code by searching for the quoted strings.

The exemplar to copy, `app/connections.js` lines 118–119:

```js
const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'The key could not be checked.');
```

The six sites to fix:

| # | File and line | Current code |
| --- | --- | --- |
| 1 | `app/connections.js:54` | `if(!response.ok){const data=await response.json();throw Error(data.error\|\|'The provider could not finish the request.');}` |
| 2 | `app/connections.js:94` | `const data=await response.json();if(!response.ok)throw Error(data.error\|\|'Models unavailable');` |
| 3 | `app/dictation.js:37` | `const data=await r.json();if(!r.ok)throw Error(data.error\|\|'Connect OpenAI to transcribe your speech.');` |
| 4 | `app/dictation.js:45-46` | `const result=await response.json();if(!response.ok)throw Error(result.error\|\|'Speech could not be transcribed. Retry the recording.');` |
| 5 | `app/audio-tools.js:68` | `const data=await r.json();if(!r.ok)throw Error(data.error\|\|'Audio request failed.');` |
| 6 | `app/audio-tools.js:75` | `const data=await r.json();if(!r.ok)throw Error(data.error);` |

(The `\|\|` in the table is `||` in the source.)

Sites 2–6 go on to use `data` (or `result`) when the response is OK. So a successful status with an unreadable body must also raise the fallback message instead of continuing with an empty object.

Tests that load these files with fake `fetch` responses: `tests/verify-dictation.cjs` and `tests/verify-provider-client.cjs`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Syntax check | `node --check app/connections.js && node --check app/dictation.js && node --check app/audio-tools.js` | no output, exit 0 |
| Full suite | `npm test` | exit 0 |

## Scope

**In scope**

- `app/connections.js`, `app/dictation.js`, `app/audio-tools.js` (the six sites only)
- `tests/verify-dictation.cjs`, `tests/verify-provider-client.cjs` (only if a fake response needs an async `json`, and for the new assertion in step 3)

**Out of scope**

- `app/agents.js` and `app/ask.js`. Check them in step 1 and report what you find; do not change them here.
- The wording of existing fallback messages.
- Server code.

## Git workflow

- Branch: `advisor/005-handle-non-json-error-responses`
- Commit style: one imperative sentence, as in `Print the full result, not just the summary card (#43)`. Leave the PR number off.
- Do not push or open a PR unless you were told to.

## Steps

### 1. List every site

```bash
grep -n -o -E "\.json\(\);(if\(!|throw)" app/*.js
```

**Verify:** the output names the six sites in the table (site 1 matches `.json();throw`). If it names sites in other files, list them in your report as follow-ups and leave them alone.

### 2. Fix the six sites

Site 1 (the body is read only on failure, so an empty object is enough):

```js
if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||'The provider could not finish the request.');}
```

Sites 2–5 (keep each site's own variable names and its own fallback message):

```js
const data=await response.json().catch(()=>null);if(!response.ok||!data)throw Error(data?.error||'Models unavailable');
```

Apply the same shape to sites 3, 4 and 5: `.catch(()=>null)`, then `if(!r.ok||!data)throw Error(data?.error||'<that site's existing message>')`. Site 4 uses `result` and `response`.

Site 6 has no fallback message today, so a failure without an `error` field shows an empty error. Give it one:

```js
const data=await r.json().catch(()=>null);if(!r.ok||!data)throw Error(data?.error||'Models unavailable');
```

**Verify:** the syntax check command → no output. `grep -n -E "\.json\(\);(if\(!|throw)" app/connections.js app/dictation.js app/audio-tools.js` → no output.

### 3. Run the tests and add one

Run `npm test`. If a test now fails with `response.json(...).catch is not a function`, the test's fake response returns a plain value from `json`. Change that fake to `json:async()=>(…)` in the test file. Do not change the app code to suit the fake.

Then, in `tests/verify-dictation.cjs`, add one case in the file's existing style: a fake transcription response with `ok:false,status:502` whose `json` rejects (`json:async()=>{throw new SyntaxError("Unexpected token '<'");}`). Assert that the status text the page shows is `Speech could not be transcribed. Retry the recording.` and does not contain `Unexpected token`. Read the file first to see how it drives a recording and reads the status element, and copy that.

**Verify:** `npm test` → exit 0.

## Test plan

One new failing-server case in `tests/verify-dictation.cjs` (step 3). The other sites share the exact pattern and are covered by the grep in step 2. If the dictation harness cannot reach the transcription call without large changes, say so in the report and mark the new test `Not added`.

## Done criteria

- [ ] The grep in step 2 prints nothing.
- [ ] `grep -c "catch(()=>null)" app/dictation.js` prints `2`; the same for `app/audio-tools.js` prints `2`; for `app/connections.js` prints `1`.
- [ ] `npm test` exits 0.
- [ ] `git status --short` lists only in-scope files (and `plans/README.md`).
- [ ] This plan's row in `plans/README.md` is updated.

## STOP conditions

- A site's ok-path deliberately accepts an empty body (for example a 204 response). The `!data` check would break it. Report the site.
- More than two test fakes need changing. Report the count before editing them.
- A site no longer matches its excerpt.

## Maintenance notes

- New fetch call sites should read the body with `.catch(...)` and check `ok` in the same statement, as these do.
- A shared helper (`readJson(response, fallback)`) would remove the repetition. It was left out to keep this change small; the files do not share a module today.
