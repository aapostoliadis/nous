# Plan 013: Stop re-parsing the whole answer on every streamed fragment

> **Executor instructions.** Follow the steps in order. Run every verification command and compare with the expected result before moving on. If a STOP condition applies, stop and report instead of improvising. When finished, update this plan's row in `plans/README.md` (unless a reviewer maintains the index for you).
>
> **Drift check (run first):** `git diff --stat 95dd4e8..HEAD -- app/streaming.cjs tests/verify-streaming.cjs`
> No other plan edits these files. If the lines quoted below have changed, STOP and report.

## Status

| Field | Value |
| --- | --- |
| Priority | P3 |
| Effort | S |
| Risk | LOW |
| Depends on | none |
| Category | performance |
| Planned at | commit `95dd4e8`, 2026-11-13 |

## Why this matters

While a provider streams an answer, the server pulls the readable part out of the partial JSON so the page can show text as it arrives. It does this by scanning the whole output so far, from the first character, every time a fragment arrives. Only the *sending* of progress is throttled; the scan is not. Providers often send fragments of a few characters, so a long answer is scanned thousands of times and the work grows with the square of the length.

Measured on a development machine with a 60,000-character answer delivered one character at a time: 10.9 seconds of server CPU with the current code, 0.25 seconds with the change below, identical output and the same number of progress updates (418). On the hosted site that CPU is billed function time, and it counts against the run's time limit.

## Current state

`app/streaming.cjs` (92 lines). `partialAnswer(source)` is defined on lines 2–31 and scans `source` from index 0.

Line 36, the state for one stream:

```js
let buffer='',output='',previous='',finished=false,reason='',done=false,total=0,lastUpdate=0,searched=false,lastStep='';
```

Line 66, the reset after a web search step:

```js
if(searched){output='';previous='';searched=false;}
```

Lines 77–78, run for every fragment:

```js
      const answer=partialAnswer(output).slice(0,20000);
      if(answer!==previous&&(answer.length-previous.length>=48||Date.now()-lastUpdate>=120)){previous=answer;lastUpdate=Date.now();onProgress(answer);}
```

`lastUpdate` is used nowhere else in the file. Confirm with `grep -c "lastUpdate" app/streaming.cjs` → `3` (one on line 36, two on line 78).

`tests/verify-streaming.cjs` (51 lines) is a plain Node script. Its body is an async IIFE that ends:

```js
  console.log('PASS streaming web search: …');
  console.log('PASS streaming: all three provider adapters, …No provider calls.');
})().catch(e=>{console.error(e);process.exitCode=1});
```

It imports `{partialAnswer,readProviderStream}` from `../app/streaming.cjs` and calls it like this:

```js
readProviderStream(response(frames('responses')),'responses',()=>{},aborted.signal)
```

The first argument is an object with a `body` that is an async iterable of byte chunks. Read the file's `response(text)` helper to see the exact shape before writing the new test.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Syntax check | `node --check app/streaming.cjs` | no output |
| Streaming tests | `node tests/verify-streaming.cjs` | its `PASS` lines, exit 0 |
| Full suite | `npm test` | exit 0 |

## Scope

**In scope**

- `app/streaming.cjs`: lines 36, 66 and 77–78 only.
- `tests/verify-streaming.cjs`: one new test.

**Out of scope**

- Rewriting `partialAnswer` as an incremental parser. The throttle removes the cost without touching its logic.
- The thresholds themselves (48 characters, 120 ms). Keep both numbers.
- The browser side. `app/agents.js` re-renders the whole answer as markdown on each progress event; that is a possible follow-up, not part of this plan.
- `app/providers.cjs`, `app/agents.cjs`, `app/server.cjs`.

## Git workflow

- Branch: `advisor/013-throttle-streaming-rescan`
- Commit style: one imperative sentence, as in `Print the full result, not just the summary card (#43)`. Leave the PR number off.
- Do not push or open a PR unless you were told to.

## Steps

### 1. Write the failing test first

In `tests/verify-streaming.cjs`, inside the async IIFE and before the final two `console.log('PASS …')` lines, add:

```js
  // A long answer arriving one character at a time must not be re-parsed from the start for every character.
  {
    const long=JSON.stringify({title:'T',answer:'word '.repeat(12000),references:[],objects:[]});
    let text='';for(const ch of long)text+='data: '+JSON.stringify({type:'response.output_text.delta',delta:ch})+'\n\n';
    text+='data: '+JSON.stringify({type:'response.completed',response:{status:'completed'}})+'\n\n';
    const bytes=Buffer.from(text);
    const body=(async function*(){for(let i=0;i<bytes.length;i+=65536)yield bytes.subarray(i,i+65536);})();
    let calls=0,last='';const started=Date.now();
    const result=await readProviderStream({body},'responses',p=>{if(typeof p==='string'){calls++;last=p;}});
    const took=Date.now()-started;
    assert(calls>10,'Progress must still be reported while streaming');
    assert(last.startsWith('word word'),'Progress must carry the answer text');
    assert(took<3000,`A 60,000-character answer in 1-character fragments took ${took} ms; the partial answer is being re-parsed too often`);
    assert(result);
  }
```

Before running it, check two things against the existing tests in the file and adjust the test, not the app:

- The stream object shape. If `response(text)` returns something other than `{body}`, build the object the same way it does.
- The event format. If `frames('responses')` builds its delta and completion events differently from the two `JSON.stringify` lines above, copy its format.

**Verify:** `node tests/verify-streaming.cjs` → fails with `…took <N> ms; the partial answer is being re-parsed too often`, with N well above 3000. If it passes at this point, see the STOP conditions.

### 2. Throttle the parse, not just the send

In `app/streaming.cjs`:

1. Line 36: replace `total=0,lastUpdate=0,` with `total=0,parsedAt=0,lastParse=0,`.
2. Line 66: replace with

   ```js
   if(searched){output='';previous='';parsedAt=0;searched=false;}
   ```

3. Lines 77–78: replace both lines with

   ```js
         // Parse only when enough new text has arrived or enough time has passed. Parsing on every fragment re-reads the whole output each time.
         if(output.length-parsedAt>=48||Date.now()-lastParse>=120){
           parsedAt=output.length;lastParse=Date.now();
           const answer=partialAnswer(output).slice(0,20000);
           if(answer!==previous){previous=answer;onProgress(answer);}
         }
   ```

Keep the indentation of the surrounding lines. Do not change what happens when the stream ends: the final result is built from the complete output elsewhere in the function, so the last few characters are never lost.

**Verify:** `node --check app/streaming.cjs` → no output. `grep -c "lastUpdate" app/streaming.cjs` → `0`. `node tests/verify-streaming.cjs` → all `PASS` lines, exit 0.

### 3. Run everything

**Verify:** `npm test` → exit 0.

## Test plan

One new test in `tests/verify-streaming.cjs` (step 1): a long answer in one-character fragments finishes inside a time bound, still reports progress, and the progress carries the answer text. The existing streaming tests cover correctness for all three provider formats, the web search reset and cancellation; they must pass unchanged.

The time bound depends on the machine. 3000 ms sits between the measured 250 ms after the fix and 10,900 ms before it.

## Done criteria

- [ ] `node tests/verify-streaming.cjs` failed after step 1 and passes after step 2.
- [ ] `npm test` exits 0.
- [ ] `grep -c "lastUpdate" app/streaming.cjs` prints `0`.
- [ ] `grep -c "parsedAt" app/streaming.cjs` prints `4`.
- [ ] `git status --short` lists only `app/streaming.cjs` and `tests/verify-streaming.cjs` (and `plans/README.md`).
- [ ] This plan's row in `plans/README.md` is updated.

## STOP conditions

- The new test passes before step 2. Either the machine is much faster than the one this was measured on or the events are not reaching the delta branch. Check that `calls` is above 10. If the events are right and it still passes, raise the repeat count from 12000 to 30000 once; if it still passes, report the timing instead of forcing a failure.
- Any existing streaming test fails after step 2. An existing test may depend on a progress call for a very short answer; report which one rather than changing its expectation.
- `partialAnswer` is called from another place inside the read loop.

## Maintenance notes

- After this change the first progress update arrives once 48 characters of raw output exist or 120 ms have passed, whichever is first. That is the same rule the old code used for sending.
- If answers ever grow far beyond 20,000 visible characters, the remaining cost is one full scan per 48 characters. An incremental parser that remembers its position would remove that too.
- A flaky failure of the timing test on a slow CI runner means the bound is too tight for that runner, not that the fix regressed. Check `grep -c "parsedAt" app/streaming.cjs` before loosening it.
- Browser follow-up: `app/agents.js` sets `innerHTML` to the full rendered answer on every progress event. Coalescing those into one update per animation frame is a separate small change.
