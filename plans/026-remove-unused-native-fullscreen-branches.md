# 026. Remove the native full screen branches that can never run

| | |
|---|---|
| Priority | P3 |
| Effort | S (about 15 minutes) |
| Risk | LOW |
| Category | tech debt |
| Depends on | 025 (same source file, same test file) |
| Written against | `432e508` on 2026-11-25 |

## Why

`app/map-fullscreen.js` keeps a flag, `ownsFullscreen`, that was meant to record "this script put the browser into native full screen". Nothing ever sets it to `true`. The map's full screen mode is drawn inside the app viewport, as the comment in `enter()` says: "Use the app viewport so embedded browsers keep full screen stable." The script never calls `requestFullscreen`.

Because the flag is always `false`, three pieces of code never run: the `leaveNative` check and the `exitFullscreen()` call in `exit()`, and the first branch of the `fullscreenchange` handler. A reader has to work that out before they can trust what `exit()` does. Removing them changes no behaviour and makes the file say what it does.

This is a decision as well as a cleanup: it is right only if native full screen is not coming back. If the maintainer wants native full screen later, mark this plan `STALE` and do not run it.

## What is there now

`app/map-fullscreen.js` is 103 lines at `432e508` and 105 lines after plan 025. LF line endings, one `(() => { ... })();` wrapper, two-space indentation. Plan 025 adds two lines above the Escape handler, which sits below everything this plan touches, so the line numbers below hold before and after 025.

Line 8, the declaration:

```js
  let ownsFullscreen = false;
```

Lines 73 to 84, `exit()`:

```js
  async function exit() {
    if (!active) return;
    active = false;autoFit=false;initial=true;
    const leaveNative = ownsFullscreen && Boolean(document.fullscreenElement);
    ownsFullscreen = false;
    sync();
    if (leaveNative) {
      try { await document.exitFullscreen(); } catch { /* Viewport mode is already restored. */ }
    }
    surface.scrollTo(priorScroll.x, priorScroll.y);
    if (!control.hidden) control.focus({ preventScroll: true });
  }
```

Lines 87 to 90, the `fullscreenchange` handler:

```js
  document.addEventListener('fullscreenchange', () => {
    if (active && ownsFullscreen && !document.fullscreenElement) exit();
    else fitMap();
  });
```

With the flag always `false`, this handler always calls `fitMap()`. `fitMap` takes no arguments and is already passed straight to a listener three times lower in the file, for example:

```js
  window.addEventListener('resize', fitMap);
```

These four lines (8, 76, 77, 88) are the only uses of `ownsFullscreen` in the repository. Line 80 is the only `exitFullscreen` call. There is no `requestFullscreen` call anywhere under `app/`.

Plan 025 creates `tests/verify-map-fullscreen.cjs`. It reads the source file as text into a constant named `source` and ends with one `console.log('PASS map full screen: ...')` line. This plan adds assertions to that file. `npm test` runs `node tests/run.cjs`, which runs every `tests/verify-*.cjs` file and then `node --check` on every script in `app/`. Its last line on success is `All test files and syntax checks passed.`

## Steps

### 1. Start clean, on top of 025

Plan 025 must be merged into `main`, or you must branch from its branch `advisor/025-guard-open-selector-in-map-escape`.

```
git status --short
git switch -c advisor/026-remove-unused-native-fullscreen-branches
```

**Verify:** `git status --short` prints nothing before the switch. `git grep -c "pickerOpen" -- app/map-fullscreen.js` prints `app/map-fullscreen.js:2` (025 is in place). `git grep -c "ownsFullscreen" -- app/map-fullscreen.js` prints `app/map-fullscreen.js:4`.

### 2. Add the test first

In `tests/verify-map-fullscreen.cjs`, insert these four lines directly above the final `console.log(` line:

```js
// The map's full screen mode lives in the app viewport. The script never enters native full screen, so it must not carry code to leave it.
assert.equal(source.includes('ownsFullscreen'),false,'The unused ownsFullscreen flag must be gone');
assert.equal(source.includes('exitFullscreen'),false,'The script must not try to leave native full screen');
assert.ok(source.includes("document.addEventListener('fullscreenchange', fitMap);"),'A native full screen change must only refit the map');
```

Do not change the `console.log` line.

**Verify (the test must fail before the fix):** `node tests/verify-map-fullscreen.cjs` exits non-zero with `AssertionError [ERR_ASSERTION]: The unused ownsFullscreen flag must be gone`.

### 3. Remove the dead code

In `app/map-fullscreen.js`, make three edits. Find each place by its text, not only by its line number.

a. Delete line 8 entirely:

```js
  let ownsFullscreen = false;
```

b. In `exit()`, delete these two lines:

```js
    const leaveNative = ownsFullscreen && Boolean(document.fullscreenElement);
    ownsFullscreen = false;
```

and these three lines:

```js
    if (leaveNative) {
      try { await document.exitFullscreen(); } catch { /* Viewport mode is already restored. */ }
    }
```

`exit()` must then read exactly:

```js
  async function exit() {
    if (!active) return;
    active = false;autoFit=false;initial=true;
    sync();
    surface.scrollTo(priorScroll.x, priorScroll.y);
    if (!control.hidden) control.focus({ preventScroll: true });
  }
```

Leave the `async` keyword. `enter()` is `async` in the same way, and removing it is not part of this plan.

c. Replace the four-line `fullscreenchange` handler with this one line:

```js
  document.addEventListener('fullscreenchange', fitMap);
```

**Verify:** `node tests/verify-map-fullscreen.cjs` prints its `PASS map full screen` line. `node --check app/map-fullscreen.js` prints nothing and exits 0. `git grep -c "ownsFullscreen" -- app/` prints nothing.

### 4. Run the whole suite

```
npm test
```

**Verify:** the output ends with `All test files and syntax checks passed.`

### 5. Look at it once in a browser

Start the app with `npm start`, open http://localhost:4179, open the Map tab and:

- press the ⤢ button: the map fills the app viewport;
- press Escape: the map returns to its tab and the page scroll position is where it was;
- press ⤢ twice more: enter and leave work with the button too.

**Verify:** all three behave as they did before the change and the console shows no error. If you cannot open a browser, say so in your report. Do not mark this step as done.

### 6. Commit

```
git add app/map-fullscreen.js tests/verify-map-fullscreen.cjs
git commit -m "Remove native full screen branches that never run from the map"
```

## Done criteria

- [ ] `git diff --numstat advisor/025-guard-open-selector-in-map-escape -- app/map-fullscreen.js` prints `1	10	app/map-fullscreen.js`. (Use `main` in place of the branch name if 025 is already merged there.)
- [ ] The same command for `tests/verify-map-fullscreen.cjs` prints `4	0	tests/verify-map-fullscreen.cjs`.
- [ ] `git grep -c "ownsFullscreen" -- app/ tests/` shows only `tests/verify-map-fullscreen.cjs:2`.
- [ ] `git grep -c "exitFullscreen" -- app/` prints nothing.
- [ ] `npm test` ends with `All test files and syntax checks passed.`
- [ ] One commit on branch `advisor/026-remove-unused-native-fullscreen-branches`. Do not push or open a PR unless you were told to.

## Out of scope

- `pickerOpen()` and the Escape handler. Plan 025 owns them.
- The `async` keyword on `enter()` and `exit()`.
- Adding native full screen (`requestFullscreen`). That is a feature decision, not part of this cleanup.
- The `?v=heading-2` query on the script tag in `app/index.html`. The server sends `Cache-Control: no-cache` with an ETag, so browsers pick up the new file.
- Any change to zoom, pan, fitting or the coarse-pointer handling.

## If something is off

Stop and report, without improvising, if:

- `git grep -c "pickerOpen" -- app/map-fullscreen.js` does not print `2`. Plan 025 has not run, or the file has changed since.
- `git grep -n "ownsFullscreen = true" -- app/` or `git grep -n "requestFullscreen" -- app/` prints anything. Someone has started using native full screen, the code is no longer dead, and this plan is `STALE`.
- `ownsFullscreen` appears in a number of lines other than four, or in a file other than `app/map-fullscreen.js`.
- `tests/verify-map-fullscreen.cjs` does not exist or has no `source` constant.
- `npm test` fails in a test file other than `tests/verify-map-fullscreen.cjs`.

## Maintenance notes

- If native full screen is added later, the three assertions from step 2 will fail. That is their job: delete them in the same change that adds `requestFullscreen`, and bring back a way to leave native full screen when the map closes.
- While the browser itself is in full screen (F11, or a host app's own mode), the map still refits on `fullscreenchange`. That is the one thing the handler ever did.
- Reviewer: the automated proof is text-based (the names are gone and the listener is the one-liner). Behaviour is proved only by step 5. Check that the executor's report says whether step 5 was run.
