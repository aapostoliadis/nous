# Plan 009: Answer unchanged static files with 304 instead of resending them

> **Executor instructions.** Follow the steps in order. Run every verification command and compare with the expected result before moving on. If a STOP condition applies, stop and report instead of improvising. When finished, update this plan's row in `plans/README.md` (unless a reviewer maintains the index for you).
>
> **Drift check (run first):** `git diff --stat 95dd4e8..HEAD -- app/server.cjs tests/verify-hosting.cjs`
> Plans 002 and 008 also edit these files; that is expected. If the static response line quoted below no longer exists, STOP and report.

## Status

| Field | Value |
| --- | --- |
| Priority | P3 |
| Effort | S |
| Risk | LOW |
| Depends on | none. Do not run at the same time as 002 or 008 (same files) |
| Category | performance |
| Planned at | commit `95dd4e8`, 2026-11-13 |

## Why this matters

Every static file is served with `Cache-Control: no-cache`, which tells the browser to check with the server before using its copy. But the server sends no `ETag` or `Last-Modified`, so the browser has nothing to check with and downloads every file in full on every page load: about twenty stylesheets and scripts plus fonts and artwork. On the hosted site each of those is also a function invocation that reads the file and sends the bytes. With an `ETag`, an unchanged file costs a short `304 Not Modified` with no body. People still get new code the moment it is deployed, which is the reason `no-cache` was chosen.

## Current state

`app/server.cjs` (70 lines, long lines; search for the quoted strings).

Line 1–5: `require` lines for `node:http`, `node:fs`, `node:path`, `./providers.cjs`, `./agents.cjs`.

Line 59, reading the file:

```js
let data;try{data=await fs.promises.readFile(file);}catch{return json(res,404,{error:'Not found.'});}
```

Line 60, the response (one line in the file):

```js
res.setHeader('Content-Type',({'html':'text/html; charset=utf-8','js':'text/javascript','css':'text/css','svg':'image/svg+xml','png':'image/png','webp':'image/webp','woff2':'font/woff2'})[path.extname(file).slice(1)]);res.setHeader('Cache-Control','no-cache');res.setHeader('X-Content-Type-Options','nosniff');if(relative==='index.html'){res.setHeader('Content-Security-Policy',"frame-ancestors 'none'");res.setHeader('X-Frame-Options','DENY');}res.end(req.method==='HEAD'?undefined:data);
```

There is no `ETag` or `If-None-Match` anywhere in the file.

`tests/verify-hosting.cjs` has a helper `request(url,options)` that resolves `{status,body,headers,chunks}` and accepts `options.headers`. It already fetches static assets and checks their headers. It runs every assertion twice, once in local mode and once in hosted mode.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Syntax check | `node --check app/server.cjs` | no output |
| Hosting tests | `node tests/verify-hosting.cjs` | two `Hosting … passed.` lines, exit 0 |
| Full suite | `npm test` | exit 0 |

## Scope

**In scope**

- `app/server.cjs` (the static file response only)
- `tests/verify-hosting.cjs`

**Out of scope**

- Changing `Cache-Control`. `no-cache` stays, so a deploy is picked up at once.
- Caching file contents in memory, compression, `Last-Modified`, range requests.
- API responses.
- The `?v=` queries in `index.html`.

## Git workflow

- Branch: `advisor/009-add-etag-revalidation`
- Commit style: one imperative sentence, as in `Print the full result, not just the summary card (#43)`. Leave the PR number off.
- Do not push or open a PR unless you were told to.

## Steps

### 1. Write the failing test first

In `tests/verify-hosting.cjs`, near the existing static asset checks inside the main `try{` block, add:

```js
const first=await request('/app.js');
assert.equal(first.status,200);assert.match(first.headers.etag||'',/^"[A-Za-z0-9_-]+"$/,'Static files need an ETag so the browser can revalidate');
const same=await request('/app.js',{headers:{'If-None-Match':first.headers.etag}});
assert.equal(same.status,304);assert.equal(same.body,'','A 304 must not carry a body');assert.equal(same.headers.etag,first.headers.etag);
const weak=await request('/app.js',{headers:{'If-None-Match':'"other", W/'+first.headers.etag}});assert.equal(weak.status,304,'A list and a weak validator must match');
const stale=await request('/app.js',{headers:{'If-None-Match':'"not-the-current-version"'}});assert.equal(stale.status,200);assert(stale.body.length>0);
```

Check first that `/app.js` is the path the test already uses for that file (the app may be served under another prefix in the test). Use the path the existing asset checks use.

**Verify:** `node tests/verify-hosting.cjs` → fails with `Static files need an ETag…`.

### 2. Add the ETag

In `app/server.cjs`:

1. Add `const crypto=require('node:crypto');` with the other `require` lines.
2. In the response line, directly after `res.setHeader('X-Content-Type-Options','nosniff');`, insert:

   ```js
   const etag='"'+crypto.createHash('sha1').update(data).digest('base64url')+'"';res.setHeader('ETag',etag);
   ```

3. Replace the final `res.end(req.method==='HEAD'?undefined:data);` with:

   ```js
   // no-cache makes the browser revalidate every load; this lets an unchanged file cost a 304 instead of its full body.
   if(String(req.headers['if-none-match']||'').split(',').map(s=>s.trim().replace(/^W\//,'')).includes(etag)){res.statusCode=304;return res.end();}
   res.end(req.method==='HEAD'?undefined:data);
   ```

The 304 must be sent after the other headers are set, so `Cache-Control`, `ETag` and (for `index.html`) the security headers are present on it too. Check how the surrounding code sets the status for a 200: if it calls `res.writeHead(200,…)` before this line, set the 304 before that call instead and report what you changed.

SHA-1 is used here as a content fingerprint, not for security.

**Verify:** `node --check app/server.cjs` → no output. `node tests/verify-hosting.cjs` → both `passed.` lines.

### 3. Run everything

**Verify:** `npm test` → exit 0.

## Test plan

Four assertions in `tests/verify-hosting.cjs` (step 1): the header exists, a matching validator gets an empty 304, a list with a weak validator matches, and a stale validator gets the full file. They run in both local and hosted modes.

## Done criteria

- [ ] `node tests/verify-hosting.cjs` failed after step 1 and passes after step 2.
- [ ] `npm test` exits 0.
- [ ] `grep -c "res.setHeader('ETag',etag)" app/server.cjs` prints `1`.
- [ ] `grep -c "'Cache-Control','no-cache'" app/server.cjs` is unchanged from before (still present).
- [ ] `git status --short` lists only `app/server.cjs` and `tests/verify-hosting.cjs` (and `plans/README.md`).
- [ ] This plan's row in `plans/README.md` is updated.

## STOP conditions

- The static response is no longer a single block that has `data` in hand before sending.
- The hosted entry (`app/vercel-entry.mjs`) or `vercel.json` already adds an `ETag` or strips `If-None-Match`. Check with `grep -n -i "etag\|if-none-match" app/vercel-entry.mjs vercel.json app/vercel.json`.
- The 304 test passes in local mode and fails in hosted mode. Report the difference.

## Maintenance notes

- The server still reads and hashes each file on every request. That is cheap at this size. If it ever matters, cache `{data,etag}` per path at first read; on Vercel the cache lives as long as the function instance.
- After deploy, confirm on the live site: reload the page with developer tools open and check that scripts and stylesheets show status 304. Vercel's edge may answer some requests itself; either way the body should not be re-downloaded.
- If `Cache-Control` is ever changed to allow caching without revalidation, the `?v=` queries in `index.html` become the only way to ship new code, and must be bumped on every change.
