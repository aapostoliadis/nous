# Nous interface

## Proposal review opens as a slide-over dialog on every width

**Id:** bcba2591-24ff-48aa-97e7-d25cdb8f2548
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** UI review of the live site, 2026-10-09/10; P1 changes #3/#4 in the nous repository (uncommitted as of 2026-10-10)
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
**Source:** UI review of the live site, 2026-10-09/10; P1 change #4 in the nous repository (uncommitted as of 2026-10-10)

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
**Source:** UI review of the live site, 2026-10-09/10; P1 change #5 in the nous repository (uncommitted as of 2026-10-10)
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
**Source:** UI review of the live site, 2026-10-09/10; P1 change #6 in the nous repository (uncommitted as of 2026-10-10)

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

**Consequence:** the audio branch in `submitAsk` can no longer be
reached from the Ask picker; whether to remove it is open.

## Mobile and touch get a list view, tap for full screen, and a pinned Ask bar

**Id:** 53830926-23c2-4b86-a3d9-7e5f78ba1a18
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** UI review of the live site, 2026-10-09/10; P1 change #8 in the nous repository (uncommitted as of 2026-10-10)
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

**Consequence:** the Map/List choice is not remembered between visits,
and switching to List leaves full screen. Touch behaviour was checked
only by emulation.
