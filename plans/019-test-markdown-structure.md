# 019. Test lists, headings, tables and links in the Agents Markdown renderer

| | |
| --- | --- |
| Priority | P3 |
| Effort | S |
| Risk | LOW |
| Category | tests |
| Depends on | none (edits the same test file as 023; run them one after the other) |
| Written against | `25910a5` on 2026-11-20 |

## Why

`md()` in `app/agents.js` turns an agent's Markdown result into HTML. The existing test covers escaping, bold, inline code and code blocks only. Numbered lists, bulleted lists, headings, tables and links have no test, so a change to `md()` could break how every result reads and `npm test` would still pass. This plan adds seven assertions. It changes no application code.

An earlier note in `plans/README.md` said `md()` does not render numbered lists. That note was wrong: it does (`app/agents.js:96` and `:98`). The first new assertion pins that.

## What is there now

`tests/verify-agents-client.cjs`, lines 58 to 62. `md` is already defined above these lines as the renderer taken from the test seam.

```js
  assert.ok(!md('[x](https://example.com/a"onmouseover="b)').includes('"onmouseover='),'a quote in a link broke out of the href attribute');
  const styled=md('**bold** and `code`');
  assert.ok(styled.includes('<strong>bold</strong>')&&styled.includes('<code>code</code>'),'bold and inline code no longer render');
  const fenced=md('```\n<script>alert(1)</script>\n```');
  assert.ok(fenced.includes('<pre><code>&lt;script&gt;')&&!fenced.includes('<script'),'a script tag inside a code block would run instead of showing');
```

The code under test is `md()` at `app/agents.js:84` to `:104`. Do not edit it.

The file uses two spaces of indentation inside its main function, no spaces around operators, and one assertion per line with a message that says what broke. Match that style.

## Steps

### 1. Add the assertions

In `tests/verify-agents-client.cjs`, directly after the line that starts with `  assert.ok(fenced.includes('<pre><code>&lt;script&gt;')` (line 62), insert these eight lines exactly:

```js
  // Markdown structure: lists, headings, tables and bare links are how a result stays readable.
  assert.equal(md('1. one\n2. two'),'<ol><li>one</li><li>two</li></ol>','a numbered list no longer renders as an ordered list');
  assert.equal(md('- a\n* b'),'<ul><li>a</li><li>b</li></ul>','a bulleted list no longer renders as an unordered list');
  assert.equal(md('Intro\n1) one\n- a'),'<p>Intro</p><ol><li>one</li></ol><ul><li>a</li></ul>','a paragraph, a numbered list and a bulleted list in a row ran together');
  assert.equal(md('# Title\n## Part'),'<h3>Title</h3><h4>Part</h4>','headings in a result must start at h3, under the page headings');
  assert.equal(md('| A | B |\n|---|---|\n| 1 | 2 |'),'<div class="ag-table"><table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table></div>','a table with a header row no longer renders');
  assert.equal(md('See https://example.com/a.'),'<p>See <a href="https://example.com/a" target="_blank" rel="noopener noreferrer">https://example.com/a</a>.</p>','the full stop after a bare link became part of the link');
  assert.equal(md('[docs](https://example.com/a)'),'<p><a href="https://example.com/a" target="_blank" rel="noopener noreferrer">docs</a></p>','a named link no longer renders');
```

The `\n` inside each string is the two characters backslash and `n`, as written. Do not replace it with a real line break.

**Verify:** `node tests/verify-agents-client.cjs` → exits 0 and prints a line starting with `PASS agents client:`.

### 2. Prove the new assertions can fail

In the file you just edited, change `'<ol><li>one</li><li>two</li></ol>'` to `'<ul><li>one</li><li>two</li></ul>'`.

**Verify:** `node tests/verify-agents-client.cjs` → exits with a non-zero code and the output contains `a numbered list no longer renders as an ordered list`.

Change it back to `'<ol><li>one</li><li>two</li></ol>'`.

**Verify:** `node tests/verify-agents-client.cjs` → exits 0.

### 3. Run the full suite

**Verify:** `npm test` → exits 0 and the last line is `All test files and syntax checks passed.`

## Done criteria

- [ ] `grep -c "Markdown structure:" tests/verify-agents-client.cjs` prints `1`.
- [ ] `git diff --numstat` shows exactly one file, `tests/verify-agents-client.cjs`, with 8 insertions and 0 deletions.
- [ ] `npm test` exits 0.
- [ ] One commit on branch `advisor/019-test-markdown-structure`, with a message such as `Test lists, headings, tables and links in the Agents Markdown renderer`. Do not push or open a PR unless you were told to.

## Out of scope

- `app/agents.js`. If an assertion fails in step 1, the renderer has changed since this plan was written. Do not change `md()` to make the test pass, and do not change the expected string to match.
- The pass line at the end of the test file. It already names "Markdown escaping"; leave it.

## If something is off

If line 62 no longer matches the excerpt, or any new assertion fails in step 1 with the text copied exactly, stop and report instead of adapting the plan. Include the actual HTML that `md()` returned.
