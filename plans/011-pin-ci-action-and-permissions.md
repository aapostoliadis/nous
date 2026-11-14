# Plan 011: Pin the CI actions to commit SHAs and bound the job

> **Executor instructions.** Follow the steps in order. Run every verification command and compare with the expected result before moving on. If a STOP condition applies, stop and report instead of improvising. When finished, update this plan's row in `plans/README.md` (unless a reviewer maintains the index for you).
>
> **Drift check (run first):** `git diff --stat 95dd4e8..HEAD -- .github/workflows/test.yml`
> No other plan edits this file. If the file differs from the excerpt below, STOP and report.

## Status

| Field | Value |
| --- | --- |
| Priority | P3 |
| Effort | S |
| Risk | LOW |
| Depends on | none. Needs network access to look up two commit SHAs |
| Category | security |
| Planned at | commit `95dd4e8`, 2026-11-13 |

## Why this matters

The workflow uses `actions/checkout@v4` and `actions/setup-node@v4`. A tag such as `v4` can be moved to different code at any time, by the maintainers or by anyone who compromises their account, and the next run would execute it. Pinning to a full commit SHA means the workflow runs exactly the code that was reviewed. The job also has no time limit, so a hung test would hold a runner for GitHub's default of six hours, and the checkout leaves a token in the local git config that the test step does not need.

The workflow already limits the token to `contents: read`. That part is right and stays.

## Current state

`.github/workflows/test.yml`, the whole file (16 lines):

```yaml
name: Test
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm test
```

It is the only workflow file. `npm test` takes a few seconds locally.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Look up the commit behind a tag | `git ls-remote https://github.com/actions/checkout refs/tags/v4 'refs/tags/v4^{}'` | one or two lines, each a 40-character hex SHA and a ref name |
| Same for setup-node | `git ls-remote https://github.com/actions/setup-node refs/tags/v4 'refs/tags/v4^{}'` | as above |
| Full suite | `npm test` | exit 0 |

How to read the lookup: if a line ending in `refs/tags/v4^{}` is printed, use the SHA on that line (it is the commit an annotated tag points to). If only the plain `refs/tags/v4` line is printed, use that SHA.

## Scope

**In scope**

- `.github/workflows/test.yml` only.

**Out of scope**

- Adding Dependabot, new jobs, a matrix, caching or a lint step.
- Changing the Node version, the triggers or the `permissions` block.
- Moving to a newer major version of either action.

## Git workflow

- Branch: `advisor/011-pin-ci-action-and-permissions`
- Commit style: one imperative sentence, as in `Print the full result, not just the summary card (#43)`. Leave the PR number off.
- Do not push or open a PR unless you were told to.

## Steps

### 1. Look up both SHAs

Run the two `git ls-remote` commands above and note one SHA for each action.

**Verify:** each SHA is exactly 40 characters of `0-9a-f`. Never type a SHA from memory and never copy one from this plan (it contains none on purpose).

### 2. Rewrite the steps

Change the job so it reads as below, with your two SHAs in place of the placeholders. Keep the `# v4` comments; they tell a reader which release the SHA is.

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@<CHECKOUT_SHA> # v4
        with:
          persist-credentials: false
      - uses: actions/setup-node@<SETUP_NODE_SHA> # v4
        with:
          node-version: 24
      - run: npm test
```

Leave lines 1–7 (`name`, `on`, `permissions`) exactly as they are. Indent with two spaces, no tabs.

**Verify:**

- `grep -cE "uses: actions/(checkout|setup-node)@[0-9a-f]{40} # v4" .github/workflows/test.yml` → `2`
- `grep -c "@v4" .github/workflows/test.yml` → `0`
- `grep -c "timeout-minutes: 10" .github/workflows/test.yml` → `1`
- `grep -c "persist-credentials: false" .github/workflows/test.yml` → `1`
- `grep -cP "\t" .github/workflows/test.yml` → `0`

### 3. Confirm nothing else moved

**Verify:** `git diff --stat` shows one file changed. `npm test` → exit 0.

## Test plan

A workflow cannot be run locally. The grep checks prove the shape of the file. The real test is the first CI run after this is pushed: the Test job must start, check out the code and pass. Say in your report that this run has not happened yet unless you were told to push and saw it pass.

## Done criteria

- [ ] The five grep checks in step 2 print the expected numbers.
- [ ] `git diff 95dd4e8 -- .github/workflows/test.yml` shows no change to lines 1–7.
- [ ] `npm test` exits 0.
- [ ] `git status --short` lists only `.github/workflows/test.yml` (and `plans/README.md`).
- [ ] This plan's row in `plans/README.md` is updated, with a note that the first CI run is still to be watched.

## STOP conditions

- No network access, or `git ls-remote` fails. Do not guess a SHA.
- The lookup returns no `v4` tag for either action.
- The workflow has gained steps that need the checkout token (a push, a release, a comment). `persist-credentials: false` would break them; report instead.

## Maintenance notes

- Pinned SHAs do not update themselves. To take a new release, repeat step 1 and change the SHA and the comment together. If that becomes a chore, add Dependabot for `github-actions`; it understands the `# v4` comment and opens the update for you.
- If the first CI run fails at checkout or setup-node, the likeliest cause is a mistyped SHA. Compare it with the lookup again before changing anything else.
