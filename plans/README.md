# Improvement plans for Nous

Written against commit `95dd4e8` on 2026-11-13. Each plan is self-contained: an executor needs only the plan file and the repository.

Audit depth was `standard`. All nine categories were covered. The user selected all 13 vetted findings.

## Status

Update the Status column when a plan is finished or stopped. Values: `TODO`, `IN PROGRESS`, `DONE`, `BLOCKED` (add the reason), `STALE`.

| # | Plan | Priority | Effort | Risk | Category | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | [Stop imported agent ids from injecting markup](001-sanitize-imported-agent-ids.md) | P1 | S | LOW | security | none | DONE (reviewed, approved; branch `advisor/001-sanitize-imported-agent-ids`, commit `656bf7d`, merged into local `main` at `3d2690e`, pushed to `origin` on 2026-11-14; browser check in step 5 not verified) |
| 002 | [Decode request bodies once, so split characters survive](002-decode-request-bodies-as-utf8.md) | P1 | S | LOW | bug | none | DONE (reviewed, approved; branch `advisor/002-decode-request-bodies-as-utf8`, commit `4275587`, merged into local `main` at `3d2690e`, pushed to `origin` on 2026-11-14) |
| 003 | [Make the browser and server agree on agent length limits](003-align-agent-length-limits.md) | P2 | S | LOW | bug | none | TODO |
| 004 | [Never trim the run that has just started](004-keep-running-run-when-trimming.md) | P2 | S | LOW | bug | none | TODO |
| 005 | [Show a readable error when the server answers with something that is not JSON](005-handle-non-json-error-responses.md) | P2 | S | LOW | bug | none | DONE (reviewed, approved; branch `advisor/005-handle-non-json-error-responses`, commit `ea77375`, merged into local `main` at `3d2690e`, pushed to `origin` on 2026-11-14; its conflict with 006 in `tests/verify-dictation.cjs` was resolved by keeping both sides) |
| 006 | [Run every test file from one runner, from any directory](006-add-test-runner.md) | P2 | S | LOW | dx | none | DONE (reviewed, approved; branch `advisor/006-add-test-runner`, commit `0885c16`, merged into local `main` at `3d2690e`, pushed to `origin` on 2026-11-14) |
| 007 | [Put the browser side of Agents under test](007-test-agents-client.md) | P2 | M | LOW | tests | 006 | TODO |
| 008 | [Send a Content-Security-Policy that blocks injected script](008-add-content-security-policy.md) | P2 | S | MED | security | 001 first or together | TODO |
| 009 | [Answer unchanged static files with 304 instead of resending them](009-add-etag-revalidation.md) | P3 | S | LOW | performance | none | TODO |
| 010 | [Describe the Agents feature, its tests and its docs in the README](010-document-agents-in-readme.md) | P3 | S | LOW | docs | none | DONE (reviewed, approved; branch `advisor/010-document-agents-in-readme`, commit `cfaada8`, merged into local `main` at `3d2690e`, pushed to `origin` on 2026-11-14) |
| 011 | [Pin the CI actions to commit SHAs and bound the job](011-pin-ci-action-and-permissions.md) | P3 | S | LOW | security | none | DONE (reviewed, approved; branch `advisor/011-pin-ci-action-and-permissions`, commit `d79e83e`, merged into local `main` at `3d2690e`, pushed to `origin` on 2026-11-14; first CI run after the push passed on 2026-11-14) |
| 012 | [Keep agents and runs in step when Nous is open in two tabs](012-sync-agents-across-tabs.md) | P3 | M | MED | bug | 007 | TODO |
| 013 | [Stop re-parsing the whole answer on every streamed fragment](013-throttle-streaming-rescan.md) | P3 | S | LOW | performance | none | DONE (reviewed, approved; branch `advisor/013-throttle-streaming-rescan`, commit `70b283f`, merged into local `main` at `3d2690e`, pushed to `origin` on 2026-11-14) |
| 014 | [Add a "Tech Innovation" style (dark gray, electric blue, cyan, DejaVu Sans) and make it the default](014-add-tech-innovation-style.md) | P3 | M | LOW | design | none | DONE (reviewed, approved; branch `advisor/014-add-tech-innovation-style`, commit `f2183c1`, merged into local `main` at `d1c8c4e`, pushed to `origin` on 2026-11-14; checked in a headless browser: opens in Tech Innovation, both fonts load, saved choices persist, old saved values open in Tech, no console errors; System on a dark OS preference covered by the test only) |

## Recommended order

006, 001, 002, 004, 003, 005, 007, 008, 009, 011, 010, 013, 012.

The runner (006) goes first so every later plan's tests are picked up without editing `package.json` again. The two P1 fixes follow. 012 goes last because it changes how `app/agents.js` loads and saves, and it relies on the tests 007 adds.

## Dependencies and files that collide

Hard dependencies:

- 006 before 007 (007 adds a test file the runner must pick up).
- 007 before 012 (012 extends the test file 007 creates).
- 001 before 008, or both together (the policy in 008 is the second line of defence for the hole 001 closes).

Plans that edit the same files. Run them one after another, each on top of the previous one, never in parallel:

- `app/agents.js`: 001, 003, 004, 007 (one line), 012.
- `app/server.cjs` and `tests/verify-hosting.cjs`: 002, 008, 009.
- `tests/`: 006 first (merged), then any plan that adds a test file (007; 014 is merged). The runner picks new `tests/verify-*.cjs` files up without a `package.json` edit.
- `app/index.html`: 014 (merged) added a menu button with an inline `style` attribute; 008 must allow it the same way it allows the two existing swatches.

Independent of everything else: 005, 010, 011, 013. 014 (added 2026-11-14 at the maintainer's request, not from the audit; merged) touched only the style files (`app/theme.js`, `app/dark-theme.css`, `app/index.html`, `app/assets/fonts/`) and added one test file. It changed the default style for every visitor without a saved choice. 010 is best done late so the README describes what shipped.

Plans that need more than a terminal:

- 008 needs a pass through the app in a real browser with the console open, to catch anything the policy blocks.
- 011 needs network access for two `git ls-remote` lookups, and its real test is the first CI run after a push.
- 012 step 5 needs two browser tabs.
- 014 needed network access for the font download, and a look at the new style in a real browser. Both are done.

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

## Found but not planned

Lower value. Each is a candidate for a later run.

- About 2.4 MB of PNG files in `app/assets` that nothing references.
- `md()` in `app/agents.js` does not render numbered lists, and its link pattern is loose.
- The model-capability pattern at `app/providers.cjs:63` will need care as model names change.
- An unreachable branch at `app/providers.cjs:39`.
- `vercel.json` is only lightly checked by the tests.
- Several source files keep whole functions on one very long line, which makes diffs hard to review.
- The Agents stream reader has no byte cap. The Connections reader caps at 16,000,000.
- After 008: `Referrer-Policy` and `Permissions-Policy` headers.
- After 005: one shared `readJson` helper in place of three copies.
- After 013: coalesce the `innerHTML` update at `app/agents.js:374` to one per animation frame.

## Direction

Options for the maintainer, not ranked against the fixes above.

1. **Run the moderated user test first.** `docs/Agents-user-test-script.md` exists and has not been run. Its results should decide what to build next in Agents.
2. **Workspace backup and restore.** Agents can be exported; the workspace cannot. Everything lives in one browser's storage, so clearing site data loses it.
3. **Raise the run ceiling.** A run is cut off at about 95 seconds on the hosted site. Long research agents with web search hit it. This needs a decision on hosting limits, not only code.
4. **Make browser-only schedules plain.** A schedule fires only while Nous is open in a tab. Either say so where the schedule is set, or move schedules to the server, which is a much larger piece of work.

## Not audited

- `context/nous-api-keys.md` was deliberately left unopened. If it holds live keys, it should not be in the repository; rotate them and remove the file from history.
- The vendored thinking-orbs code, `app/map-fullscreen.js` and most of the CSS. (`app/theme.js` and `app/dark-theme.css` were read for plan 014, for styling only.)
- Behaviour at Vercel's edge (caching, header rewriting). Only the Node entry was read.
