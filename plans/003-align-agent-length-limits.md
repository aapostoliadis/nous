# Plan 003: Make the browser and server agree on agent length limits

> **Executor instructions.** Follow the steps in order. Run every verification command and compare with the expected result before moving on. If a STOP condition applies, stop and report instead of improvising. When finished, update this plan's row in `plans/README.md` (unless a reviewer maintains the index for you).
>
> **Drift check (run first):** `git diff --stat 95dd4e8..HEAD -- app/agents.js app/agents.cjs tests/verify-agents.cjs`
> If a file changed and the excerpts below no longer match, STOP and report.

## Status

| Field | Value |
| --- | --- |
| Priority | P2 |
| Effort | S |
| Risk | LOW |
| Depends on | none (touches run code in `app/agents.js` near plan 004; do them one at a time) |
| Category | bug |
| Planned at | commit `95dd4e8`, 2026-11-13 |

## Why this matters

The agent forms let a person type exactly as much as the server accepts: 6,000 characters of instructions and a 5,000-character request. But the browser then adds text before sending, and the total goes over the server's limit. Three cases:

1. **Answer length.** With "Short" or "Detailed" selected, a sentence is appended to the instructions. An agent with instructions near 6,000 characters is rejected with "This agent is incomplete. Open it and finish its identity." The agent is complete; the message sends the person looking for a problem that does not exist.
2. **Follow-up runs.** A follow-up wraps the request with the earlier request and result. A long follow-up request pushes the total past 5,000 and the run fails with "Keep the request under 5,000 characters." although the box allowed the text.
3. **Improve instructions fallback.** When the model returns nothing, the app builds new instructions by appending the feedback. The result can exceed 6,000 and the agent can no longer run.

## Current state

Nous is a static app under `app/`. `app/agents.js` (browser, 544 lines, one IIFE, very long lines) talks to `app/agents.cjs` (server, 57 lines). Find code by searching for the quoted strings.

Server limits, `app/agents.cjs` lines 38–39 (inside the run handler):

```js
if(!a||!boundedString(a.name,80)||!a.name.trim()||!boundedString(a.description,300)||!boundedString(a.instructions,6000)||!a.instructions.trim())fail('This agent is incomplete. Open it and finish its identity.');
if(!boundedString(input.request,5000))fail('Keep the request under 5,000 characters.');
```

`boundedString` and `fail` come from `app/providers.cjs` (`const {complete,fail,boundedString}=require('./providers.cjs');`, line 3). `fail(message)` throws an error the client shows as is.

Browser, `app/agents.js`:

- Line 57: `const LENGTHS={Short:'Keep the answer short: a few sentences or bullets.',Standard:'',Detailed:'Give a detailed, thorough answer.'};`
- Line 373, inside `async function run(`: `instructions:a.instructions+(LENGTHS[length]?'\n\n'+LENGTHS[length]:'')`
- Line 319:

  ```js
  const withParent=(request,p)=>{if(!p)return request;const head=`This follows up on an earlier run.\n\nEarlier request: ${(p.request||'(usual run)').slice(0,500)}\n\nEarlier result:\n`,tail=`\n\nFollow-up: ${request}`,room=5000-head.length-tail.length;return head+(p.answer.length>room?p.answer.slice(0,Math.max(0,room-1))+'…':p.answer)+tail;};
  ```

  When `request` is long, `room` goes negative, the earlier answer becomes `…`, and the total is still over 5,000.

- Line 347 (search `Feedback to apply:`): `` next||`${a.instructions.trim()}\n\nFeedback to apply:\n${list}` ``
- Form limits: request textarea `maxlength="5000"` (line 230), instructions `maxlength` 6000 (line 247).

`tests/verify-agents.cjs` (61 lines) tests the server module only. It already has an assertion that a 5,001-character request rejects with `/under 5,000/`. Its fixtures: `base={provider:'anthropic',model:'claude-test',key:'agents-fixture-not-a-real-key'}` and a `fake(value,seen)` fetch stub. Read the file before adding to it and copy its style.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Syntax check | `node --check app/agents.js` and `node --check app/agents.cjs` | no output, exit 0 |
| Agent tests only | `node tests/verify-agents.cjs` | exit 0 |
| Full suite | `npm test` | exit 0 |

Never run a real agent against a provider. Tests use the stub model `claude-test` and a fake `fetch`.

## Scope

**In scope**

- `app/agents.cjs` (the two validation lines only)
- `app/agents.js` (`withParent`, and the fallback at `Feedback to apply:`)
- `tests/verify-agents.cjs`

**Out of scope**

- The form `maxlength` values.
- `trimRuns` (plan 004) and the import handler (plan 001).
- The design endpoint limits in `agents.cjs` (goal 2,000, answers, context).
- Prompt wording sent to the provider.

## Git workflow

- Branch: `advisor/003-align-agent-length-limits`
- Commit style: one imperative sentence, as in `Agents: web search toggle, live steps, report card (#39)`. Leave the PR number off.
- Do not push or open a PR unless you were told to.

## Steps

### 1. Server: allow the appended answer-length note, and say what is actually wrong

In `app/agents.cjs`, replace the line that ends `fail('This agent is incomplete. Open it and finish its identity.');` with two lines:

```js
if(!a||!boundedString(a.name,80)||!a.name.trim()||!boundedString(a.description,300)||typeof a.instructions!=='string'||!a.instructions.trim())fail('This agent is incomplete. Open it and finish its identity.');
// The form caps instructions at 6,000; the browser may append a short answer-length note, so allow a little more.
if(a.instructions.length>6100)fail('Keep the instructions under 6,000 characters.');
```

First open `app/providers.cjs`, find `boundedString`, and confirm it means "is a string no longer than N". If it does something else as well (for example trimming or rejecting empty strings), keep that behaviour in the rewritten checks and note it in your report.

**Verify:** `node --check app/agents.cjs` → no output.

### 2. Test the server change

In `tests/verify-agents.cjs`, next to the existing 5,001-character request assertion, add assertions in the same style that:

- a run with `instructions:'x'.repeat(6000)+'\n\n'+'Give a detailed, thorough answer.'` is **accepted** (resolves, using the file's `fake` fetch);
- a run with `instructions:'x'.repeat(6101)` rejects with `/under 6,000/`;
- a run with `instructions:'   '` still rejects with `/incomplete/`.

If the file already asserts something about 6,001-character instructions, update that assertion to the new boundary and say so in your report.

**Verify:** `node tests/verify-agents.cjs` → exit 0.

### 3. Browser: keep follow-ups within 5,000 characters

In `app/agents.js`, replace the whole `const withParent=…;` statement with:

```js
// A follow-up carries the earlier request and result as context. The person's new request is never cut; context shrinks to fit, and is dropped if there is no room for it.
const withParent=(request,p)=>{if(!p)return request;const tail=`\n\nFollow-up: ${request}`;for(const quote of [500,100]){const head=`This follows up on an earlier run.\n\nEarlier request: ${(p.request||'(usual run)').slice(0,quote)}\n\nEarlier result:\n`,room=5000-head.length-tail.length;if(room>=200||room>=p.answer.length)return head+(p.answer.length>room?p.answer.slice(0,room-1)+'…':p.answer)+tail;}return request;};
```

Behaviour: unchanged when everything fits. When the request is long, the quoted earlier request shrinks from 500 to 100 characters. If there is still no room for at least 200 characters of the earlier result, the request is sent on its own.

**Verify:** `node --check app/agents.js` → no output. Then run this check (it pulls the function out of the file and exercises it; the output must be exactly as shown):

```bash
node -e "const s=require('fs').readFileSync('app/agents.js','utf8');const src=s.match(/const withParent=.*?return request;\};/)[0];eval(src+';const p={request:\'r\'.repeat(900),answer:\'a\'.repeat(9000)};const out=[withParent(\'q\',null),withParent(\'q\',p).length<=5000,withParent(\'q\'.repeat(4700),p).length<=5000,withParent(\'q\'.repeat(5000),p)===\'q\'.repeat(5000),withParent(\'q\',{request:\'\',answer:\'short\'}).includes(\'short\')];console.log(out.join(\' \'))')"
```

Expected output: `q true true true true`

If your shell rejects the quoting, put the same JavaScript in a file in your temp directory (not in the repository), run it from the repository root, and delete it afterwards.

### 4. Browser: cap the improve-instructions fallback

Search `app/agents.js` for `Feedback to apply:`. Read the whole statement around it so you understand where the value goes (a textarea, the agent record, or both). Change the fallback so the combined text never exceeds 6,000 characters:

```js
next||`${a.instructions.trim()}\n\nFeedback to apply:\n${list}`.slice(0,6000)
```

Make sure the `.slice(0,6000)` applies only to the fallback template string, as written, and not to `next`.

**Verify:** `node --check app/agents.js` → no output. `npm test` → exit 0.

## Test plan

- Server limits: three new assertions in `tests/verify-agents.cjs` (step 2), following the existing 5,001-character request test.
- `withParent`: the one-off command in step 3. A permanent test arrives with plan 007, which builds a harness for `app/agents.js`.

## Done criteria

- [ ] `npm test` exits 0, including the new assertions.
- [ ] The step 3 command prints `q true true true true`.
- [ ] `grep -c "under 6,000 characters" app/agents.cjs` prints `1`.
- [ ] `grep -c "Math.max(0,room-1)" app/agents.js` prints `0`.
- [ ] `git status --short` lists only the three in-scope files (and `plans/README.md`).
- [ ] This plan's row in `plans/README.md` is updated.

## STOP conditions

- `boundedString` turns out to do more than a type-and-length check and you cannot preserve it with confidence.
- The `Feedback to apply:` value is used in a way where cutting it would lose the person's own typed text (for example it replaces what they typed without showing them). Report what you found.
- An existing test asserts the old "incomplete" message for over-long instructions and you are unsure whether that message is relied on elsewhere. Search `app/` for the string first; if only the test uses it, update the test.

## Maintenance notes

- If another answer-length option is added to `LENGTHS`, its sentence plus two newlines must stay under the 100 characters of headroom in `agents.cjs`.
- Anything else the browser appends to instructions or requests before sending needs the same headroom thinking.
- The alternative considered for follow-ups was lowering the follow-up box's `maxlength`. It was rejected because the context size varies with the earlier request.
