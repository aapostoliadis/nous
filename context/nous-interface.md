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

## The agents studio has one style: glass

**Id:** da047ee9-f29a-49fc-8d44-cf6e8e7250b0
**Type:** decision
**Status:** active
**Evidence:** unknown
**Source:** design review of three rendered studio variants, 2026-10-31; nous commit 9b84119

The agents studio (`.agents-app` in `app/agents.css`) has a single
visual style: lavender glass (translucent cards, `backdrop-filter`
blur), with a dark counterpart under `[data-mode="dark"]`. There is no
style switch: the `data-agents-style` attribute and the
`nous-agents-style` storage key were removed.

**Reason:** three variants, glass, ink and paper, were rendered side by
side and the maintainer picked glass. Why glass beat the other two was
not stated.

**Which parts are confirmed:** that glass was chosen and that the other
styles were dropped, not kept as options. Unknown: the reason for
preferring glass. Inferred: dropping the switch keeps one set of studio
styles to maintain and test in light and dark.

**Rejected alternatives:** ink and paper, as the studio style (reason
unknown, see above), and keeping all three behind a user-selectable
style setting (inferred reason: three themes to keep working for a
choice nobody needed to make).

## The workspace goes inert behind the agents studio

**Id:** a549f3a5-b07c-4e6d-955e-0d5b16865d5e
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** end-to-end check of the studio against a stand-in provider, 2026-10-31; nous commit 9b84119

The studio is a fixed overlay over the workspace, not a separate page.
When it opens, `setMode('agents')` in `app/agents.js` sets `inert` on
every child of `<body>` except the studio itself, `<dialog>` elements,
scripts and `#toast`. Leaving the studio clears `inert` and returns focus
to `#agents-toggle`.

**Reason:** the end-to-end check found that keyboard focus could still
move into workspace controls hidden behind the overlay, so a keyboard or
screen-reader user could act on a screen they could not see. `inert`
takes the covered workspace out of focus order and the accessibility
tree while leaving it rendered, so it reappears unchanged on exit.

**Which parts are confirmed:** the focus leak (observed) and that the fix
closed it (re-checked locally and on the live site). Inferred: why
dialogs and `#toast` are exempt; they show messages and prompts that can
be raised while the studio is open and must stay reachable.

**Rejected alternative:** only covering the workspace visually (the
first version). Rejected because covering does not stop focus. Other
options, such as unmounting the workspace while the studio is open, were
not weighed: alternatives beyond this one are unknown.

## Nous has four styles, and System picks Light or Warm ink

**Id:** 5297a405-1b53-47f2-8579-78953b15a71f
**Type:** decision
**Status:** superseded
**Superseded by:** 84f8fe78-0b1e-450e-8634-cc243f909a8d
**Evidence:** inferred
**Source:** nous commits 9ac5e55 and 4a6738a

A palette menu in the header switches between Light, Graphite, Forest
and Warm ink, plus System (`app/theme.js`). The choice is saved per
device under `nous-theme`. Without a saved choice, System follows the
OS light/dark setting live, using Light or Warm ink. A saved `dark`
from the earlier single dark mode is read as Warm ink.

**Reason:** unknown. The three dark palettes were rendered side by side
for a pick, but why all three were kept as options, and why Warm ink is
the dark default, was not recorded.

**Rejected alternative:** the single dark mode that Warm ink replaced;
why it lost is unknown.

## Nous has two styles, Light by default

**Id:** 84f8fe78-0b1e-450e-8634-cc243f909a8d
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer request; `app/theme.js`, `app/dark-theme.css`

The style menu offers System, Light and Warm ink. Without a saved
choice Nous shows Light; System (saved as `system`) follows the OS
setting live. Each option shows a tile in its own colours with an icon:
a desktop for System, a sun for Light, a moon for Warm ink. Saved
`dark`, `graphite` and `forest` values open in Warm ink.

**Reason:** unknown. The maintainer asked to keep one dark style and to
default to Light; why was not stated.

**Rejected alternatives:** keeping Graphite and Forest beside Warm ink
(removed), and following the OS setting when nothing is saved (the
previous default). The icon tiles were picked over other renderings
shown side by side; why is unknown.

## The style menu is repeated in the agents studio Settings

**Id:** 653f1bca-4dbf-4353-8343-fc26ba58e483
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** browser check of the studio, 2026-11-01; nous PR #21

The studio's Settings view has a Style card with the same System, Light
and Warm ink options as the header menu. It copies the header options'
markup, so their icons, swatches and pressed state come from one place.
`app/theme.js` handles option clicks anywhere on the page, not only
inside `#theme-menu`.

**Reason:** the header sits behind the studio and is inert while the
studio is open (see "The workspace goes inert behind the agents
studio"), so the style button could not be reached without leaving the
studio. Repeating the options inside the studio restores access and
leaves the inert decision intact. The maintainer approved the fix.

**Rejected alternatives:** unknown. Lifting the header out of `inert`
or above the overlay would have reversed the decision above; it was not
weighed as an option.
