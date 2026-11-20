# 018. Move the unused source artwork out of the served folder

| | |
| --- | --- |
| Priority | P3 |
| Effort | S |
| Risk | LOW |
| Category | tech debt |
| Depends on | none |
| Written against | `25910a5` on 2026-11-20 |

## Why

`app/assets` holds three PNG files, about 2.4 MB together, that no page, stylesheet, script or test uses. They are source artwork that the vector logo was traced from. Because they sit in `app/assets`, the server answers requests for them (`app/server.cjs:59` serves any `assets/*.png`) and both `vercel.json` files bundle them into every deployment (`assets/**`). Moving them to `docs/` keeps the artwork in the repository and takes it out of the served and deployed app.

## What is there now

The three tracked files:

| File | Size in bytes |
| --- | --- |
| `app/assets/nous-editorial.png` | 980906 |
| `app/assets/nous-logo-transparent.png` | 421086 |
| `app/assets/nous-logo.png` | 997652 |

`app/assets` also holds `fonts/`, `nous-logo.svg`, `nous-symbol.svg` and `workspace-texture.webp`. Those are used. Do not touch them.

The folder `docs/source-artwork/` does not exist yet. `docs/` holds `Agents-user-test-script.md`, `FIGMA-ADAPTATION.md` and `Nous-UX-review.md`.

The only mention of the PNG files outside `plans/` is in `docs/FIGMA-ADAPTATION.md`, lines 18 to 23:

```markdown
## Bundled assets

- `../app/assets/workspace-texture.png`: exact embedded image `a6ff41334869ab2b7073680a2d8006d53b80c4a6`, used by the kit's Home and assistant panel.
- `../app/assets/nous-logo.png`: user-supplied artwork, retained unchanged as the source reference.
- `../app/assets/nous-logo.svg` and `nous-symbol.svg`: smooth vector outlines traced from the original supplied artwork. These are used throughout the interface and contain no embedded bitmap or background. The previous transparent PNG is retained as an unused intermediate asset.
- `../app/assets/fonts/`: Inter and Plus Jakarta Sans variable fonts, Latin subset, with SIL Open Font licences.
```

Line 20 is already out of date: the texture file is `workspace-texture.webp` (used at `app/kit-theme.css:7` and `:33`). This plan corrects that file name in passing.

`docs/FIGMA-ADAPTATION.md` has Windows line endings (CRLF) in a Windows working tree. Keep whatever line ending the file already has. Do not convert it.

## Steps

### 1. Confirm nothing uses the files

**Verify:** `git grep -n -e "nous-editorial" -e "nous-logo-transparent" -e "nous-logo\.png" -- app tests` → no output, exit code 1.

If this prints any line, stop and report. Do not move the files.

### 2. Move the three files

Run these three commands from the repository root. `git mv` creates the folder.

```
git mv app/assets/nous-editorial.png docs/source-artwork/nous-editorial.png
git mv app/assets/nous-logo-transparent.png docs/source-artwork/nous-logo-transparent.png
git mv app/assets/nous-logo.png docs/source-artwork/nous-logo.png
```

If `git mv` reports that the destination folder does not exist, create `docs/source-artwork` first and run the commands again.

**Verify:** `git status --short` → exactly three lines, each starting with `R ` (a rename), and no other line.

### 3. Update the asset list in `docs/FIGMA-ADAPTATION.md`

Replace lines 20, 21 and 22 (the three bullets that start with `workspace-texture.png`, `nous-logo.png` and `nous-logo.svg`) with these four bullets. Leave the heading on line 18 and the fonts bullet unchanged.

```markdown
- `../app/assets/workspace-texture.webp`: the kit's embedded image `a6ff41334869ab2b7073680a2d8006d53b80c4a6`, stored as WebP, used by the kit's Home and assistant panel.
- `source-artwork/nous-logo.png`: user-supplied artwork, retained unchanged as the source reference. It is kept outside `app/` so that it is not served or deployed.
- `../app/assets/nous-logo.svg` and `nous-symbol.svg`: smooth vector outlines traced from the original supplied artwork. These are used throughout the interface and contain no embedded bitmap or background. The previous transparent PNG is retained as an unused intermediate asset at `source-artwork/nous-logo-transparent.png`.
- `source-artwork/nous-editorial.png`: artwork the interface does not use, retained for reference.
```

**Verify:** `grep -c "source-artwork/" docs/FIGMA-ADAPTATION.md` → prints `3`.

**Verify:** `grep -c "app/assets/nous-logo.png\|workspace-texture.png" docs/FIGMA-ADAPTATION.md` → prints `0`.

### 4. Run the tests

**Verify:** `npm test` → exits 0 and the last line is `All test files and syntax checks passed.`

## Done criteria

- [ ] `git ls-files app/assets` lists no `.png` file.
- [ ] `git ls-files docs/source-artwork` lists exactly `nous-editorial.png`, `nous-logo-transparent.png` and `nous-logo.png`.
- [ ] `git diff --cached --stat -M HEAD` (after staging everything) shows three renames with no content change, and `docs/FIGMA-ADAPTATION.md` with 4 insertions and 3 deletions.
- [ ] `npm test` exits 0.
- [ ] One commit on branch `advisor/018-move-unused-source-artwork`, with a message such as `Move unused source artwork out of app/assets`. Do not push or open a PR unless you were told to.

## Out of scope

- Deleting, compressing or converting the PNG files. They are kept unchanged.
- `app/server.cjs`, both `vercel.json` files, and every other file in `app/assets`.
- Any other correction to `docs/FIGMA-ADAPTATION.md`.

## If something is off

If step 1 finds a reference, or the three bullets in `docs/FIGMA-ADAPTATION.md` no longer match the excerpt, stop and report instead of adapting the plan.

## Maintenance notes

After this change a request for `/assets/nous-logo.png` answers 404, locally and on the hosted site. Nothing in the app asks for it. New source artwork belongs in `docs/source-artwork/`, not in `app/assets`.
