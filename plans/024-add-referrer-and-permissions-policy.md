# 024. Send a referrer policy and a permissions policy with the page

| | |
| --- | --- |
| Priority | P3 |
| Effort | S |
| Risk | LOW |
| Category | security |
| Depends on | none (edits the same test file as 022; run them one after the other) |
| Written against | `25910a5` on 2026-11-20 |

## Why

The server sends a content security policy and `X-Frame-Options` with the page. It sends no `Referrer-Policy` and no `Permissions-Policy`. Without the first, a link a person follows from an agent's result tells the other site which address they came from. Without the second, the page keeps the right to ask for the camera, location, screen capture, payment and USB devices, none of which Nous uses. If a script were ever injected, it could ask for them under the app's name. This plan adds both headers and tests them. The microphone stays allowed, because dictation and the audio tools record sound.

## What is there now

`app/server.cjs:8`, the policy constant the new constant goes under:

```js
const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
```

`app/server.cjs:64` is one long line that serves static files. It ends with this, which is where the page's headers are set:

```js
if(relative==='index.html'){res.setHeader('Content-Security-Policy',CSP);res.setHeader('X-Frame-Options','DENY');}
```

`app/vercel-entry.mjs` re-exports the handler from `app/server.cjs`. A header set in `app/server.cjs` is therefore sent both locally and on the hosted site. Do not edit `app/vercel-entry.mjs` or either `vercel.json`.

`tests/verify-hosting.cjs`, lines 72 to 78. `request` is the test's helper that sends a request to the server under test; it returns `status` and `headers`.

```js
      const linked=await request('/',{headers:{'Sec-Fetch-Site':'cross-site'}});
      assert.equal(linked.status,200,'A link from another site must open the page');
      const csp=linked.headers['content-security-policy']||'';
      for(const part of ["default-src 'self'","script-src 'self'","object-src 'none'","base-uri 'none'","frame-ancestors 'none'"])assert(csp.includes(part),'CSP must include '+part);
      assert(!/script-src[^;]*unsafe-inline/.test(csp),'Scripts must not allow inline code');
      assert.equal(linked.headers['x-frame-options'],'DENY');
      assert.equal((await request('/api/providers',{headers:{'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate'}})).status,403);
```

These lines are indented with six spaces. This block runs twice, once against the local server and once against the Vercel entry, so the new assertions cover both.

If plan 022 was merged first, the line numbers in this test file are 11 higher than stated here. Find each place by its content, not by its number.

Both files have LF line endings and use no spaces around operators. Keep whatever line ending each file already has.

## Steps

### 1. Add the permissions constant

In `app/server.cjs`, directly after line 8 (the line that starts with `const CSP=`), insert these two lines exactly:

```js
// The page records sound for dictation and audio tools. It uses no other device feature, so the rest are switched off.
const PERMISSIONS='camera=(), display-capture=(), geolocation=(), microphone=(self), payment=(), usb=()';
```

**Verify:** `grep -c "^const PERMISSIONS=" app/server.cjs` → prints `1`.

### 2. Send both headers with the page

In `app/server.cjs`, in the long line that now is line 66 (it was line 64), change

```js
res.setHeader('X-Frame-Options','DENY');}
```

to

```js
res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Permissions-Policy',PERMISSIONS);}
```

The text `res.setHeader('X-Frame-Options','DENY');}` appears once in the file. Change nothing else on that line.

**Verify:** `grep -c "res.setHeader('Permissions-Policy',PERMISSIONS)" app/server.cjs` → prints `1`.

**Verify:** `node --check app/server.cjs` → exits 0 with no output.

### 3. Add the assertions

In `tests/verify-hosting.cjs`, directly after the line `      assert.equal(linked.headers['x-frame-options'],'DENY');` (line 77), insert these five lines exactly, with six spaces of indentation:

```js
      assert.equal(linked.headers['referrer-policy'],'no-referrer','The page must not send its address to other sites');
      const allowed=linked.headers['permissions-policy']||'';
      assert(allowed.includes('microphone=(self)'),'Dictation and the audio tools need the microphone');
      for(const feature of ['camera','display-capture','geolocation','payment','usb'])assert(allowed.includes(feature+'=()'),'Permissions-Policy must switch off '+feature);
      assert.equal((await request('/app.js')).headers['permissions-policy'],undefined,'Only the page carries the document policies');
```

The last line checks that a script file does not get the header. Both headers apply to a document, so the server sends them with the page only, the same as the content security policy.

**Verify:** `node tests/verify-hosting.cjs` → exits 0 and prints two lines, one starting with `Hosting local:` and one starting with `Hosting Vercel:`.

### 4. Prove the assertions can fail

In the first line you added to the test file, change `'no-referrer','The page` to `'origin','The page`.

**Verify:** `node tests/verify-hosting.cjs` → exits with a non-zero code and the output contains `The page must not send its address to other sites`.

Change it back to `'no-referrer','The page`.

**Verify:** `node tests/verify-hosting.cjs` → exits 0.

### 5. Run the full suite

**Verify:** `npm test` → exits 0 and the last line is `All test files and syntax checks passed.`

## Done criteria

- [ ] `grep -c "^const PERMISSIONS=" app/server.cjs` prints `1`.
- [ ] `grep -c "referrer-policy" tests/verify-hosting.cjs` prints `1`.
- [ ] `git diff --numstat` shows exactly two files: `app/server.cjs` with 3 insertions and 1 deletion, and `tests/verify-hosting.cjs` with 5 insertions and 0 deletions.
- [ ] `npm test` exits 0.
- [ ] One commit on branch `advisor/024-add-referrer-and-permissions-policy`, with a message such as `Send a referrer policy and a permissions policy with the page`. Do not push or open a PR unless you were told to.

## Out of scope

- The content security policy on line 8. Do not change it.
- `app/vercel-entry.mjs`, `vercel.json` and `app/vercel.json`. The hosted site gets the headers through the shared handler; adding them in a config as well would create two places to keep in step.
- Headers on API responses and on static files other than the page.
- `Strict-Transport-Security`. The host sets transport rules, not this server.
- More features in the permissions list. Keep the six that are written.

## If something is off

If line 8 or the end of line 64 of `app/server.cjs` no longer matches the excerpts, if the text `res.setHeader('X-Frame-Options','DENY');}` appears more than once, or if a new assertion fails in step 3 with the text copied exactly, stop and report instead of adapting the plan.

## Maintenance notes

This plan was checked with the test suite only. After it is merged, a person should open the app in a real browser, start dictation once and confirm the microphone prompt still appears. `microphone=(self)` allows it, but a typing mistake in the header would switch it off without any test failing in a browser.

If Nous later uses another device feature, for example the camera, add it to `PERMISSIONS` as `camera=(self)` and update the test list in the same commit. Until then a request for that feature fails without a prompt.

`no-referrer` also applies to requests the page makes to its own server. Nothing in the server reads the `Referer` header; it checks `Sec-Fetch-Site` and `Origin` instead. If a later change starts to rely on `Referer`, use `same-origin` here.
