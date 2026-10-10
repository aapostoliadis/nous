# Nous interface

## Proposal review opens as a slide-over dialog on every width

**Id:** bcba2591-24ff-48aa-97e7-d25cdb8f2548
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** UI review of the live site, 2026-10-09/10; P1 changes #3/#4, nous commit 9b9f873
**See:** nous-interface.md#mobile-and-touch-get-a-list-view-tap-for-full-screen-and-a-pinned-ask-bar — 53830926-23c2-4b86-a3d9-7e5f78ba1a18 — as of 2026-10-10

Reviewing proposals no longer switches the app to a separate Actions
view. `setView('actions')` now calls `openReview()`, which renders a
right-edge panel (`.review-panel`, `role="dialog"`, `aria-modal="true"`,
`width:min(720px,100vw)`) over a scrim inside `#review-host`. It has a
"← Back to …" button, closes on Esc, and returns focus to the control
that opened it. At ≤850px a "Proposals (N)" chip (`#review-chip`) is the
entry point, so review is reachable at every width.

**Reason:** the review of the live site found proposal review lived in
its own view, which took the user away from the map they were judging
the proposals against, and was hard to reach on narrow screens. A
slide-over keeps the map visible behind it and works the same way at
every width.

**Which parts are confirmed:** the change itself (the maintainer asked
for the P1 list, which named it) and the implementation in `app/app.js`
and `app/ux-refinements.css`. Inferred: the reason above, taken from the
review's findings rather than stated when the choice was made.

**Rejected alternative:** keep the separate Actions view (the previous
behaviour). Inferred reason: it hides the context the proposals refer to
and needs its own navigation on mobile.

**Consequence:** `renderActions()` now runs only inside the review
panel. `body.review-open` locks page scroll while the panel is open, and
reduced-motion turns off its slide-in animation.

## Rejected is drawn as an exit from Candidate, not a lifecycle step

**Id:** 05a97aee-d916-4449-bdf3-02982d11224c
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** UI review of the live site, 2026-10-09/10; P1 change #4, nous commit 9b9f873

The Decisions lifecycle strip reads Idea → Candidate → Decided →
Superseded, with `↳ Rejected` drawn under Candidate as a side exit (the
`state-exit` class). Its aria-label says "A candidate can exit as
Rejected."

**Reason:** a decision that is rejected never becomes Decided or
Superseded, so showing Rejected as one more step in the row implied an
order that does not exist. Drawing it as a branch matches how a
candidate actually moves.

**Which parts are confirmed:** the change (part of the P1 list the
maintainer asked for) and its implementation in `app/app.js`. Inferred:
the reason.

**Alternatives:** unknown beyond the previous linear strip.

**Consequence:** none outside the strip's markup and styles.

## The Ask model picker sits behind a chip

**Id:** 9d3901e8-66ca-4231-9f68-8526b55c91fa
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** UI review of the live site, 2026-10-09/10; P1 change #5, nous commit 9b9f873
**See:** nous-interface.md#ask-lists-only-text-models-led-by-a-short-suggested-list — e11f7752-553e-4995-9bfc-d00ce802f6ea — as of 2026-10-10

The provider and model controls for Ask are collapsed behind
`#model-chip`, which shows the current choice and opens the picker on
demand (`app/connections.js`).

**Reason:** most asks reuse the last model, so permanently visible
controls took space next to the Ask bar for a setting that rarely
changes. The code comment records this reason.

**Which parts are confirmed:** the change (part of the P1 list) and the
implementation. Inferred: that this reason was the deciding one; it was
written alongside the change, not stated by the maintainer.

**Rejected alternative:** the always-visible picker (the previous
behaviour). Inferred reason: the space cost above.

**Consequence:** changing model takes one extra click.

## Ask lists only text models, led by a short suggested list

**Id:** e11f7752-553e-4995-9bfc-d00ce802f6ea
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** UI review of the live site, 2026-10-09/10; P1 change #6, nous commit 9b9f873

The Ask model list keeps only models that can answer in text (the
responses, chat or messages modes). Audio models are listed under Audio
tools instead. The list opens with a Suggested group of at most four
(the default, the model the user wanted, and a structured-output model),
followed by "Show all N models…".

**Reason:** the review found the full provider catalogue in the picker,
including models that cannot answer an Ask, which made the list long
and let users pick a model that would fail. Filtering by mode removes
the failures, and the short list covers the usual choices.

**Which parts are confirmed:** the change (part of the P1 list) and the
implementation in `app/connections.js`. Inferred: the
reason, and why four was chosen as the cap.

**Rejected alternative:** the unfiltered provider catalogue (the
previous behaviour). Inferred reason: the length and failing choices
above.

**Consequence:** the audio branch in `submitAsk` could no longer be
reached from the Ask picker, so it was removed (nous commit 11a2ea1,
2026-10-10). Audio models stay reachable through the Audio tools button
(`app/audio-tools.js`).

## Mobile and touch get a list view, tap for full screen, and a pinned Ask bar

**Id:** 53830926-23c2-4b86-a3d9-7e5f78ba1a18
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** UI review of the live site, 2026-10-09/10; P1 change #8, nous commit 9b9f873
**See:** nous-interface.md#on-desktop-only-the-ask-input-is-pinned — fafb4ccb-a9ea-4fb3-90b1-9d7b8a4dc56c — as of 2026-10-10
**Revisit when:** the change is tested on a real touch device rather than browser emulation

Three changes for small and touch screens:

- A Map/List segmented control. List (`renderObjectList`) groups objects
  by type in the order question, claim, assumption, evidence, source,
  decision, artifact.
- On `(pointer:coarse)`, a tap that moves less than 8px opens the map
  full screen, and the hints change with the input mode ("Tap ⤢ to
  return" instead of "Esc to return").
- At ≤850px, `#command-form` is fixed to the bottom of the screen.

**Reason:** the review found the map clipped nodes at the right edge on
narrow screens, its hints assumed a keyboard and mouse, and the Ask bar
sat at the bottom of a 2,349px page. A list reads on any width, touch
gets its own way into full screen, and the Ask bar stays in reach.

**Which parts are confirmed:** the three problems (measured in the
review) and the changes (part of the P1 list). Inferred: the reasons
for these particular fixes and the 8px threshold.

**Alternatives:** unknown — no other fixes for these problems were
discussed.

**Consequence:** the Map/List choice is saved per device in its own
`localStorage` key (`nous-map-layout`), apart from the saved workspace,
so it survives reloads. Switching to List leaves full screen, since full
screen applies only to the map. Touch behaviour was checked only by
emulation.

## On desktop only the Ask input is pinned

**Id:** fafb4ccb-a9ea-4fb3-90b1-9d7b8a4dc56c
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** nous commits 12e13e4 and 11a2ea1, 2026-10-10
**See:** nous-interface.md#mobile-and-touch-get-a-list-view-tap-for-full-screen-and-a-pinned-ask-bar — 53830926-23c2-4b86-a3d9-7e5f78ba1a18 — as of 2026-10-10

Above 850px, `#command-form` is `position:fixed` at the bottom of the
window (`app/ux-refinements.css`), with a blurred backing strip
(`body::after`, 82px) so page content does not show around it while
scrolling. The scope line and suggestions in `.command-dock` scroll with
the page and sit above the input at the end of it. In full screen map
the form is not pinned.

**Reason:** the Ask bar should stay visible on desktop, as it already
did on mobile. Pinning the whole dock took about 175px of the viewport;
pinning only the input keeps Ask in reach for 82px.

**Which parts are confirmed:** that the Ask bar must stay visible on
desktop, and the choice of pinning only the input row over the whole
dock (both asked for by the maintainer). Inferred: that the space cost
was the deciding reason; it was how the option was described when it was
picked, not stated by the maintainer.

**Rejected alternative:** pin the entire `.command-dock` with
`position:sticky` (commit 12e13e4, replaced in 11a2ea1). Rejected for
the ~175px it covered.

**Consequence:** desktop and ≤850px now pin the same element, so the two
layouts behave alike. Pages get 82px of bottom padding on desktop (70px
on mobile) so their last content is not hidden behind the input.

## Workspace commands run locally whichever provider is selected

**Id:** c6dadacb-0af5-4654-a2cd-bcc2b812c6a2
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** nous working-tree change, 2026-10-10 (`app/ask.js`, `app/connections.js`, `tests/verify-provider-client.cjs`)

When a model provider is selected, `submitAsk` in `app/connections.js`
first calls the local `submitAsk(true)`. In that mode `answerAsk` runs
only the workspace commands (set goal, add constraint, create object,
create branch, challenge, mark @X as state, compare alternatives, draft
brief, edit context, show actions, show map) and returns `null` for
anything else, which then goes to the model. "Explain @X" and other
questions are not commands, so a selected model answers them.

**Reason:** before this, selecting OpenAI or Claude sent commands such
as "add a question: …" to the model instead of changing the workspace,
and without a saved key they failed with "Connect this provider first".
Commands change local state that the model cannot change directly.

**Which parts are confirmed:** that commands must work with any provider,
and that "draft a brief" stays local with a model selected (both decided
by the maintainer, the latter on 2026-10-10). Inferred: the reason as
worded.

**Rejected alternative:** let a selected model write the brief. Reason
for rejecting it: not stated by the maintainer; the local version
rebuilds the brief from the workspace objects and keeps their
references attached.

**Consequence:** a reference to a missing object (`@X99`) is answered
locally with "Object not found" before any model is asked, as it was
before.
