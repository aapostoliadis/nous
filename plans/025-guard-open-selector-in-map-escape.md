# 025. Keep Escape working in the full screen map where `:open` is unknown

| | |
|---|---|
| Priority | P2 |
| Effort | S (about 20 minutes) |
| Risk | LOW |
| Category | bug |
| Depends on | none |
| Written against | `432e508` on 2026-11-25 |

## Why

The full screen map tells people "Esc to return", and its button title says "Exit full screen map (Esc)". The Escape handler asks the page whether a dropdown is open by calling `document.querySelector('select:open')`. The `:open` selector is new: Chrome 133, Firefox 136 and Safari 26.5 are the first versions that know it. In any older browser `querySelector` throws a `SyntaxError` on a selector it does not know. The handler then stops before it calls `exit()`, so Escape does nothing and an error lands in the console on every Escape press. The ⤢ button still leaves the map, so nobody is trapped, but the promised key is dead.

The fix is to treat "the browser does not know `:open`" as "no dropdown is open".

## What is there now

`app/map-fullscreen.js` is 103 lines, LF line endings, wrapped in one `(() => { ... })();` function, two-space indentation. The handler is at lines 91 to 96:

```js
  document.addEventListener('keydown', event => {
    if (active && event.key === 'Escape' && !document.querySelector('#dialog').open && !document.querySelector('select:open')) {
      event.preventDefault();
      exit();
    }
  });
```

This is the only place in the file, and the only place in any script under `app/`, that uses `select:open`. `app/dropdowns.css` also uses `select:open`, but inside an `@supports` block, which is safe. Do not touch it.

The file's style: comments are full sentences above the code they explain, and small helper functions are written on one line, for example line 39:

```js
  function endDrag(){drag=null;surface.classList.remove('map-is-dragging');}
```

Tests are plain Node scripts in `tests/` named `verify-*.cjs`. They use `node:assert/strict`, print one `PASS ...` line and exit. `npm test` runs `node tests/run.cjs`, which picks up every `tests/verify-*.cjs` file by itself and then runs `node --check` on every script in `app/`. Its last line on success is `All test files and syntax checks passed.` There is no test for `map-fullscreen.js` today.

## Steps

### 1. Start clean on a branch

```
git status --short
git switch -c advisor/025-guard-open-selector-in-map-escape
```

**Verify:** `git status --short` prints nothing before the switch. `git grep -c "select:open" -- app/map-fullscreen.js` prints `app/map-fullscreen.js:1`.

### 2. Add the test first

Create `tests/verify-map-fullscreen.cjs` with exactly this content:

```js
// Checks that Escape can leave the full screen map in browsers that do not know the :open selector.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','app','map-fullscreen.js'),'utf8');

const found=source.match(/function pickerOpen\(\)\{[^\n]*\}/);
assert.ok(found,'map-fullscreen.js must define pickerOpen() on one line');
const build=document=>new Function('document',found[0]+';return pickerOpen;')(document);

// Safari before 26.5 and Firefox before 136 throw on a selector they do not know.
assert.equal(build({querySelector(){throw new SyntaxError('unknown selector');}})(),false,'An unknown selector must read as no picker open');
assert.equal(build({querySelector:()=>null})(),false,'No picker is open');
assert.equal(build({querySelector:selector=>selector==='select:open'?{}:null})(),true,'An open picker must be reported');

assert.equal(source.split('select:open').length-1,1,'The :open selector must appear once, inside pickerOpen()');
assert.ok(source.includes("!document.querySelector('#dialog').open && !pickerOpen()"),'The Escape handler must ask pickerOpen()');
console.log('PASS map full screen: Escape works where the :open selector is unknown');
```

The test pulls the one-line `pickerOpen` function out of the source text and runs it against three fake `document` objects. It does not load the whole file, because the file needs a real page.

**Verify (the test must fail before the fix):** `node tests/verify-map-fullscreen.cjs` exits non-zero with `AssertionError [ERR_ASSERTION]: map-fullscreen.js must define pickerOpen() on one line`.

### 3. Make the fix

In `app/map-fullscreen.js`, insert these two lines directly above the line `  document.addEventListener('keydown', event => {` that precedes the Escape check (the one at line 91, not the one at line 34):

```js
  // Browsers that do not know the :open selector throw on it. Treat that as no picker open, so Escape still leaves the map.
  function pickerOpen(){try{return Boolean(document.querySelector('select:open'));}catch{return false;}}
```

Then, in the `if` line below, replace

```js
!document.querySelector('select:open')) {
```

with

```js
!pickerOpen()) {
```

Keep `function pickerOpen(){...}` on one line. The test relies on that.

**Verify:** `node tests/verify-map-fullscreen.cjs` prints `PASS map full screen: Escape works where the :open selector is unknown`. `node --check app/map-fullscreen.js` prints nothing and exits 0.

### 4. Run the whole suite

```
npm test
```

**Verify:** the output includes the new `PASS map full screen` line and ends with `All test files and syntax checks passed.`

### 5. Commit

```
git add app/map-fullscreen.js tests/verify-map-fullscreen.cjs
git commit -m "Keep Escape working in the full screen map where :open is unknown"
```

## Done criteria

- [ ] `git diff --numstat main -- app/map-fullscreen.js` prints `3	1	app/map-fullscreen.js`.
- [ ] `git diff --name-only main` lists exactly `app/map-fullscreen.js` and `tests/verify-map-fullscreen.cjs`.
- [ ] `git grep -c "select:open" -- app/map-fullscreen.js` prints `app/map-fullscreen.js:1`.
- [ ] `npm test` ends with `All test files and syntax checks passed.`
- [ ] One commit on branch `advisor/025-guard-open-selector-in-map-escape`. Do not push or open a PR unless you were told to.

## Out of scope

- `app/dropdowns.css`. Its `select:open` rule sits inside `@supports` and is correct.
- `ownsFullscreen` in the same file (line 8, lines 76 to 81, line 88). It is never set to `true`, so those branches never run. Leave them. Removing them is a separate decision.
- The `?v=heading-2` query on the script tag in `app/index.html`. The server sends `Cache-Control: no-cache` with an ETag, so browsers pick up the new file without a version bump.
- Any other change to how the map zooms, pans or enters full screen.

## If something is off

Stop and report, without improvising, if:

- `git grep "select:open" -- app/map-fullscreen.js` does not show exactly one match before you start (the file has changed since `432e508`).
- The file has more than two `document.addEventListener('keydown'` lines, or the Escape check is no longer in the last one.
- `npm test` fails in a test file other than the one you added.

## Maintenance notes

- If a later change adds another `:open`, `:popover-open` or similarly new selector to a `querySelector` or `matches` call in a script, wrap it the same way. An unknown selector throws; it does not return `null`.
- When Safari older than 26.5 and Firefox older than 136 no longer matter, `pickerOpen()` can go back to a plain `querySelector` call and this test can be deleted.
- Reviewer: this was verified by a Node test with fake `document` objects only. Nobody has pressed Escape in an old Safari. If one is at hand, open the map full screen and press Escape once.
