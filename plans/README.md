# Improvement plans for Nous

Written against commit `95dd4e8` on 2026-11-13. Plans 018 to 024 were written against `25910a5` on 2026-11-20. Plans 025 and 026 were written against `432e508` on 2026-11-25. Each plan is self-contained: an executor needs only the plan file and the repository.

Audit depth was `standard`. All nine categories were covered. The user selected all 13 vetted findings.

## Status

Update the Status column when a plan is finished or stopped. Values: `TODO`, `IN PROGRESS`, `DONE`, `BLOCKED` (add the reason), `STALE`.

| # | Plan | Priority | Effort | Risk | Category | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | [Stop imported agent ids from injecting markup](001-sanitize-imported-agent-ids.md) | P1 | S | LOW | security | none | DONE (reviewed, approved; branch `advisor/001-sanitize-imported-agent-ids`, commit `656bf7d`, merged into local `main` at `3d2690e`, pushed to `origin` on 2026-11-14; browser check in step 5 not verified) |
| 002 | [Decode request bodies once, so split characters survive](002-decode-request-bodies-as-utf8.md) | P1 | S | LOW | bug | none | DONE (reviewed, approved; branch `advisor/002-decode-request-bodies-as-utf8`, commit `4275587`, merged into local `main` at `3d2690e`, pushed to `origin` on 2026-11-14) |
| 003 | [Make the browser and server agree on agent length limits](003-align-agent-length-limits.md) | P2 | S | LOW | bug | none | DONE (reviewed, approved; branch `advisor/003-align-agent-length-limits`, commit `a461224`, merged into local `main` at `74be67c`, pushed to `origin` on 2026-11-14; the fallback `.slice(0,6000)` on the Improve instructions path at `app/agents.js:360` had no automated test; plan 015 adds one) |
| 004 | [Never trim the run that has just started](004-keep-running-run-when-trimming.md) | P2 | S | LOW | bug | none | DONE (reviewed, approved; branch `advisor/004-keep-running-run-when-trimming`, commit `6f3fcb4`, merged into local `main` at `74be67c`, pushed to `origin` on 2026-11-14; the plan's original `grep -c` criterion matched three lines; the plan text now uses a string that matches only `trimRuns`; the behaviour is covered by the test 007 adds) |
| 005 | [Show a readable error when the server answers with something that is not JSON](005-handle-non-json-error-responses.md) | P2 | S | LOW | bug | none | DONE (reviewed, approved; branch `advisor/005-handle-non-json-error-responses`, commit `ea77375`, merged into local `main` at `3d2690e`, pushed to `origin` on 2026-11-14; its conflict with 006 in `tests/verify-dictation.cjs` was resolved by keeping both sides) |
| 006 | [Run every test file from one runner, from any directory](006-add-test-runner.md) | P2 | S | LOW | dx | none | DONE (reviewed, approved; branch `advisor/006-add-test-runner`, commit `0885c16`, merged into local `main` at `3d2690e`, pushed to `origin` on 2026-11-14) |
| 007 | [Put the browser side of Agents under test](007-test-agents-client.md) | P2 | M | LOW | tests | 006 | DONE (reviewed, approved; branch `advisor/007-test-agents-client`, commit `7be7b8c`, merged into local `main` at `74be67c`, pushed to `origin` on 2026-11-14; the test never calls a provider) |
| 008 | [Send a Content-Security-Policy that blocks injected script](008-add-content-security-policy.md) | P2 | S | MED | security | 001 first or together | DONE (reviewed, approved; branch `advisor/008-add-content-security-policy`, commit `819870b`, merged into local `main` at `74be67c`, pushed to `origin` on 2026-11-14; browser pass in a headless browser found no policy violations and no console errors; not verified: dictation recording and audio transcription past the API-key gate, and a real agent run; the hosted site gets the same header, because `vercel.json` routes every request through `app/vercel-entry.mjs` to the `app/server.cjs` handler and the hosted fixture in `tests/verify-hosting.cjs` asserts it; the live response header was checked on 2026-11-14 after the push and carries the policy; the live app was walked through in a headless browser on 2026-11-15, after push `5648f40`, looking only: the workspace tabs, the model menu, the Connections dialog and the four Agents views opened with no console errors) |
| 009 | [Answer unchanged static files with 304 instead of resending them](009-add-etag-revalidation.md) | P3 | S | LOW | performance | none | DONE (reviewed, approved; branch `advisor/009-add-etag-revalidation`, commit `35a03c8`, merged into local `main` at `74be67c`, pushed to `origin` on 2026-11-14) |
| 010 | [Describe the Agents feature, its tests and its docs in the README](010-document-agents-in-readme.md) | P3 | S | LOW | docs | none | DONE (reviewed, approved; branch `advisor/010-document-agents-in-readme`, commit `cfaada8`, merged into local `main` at `3d2690e`, pushed to `origin` on 2026-11-14) |
| 011 | [Pin the CI actions to commit SHAs and bound the job](011-pin-ci-action-and-permissions.md) | P3 | S | LOW | security | none | DONE (reviewed, approved; branch `advisor/011-pin-ci-action-and-permissions`, commit `d79e83e`, merged into local `main` at `3d2690e`, pushed to `origin` on 2026-11-14; first CI run after the push passed on 2026-11-14) |
| 012 | [Keep agents and runs in step when Nous is open in two tabs](012-sync-agents-across-tabs.md) | P3 | M | MED | bug | 007 | DONE (reviewed, approved; branch `advisor/012-sync-agents-across-tabs`, commit `1dc33d3`, merged into local `main` at `74be67c`, pushed to `origin` on 2026-11-14; two-tab check passed in a headless browser: create and rename appear in the other tab without reload, an open wizard keeps its text, a later save does not overwrite the other tab's agent; not verified in a browser: the running-run branch of the storage listener and the scheduled double start, which the plan only narrows) |
| 013 | [Stop re-parsing the whole answer on every streamed fragment](013-throttle-streaming-rescan.md) | P3 | S | LOW | performance | none | DONE (reviewed, approved; branch `advisor/013-throttle-streaming-rescan`, commit `70b283f`, merged into local `main` at `3d2690e`, pushed to `origin` on 2026-11-14) |
| 014 | [Add a "Tech Innovation" style (dark gray, electric blue, cyan, DejaVu Sans) and make it the default](014-add-tech-innovation-style.md) | P3 | M | LOW | design | none | DONE (reviewed, approved; branch `advisor/014-add-tech-innovation-style`, commit `f2183c1`, merged into local `main` at `d1c8c4e`, pushed to `origin` on 2026-11-14; checked in a headless browser: opens in Tech Innovation, both fonts load, saved choices persist, old saved values open in Tech, no console errors; System on a dark OS preference covered by the test only) |
| 015 | [Test the 6,000-character cap on the Improve instructions fallback](015-test-improve-fallback-cap.md) | P3 | S | LOW | tests | 003, 007 | DONE (added 2026-11-14 from a gap found while reviewing 003; reviewed, approved; branch `advisor/015-test-improve-fallback-cap`, commit `6702913`, merged into local `main` at `76f4eda`, pushed to `origin` on 2026-11-14; the test fails with the slice removed and passes with it restored; the executor also passed Node's `AbortController` into the test page, which the plan did not list) |
| 016 | [Name the Improve cases in the agents client test's pass line](016-name-improve-cases-in-pass-line.md) | P3 | S | LOW | tests | 015 | DONE (added 2026-11-14 from a gap found after 015; reviewed, approved; branch `advisor/016-name-improve-cases-in-pass-line`, commit `26fdd02`, merged into local `main` at `771b09d`, pushed to `origin` on 2026-11-15; one line changed in `tests/verify-agents-client.cjs`) |
| 017 | [Keep the workspace scroll position when returning from Agents](017-keep-workspace-scroll-on-return-from-agents.md) | P3 | S | LOW | bug | 007 | DONE (2026-11-15: merged into local `main`, `npm test` passes; checked in a local browser: scroll stays at 300 and focus returns to the Agents button; pushed, and the same check passes on the live site) |
| 018 | [Move the unused source artwork out of the served folder](018-move-unused-source-artwork.md) | P3 | S | LOW | tech debt | none | DONE, merged into local `main` on 2026-11-20 by merge `a907d2c`, since pushed to `origin/main` (confirmed 2026-11-25) (2026-11-20; reviewed and approved; commit `f5a47b4` on branch `advisor/018-move-unused-source-artwork`, based on `25910a5`, in worktree `../nous-repo-worktrees/018`; three renames with no content change, `docs/FIGMA-ADAPTATION.md` 4 insertions and 3 deletions, `npm test` passed. The doc is stored with LF line endings; the CRLF seen in the main checkout is a working-copy conversion only. After merge `/assets/nous-logo.png` answers 404) |
| 019 | [Test lists, headings, tables and links in the Agents Markdown renderer](019-test-markdown-structure.md) | P3 | S | LOW | tests | none | DONE, merged into local `main` on 2026-11-20 by merge `5265ed7`, since pushed to `origin/main` (confirmed 2026-11-25) (2026-11-20; reviewed and approved; commit `f7303f8` on branch `advisor/019-test-markdown-structure`, worktree `D:\Downloads\nous\nous-repo-worktrees\019`, stacked on the 023 branch at `6c65348`, so merging it brings 023 too. 8 lines added in `tests/verify-agents-client.cjs`; `npm test` passes; the fail-proof step fails with the expected message) |
| 020 | [Pin which OpenAI models are marked as supporting structured output](020-pin-structured-output-flags.md) | P3 | S | LOW | tests | none | DONE, merged into local `main` on 2026-11-20 by fast-forward, since pushed to `origin/main` (confirmed 2026-11-25) (executed 2026-11-20; reviewed and approved: 4 lines added to `tests/verify-models.cjs`, `npm test` passes; commit `7c33528` on branch `advisor/020-pin-structured-output-flags`, worktree `D:/Downloads/nous/nous-repo-worktrees/020`) |
| 021 | [Remove a line in `modelMode` that can never run](021-remove-unreachable-model-branch.md) | P3 | S | LOW | tech debt | 020 | DONE, merged into local `main` on 2026-11-20 by fast-forward to `b233326`, since pushed to `origin/main` (confirmed 2026-11-25) (executed 2026-11-20; reviewed and approved: one line removed from `app/providers.cjs`, `npm test` passes; commit `b233326` on branch `advisor/021-remove-unreachable-model-branch`, which is stacked on the 020 branch; worktree `D:/Downloads/nous/nous-repo-worktrees/021`) |
| 022 | [Check both Vercel configs against the server's list of public files](022-check-vercel-config-against-public-files.md) | P3 | S | LOW | tests | none | DONE, merged into local `main` on 2026-11-20 by merge `b33a432` (with 024), since pushed to `origin/main` (confirmed 2026-11-25) (2026-11-20; reviewed and approved; 11 lines added to `tests/verify-hosting.cjs`, `npm test` passes; commit `06a4878` on branch `advisor/022-check-vercel-config-against-public-files`, worktree `D:\Downloads\nous\nous-repo-worktrees\022`, based on `25910a5`. Plan 024 edits the same test file, so base it on this branch or merge this one first) |
| 023 | [Stop the Agents stream reader at 16,000,000 bytes](023-cap-agents-stream-reader.md) | P3 | S | LOW | bug | none | DONE, merged into local `main` on 2026-11-20 by merge `5265ed7` (with 019), since pushed to `origin/main` (confirmed 2026-11-25) (2026-11-20; reviewed and approved; `app/agents.js` 3 lines changed, `tests/verify-agents-client.cjs` 15 added and 3 removed, `npm test` passes; commit `6c65348` on branch `advisor/023-cap-agents-stream-reader`, worktree `D:\Downloads\nous\nous-repo-worktrees\023`, based on `25910a5`. It ran before plan 019, so 019 must find its places in `tests/verify-agents-client.cjs` by content, not by line number, and should be based on this branch or run after it is merged) |
| 024 | [Send a referrer policy and a permissions policy with the page](024-add-referrer-and-permissions-policy.md) | P3 | S | LOW | security | none | DONE, merged into local `main` on 2026-11-20 by merge `b33a432`, since pushed to `origin/main` (confirmed 2026-11-25) (2026-11-20; reviewed and approved; commit `c4249df` on branch `advisor/024-add-referrer-and-permissions-policy`, worktree `D:\Downloads\nous\nous-repo-worktrees\024`, stacked on the 022 branch at `06a4878`, so merging it brings 022 too. 3 lines added and 1 changed in `app/server.cjs`, 5 added in `tests/verify-hosting.cjs`; `npm test` passes; the fail-proof step fails with the expected message. After merge, checked in a headless browser on the local server: the page allows the microphone and blocks the camera and geolocation, with no console errors. Spoken dictation was not tested) |
| 025 | [Keep Escape working in the full screen map where `:open` is unknown](025-guard-open-selector-in-map-escape.md) | P2 | S | LOW | bug | none | DONE (2026-11-25; commit `0c0c2de` on branch `advisor/025-guard-open-selector-in-map-escape`, merged into local `main` by fast-forward, not pushed. `app/map-fullscreen.js` 3 lines added and 1 removed, plus the new `tests/verify-map-fullscreen.cjs`; `npm test` passes; the test failed with the expected message before the fix. Not verified in a Safari older than 26.5 or a Firefox older than 136) |
| 026 | [Remove the native full screen branches that can never run](026-remove-unused-native-fullscreen-branches.md) | P3 | S | LOW | tech debt | 025 | DONE (2026-11-25; commit `7930051` on branch `advisor/026-remove-unused-native-fullscreen-branches`, stacked on 025, merged into local `main` by fast-forward, not pushed. `app/map-fullscreen.js` 1 line added and 10 removed, `tests/verify-map-fullscreen.cjs` 4 added; `npm test` passes; the test failed with the expected message before the fix. Checked in a headless browser on the local server at 1280x720: the button and Escape both enter and leave the full screen map, focus returns to the button, no console errors. The surface was not scrolled before entering, so the scroll restore was not exercised. The plan's done criterion expects `git grep -c "ownsFullscreen" -- app/ tests/` to print `tests/verify-map-fullscreen.cjs:2`; it prints `:1`, because both uses sit on one line of the test) |

The worktrees and `advisor/*` branches named in rows 018 to 024 were removed on 2026-11-20, after the merge. Every commit they held is in `main`.

## Recommended order

006, 001, 002, 004, 003, 005, 007, 008, 009, 011, 010, 013, 012.

The runner (006) goes first so every later plan's tests are picked up without editing `package.json` again. The two P1 fixes follow. 012 goes last because it changes how `app/agents.js` loads and saves, and it relies on the tests 007 adds.

Second batch (added 2026-11-20): 020, 021, 019, 023, 022, 024, 018.

020 goes first because 021 depends on its test. 019 goes before 023 and 022 before 024, because each pair edits the same test file and the later plan states the line shift the earlier one causes. 018 moves files only and can go at any point.

Third batch (added 2026-11-25): 025, then 026. Both edit `app/map-fullscreen.js` and `tests/verify-map-fullscreen.cjs`, which no other plan touches. 025 creates the test file and 026 extends it. 026 is a decision as well as a cleanup: run it only if native full screen is not coming back.

## Dependencies and files that collide

Hard dependencies:

- 006 before 007 (007 adds a test file the runner must pick up).
- 007 before 012 (012 extends the test file 007 creates).
- 001 before 008, or both together (the policy in 008 is the second line of defence for the hole 001 closes).
- 020 before 021 (020 adds the test that protects the file 021 edits).
- 025 before 026 (026 extends the test file 025 creates and edits the same source file).

Plans that edit the same files. Run them one after another, each on top of the previous one, never in parallel:

- `app/agents.js`: 001, 003, 004, 007 (one line), 012.
- `app/server.cjs` and `tests/verify-hosting.cjs`: 002, 008, 009.
- `tests/`: 006 first (merged), then any plan that adds a test file (007; 014 is merged). The runner picks new `tests/verify-*.cjs` files up without a `package.json` edit.
- `app/index.html`: 014 (merged) added a menu button with an inline `style` attribute; 008 must allow it the same way it allows the two existing swatches.
- Second batch, `app/agents.js` and `tests/verify-agents-client.cjs`: 019 (test file only), then 023. 019 moves the test file's later lines down by 8.
- Second batch, `app/server.cjs` and `tests/verify-hosting.cjs`: 022 (test file only), then 024. 022 moves the test file's later lines down by 11.
- Second batch, `app/providers.cjs` and `tests/verify-models.cjs`: 020 (test file only), then 021.
- Third batch, `app/map-fullscreen.js` and `tests/verify-map-fullscreen.cjs`: 025, then 026. 026's source edits sit above the lines 025 adds, so its line numbers hold either way.
- 018 touches none of these files.

Independent of everything else: 005, 010, 011, 013. 014 (added 2026-11-14 at the maintainer's request, not from the audit; merged) touched only the style files (`app/theme.js`, `app/dark-theme.css`, `app/index.html`, `app/assets/fonts/`) and added one test file. It changed the default style for every visitor without a saved choice. 010 is best done late so the README describes what shipped.

Plans that need more than a terminal:

- 008 needed a pass through the app in a real browser with the console open, to catch anything the policy blocks. Done.
- 011 needs network access for two `git ls-remote` lookups, and its real test is the first CI run after a push.
- 012 step 5 needed two browser tabs. Done.
- 014 needed network access for the font download, and a look at the new style in a real browser. Both are done.
- 024 should be followed by one dictation check in a real browser, to confirm the microphone prompt still appears. Still open on 2026-11-25: it needs a person, a microphone and a provider key. The live site was checked that day and sends `microphone=(self)` in its `Permissions-Policy` header, so the header itself is right.
- 025 is proved by a Node test with fake `document` objects. Pressing Escape in a Safari older than 26.5 or a Firefox older than 136 would confirm it for real.
- 026's automated proof is text-based. Its step 5 needs one look at the full screen map in a browser: enter and leave with the button and with Escape. Done on 2026-11-25 in a headless browser.

## Considered and rejected

Do not re-audit these without new evidence.

| Finding | Why it was rejected |
| --- | --- |
| The hosted proxy can be called without an `Origin` header | By design. The user brings their own provider key; the proxy holds no secret to protect. |
| A whitespace-only entry in `NOUS_ALLOWED_HOSTS` | No reachable effect; the entry never matches a host. |
| Unreviewed runs are trimmed with the rest | Settled in #16. Plan 004 covers the one real defect (the run that has just started). |
| A second `@mention` regex in `app/ask.js` | Not found in the code. |
| Instruction-shaped text in `AGENTS.md` and the SessionStart hook | Read and found benign. Ordinary contributor guidance. |
| README wording on where API keys are stored | Accurate. Checked against `app/connections.js:17`. |
| README claims Agents results can be printed | The README makes no such claim, and `app/agents.js` has no `window.print`. |
| Several source files keep whole functions on one very long line | House style. The repository has no dependencies, so there is no formatter to run, and a reformat by hand is a very large diff that changes no behaviour. (2026-11-20) |
| One shared `readJson` helper in place of the copies | No `readJson` exists. About ten inline copies with different error messages sit in four client files that share no module system, so there is nowhere to put a shared one. (2026-11-20) |
| One `innerHTML` update per animation frame at `app/agents.js:374` | Plan 013 already throttles answer events on the server, so the browser no longer gets one update per fragment. (2026-11-20) |
| `md()` in `app/agents.js` does not render numbered lists | Wrong. It does, at `app/agents.js:96` and `:98`. The real gap was the missing test, which plan 019 adds. (2026-11-20) |

## Found but not planned

Nothing is left here. All ten items from the first audit were handled on 2026-11-20:

- Seven became plans 018 to 024 (see the Status table).
- Three were rejected: the long one-line functions, the shared `readJson` helper and the per-frame `innerHTML` update. The claim that `md()` does not render numbered lists was also wrong. All four are in the table above.

Added 2026-11-25, from the audit of the areas the first pass skipped:

- `ownsFullscreen` in `app/map-fullscreen.js` (line 8) is never set to `true`, so the native full screen branches at lines 76 to 81 and line 88 never run. This became plan 026 on 2026-11-25.

Added 2026-11-25, while checking the interface review fixes (commit `9d58c80`). Neither is planned or changed:

- At a 300px viewport the page is 317px wide, so it scrolls sideways by 17px. The top actions row causes it: the Help button's right edge sits at 317px. The width is the same on `432e508`, before the interface fixes, so they did not cause it. At 320px, the narrowest width the app is checked at, the page does not scroll sideways.
- The app reopens in Agents mode when that was the last mode used, because the mode is kept in browser storage. This is existing behaviour, not a bug. It matters for browser checks: confirm `document.body.className` does not contain `mode-agents` before measuring the workspace.

## Direction

Options for the maintainer, not ranked against the fixes above.

1. **Run the moderated user test first.** `docs/Agents-user-test-script.md` exists and has not been run. Its results should decide what to build next in Agents.
2. **Workspace backup and restore.** Agents can be exported; the workspace cannot. Everything lives in one browser's storage, so clearing site data loses it.
3. **Raise the run ceiling.** A run is cut off at about 95 seconds on the hosted site. Long research agents with web search hit it. This needs a decision on hosting limits, not only code.
4. **Make browser-only schedules plain.** A schedule fires only while Nous is open in a tab. Either say so where the schedule is set, or move schedules to the server, which is a much larger piece of work.

## Not audited

Checked on 2026-11-25, and no longer open:

- `app/map-fullscreen.js` and `app/thinking-orbs.js` were read in full. One bug became plan 025 and the dead code became plan 026. The orb adapter has no finding.
- Vercel's edge was checked against the live site. The page arrives with the content security policy, `Permissions-Policy`, `Referrer-Policy`, `Strict-Transport-Security` and `X-Content-Type-Options` intact, `Cache-Control: no-cache` with an ETag, and a repeat request with `If-None-Match` gets a 304. `/context/nous-api-keys.md`, `/.env` and `/server.cjs` return 404. `X-Frame-Options: DENY` is sent by the local server and by the live site (both checked 2026-11-25). It is set at `app/server.cjs:66` and asserted at `tests/verify-hosting.cjs:88`, alongside `frame-ancestors 'none'` in the content security policy.

Still not audited:

- `context/nous-api-keys.md` is still unopened. Pattern counts taken without reading it show no provider, GitHub or Slack key shapes and no `KEY=` lines; its only long strings are 54 characters and begin `hosted-nous-`, which looks like heading anchors. On that evidence it is a design note, not a key store, and nothing needs rotating. That is an inference, not a reading.
- `app/vendor/thinking-orbs/engine.es.js` was searched, not read. It has no `eval`, `new Function`, network call, `innerHTML`, cookie or storage use.
- The CSS was checked for focus styles only. Every `outline:none` in `app/agents.css` has a visible replacement. Two were not followed up: `.review-panel:focus{outline:none}` at `app/ux-refinements.css:142` (fine only if the panel is focused by script and never by Tab), and the fixed `height:calc(100vh - 458px)` on `main` at `app/kit-theme.css:31`. (`app/theme.js` and `app/dark-theme.css` were read for plan 014, for styling only.)
