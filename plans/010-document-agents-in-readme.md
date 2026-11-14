# Plan 010: Describe the Agents feature, its tests and its docs in the README

> **Executor instructions.** Follow the steps in order. Run every verification command and compare with the expected result before moving on. If a STOP condition applies, stop and report instead of improvising. When finished, update this plan's row in `plans/README.md` (unless a reviewer maintains the index for you).
>
> **Drift check (run first):** `git diff --stat 95dd4e8..HEAD -- README.md`
> No other plan edits `README.md`. If the Features list or the Project structure section quoted below has changed, STOP and report.

## Status

| Field | Value |
| --- | --- |
| Priority | P3 |
| Effort | S |
| Risk | LOW |
| Depends on | none. Best done after the other plans, so the README describes what shipped |
| Category | docs |
| Planned at | commit `95dd4e8`, 2026-11-13 |

## Why this matters

Agents is the largest feature in the app (`app/agents.js` is 544 lines, with its own server endpoints and its own test file) and the README does not mention it. Someone who clones the repository learns about Ask, Connections and dictation, then finds a whole mode nobody told them about. The Project structure section also describes `tests/` and `docs/` as they were before Agents existed.

## Current state

`README.md` (62 lines) in the repository root.

Lines 35–43 are a `## Features` list of nine bullets. None mentions Agents.

Lines 44–62 hold `## Validation` and `## Project structure`. The two lines to change:

```markdown
- `tests/`: isolated provider, streaming, request lifecycle and dictation checks.
```

```markdown
- `docs/`: visual adaptation notes and the UX review.
```

Facts about Agents, each confirmed in the code at the planned commit. Use only these; do not add others.

- An agent is a saved set of instructions you run on request. Results stay in the browser (localStorage key `nous-agents-v1`).
- The server endpoints are `/api/agents/design` (drafts an agent from a description) and `/api/agents/run` (runs one). Both are in `app/server.cjs`.
- Templates: "Save as template" and "Use template".
- Optional web search per agent. The interface says: "Unless you turn on web search, nothing here reaches outside this browser and your chosen provider."
- Schedules. They run from a timer in the page, so only while Nous is open in a browser tab.
- "Run and compare" and "Try another model" run the same request on another model.
- "Follow up", "Improve instructions", "Mark reviewed", "Archive" and "Restore".
- "Attach file" on a run.
- "Save to workspace" puts a result into the workspace.
- "Export agents" and "Import agents" move agents between browsers as a file.
- "Delete all agents and results".

`tests/` holds `verify-agents.cjs`, `verify-dictation.cjs`, `verify-hosting.cjs`, `verify-models.cjs`, `verify-provider-client.cjs`, `verify-streaming.cjs`.

`docs/` holds `Agents-user-test-script.md`, `FIGMA-ADAPTATION.md`, `Nous-UX-review.md`.

The README's description of where API keys are stored (lines 19–21) was checked against `app/connections.js` and is accurate. Leave it alone.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Confirm a label exists in the app | `grep -c "Run and compare" app/agents.js` | `1` or more |
| Full suite | `npm test` | exit 0 |

## Scope

**In scope**

- `README.md` only.

**Out of scope**

- Any file under `app/`, `tests/` or `docs/`.
- The Connections and key-storage paragraphs.
- Screenshots or new images.
- A changelog or a separate Agents guide.

## Git workflow

- Branch: `advisor/010-document-agents-in-readme`
- Commit style: one imperative sentence, as in `Print the full result, not just the summary card (#43)`. Leave the PR number off.
- Do not push or open a PR unless you were told to.

## Steps

### 1. Confirm every label you are about to cite

Run `grep -c` on `app/agents.js` for each quoted label in the facts list above ("Save as template", "Use template", "Run and compare", "Try another model", "Follow up", "Improve instructions", "Mark reviewed", "Attach file", "Save to workspace", "Export agents", "Import agents").

**Verify:** each prints `1` or more. Leave out of the README any label that prints `0`, and say so in your report.

### 2. Add an Agents section

Directly after the Features list (after its last bullet, before `## Validation`), add this section. Match the README's existing style: sentence-case headings, bold for interface labels, no em dashes.

```markdown
## Agents

An agent is a set of instructions you save once and run whenever you need it. Open **Agents** beside Ask, describe the job in a sentence and Nous drafts the agent for you to edit.

- Run an agent on a request, attach a file, then follow up on the result.
- **Run and compare** or **Try another model** to see the same request answered by a different model.
- **Improve instructions** rewrites the agent from a result you were not happy with.
- Turn on web search for an agent that needs current facts. Without it, nothing leaves this browser except the request to your chosen provider.
- Give an agent a schedule. Schedules run from the open page, so they only fire while Nous is open in a browser tab.
- **Save to workspace** adds a result to your workspace. **Mark reviewed** and **Archive** keep the list tidy.
- Save an agent as a template, and use **Export agents** and **Import agents** to move agents to another browser.

Agents and their results are stored in this browser. Clearing site data removes them, so export the agents you want to keep.
```

**Verify:** `grep -c "^## Agents" README.md` → `1`.

### 3. Update the Project structure lines

Replace the `tests/` line with:

```markdown
- `tests/`: isolated provider, streaming, request lifecycle, dictation, agent and hosting checks.
```

Replace the `docs/` line with:

```markdown
- `docs/`: visual adaptation notes, the UX review and the Agents user test script.
```

**Verify:** `grep -c "agent and hosting checks" README.md` → `1`. `grep -c "Agents user test script" README.md` → `1`.

### 4. Read it through

Read the whole README once, top to bottom. The new section must not repeat a Features bullet, and no sentence may claim something the facts list does not support.

**Verify:** `npm test` → exit 0 (nothing should have changed; this confirms no stray edit).

## Test plan

Documentation only. No test is added. The checks are the grep counts above and a read-through.

## Done criteria

- [ ] `grep -c "^## Agents" README.md` prints `1`.
- [ ] `grep -c "agent and hosting checks" README.md` prints `1`.
- [ ] `grep -c "Agents user test script" README.md` prints `1`.
- [ ] `grep -c "—" README.md` prints the same number as before your change (no new em dashes).
- [ ] `git status --short` lists only `README.md` (and `plans/README.md`).
- [ ] This plan's row in `plans/README.md` is updated.

## STOP conditions

- The README already has an Agents section.
- More than two of the labels in step 1 are missing from `app/agents.js`. The feature has changed since this plan was written.
- You find yourself wanting to describe a behaviour that is not in the facts list. Report it instead.

## Maintenance notes

- If plan 012 (sync across tabs) lands, the storage sentence stays true and needs no change.
- If schedules ever move to the server, the schedule bullet becomes wrong and must change with that work.
- Printing is not an Agents feature at this commit. Do not add it.
