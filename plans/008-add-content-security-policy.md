# Plan 008: Send a Content-Security-Policy that blocks injected script

> **Executor instructions.** Follow the steps in order. Run every verification command and compare with the expected result before moving on. If a STOP condition applies, stop and report instead of improvising. When finished, update this plan's row in `plans/README.md` (unless a reviewer maintains the index for you).
>
> **Drift check (run first):** `git diff --stat 95dd4e8..HEAD -- app/server.cjs app/index.html tests/verify-hosting.cjs`
> Plans 002 and 009 also edit `server.cjs` and `verify-hosting.cjs`; that is expected. If the header line quoted below no longer exists, STOP and report.

## Status

| Field | Value |
| --- | --- |
| Priority | P2 |
| Effort | S |
| Risk | MED (a policy that is too strict breaks a feature silently) |
| Depends on | none. Do plan 001 first or together; do not run at the same time as 002 or 009 (same files) |
| Category | security |
| Planned at | commit `95dd4e8`, 2026-11-13 |

## Why this matters

People keep their own provider API keys in the browser's storage for the Nous page. Any script that runs in that page can read them. The page builds a lot of HTML from strings, including model output and imported agent files, so one missed escape is enough to run an attacker's script (plan 001 fixes one such case).

Today the only policy the server sends is `frame-ancestors 'none'`, which stops the page being framed and nothing else. A full policy makes the browser refuse inline event handlers, inline scripts and requests to other origins. An injected `<img onerror=…>` then does nothing, and a script that did run could not send a key anywhere. The page is a good fit: every script and stylesheet is a same-origin file, and there are no inline scripts.

## Current state

`app/server.cjs` (70 lines, long lines; search for the quoted strings). The static file response, line 60:

```js
res.setHeader('Cache-Control','no-cache');res.setHeader('X-Content-Type-Options','nosniff');if(relative==='index.html'){res.setHeader('Content-Security-Policy',"frame-ancestors 'none'");res.setHeader('X-Frame-Options','DENY');}res.end(req.method==='HEAD'?undefined:data);
```

`tests/verify-hosting.cjs` asserts the current value (search `content-security-policy`):

```js
linked.headers['content-security-policy']==="frame-ancestors 'none'"
```

`app/index.html` (12 lines): stylesheets and scripts are all same-origin files with `?v=` queries. There is no inline `<script>`. There **are** inline `style="--sw-bg:…"` attributes and inline SVG. `thinking-orbs.js` is loaded with `type="module"`. The page uses audio playback, microphone recording (dictation), file download and import, and a print view (#43).

The app talks only to its own origin: `/api/…` routes on the same server. Provider calls are made by the server.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Syntax check | `node --check app/server.cjs` | no output |
| Hosting tests | `node tests/verify-hosting.cjs` | two `Hosting … passed.` lines, exit 0 |
| Full suite | `npm test` | exit 0 |
| Run locally | `npm start` | serves http://localhost:4179 |

## Scope

**In scope**

- `app/server.cjs` (the header on `index.html` only)
- `tests/verify-hosting.cjs` (the header assertion)

**Out of scope**

- Rewriting app code to suit the policy. If a feature needs a looser policy, loosen the one directive and say why. If it needs `'unsafe-inline'` for scripts, STOP.
- `vercel.json` headers.
- Other security headers (`Referrer-Policy`, `Permissions-Policy`). Note them as follow-ups.

## Git workflow

- Branch: `advisor/008-add-content-security-policy`
- Commit style: one imperative sentence, as in `Print the full result, not just the summary card (#43)`. Leave the PR number off.
- Do not push or open a PR unless you were told to.

## Steps

### 1. Survey what the page actually does

Run each search and write down the hits. They decide the policy.

```bash
grep -n -o -E " on[a-z]+=\"" app/*.js app/index.html | sort | uniq -c
grep -n -o -E "javascript:|eval\(|new Function|new Worker|<iframe|window\.open|createObjectURL|importScripts|serviceWorker" app/*.js app/index.html
grep -n -o -E "https?://[a-zA-Z0-9./_-]+" app/*.js app/*.css app/index.html | grep -v "w3.org" | sort -u
grep -n -o -E "url\((data:|blob:|https?:)" app/*.css | sort -u
```

How to read the results:

- **Inline event handlers** (first search, any hit that is an HTML attribute in a template string or in `index.html`): `script-src 'self'` blocks them. STOP and report the list. Do not add `'unsafe-inline'` to `script-src`.
- `eval(` or `new Function`: STOP and report.
- `<iframe` or a print feature that writes into a frame: add `frame-src 'self' blob:` (and `about:` documents inherit the policy). Test printing carefully in step 4.
- `new Worker` or `createObjectURL`: already allowed by `worker-src 'self' blob:` and the `blob:` media and image sources below.
- An `https://` URL that the browser itself fetches (a font, an image, an API): add that origin to the matching directive and name it in your report. URLs that are only shown as links or sent to the server need nothing.

### 2. Set the policy

Starting policy:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
```

`style-src` keeps `'unsafe-inline'` because the page uses `style="…"` attributes and sets styles from script. That is a known, accepted gap: inline styles cannot read storage.

In `app/server.cjs`, add a constant near the top of the file (after the `require` lines):

```js
// Blocks injected script and off-origin requests; keys live in this page's storage. Inline styles are allowed because the UI uses style attributes.
const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
```

and change `res.setHeader('Content-Security-Policy',"frame-ancestors 'none'")` to `res.setHeader('Content-Security-Policy',CSP)`. Keep `X-Frame-Options`.

Apply any additions from step 1 to the constant.

**Verify:** `node --check app/server.cjs` → no output.

### 3. Update the test

In `tests/verify-hosting.cjs`, replace the exact-match check on the header with checks that will survive small policy edits. Keep the surrounding assertion style:

```js
const csp=linked.headers['content-security-policy']||'';
for(const part of ["default-src 'self'","script-src 'self'","object-src 'none'","base-uri 'none'","frame-ancestors 'none'"])assert(csp.includes(part),'CSP must include '+part);
assert(!/script-src[^;]*unsafe-inline/.test(csp),'Scripts must not allow inline code');
```

If the old check was part of a longer `assert` expression, split it so the rest of that expression still runs.

**Verify:** `node tests/verify-hosting.cjs` → both `passed.` lines. `npm test` → exit 0.

### 4. Check every feature in a browser

A policy fails silently, so this step is the real test. `npm start`, open http://localhost:4179 with the developer console open, and reload once with the cache disabled. Then use each of these and watch the console for lines starting `Refused to` or mentioning `Content Security Policy`:

1. All five views: Map, Branches, Evidence, Decisions, Document. Full-screen map on and off.
2. Theme menu: System, Light, Warm ink.
3. Help dialog, Connections dialog, Audio tools dialog.
4. The thinking orb animation (it is the module script).
5. Dictation: start and cancel. Do not send audio to a provider.
6. Agents: open the list, open an agent, the new-agent wizard, export, import, and print a stored result if one exists.
7. Any image or file upload the UI offers.

Use only the stub model and do not run a real agent or send a real provider request.

**Verify:** zero CSP violations in the console. For each violation, either add the narrowest source that fixes it and repeat this step, or STOP if it would need inline or remote script.

If you have no browser, STOP after step 3 and report that step 4 is `Not verified`. Do not merge this plan unverified.

## Test plan

The header assertion in `tests/verify-hosting.cjs` (step 3) guards the policy's presence and its key parts. Feature coverage is the manual pass in step 4; there is no browser test harness in this repository.

## Done criteria

- [ ] `npm test` exits 0.
- [ ] `grep -c "const CSP=" app/server.cjs` prints `1`.
- [ ] `grep -c "script-src 'self'" app/server.cjs` prints `1`, and the policy has no `'unsafe-inline'` or `'unsafe-eval'` in `script-src`.
- [ ] Step 4 completed with zero violations, with the list of features exercised in the report.
- [ ] `git status --short` lists only `app/server.cjs` and `tests/verify-hosting.cjs` (and `plans/README.md`).
- [ ] This plan's row in `plans/README.md` is updated.

## STOP conditions

- Step 1 finds inline event handler attributes, `eval(` or `new Function`.
- A feature only works with `'unsafe-inline'` or a remote origin in `script-src`.
- The hosted deployment sets its own `Content-Security-Policy` in `vercel.json` or `app/vercel.json` (check with `grep -n "Content-Security" vercel.json app/vercel.json`). Two policies combine to the stricter of both; report before changing either.
- You cannot run step 4.

## Maintenance notes

- Any new feature that loads something from another origin, or adds an inline handler, will fail silently under this policy. The symptom is "works locally in old tab, broken after reload". Check the console first.
- A safer rollout is to ship `Content-Security-Policy-Report-Only` for a release, then switch. With one user and no reporting endpoint it adds little, so this plan enforces directly.
- Removing `'unsafe-inline'` from `style-src` would need every `style="…"` attribute moved to classes. Not worth it now.
- After deploy, check the live site the same way as step 4. The hosted path goes through `app/vercel-entry.mjs` and should send the same header.
