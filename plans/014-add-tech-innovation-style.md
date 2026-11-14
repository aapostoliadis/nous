# Plan 014: Add a "Tech Innovation" style and make it the default (dark gray, electric blue, cyan, DejaVu Sans)

> **Executor instructions.** Follow the steps in order. Run every verification command and compare with the expected result before moving on. If a STOP condition applies, stop and report instead of improvising. When finished, update this plan's row in `plans/README.md` (unless a reviewer maintains the index for you).
>
> **Drift check (run first):** `git diff --stat 3d2690e..HEAD -- app/theme.js app/dark-theme.css app/index.html app/kit-theme.css app/assets/fonts package.json tests/`
> Expected: no output. If `app/theme.js`, `app/dark-theme.css` or the `#theme-menu` markup in `app/index.html` changed, compare with the excerpts below; if they differ, STOP and report.
>
> **Download gate.** Step 1 downloads three files from the internet. Do not run step 1 unless the person who dispatched you states that the maintainer approved the download. Without that, STOP before step 1.

## Status

| Field | Value |
| --- | --- |
| Priority | P3 |
| Effort | M |
| Risk | LOW |
| Depends on | none |
| Category | design |
| Planned at | commit `95dd4e8`, 2026-11-14; revised against `3d2690e` (plans 001, 002, 005, 006, 010, 011, 013 merged) on 2026-11-14 to make the style the default |

## Why this matters

The maintainer chose the "Tech Innovation" theme for Nous: Electric Blue `#0066ff`, Neon Cyan `#00ffff`, Dark Gray `#1e1e1e`, White `#ffffff`, with DejaVu Sans Bold for headings and DejaVu Sans for body text. Nous already has a style switcher with two styles (Light, Warm ink). This plan adds Tech Innovation as a third selectable style on the same machinery and, by the maintainer's decision on 2026-11-14, makes it the default: a visitor with no saved choice gets Tech Innovation, and "System" resolves to Tech Innovation when the system is dark. Light and Warm ink stay selectable with their values untouched, and a saved choice of Light or Warm ink is still honoured.

The four theme colours cannot be used naively. Computed WCAG contrast ratios:

| Pair | Ratio | Consequence |
| --- | --- | --- |
| `#0066ff` on `#1e1e1e` | 3.45 | Too low for text (needs 4.5). Fine as a filled button. |
| `#00ffff` on `#1e1e1e` | 13.30 | Cyan is the accent for text, links, focus and ticks. |
| `#ffffff` on `#0066ff` | 4.83 | White labels on blue buttons pass. |
| `#ffffff` on `#00ffff` | 1.25 | Never put white on cyan. |

So: cyan is `--accent` (text-like accent), blue is `--solid` (filled controls, white label), `#1e1e1e` is `--bg`, white is `--ink`.

## Current state

**How styles work.** `app/theme.js` (61 lines) sets `data-theme` on `<html>`, and `data-mode="dark"` for any style that is not `light`. `app/dark-theme.css` (150 lines) has a shared `:root[data-mode=dark]` block and one surface block per dark style. Every other stylesheet reads tokens as `var(--token,<light fallback>)`. A new dark style therefore needs one token block, one entry in `THEMES` and one menu button.

`app/theme.js`, the lines to change:

```js
// Styles: Light and Warm ink. Loaded in <head> so the style is set before
```

```js
  const THEMES={light:'Light',warm:'Warm ink'},DARK='warm';
```

The other lines that decide the default (`app/theme.js` lines 1–3 and 7–11):

```js
// Styles: Light and Warm ink. Loaded in <head> so the style is set before
// first paint. The choice in the menu is saved per device; without one the
// style is Light. Picking System follows the system setting live.
```

```js
  // 'dark' was saved by the first dark mode; Graphite and Forest were removed.
  // Each now opens in Warm ink.
  const LEGACY_DARK=['dark','graphite','forest'];
  const choice=()=>{try{const v=localStorage.getItem(KEY);return LEGACY_DARK.includes(v)?DARK:v==='system'||v in THEMES?v:'light'}catch{return 'light'}};
  const fromSystem=()=>system.matches?DARK:'light';
```

`choice()` accepts any stored value that is `in THEMES`. Nothing else in the repository holds the default: `app/index.html` has no static `data-theme`, and no test or document names the default style. The click handler reads `o.querySelector('.theme-swatch')`, so every option must contain a `.theme-swatch`.

`app/dark-theme.css` lines 16–21, the only existing per-style block:

```css
:root[data-theme=warm]{
  --bg:#161512;--surface:#1d1c18;--raised:#25231e;--raised-2:#2e2b25;--line:#34312a;--line-strong:#454037;
  --ink:#ece8df;--muted:#aaa497;--subtle:#857f73;
  --accent:#9cc4a4;--accent-strong:#bcdcc2;--accent-bg:#232a22;--accent-line:#3c4a3d;
  --solid:#ece8df;--on-solid:#161512;--solid-hover:#9cc4a4;
  --gray-bg:#2e2b25;--blue-bg:#1f2630;--dash:#6e6250}
```

The header comment (lines 1–9) says `data-theme (light or warm)`.

`app/index.html` line 5 holds the menu. The last option is:

```html
<button type="button" data-theme-option="warm" aria-pressed="false"><span class="theme-swatch" style="--sw-bg:#161512;--sw-accent:#9cc4a4" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3h.4a7.5 7.5 0 0 0 7.9 12.4A9 9 0 1 1 12 3z"/></svg></span>Warm ink</button></div></div>
```

The same file loads `dark-theme.css?v=tokens-4` and `theme.js?v=5`.

**The Agents Settings picker needs no edit.** `app/agents.js:212` clones the menu: `[...document.querySelectorAll('#theme-menu [data-theme-option]')].map(o=>o.outerHTML)`.

**Fonts.** `app/kit-theme.css:3-4` declares Inter and Plus Jakarta Sans with `src:url('assets/fonts/…woff2') format('woff2')` and `font-display:swap`. `kit-theme.css:5` sets `--sans` and `--serif` to `Inter,Arial,sans-serif`. Headings use `font-family:var(--serif)` at weight 400 (`app/style.css:1`, rules `h1` and `.node h3`). Two rules name a font directly: `kit-theme.css:53` (`.suggestions>span{font-family:'Plus Jakarta Sans',var(--sans)…}`) and `connections.css:2` (`.provider-controls select{font:600 12px Inter,sans-serif…}`). `app/agents.css:8` derives `--ag-serif` from `--sans`.

`app/assets/fonts/` holds `inter-latin-wght-normal.woff2`, `plus-jakarta-sans-latin-wght-normal.woff2`, `Inter-LICENSE.txt`, `Plus-Jakarta-Sans-LICENSE.txt`.

**Server.** `app/server.cjs:55` serves any `assets/….woff2`. No server change is needed.

**Rules that would break under the new tokens:**

- `app/ux-refinements.css:173` `.map-mode button[aria-pressed=true]{background:var(--accent,#295b44);color:#fff}` with `app/dark-theme.css:63` setting its colour to `var(--on-solid)`. With cyan as accent that is white on cyan (1.25:1).
- `app/dark-theme.css:80` `…#dictation-elapsed{border-color:#6b2f2b}` and `:102` `.evidence-card.contradiction{border-top-color:#8a7140}` are warm-tinted literals. They are status borders (recording, contradiction) and stay as they are.

**Tests.** `npm test` runs `node tests/run.cjs`, which runs every `tests/verify-*.cjs` file and then syntax-checks the app. A new `tests/verify-theme.cjs` is picked up without editing `package.json`.

`tests/verify-hosting.cjs:50-52` collects every `url(...)` in the served CSS and requires a 200 for each, so a font referenced in CSS but missing on disk fails the suite.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Syntax check | `node --check app/theme.js` | no output |
| New test | `node tests/verify-theme.cjs` | `PASS theme: …`, exit 0 |
| Hosting test | `node tests/verify-hosting.cjs` | `Hosting … passed.` lines, exit 0 |
| Full suite | `npm test` | exit 0 |

## Scope

**In scope**

- `app/assets/fonts/`: three new files (step 1).
- `app/dark-theme.css`: header comment, two `@font-face` rules, one token block, a few `[data-theme=tech]` overrides.
- `app/theme.js`: the header comment, the `THEMES`/`DARK` line, the legacy comment, and the two `'light'` fallbacks in `choice()`.
- `app/index.html`: one new menu button; two version strings.
- `tests/verify-theme.cjs` (new).

**Out of scope**

- `fromSystem()`: a light system still resolves to Light under "System".
- `package.json`.
- Preloading the fonts in `app/index.html`. A preload would make Light and Warm ink visitors download them too.
- The Warm ink and Light token values.
- `app/server.cjs`, `app/agents.js`, `app/kit-theme.css`, `app/style.css`, `app/connections.css`, `app/ux-refinements.css`. All overrides go in `app/dark-theme.css`, scoped to `[data-theme=tech]`.
- The status colours in the shared `:root[data-mode=dark]` block. They were checked against `#1e1e1e` and `#363636` and all exceed 5.3:1.
- Removing Inter or Plus Jakarta Sans.

## Git workflow

- Branch: `advisor/014-add-tech-innovation-style`
- Commit style: one imperative sentence, as in `Print the full result, not just the summary card (#43)`. Leave the PR number off.
- Do not push or open a PR unless you were told to.

## Steps

### 1. Add the DejaVu Sans font files (needs the download gate above)

Source: npm package `@fontsource/dejavu-sans` version `5.3.0`, served by jsDelivr. Download into `app/assets/fonts/`:

```sh
curl -fL -o app/assets/fonts/dejavu-sans-latin-400-normal.woff2 https://cdn.jsdelivr.net/npm/@fontsource/dejavu-sans@5.3.0/files/dejavu-sans-latin-400-normal.woff2
curl -fL -o app/assets/fonts/dejavu-sans-latin-700-normal.woff2 https://cdn.jsdelivr.net/npm/@fontsource/dejavu-sans@5.3.0/files/dejavu-sans-latin-700-normal.woff2
curl -fL -o app/assets/fonts/DejaVu-Sans-LICENSE.txt https://cdn.jsdelivr.net/npm/@fontsource/dejavu-sans@5.3.0/LICENSE
```

Do not open, execute or transform the font files.

**Verify:**

- `wc -c app/assets/fonts/dejavu-sans-latin-400-normal.woff2` → `253844`
- `wc -c app/assets/fonts/dejavu-sans-latin-700-normal.woff2` → `233424`
- `openssl dgst -sha256 -binary app/assets/fonts/dejavu-sans-latin-400-normal.woff2 | base64` → `w8fKALRTjMEJBqXU2SGqsjabK+54EWjvLKaV86WAV2A=`
- `openssl dgst -sha256 -binary app/assets/fonts/dejavu-sans-latin-700-normal.woff2 | base64` → `d/72ylXdA/ehK8ETGBvamQYt5oHIT9JzVcbewmzZJjw=`
- `head -c 4 app/assets/fonts/dejavu-sans-latin-400-normal.woff2` → `wOF2` (same for the 700 file)
- `grep -c "Bitstream" app/assets/fonts/DejaVu-Sans-LICENSE.txt` → at least `1`

If a size differs, STOP (see STOP conditions).

### 2. Write the failing test

Create `tests/verify-theme.cjs`:

```js
// Checks the Tech Innovation style: its tokens exist, text and controls meet contrast minimums, and the menu, script and fonts are wired up.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=path.join(__dirname,'..','app');
const read=f=>fs.readFileSync(path.join(app,f),'utf8');

const css=read('dark-theme.css');
const block=css.match(/:root\[data-theme=tech\]\{([^}]*)\}/);
assert.ok(block,'dark-theme.css must define :root[data-theme=tech]');
const t={};for(const m of block[1].matchAll(/--([a-z0-9-]+):([^;]+)/g))t[m[1]]=m[2].trim();

// The four theme colours, in their roles.
assert.equal(t.bg,'#1e1e1e');assert.equal(t.ink,'#ffffff');assert.equal(t.accent,'#00ffff');assert.equal(t.solid,'#0066ff');

const lum=h=>{assert.match(h,/^#[0-9a-f]{6}$/,`Expected a 6-digit hex colour, got ${h}`);const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const need=(fg,bg,min)=>{const r=ratio(t[fg],t[bg]);assert.ok(r>=min,`--${fg} on --${bg} is ${r.toFixed(2)}:1, needs ${min}:1`)};

for(const bg of['bg','surface','raised','raised-2']){need('ink',bg,4.5);need('muted',bg,4.5);need('accent',bg,4.5);need('accent-strong',bg,4.5)}
for(const bg of['bg','surface','raised'])need('subtle',bg,4.5);
need('accent-strong','accent-bg',4.5);need('ink','accent-bg',4.5);need('ink','blue-bg',4.5);
need('on-solid','solid',4.5);need('on-solid','solid-hover',4.5);
need('solid','bg',3);need('line-strong','bg',3);

// Fonts: both weights declared, the files exist, and the style uses them.
for(const w of['400','700']){
  const file=`assets/fonts/dejavu-sans-latin-${w}-normal.woff2`;
  assert.ok(css.includes(`url('${file}')`),`dark-theme.css must load ${file}`);
  assert.equal(fs.readFileSync(path.join(app,file)).subarray(0,4).toString('latin1'),'wOF2',`${file} must be a WOFF2 file`);
}
assert.ok(fs.existsSync(path.join(app,'assets/fonts/DejaVu-Sans-LICENSE.txt')),'The DejaVu licence must ship with the font');
assert.match(t.sans,/^'DejaVu Sans',/);assert.match(t.serif,/^'DejaVu Sans',/);

// Wiring.
assert.match(read('theme.js'),/tech:'Tech Innovation'/,'theme.js must list the style');
const html=read('index.html');
const option=html.match(/<button[^>]*data-theme-option="tech"[^>]*>.*?<\/button>/);
assert.ok(option,'index.html must offer the style in #theme-menu');
assert.ok(option[0].includes('class="theme-swatch"'),'The option needs a .theme-swatch; theme.js reads it on click');
assert.ok(option[0].includes('Tech Innovation'));

// Default: run theme.js against stubs and read the style it sets.
const vm=require('node:vm');
const boot=(saved,systemDark=false)=>{
  const root={dataset:{},classList:{add(){},remove(){}}};
  const store=saved instanceof Error?{getItem(){throw saved},setItem(){}}:{getItem:()=>saved,setItem(){}};
  vm.runInNewContext(read('theme.js'),{localStorage:store,matchMedia:q=>({matches:q.includes('dark')&&systemDark,addEventListener(){}}),document:{documentElement:root,getElementById:()=>null,querySelectorAll:()=>[],addEventListener(){}}});
  return root.dataset;
};
assert.deepEqual({...boot(null)},{theme:'tech',mode:'dark'},'No saved choice must open in Tech Innovation');
assert.equal(boot('nonsense').theme,'tech','An unknown saved value must open in Tech Innovation');
assert.equal(boot(new Error('blocked')).theme,'tech','Blocked storage must open in Tech Innovation');
assert.deepEqual({...boot('light')},{theme:'light'},'A saved Light choice must be kept, without data-mode');
assert.equal(boot('warm').theme,'warm','A saved Warm ink choice must be kept');
assert.equal(boot('system',true).theme,'tech','System on a dark system must resolve to Tech Innovation');
assert.equal(boot('system',false).theme,'light','System on a light system must resolve to Light');
for(const old of['dark','graphite','forest'])assert.equal(boot(old).theme,'tech',`The removed style "${old}" must open in Tech Innovation`);

console.log('PASS theme: Tech Innovation tokens, contrast, fonts, menu wiring and default.');
```

**Verify:** `node tests/verify-theme.cjs` → fails with `dark-theme.css must define :root[data-theme=tech]`.

### 3. Add the fonts and tokens to `app/dark-theme.css`

1. In the header comment, change `data-theme (light or warm)` to `data-theme (light, warm or tech)`. Change nothing else in the comment.

2. Directly after the closing `}` of the `:root[data-theme=warm]{…}` block (line 21), insert:

```css
/* Tech Innovation: dark gray, electric blue fills, cyan accent, DejaVu Sans. Blue (#0066ff) is 3.45:1 on the
   background, so it is used for filled controls only; cyan carries accent text. This is the default style. The fonts load only when it is active. */
@font-face{font-family:'DejaVu Sans';font-style:normal;font-weight:400;font-display:swap;src:url('assets/fonts/dejavu-sans-latin-400-normal.woff2') format('woff2')}
@font-face{font-family:'DejaVu Sans';font-style:normal;font-weight:700;font-display:swap;src:url('assets/fonts/dejavu-sans-latin-700-normal.woff2') format('woff2')}
:root[data-theme=tech]{
  --bg:#1e1e1e;--surface:#252525;--raised:#2d2d2d;--raised-2:#363636;--line:#3a3a3a;--line-strong:#6b6b6b;
  --ink:#ffffff;--muted:#b8b8b8;--subtle:#9a9a9a;
  --accent:#00ffff;--accent-strong:#80ffff;--accent-bg:#0a2a3a;--accent-line:#0a5a70;
  --solid:#0066ff;--on-solid:#ffffff;--solid-hover:#0052cc;
  --gray-bg:#363636;--blue-bg:#0f2547;--dash:#5c5c5c;
  --sans:'DejaVu Sans',Verdana,Arial,sans-serif;--serif:'DejaVu Sans',Verdana,Arial,sans-serif}
```

3. At the very end of the file, append:

```css
/* Tech Innovation overrides. */
[data-theme=tech] :is(h1,h2,h3){font-weight:700}
[data-theme=tech] .suggestions>span{font-family:var(--sans)}
[data-theme=tech] .provider-controls select{font-family:var(--sans)}
[data-theme=tech] .map-mode button[aria-pressed=true]{background:var(--solid)}
```

Do not use `!important` unless step 7's check shows a rule is not winning; if you add it, say so in your report with the selector it had to beat.

**Verify:** `grep -c "data-theme=tech" app/dark-theme.css` → `5`. `node tests/verify-hosting.cjs` → passes, and its `CSS fonts and images` count is 2 higher than before this step (run it once before editing to get the baseline).

### 4. Register the style in `app/theme.js` and make it the default

1. Line 1: `// Styles: Light and Warm ink.` → `// Styles: Light, Warm ink and Tech Innovation.` (keep the rest of the line).
2. Line 3: `// style is Light. Picking System` → `// style is Tech Innovation. Picking System` (keep the rest of the line).
3. `const THEMES={light:'Light',warm:'Warm ink'},DARK='warm';` → `const THEMES={light:'Light',warm:'Warm ink',tech:'Tech Innovation'},DARK='tech';`
4. Line 8: `// Each now opens in Warm ink.` → `// Each now opens in Tech Innovation.`
5. In `choice()`, replace both `'light'` fallbacks with `DARK`: `…v in THEMES?v:'light'}catch{return 'light'}};` → `…v in THEMES?v:DARK}catch{return DARK}};`

Do not change `fromSystem()` or the `theme==='light'` test in `apply()`.

**Verify:** `node --check app/theme.js` → no output. `grep -c "tech:'Tech Innovation'" app/theme.js` → `1`. `grep -c "'light'" app/theme.js` → `2` (the lines for `fromSystem` and `apply`).

### 5. Add the menu option and bump the cache versions in `app/index.html`

1. Immediately after the Warm ink button's closing `</button>` (quoted in "Current state"), and before the `</div></div>` that follows it, insert on the same line:

```html
<button type="button" data-theme-option="tech" aria-pressed="false"><span class="theme-swatch" style="--sw-bg:#1e1e1e;--sw-accent:#00ffff" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg></span>Tech Innovation</button>
```

2. `dark-theme.css?v=tokens-4` → `dark-theme.css?v=tokens-5`.
3. `theme.js?v=5` → `theme.js?v=6`.

**Verify:** `grep -c 'data-theme-option="tech"' app/index.html` → `1`. `grep -c "tokens-5\|theme.js?v=6" app/index.html` → at least `1`, and `grep -c "tokens-4\"" app/index.html` shows no remaining `dark-theme.css?v=tokens-4`. `node tests/verify-theme.cjs` → `PASS theme: …`.

### 6. Confirm the suite runs the new test

Do not edit `package.json`. The runner picks up `tests/verify-*.cjs`.

**Verify:** `npm test` → exit 0, output includes `PASS theme:`.

### 7. Check the cascade without a browser

For each override added in step 3.3, confirm no later or more specific rule defeats it:

```sh
grep -n -o "[^{}]*\.map-mode button\[aria-pressed=true\][^{}]*{[^{}]*}" app/*.css
grep -n -o "[^{}]*\.provider-controls select[^{}]*{[^{}]*}" app/*.css
grep -n -o "[^{}]*\.suggestions>span[^{}]*{[^{}]*}" app/*.css
```

`[data-theme=tech] X` has higher specificity than `X` and than `[data-mode=dark] X` only when it comes later in the cascade or has more selectors; `dark-theme.css` loads after every sheet except `agents.css`, and the overrides are at the end of it. Report anything in `agents.css` that sets `background` on `.map-mode` or `font-family` with a literal font name (expected: nothing).

**Verify:** `grep -c "Inter\|Plus Jakarta" app/agents.css` → `0`.

## Test plan

One new file, `tests/verify-theme.cjs` (step 2). It asserts the four theme colours sit in their roles; that ink, muted, accent and accent-strong reach 4.5:1 on all four surface steps; subtle reaches 4.5:1 on the three it is used on; the button label reaches 4.5:1 on both button fills; the button fill and input border reach 3:1 on the page; both font weights are declared, present and real WOFF2; the licence ships; the script and menu list the style; and, by running `app/theme.js` against stubs, that no saved choice, an unknown value, blocked storage and the three removed styles all open in Tech Innovation, that saved Light and Warm ink choices are kept, and that System follows the system. `tests/verify-hosting.cjs` already proves the font files are served.

Not covered by any test, and to be reported as **not verified** unless you can drive a browser: how the style renders. See "Maintenance notes" for the list a reviewer should walk.

## Done criteria

- [ ] `node tests/verify-theme.cjs` failed after step 2 and passes after step 5.
- [ ] `npm test` exits 0.
- [ ] `git status --short` lists only: `app/assets/fonts/` (3 new files), `app/dark-theme.css`, `app/theme.js`, `app/index.html`, `tests/verify-theme.cjs` (and `plans/README.md` if you maintain the index).
- [ ] `git diff 3d2690e -- app/dark-theme.css` shows no changed line inside `:root[data-mode=dark]{…}` or `:root[data-theme=warm]{…}`.
- [ ] `grep -c "DARK='tech'" app/theme.js` prints `1`.
- [ ] This plan's row in `plans/README.md` is updated.

## STOP conditions

- The download gate was not confirmed by the dispatcher.
- A downloaded file's size differs from the figures in step 1, a font file does not start with `wOF2`, or the licence does not mention Bitstream. Delete the three files and report; do not try another source or version.
- `tests/verify-hosting.cjs` fails after step 3 for a reason other than a missing font file (for example it asserts an exact count of CSS assets). Report the assertion; do not change that test.
- A contrast assertion in the new test fails with the token values given here. The values were computed in advance, so a failure means a typo or a parsing problem; fix the typo, but do not change a colour to make it pass.
- The `#theme-menu` markup or the `THEMES` line differs from the excerpts.

## Maintenance notes

- **Browser pass for the reviewer.** Open the app with site data cleared: it must open in Tech Innovation with no flash of Light. Pick Light, reload (still Light), then pick Tech Innovation again from the style menu and from Agents → Settings, and check: headings are bold DejaVu Sans; the primary button is blue with a white label and darkens on hover; the selected map mode is blue, not cyan; links, the tick in the style menu and focus rings are cyan; custom dropdowns and scrollbars use the gray surfaces (they read tokens, so they should); the page-texture overlay and `.nous-artwork` (brightened by a filter in dark mode) still look right on neutral gray; `h1` keeps `letter-spacing:-1.25px`, which may look tight in DejaVu Sans, a wide face. Reload once to confirm the choice persists and there is no flash of the light style.
- **Weights.** DejaVu ships 400 and 700 only. The app uses 500 and 600 in places; by the font-matching rules 500 renders as 400 and 600 as 700. No faux bold is synthesised.
- **Size.** The two files total about 476 KB against 48 KB for Inter. Browsers fetch an `@font-face` file only when text uses it, so visitors on Light or Warm ink do not download them. As the default, every first-time visitor downloads both; with `font-display:swap` text shows in Verdana or Arial until they arrive. A subset limited to the characters Nous uses would cut this further.
- **Latin only.** The files are the `latin` subset. Other scripts fall back to Verdana or Arial.
- **Plan 008** adds a Content-Security-Policy. The new swatch uses an inline `style` attribute like the two existing ones, so it needs whatever `style-src` allowance 008 gives them; `font-src 'self'` covers the new fonts.
- **Existing visitors.** Anyone who never picked a style has nothing saved and moves from Light to Tech Innovation on their next visit. Anyone who picked Light, Warm ink or System keeps it, except that System on a dark system now gives Tech Innovation instead of Warm ink.
