# 023. Stop the Agents stream reader at 16,000,000 bytes

| | |
| --- | --- |
| Priority | P3 |
| Effort | S |
| Risk | LOW |
| Category | bug |
| Depends on | none (edits the same test file as 019; run them one after the other) |
| Written against | `25910a5` on 2026-11-20 |

## Why

When an agent runs, the browser reads the server's answer as a stream of lines. `stream()` in `app/agents.js` adds every chunk to a string and never checks how much it has read. A response that never ends, or one that never sends a line break, grows that string until the tab runs out of memory. The Connections reader already guards against this: `app/connections.js:64` stops at 16,000,000 bytes. This plan gives the Agents reader the same limit and adds a test for it.

## What is there now

`app/agents.js`, lines 109 to 117. This is the function the plan changes.

```js
  async function stream(response,signal,onAnswer,onStep){
    if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||'The provider could not finish the request.');}
    if(!response.headers.get('content-type')?.includes('application/x-ndjson'))return response.json();
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',result=null;
    const event=line=>{if(!line.trim())return;const item=JSON.parse(line);if(item.type==='error')throw Error(item.error||'The provider interrupted the run.');if(item.type==='answer')onAnswer(item.answer);if(item.type==='step')onStep?.(item.step);if(item.type==='complete')result=item.result;};
    try{while(true){signal.throwIfAborted();const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))!==-1){event(buffer.slice(0,end));buffer=buffer.slice(end+1);}}event(buffer+decoder.decode());}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    if(!result)throw Error('The connection ended before the result was complete. Run it again.');return result;
  }
```

The `finally` line already cancels the connection when the loop throws. The new limit relies on that; do not change it.

`app/agents.js:561`, the test seam. It hands internal functions to the test file when the test sets `window.__agentsTest`.

```js
  if(window.__agentsTest)Object.assign(window.__agentsTest,{md,trimRuns,withParent,tick,setMode,db:()=>db,improving:()=>improving});
```

The precedent, inside the long line at `app/connections.js:64`. Read it; do not edit it.

```js
while(true){signal.throwIfAborted();const chunk=await reader.read();if(chunk.done)break;total+=chunk.value.byteLength;if(total>16000000)throw Error('The response was too large. Please retry with a smaller request.');buffer+=decoder.decode(chunk.value,{stream:true});
```

`tests/verify-agents-client.cjs`, three places.

Line 29, part of the fake browser environment the test builds:

```js
    crypto:require('node:crypto').webcrypto,MutationObserver:class{observe(){}disconnect(){}},AbortController,setTimeout:()=>0,setInterval:()=>0,
```

Line 52, the check that the seam exposes what the test needs:

```js
  for(const name of ['md','trimRuns','withParent','improving','setMode'])assert.equal(typeof h.t[name],'function',`the test seam does not expose ${name}`);
```

Lines 141 to 146, the end of the file:

```js
  assert.equal(JSON.parse(h.storage.get(KEY)).agents[0].ranAt,claim,'this tab overwrote a schedule another tab had already claimed');
  assert.equal(h.t.db().runs.length,0,'a scheduled run another tab already started was started again');

  for(const line of skipped)console.log(line);
  console.log('PASS agents client: Markdown escaping, run trimming, follow-up text, the improved-instructions cap, the workspace return focus, import and stored ids, changes from another tab and claimed schedules passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
```

If plan 019 was merged first, the line numbers in this test file are 8 higher than stated here. Find each place by its content, not by its number.

Both files use two spaces of indentation inside their main function and no spaces around operators. Both have LF line endings. Keep whatever line ending each file already has.

## Steps

### 1. Count the bytes in `stream()`

In `app/agents.js`, in the line that starts with `    const reader=response.body.getReader(),decoder=new TextDecoder();` (line 112), change

```js
let buffer='',result=null;
```

to

```js
let buffer='',result=null,total=0;
```

In the line that starts with `    try{while(true){signal.throwIfAborted();` (line 114), change

```js
if(done)break;buffer+=decoder.decode(value,{stream:true});
```

to

```js
if(done)break;total+=value.byteLength;if(total>16000000)throw Error('The result was too large to read. Run it again with a narrower request.');buffer+=decoder.decode(value,{stream:true});
```

Change nothing else in either line.

**Verify:** `grep -c "total>16000000" app/agents.js` → prints `1`.

### 2. Expose `stream` on the test seam

In `app/agents.js`, in the line that starts with `  if(window.__agentsTest)Object.assign(` (line 561), change `{md,trimRuns,` to `{md,stream,trimRuns,`.

**Verify:** `grep -c "{md,stream,trimRuns," app/agents.js` → prints `1`.

**Verify:** `node --check app/agents.js` → exits 0 with no output.

### 3. Give the test environment a `TextDecoder`

In `tests/verify-agents-client.cjs`, in the line that starts with `    crypto:require('node:crypto').webcrypto,` (line 29), change `AbortController,setTimeout:()=>0,` to `AbortController,TextDecoder,setTimeout:()=>0,`.

`stream()` creates a `TextDecoder`. The fake environment did not have one, because no test called `stream()` before.

### 4. Require `stream` on the seam

In the line that starts with `  for(const name of ['md','trimRuns',` (line 52), change `['md','trimRuns',` to `['md','stream','trimRuns',`.

### 5. Add the test

Directly before the line `  for(const line of skipped)console.log(line);` (line 144), insert these eleven lines, followed by one empty line:

```js
  // Stream reader: a response that never ends must stop at 16,000,000 bytes instead of filling the tab's memory.
  const ndjson=read=>{const state={cancelled:false};return {state,response:{ok:true,headers:{get:()=>'application/x-ndjson'},body:{getReader:()=>({read,cancel:async()=>{state.cancelled=true;},releaseLock(){}})}}};};
  const lines=[Buffer.from('{"type":"answer","answer":"Hi"}\n{"type":"comp'),Buffer.from('lete","result":{"answer":"Hi there"}}\n')],answers=[];
  const small=ndjson(async()=>lines.length?{done:false,value:lines.shift()}:{done:true});
  const result=await h.t.stream(small.response,new AbortController().signal,a=>answers.push(a));
  assert.equal(result.answer,'Hi there','a result split across two chunks was not read');assert.equal(answers.join(),'Hi');
  let reads=0;const block=new Uint8Array(4000000).fill(32);
  const endless=ndjson(async()=>{reads++;return {done:false,value:block};});
  await assert.rejects(()=>h.t.stream(endless.response,new AbortController().signal,()=>{}),/too large/,'a response with no end was read without a limit');
  assert.equal(reads,5,'the reader must stop at the first chunk that passes 16,000,000 bytes');
  assert.ok(endless.state.cancelled,'the reader must cancel the connection when it stops early');
```

The `\n` inside each string is the two characters backslash and `n`, as written. Do not replace it with a real line break.

The empty line that was already above `for(const line of skipped)` stays above the new block. The result is: the two `assert.equal` lines about schedules, one empty line, the eleven new lines, one empty line, then `for(const line of skipped)`.

How the test works: the first half feeds a small result in two chunks, split in the middle of a line, and checks it is still read. The second half feeds blocks of 4,000,000 bytes without end. Four blocks are exactly 16,000,000 bytes, which is allowed. The fifth block passes the limit, so the reader must throw on the fifth read and cancel the connection.

If the file already declares a variable named `ndjson`, `lines`, `answers`, `small`, `result`, `reads`, `block` or `endless` in the same function, `node` reports `Identifier ... has already been declared`. In that case stop and report; do not rename anything.

### 6. Name the new check in the pass line

In the line that starts with `  console.log('PASS agents client:`, change the end of the text from

```
changes from another tab and claimed schedules passed.
```

to

```
changes from another tab, claimed schedules and the stream size cap passed.
```

**Verify:** `node tests/verify-agents-client.cjs` → exits 0 and prints a line starting with `PASS agents client:` that ends with `the stream size cap passed.`

### 7. Prove the test can fail

In the test file, change `assert.equal(reads,5,` to `assert.equal(reads,4,`.

**Verify:** `node tests/verify-agents-client.cjs` → exits with a non-zero code and the output contains `the reader must stop at the first chunk`.

Change it back to `assert.equal(reads,5,`.

**Verify:** `node tests/verify-agents-client.cjs` → exits 0.

### 8. Run the full suite

**Verify:** `npm test` → exits 0 and the last line is `All test files and syntax checks passed.`

## Done criteria

- [ ] `grep -c "total>16000000" app/agents.js` prints `1`.
- [ ] `grep -c "Stream reader:" tests/verify-agents-client.cjs` prints `1`.
- [ ] `grep -c "assert.equal(reads,5," tests/verify-agents-client.cjs` prints `1`.
- [ ] `git diff --numstat` shows exactly two files: `app/agents.js` with 3 insertions and 3 deletions, and `tests/verify-agents-client.cjs` with 15 insertions and 3 deletions.
- [ ] `npm test` exits 0.
- [ ] One commit on branch `advisor/023-cap-agents-stream-reader`, with a message such as `Stop the Agents stream reader at 16,000,000 bytes`. Do not push or open a PR unless you were told to.

## Out of scope

- `app/connections.js`. Its reader already has the limit.
- A shared reader for both files. The client scripts are separate files with no module system, so there is nowhere to put one.
- The limit value. Use 16,000,000, the same as Connections.
- Any other line of `stream()`, including the `finally` line and the two existing error messages.
- The server. This change is in the browser code only.

## If something is off

If lines 109 to 117 or line 561 of `app/agents.js` no longer match the excerpts, or the new test fails in step 6 with the text copied exactly, stop and report instead of adapting the plan. Include the error text.

## Maintenance notes

The limit counts bytes received, not characters kept, the same way the Connections reader does. A real result is far below it: every provider request sets a token limit (`max_tokens` or `max_output_tokens` in `app/providers.cjs`). If the two readers ever need different limits, say why in a comment next to the number. A person who hits the limit sees `The result was too large to read. Run it again with a narrower request.` in the run's error state.
