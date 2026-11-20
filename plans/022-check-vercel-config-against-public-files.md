# 022. Check both Vercel configs against the server's list of public files

| | |
| --- | --- |
| Priority | P3 |
| Effort | S |
| Risk | LOW |
| Category | tests |
| Depends on | none (edits the same test file as 024; run them one after the other) |
| Written against | `25910a5` on 2026-11-20 |

## Why

The server keeps a list of the files it may serve (`publicFiles` in `app/server.cjs:16`). The hosted site only has the files that `vercel.json` bundles through `includeFiles`. The two lists are kept in step by hand. If someone adds a public file in a folder or with an extension the globs do not cover, the app works locally and the deployed app answers 404 for that file. Nothing tests this today: the existing test only checks three fields of each config. This plan adds a check that every public file exists and is covered by both configs. It changes no application code and no config.

## What is there now

`app/server.cjs:16`, the list the test will read. Read it; do not edit it.

```js
const publicFiles=new Set(['index.html','app.js','ask.js','connections.js','map-fullscreen.js','style.css','kit-theme.css','dropdowns.css','map-fullscreen.css','ask.css','connections.css','thinking-orbs.js','audio-tools.js','dictation.js','ux-refinements.css','dark-theme.css','theme.js','agents.js','agents.css','vendor/thinking-orbs/engine.es.js']);
```

`vercel.json` in the repository root. Read it; do not edit it.

```json
{
  "version": 2,
  "builds": [{ "src": "app/vercel-entry.mjs", "use": "@vercel/node", "config": { "helpers": false, "includeFiles": ["app/*.html", "app/*.js", "app/*.css", "app/assets/**", "app/vendor/**"], "excludeFiles": ["**/.env*"] } }],
  "routes": [{ "src": "/(.*)", "dest": "/app/vercel-entry.mjs" }]
}
```

The exact spacing of that file may differ; only the values matter. `app/vercel.json` holds the same values without the `app/` prefix (`"*.html"`, `"*.js"`, `"*.css"`, `"assets/**"`, `"vendor/**"`, and `src` `"vercel-entry.mjs"`).

`tests/verify-hosting.cjs`, lines 27 to 32. This is the block the plan extends. `fs`, `path` and `assert` are already imported at the top of the file.

```js
  for(const root of ['..','../app']){
    const config=JSON.parse(fs.readFileSync(path.join(__dirname,root,'vercel.json'),'utf8'));
    assert.equal(config.builds[0].src.endsWith('vercel-entry.mjs'),true);
    assert.equal(config.builds[0].config.helpers,false);
    assert.equal(config.routes[0].dest.endsWith('vercel-entry.mjs'),true);
  }
```

The file uses two spaces of indentation at this level, no spaces around operators, and assertion messages that say what broke. Match that style. Keep whatever line ending the file already has.

## Steps

### 1. Add four lines before the loop

In `tests/verify-hosting.cjs`, directly before the line `  for(const root of ['..','../app']){` (line 27), insert these four lines exactly:

```js
  // The server's list of public files, read from its source: every one must exist and be bundled by both Vercel configs.
  const publicFiles=JSON.parse(fs.readFileSync(path.join(__dirname,'../app/server.cjs'),'utf8').match(/const publicFiles=new Set\((\[[^\]]+\])\)/)[1].replace(/'/g,'"'));
  assert.ok(publicFiles.length>=10&&publicFiles.includes('index.html'),'The public file list in app/server.cjs could not be read');
  for(const file of publicFiles)assert.ok(fs.existsSync(path.join(__dirname,'../app',file)),`app/server.cjs serves ${file}, but the file does not exist`);
```

The second line reads the list out of the server's source text. It does not `require` the server, because loading it would start nothing useful here and the list is not exported.

### 2. Add seven lines inside the loop

In the same loop, directly after the line `    assert.equal(config.routes[0].dest.endsWith('vercel-entry.mjs'),true);` and before the closing `  }`, insert these seven lines exactly:

```js
    const prefix=root==='..'?'app/':'',{includeFiles,excludeFiles}=config.builds[0].config;
    // A glob ending in /** covers a whole folder; in any other glob a * stays inside one folder.
    const bundled=file=>includeFiles.some(glob=>glob.endsWith('/**')?(prefix+file).startsWith(glob.slice(0,-2)):new RegExp('^'+glob.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'[^/]*')+'$').test(prefix+file));
    for(const file of [...publicFiles,'assets/nous-logo.svg','assets/fonts/inter.woff2'])assert.ok(bundled(file),`${root}/vercel.json does not bundle ${file}, so the deployed app would answer 404 for it`);
    assert.ok(!bundled('server.cjs')&&!bundled('.env.local'),`${root}/vercel.json bundles a private file as a static file`);
    assert.ok(excludeFiles.includes('**/.env*'),`${root}/vercel.json must keep .env files out of the deployment`);
    assert.equal(config.routes.length,1,`${root}/vercel.json must send every request through one route`);assert.equal(config.routes[0].src,'/(.*)');
```

Copy the third line character for character. It contains backslashes inside a regular expression; do not add or remove any.

`'assets/fonts/inter.woff2'` is only a path used to test the glob for nested folders. The test does not open it, so it does not matter whether a file with that exact name exists.

After both insertions the block reads:

```js
  // The server's list of public files, read from its source: every one must exist and be bundled by both Vercel configs.
  const publicFiles=JSON.parse(fs.readFileSync(path.join(__dirname,'../app/server.cjs'),'utf8').match(/const publicFiles=new Set\((\[[^\]]+\])\)/)[1].replace(/'/g,'"'));
  assert.ok(publicFiles.length>=10&&publicFiles.includes('index.html'),'The public file list in app/server.cjs could not be read');
  for(const file of publicFiles)assert.ok(fs.existsSync(path.join(__dirname,'../app',file)),`app/server.cjs serves ${file}, but the file does not exist`);
  for(const root of ['..','../app']){
    const config=JSON.parse(fs.readFileSync(path.join(__dirname,root,'vercel.json'),'utf8'));
    assert.equal(config.builds[0].src.endsWith('vercel-entry.mjs'),true);
    assert.equal(config.builds[0].config.helpers,false);
    assert.equal(config.routes[0].dest.endsWith('vercel-entry.mjs'),true);
    const prefix=root==='..'?'app/':'',{includeFiles,excludeFiles}=config.builds[0].config;
    // A glob ending in /** covers a whole folder; in any other glob a * stays inside one folder.
    const bundled=file=>includeFiles.some(glob=>glob.endsWith('/**')?(prefix+file).startsWith(glob.slice(0,-2)):new RegExp('^'+glob.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'[^/]*')+'$').test(prefix+file));
    for(const file of [...publicFiles,'assets/nous-logo.svg','assets/fonts/inter.woff2'])assert.ok(bundled(file),`${root}/vercel.json does not bundle ${file}, so the deployed app would answer 404 for it`);
    assert.ok(!bundled('server.cjs')&&!bundled('.env.local'),`${root}/vercel.json bundles a private file as a static file`);
    assert.ok(excludeFiles.includes('**/.env*'),`${root}/vercel.json must keep .env files out of the deployment`);
    assert.equal(config.routes.length,1,`${root}/vercel.json must send every request through one route`);assert.equal(config.routes[0].src,'/(.*)');
  }
```

**Verify:** `node tests/verify-hosting.cjs` → exits 0 and prints two lines, one starting with `Hosting local:` and one starting with `Hosting Vercel:`.

### 3. Prove the check can fail

In the line you added that starts with `    for(const file of [...publicFiles,`, change `'assets/nous-logo.svg'` to `'private/x.svg'`.

**Verify:** `node tests/verify-hosting.cjs` → exits with a non-zero code and the output contains `does not bundle private/x.svg`.

Change it back to `'assets/nous-logo.svg'`.

**Verify:** `node tests/verify-hosting.cjs` → exits 0.

### 4. Run the full suite

**Verify:** `npm test` → exits 0 and the last line is `All test files and syntax checks passed.`

## Done criteria

- [ ] `grep -c "const publicFiles=JSON.parse" tests/verify-hosting.cjs` prints `1`.
- [ ] `grep -c "private/x.svg" tests/verify-hosting.cjs` prints `0`.
- [ ] `git diff --numstat` shows exactly one file, `tests/verify-hosting.cjs`, with 11 insertions and 0 deletions.
- [ ] `npm test` exits 0.
- [ ] One commit on branch `advisor/022-check-vercel-config-against-public-files`, with a message such as `Check both Vercel configs against the server's public file list`. Do not push or open a PR unless you were told to.

## Out of scope

- `app/server.cjs`, `vercel.json` and `app/vercel.json`. If a new assertion fails in step 2 with the text copied exactly, the configs and the server list have drifted apart. That is a real finding. Do not edit a config or the list to make the test pass.
- Exporting `publicFiles` from the server. The test reads the source text on purpose, so the server file stays unchanged.
- Any other part of `tests/verify-hosting.cjs`, including the two lines it prints.

## If something is off

If lines 27 to 32 no longer match the excerpt, if `app/server.cjs` no longer contains `const publicFiles=new Set([`, or if any new assertion fails in step 2, stop and report instead of adapting the plan. Include the assertion message.

## Maintenance notes

The glob check understands two forms: a glob that ends in `/**`, and a glob with `*` inside one folder. Those are the only forms the two configs use. If a config later gets a different form, such as `**/*.js`, extend `bundled` in the same commit. When a public file is added in a new folder, add the folder to `includeFiles` in both configs; this test then says so if one is forgotten.
