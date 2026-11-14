# Plan 006: Run every test file from one runner, from any directory

> **Executor instructions.** Follow the steps in order. Run every verification command and compare with the expected result before moving on. If a STOP condition applies, stop and report instead of improvising. When finished, update this plan's row in `plans/README.md` (unless a reviewer maintains the index for you).
>
> **Drift check (run first):** `git diff --stat 95dd4e8..HEAD -- package.json tests/`
> If the `test` script or the list of test files changed, STOP and report.

## Status

| Field | Value |
| --- | --- |
| Priority | P2 |
| Effort | S |
| Risk | LOW |
| Depends on | none (plan 007 depends on this one) |
| Category | dx |
| Planned at | commit `95dd4e8`, 2026-11-13 |

## Why this matters

The test command is a hand-written chain:

```json
"test": "node tests/verify-models.cjs && node tests/verify-streaming.cjs && node tests/verify-provider-client.cjs && node tests/verify-dictation.cjs && node tests/verify-agents.cjs && node tests/verify-hosting.cjs"
```

Three problems follow from that:

1. A new test file does nothing until someone remembers to add it to the chain. CI stays green while the file never runs.
2. The chain stops at the first failure, so one run shows one broken file, not all of them.
3. Nothing checks that the browser scripts even parse. There is no linter, type checker or build step, so a stray bracket in `app/agents.js` reaches production with a green CI.

Some tests also read files with paths relative to the current directory, so they only pass when run from the repository root.

## Current state

- `package.json` lines 10–11: `"start": "node app/server.cjs"` and the `test` chain above. No dependencies. Node 24.
- Test files: `tests/verify-models.cjs`, `verify-streaming.cjs`, `verify-provider-client.cjs`, `verify-dictation.cjs`, `verify-agents.cjs`, `verify-hosting.cjs`. Each is a plain Node script that uses `node:assert/strict`, prints a `…passed.` line and exits non-zero on failure. `verify-hosting.cjs` re-runs itself as a child process for local and hosted modes.
- Example of a path that depends on the current directory, in `tests/verify-dictation.cjs`: `fs.readFileSync('app/dictation.js','utf8')`.
- CI (`.github/workflows/test.yml`) runs `npm test` on Node 24.
- Browser scripts live in `app/*.js`; server modules in `app/*.cjs`; `app/vercel-entry.mjs` is the Vercel entry. `app/thinking-orbs.js` is the only script loaded with `type="module"`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Full suite | `npm test` | exit 0 |
| Runner directly | `node tests/run.cjs` | exit 0, ends with a summary line |

## Scope

**In scope**

- `tests/run.cjs` (new)
- `package.json` (the `test` script only)
- `tests/verify-*.cjs` (only to replace paths relative to the current directory)

**Out of scope**

- `.github/workflows/test.yml` (it already calls `npm test`).
- Adding a test framework, a linter or any dependency.
- Changing what any test asserts.

## Git workflow

- Branch: `advisor/006-add-test-runner`
- Commit style: one imperative sentence, as in `Print the full result, not just the summary card (#43)`. Leave the PR number off.
- Do not push or open a PR unless you were told to.

## Steps

### 1. Record the baseline

Run `npm test` and keep the output.

**Verify:** exit 0, six `…passed.` groups. If it fails, STOP.

### 2. Add the runner

Create `tests/run.cjs`:

```js
// Runs every tests/verify-*.cjs and syntax-checks every script under app/. A new verify file is picked up without editing package.json.
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),failures=[];
const run=(label,args)=>{const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(r.status!==0)failures.push(label);};

for(const file of fs.readdirSync(__dirname).filter(f=>/^verify-.+\.cjs$/.test(f)).sort())run(file,[path.join('tests',file)]);

// There is no build step, so this is the only check that the shipped scripts parse.
const skipSyntax=new Set([]);
for(const file of fs.readdirSync(path.join(root,'app')).filter(f=>/\.(js|cjs|mjs)$/.test(f)&&!skipSyntax.has(f)).sort())run('syntax: app/'+file,['--check',path.join('app',file)]);

if(failures.length){console.error('\nFailed: '+failures.join(', '));process.exit(1);}
console.log('\nAll test files and syntax checks passed.');
```

**Verify:** `node tests/run.cjs` → the same six groups as the baseline, then `All test files and syntax checks passed.`, exit 0.

If a syntax check fails on a file that is valid but is an ES module (most likely `app/thinking-orbs.js`), add that file name to `skipSyntax` with a comment saying why, for example `// ES module: node --check reads .js here as CommonJS`. Do not skip a file for any other reason. A real syntax error is a finding: STOP and report it.

### 3. Point `npm test` at the runner

In `package.json`, replace the value of `"test"` with `"node tests/run.cjs"`.

**Verify:** `npm test` → exit 0 with the summary line.

### 4. Make the tests independent of the current directory

```bash
grep -n "readFileSync('app/\|readFileSync(\"app/\|require('\./app\|readFileSync('tests/" tests/*.cjs
```

For each hit, build the path from the test file's own location, for example `fs.readFileSync(path.join(__dirname,'../app/dictation.js'),'utf8')`. Add `const path=require('node:path');` where the file does not already have it.

**Verify:** the grep → no output. Then, from another directory, run the runner by absolute path (replace the path with your checkout):

```bash
cd / && node /path/to/nous-repo/tests/run.cjs
```

→ exit 0.

### 5. Prove the runner fails properly

Create `tests/verify-zz-probe.cjs` containing `process.exit(1);`. Run `npm test`.

**Verify:** all six real files still run, the output ends `Failed: verify-zz-probe.cjs`, exit code 1. Delete the probe file and run `npm test` again → exit 0. `git status --short` must not list the probe.

## Test plan

The runner is the test infrastructure; step 5 is its test. No assertion in an existing test changes.

## Done criteria

- [ ] `npm test` exits 0 and prints `All test files and syntax checks passed.`
- [ ] `grep -c '"test": "node tests/run.cjs"' package.json` prints `1`.
- [ ] The grep in step 4 prints nothing.
- [ ] Step 5 showed exit code 1 with the probe present.
- [ ] `git status --short` lists only `package.json`, `tests/run.cjs` and any `tests/verify-*.cjs` edited in step 4 (and `plans/README.md`).
- [ ] This plan's row in `plans/README.md` is updated.

## STOP conditions

- `npm test` fails at step 1.
- `node --check` reports a real syntax error in a shipped file.
- A test only passes when run in the old order (it depends on another test's side effects). Report which.
- More than one file needs to go in `skipSyntax`.

## Maintenance notes

- New test files must be named `tests/verify-<something>.cjs` to be picked up.
- The runner runs files one after another on purpose: `verify-hosting.cjs` starts servers, and serial output is easier to read in CI.
- Plan 007 adds `tests/verify-agents-client.cjs` and relies on this pickup.
