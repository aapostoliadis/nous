# Plan 002: Decode request bodies once, so split characters survive

> **Executor instructions.** Follow the steps in order. Run every verification command and compare with the expected result before moving on. If a STOP condition applies, stop and report instead of improvising. When finished, update this plan's row in `plans/README.md` (unless a reviewer maintains the index for you).
>
> **Drift check (run first):** `git diff --stat 95dd4e8..HEAD -- app/server.cjs tests/verify-hosting.cjs`
> If either file changed and the excerpts below no longer match, STOP and report.

## Status

| Field | Value |
| --- | --- |
| Priority | P1 |
| Effort | S |
| Risk | LOW |
| Depends on | none (touches the same files as plans 008 and 009; do them one at a time) |
| Category | bug |
| Planned at | commit `95dd4e8`, 2026-11-13 |

## Why this matters

The server reads a POST body chunk by chunk and turns each chunk into text on its own. A character that takes more than one byte in UTF-8 (Greek, accents, emoji, CJK) can be cut in half at a chunk boundary. Each half then becomes the replacement character `�`, and the prompt or workspace text the provider receives is silently corrupted. Bodies can be up to 350 KB (18 MB for audio), so they regularly arrive in several chunks. The user sees no error; the answer is just about the wrong text.

## Current state

Nous is a static app under `app/` served by `app/server.cjs` (70 lines, no dependencies). Lines are long; find code by searching for the quoted strings.

`app/server.cjs` lines 36–38:

```js
let body='',size=0;
for await(const chunk of req){size+=chunk.length;if(size>(url==='/api/audio'?18000000:350000)){const e=new Error('Workspace exceeds the supported request size.');e.status=413;throw e;}body+=chunk;}
let input;try{input=JSON.parse(body);}catch{}
```

`body+=chunk` converts every `Buffer` chunk to a string separately. That is the bug.

`tests/verify-hosting.cjs` (81 lines) is where server behaviour is tested. It re-runs itself once for local mode and once for hosted mode, replaces `app/providers.cjs` with a stub, and sends real HTTP requests to the handler. The stub (search `require.cache[providerPath]`):

```js
require.cache[providerPath]={id:providerPath,filename:providerPath,loaded:true,exports:{status:()=>[{id:'openai',configured:false}],listModels:async(provider,opts)=>{modelKey=opts.key;return {models:[]};},ask:async(input,fetch,signal,emit)=>{asks++;assert.equal(input.prompt,'Hello');assert.equal(input.key,userKey,'Key must come from the header, not the body');emit?.('First part');await new Promise(r=>setTimeout(r,30));return {answer:'First part, complete.'};},audioRequest:async()=>({ok:true})}};
```

The `ask` stub insists the prompt is `'Hello'` and the test later asserts exact call counts (`assert.equal(asks,1)`, `assert.equal(asks,3)`). **Do not send the new test through `/api/ask`.** Use `/api/audio`, whose stub accepts anything.

Variables declared just above the stub: `let asks=0,modelKey;`

The existing request helper sends the body in a single write, so it cannot split a character:

```js
function request(url,options={}){
  return new Promise((resolve,reject)=>{
    const req=http.request({host:'127.0.0.1',port:server.address().port,path:url,method:options.method||'GET',headers:{Host:host,...options.headers}},res=>{
      let body='';const chunks=[];res.on('data',chunk=>{body+=chunk;chunks.push(chunk.toString());});res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers,chunks}));
    });req.on('error',reject);req.end(options.body);
  });
}
```

Also available in the test: `host` and `origin` (`const origin=(hosted?'https://':'http://')+host;`). `/api/audio` rejects requests without an `Origin` header and requires `Content-Type: application/json`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Syntax check | `node --check app/server.cjs` | no output, exit 0 |
| Hosting tests only | `node tests/verify-hosting.cjs` | two lines, `Hosting local: …passed.` and `Hosting Vercel: …passed.`, exit 0 |
| Full suite | `npm test` | exit 0 |

## Scope

**In scope**

- `app/server.cjs` (the body-reading lines only)
- `tests/verify-hosting.cjs`

**Out of scope**

- The size limits (350000 and 18000000) and the 413 message.
- `app/providers.cjs`, `app/agents.cjs`, `app/streaming.cjs`. Provider response decoding is already tested.
- Any other header or routing behaviour in `server.cjs`.

## Git workflow

- Branch: `advisor/002-decode-request-bodies-as-utf8`
- Commit style: one imperative sentence, as in `Print the full result, not just the summary card (#43)`. Leave the PR number off.
- Do not push or open a PR unless you were told to.

## Steps

### 1. Write the failing test first

In `tests/verify-hosting.cjs`:

1. Change `let asks=0,modelKey;` to `let asks=0,modelKey,audioInput;`.
2. In the stub, change `audioRequest:async()=>({ok:true})` to `audioRequest:async input=>{audioInput=input;return {ok:true};}`.
3. Directly after the `request` function, add a helper that sends the body in two separate writes:

   ```js
   // Sends the body as two chunks so a multi-byte character can straddle the boundary.
   function splitPost(url,headers,parts){
     return new Promise((resolve,reject)=>{
       const req=http.request({host:'127.0.0.1',port:server.address().port,path:url,method:'POST',headers:{Host:host,...headers}},res=>{
         let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body}));
       });req.on('error',reject);req.setNoDelay(true);req.write(parts[0]);setTimeout(()=>req.end(parts[1]),50);
     });
   }
   ```

4. Inside the main `try{` block, after the loop that posts `'null'`, `'[]'` and `'"text"'` to `/api/ask` and before the streaming request, add:

   ```js
   const utf='Ελληνικά 😀 naïve',raw=Buffer.from(JSON.stringify({text:utf})),cut=raw.indexOf(Buffer.from('λ'))+1; // one byte into a two-byte character
   const split=await splitPost('/api/audio',{Origin:origin,'Content-Type':'application/json'},[raw.subarray(0,cut),raw.subarray(cut)]);
   assert.equal(split.status,200,split.body);assert.equal(audioInput.text,utf,'A character split across chunks must survive');
   ```

**Verify:** `node tests/verify-hosting.cjs` → **fails** with an `AssertionError` mentioning `A character split across chunks must survive`. This proves the test catches the bug. If it passes at this point, STOP (see STOP conditions).

### 2. Fix the server

In `app/server.cjs`, replace the two lines quoted under "Current state" (`let body='',size=0;` and the `for await` line) with:

```js
const chunks=[];let size=0;
for await(const chunk of req){size+=chunk.length;if(size>(url==='/api/audio'?18000000:350000)){const e=new Error('Workspace exceeds the supported request size.');e.status=413;throw e;}chunks.push(chunk);}
const body=Buffer.concat(chunks).toString('utf8'); // Decode once: a character split across chunks must not become U+FFFD.
```

Leave the next line (`let input;try{input=JSON.parse(body);}catch{}`) as it is.

**Verify:** `node --check app/server.cjs` → no output. `node tests/verify-hosting.cjs` → both `Hosting … passed.` lines, exit 0.

### 3. Run everything

**Verify:** `npm test` → exit 0.

## Test plan

One new assertion in `tests/verify-hosting.cjs` (step 1), run in both local and hosted modes because the file re-runs itself for each. It follows the file's existing style: real HTTP against the handler, stubbed provider module, `assert` from `node:assert/strict`.

## Done criteria

- [ ] `node tests/verify-hosting.cjs` failed after step 1 and passes after step 2.
- [ ] `npm test` exits 0.
- [ ] `grep -c "body+=chunk;}" app/server.cjs` prints `0`.
- [ ] `grep -c "Buffer.concat(chunks)" app/server.cjs` prints `1`.
- [ ] `git status --short` lists only `app/server.cjs` and `tests/verify-hosting.cjs` (and `plans/README.md`).
- [ ] This plan's row in `plans/README.md` is updated.

## STOP conditions

- The new test passes before the fix. The two writes are being merged into one chunk on your machine; report it rather than weakening the assertion. (A reviewer may then raise the 50 ms delay.)
- Adding the test changes the `asks` counts or breaks another assertion.
- The body-reading code no longer matches the excerpt.

## Maintenance notes

- If someone later switches to `req.setEncoding('utf8')`, the size check would count characters, not bytes. Keep counting `Buffer` lengths.
- Plans 008 and 009 edit a different line of `server.cjs` and add assertions to the same test file. Rebase rather than merge by hand.
