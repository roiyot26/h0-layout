# M0 QA (acceptance) gate record, re-gate

```
Milestone: M0 Repo, pipeline, guards
Gate: QA (acceptance)          Result: PASS
Date: 2026-10-19 (Asia/Jerusalem)   SHA: 6b53ca6 (6b53ca61ad6bfc357a0c8007fa02b617a094447e)
Preview: https://roiyot26.github.io/h0-layout-preview/pr-2/     Screenshots: docs/gates/M0/shots/
Findings: numbered, each with severity and the exact check that failed
Fixes required before the next gate: none (PASS)
```

- **What's gated:** PR #2 (branch `board-type`) at head 6b53ca6, on base main 2c30eda (2c30eda1431686d4eedc920e5dd8c8e2ed7b01c8).
- **What it replaces:** the QA record for 3751cb6, which was a PASS. This head adds 6 commits on top of 3751cb6 with no rewrite, so the earlier history is unchanged.
- **Preview build marker:** `pr-2/build.txt` reads 6b53ca61ad6bfc357a0c8007fa02b617a094447e, and the page was last modified at 14:52 (Asia/Jerusalem).
- **Method:** the same as before. Read-only, on the QA box only: a fresh fetch of every branch and PR ref, a throwaway hook clone (deleted), headless Chromium through Playwright with CDP and @axe-core/playwright, and CI read through the GitHub API. No Blender bake or render was running.

## Checks

1. **CI.** PASS.
   - Run 39247674838 (CI, pull_request, head 6b53ca61ad6bfc357a0c8007fa02b617a094447e) passed all 8 jobs: lint, test (11/11), build (/h0-layout/), build (/), budget, history, gitleaks and glb.
   - Run 39247674829 (PR preview, same head) passed: publish.
   - Job output:
     - history: `clean (full history, 20 commit(s), 56 file version(s))`, and the lockfile scan is clean.
     - gitleaks: 19 commits scanned, `no leaks found`.
     - budget: 33.1 KB gzip against the 200 KB cap.
     - glb-check: `EXT_meshopt_compression, KHR_mesh_quantization, KHR_texture_basisu`.
   - **Local run at 6b53ca6:** I ran `npm ci`, lint, test (11 passed), build, size, budget and history-check locally. All green, with the same numbers.
2. **Diff 3751cb6..6b53ca6** (6 commits, 8 files, +60/−12):
   - `src/style.css`:
     - every flap gets `border-radius:2px`, replacing radius on the outer corners only;
     - at ≤640px, `line-height:21px;padding:9px 8px 11px`;
     - at ≤480px, `body{padding-inline:16px}`.
   - `scripts/banned.sha256.json`: 4 new hashes, 19 entries in all. Three are two-word name terms (stored as the joined words), and one is an ordinary word with `"scope": "metadata"`.
   - `scripts/history-check.mjs`: a `context` parameter (`metadata`, `path` or `content`). Metadata-scoped entries apply only to commit messages, identity fields and ref names. Paths are now scanned under the `path` context.
   - `test/history-check.test.ts`: +2 tests for pairs and scope, which use a neutral stand-in list.
   - `README.md`: documents the scope rule.
   - `docs/gates/M0/shots/`: 1440 and 390 re-shot, plus `390-preview-pr-1.png`.
3. **Layout:** PASS. It ran at 1440×900, 480×854, 390×844 and 360×780, each with JS on, JS off and reduced motion: 12 runs.
   - **No sideways scroll:** `scrollWidth == clientWidth` in every run (1440/480/390/360). `scrollHeight` equals the viewport height, so the page doesn't scroll at all.
   - **Side inset 16px at ≤480:** I measured the outer edges of the first and last flap and the caption against the viewport.
     - At 480, 390 and 360, the left and right insets are both 16px for the flaps and for the caption.
     - At 1440 they're 190px on each side, so the board is centred.
   - **Phone flap height:** every visible flap is exactly 41px tall at 480, 390 and 360 (line-height 21 + padding 9/11). At 1440 they're 53px.
   - **Border radius:** the computed `border-radius` is 2px on every visible flap, in every run.
   - **Nothing clipped or overlapping:**
     - No element lies outside the viewport.
     - No cell, header, caption or note text overflows its box.
     - Neighbouring flaps and headers don't overlap, and the note sits below the board.
     - The only clipped element is the intentionally visually-hidden `h1`.
   - **Errors:** 0 console errors or warnings, 0 page errors and 0 responses ≥400 in all 12 runs.
   - **No-JS and reduced motion:** both render the same as the default.
   - **Hinge (recorded only; placement is the design reviewer's call):** pixel sampling 3px inside the first flap finds exactly one #0E0F10 row in each.
     - At 480, 390 and 360 it's row 20 of the 41px flap (0-based), with 20 rows above and 20 below.
     - At 1440 it's row 26 of 53, with 26 above and 26 below.
4. **Banned list and hook:** PASS.
   - **Setup:**
     - a throwaway clone at 6b53ca6, with its GitHub remote removed and a local bare repo on the box as the only remote;
     - `npm ci`, then `npm run prepare` (core.hooksPath=.githooks);
     - a baseline push of the existing history, which was clean (17 commits).
   - **Seeded commits:** each held a neutral file, with a message containing one new term. Each was rejected with exit 1 and `error: failed to push some refs`, and none reached the bare remote.
     - The pair term for the presentation role and the other two new pair terms: `commit … message: banned term (hash 7fa86c2a1ca9)`, `(hash af4976f2ca0b)` and `(hash 3ac4010a3b47)`.
     - The new metadata-only word: `(hash 9285827b8031)`.
   - **Clean control:** accepted with exit 0, `history-check: clean (push, 1 commit(s) …)` / `[new branch] clean-1`.
   - **Cleanup:** I deleted the clone and the bare repo afterwards, and nothing was pushed to GitHub.
   - **Full history:** `node scripts/history-check.mjs --all` over every branch and PR ref is clean (20 commits, 56 file versions).
   - **Identity:** all 20 commits use the roiyot26 GitHub noreply address as author and committer, and `git interpret-trailers --parse` is empty for every one.
   - **Outside-reviewer grep:** `rg -iw -a` over the tree (binaries included), `git log --all -p` with identities, refs and paths found 0 hits.
5. **Quick re-checks:** PASS.
   - **First screen:** 5 requests (HTML, JS, CSS and two woff2), about 35.1 KB on the wire including headers at every width. That's 33.1 KB gzip of bodies in the budget job, against the 200 KB cap.
   - **Fonts:** every request is to `roiyot26.github.io`. Both `@font-face` rules have `font-display: swap`, both fonts load, and the computed families are IBM Plex Mono and Barlow Semi Condensed.
   - **noindex:** `<meta name="robots" content="noindex, nofollow">` is present in all 12 runs.
   - **axe:** at 1440, 480, 390 and 360, 0 violations. `color-contrast` comes back as incomplete (needs review).
6. **Repo gate shots:** PASS.
   - At 6b53ca6, `docs/gates/M0/shots/1440-placeholder.png` and `390-placeholder.png` are pixel-identical to QA's own captures of the 6b53ca6 preview: 0 differing pixels at 1440×900 and 390×844.
   - Both show the self-hosted Barlow caption, the Plex Mono board, rounded flaps and the 16px phone inset.

## Findings

1. **Low (outside the gate; carried over): the preview's robots.txt has no effect.**
   - **Check:** "robots.txt disallows".
   - `/h0-layout-preview/robots.txt` returns 200 with `Disallow: /`, but crawlers only read the host-root `https://roiyot26.github.io/robots.txt`, which returns 404.
   - The §11 noindex requirement is met by the meta tag on every preview page.
2. **Low (informational; carried over): axe returns `color-contrast` as "incomplete".**
   - **Check:** axe-core at every width.
   - This is because of the flaps' layered hinge background.
   - The design reviewer's computed contrast values pass, and there are no violations.
3. **Low (outside the spec; carried over): `npm audit` reports 8 advisories in dev tooling.**
   - **Check:** the `npm ci` output in CI.
   - There are 2 critical, 4 high and 2 moderate, through vitest/tinypool, vite/esbuild and the glTF CLI's micromatch/braces.
   - Nothing from these ships to the site. Bump the pinned versions before M1.

**Closed since 3751cb6:**
- The banned-list coverage gap (the earlier finding 2) is fixed by the three pair terms and the metadata-only word. The hook test shows all four are enforced.
- The stale repo screenshots (the earlier finding 5) are fixed by 6b53ca6.

**Noted only:** the PR #1 preview (060094b) is unchanged and still needs a rebase onto PR #2's styles if it goes ahead.
