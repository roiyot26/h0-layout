# M0 hiring-rules gate record

```
Milestone: M0 Repo, pipeline, guards
Gate: hiring-rules reviewer          Result: PASS (with notes; no fixes required)
Date: 2026-10-19 (Asia/Jerusalem)   SHA: 6b53ca6 (6b53ca61ad6bfc357a0c8007fa02b617a094447e)
Preview: https://roiyot26.github.io/h0-layout-preview/pr-2/     Screenshots: docs/gates/M0/shots/
Findings: numbered, each with severity and the exact check that failed
Fixes required before the next gate: none (PASS)
```

- **What's gated:** PR #2 (branch `board-type`) at head 6b53ca6, on base main 2c30eda. It follows the design gate (PASS at 6b53ca6) and the QA gate (PASS at 6b53ca6).
- **Scope:** the hiring rules that the plan's "Hiring rules → plan" table and the M0 block put in M0: Rule 14 (CI guards), Rule 15 (budget enforced in CI), Rule 16 (no internals or codenames in history), Rule 17 (no secrets, identity slips or outside material) and the M0 part of Rule 18 (accessibility of the placeholder). Rules 1–5, 11 and 13 are ticked at M1, Rules 6–9 don't apply (the site has no chatbot), and Rules 10 and 12 are known gaps recorded for the owner at M7. Those are marked N/A-by-plan, not failed.
- **Preview serves this SHA:** `pr-2/build.txt` reads 6b53ca61ad6bfc357a0c8007fa02b617a094447e. The page was last modified at 14:52 (Asia/Jerusalem). A local build of 6b53ca6 with the preview base and `NOINDEX=1` is byte-identical to the served `index.html`, JS, CSS and both fonts (`cmp`).
- **Method:** read-only. A fresh clone at 6b53ca6 with every branch and PR ref fetched, `curl` against the preview, the live site and the preview repo, and CI read through the GitHub API. Nothing was pushed, commented on or merged.

## Per-rule results

| # | Rule | Result | Evidence |
|---|---|---|---|
| 1 | Name, role, "portfolio" in first-paint HTML | N/A-by-plan (M1) | The placeholder carries no name or role yet (`index.html:6` title "H0 layout · Coming soon", `:15` h1 "Coming soon"). See note 2. |
| 2 | Skip-to-facts always visible | N/A-by-plan (M1) | No routes or controls in M0 (0 focusables). |
| 3 | CV and contact one click away | N/A-by-plan (M1) | No contact routes yet. No email, `mailto:`, phone or LinkedIn string anywhere in `dist` or the tree. |
| 4 | All projects at once | N/A-by-plan (M1) | No projects in M0. |
| 5 | Every section real HTML with a URL | N/A-by-plan (M1) | One route. The page is plain DOM text with no canvas. |
| 6–9 | AI label, grounding, speed, API down | N/A (no chatbot, by plan) | No text input or AI endpoint. CSP and the API path don't exist yet. |
| 10 | AI claims link to artifacts | N/A-by-plan (M1, gap recorded for M7) | No AI claims on the page. |
| 11 | Years, roles, company switch | N/A-by-plan (M1) | No content file yet. |
| 12 | Cases, credits | N/A-by-plan (M1, gap recorded for M7) | No content yet. |
| 13 | README in 10 s, fresh clone runs, LICENSE | N/A-by-plan (M1), partly met | `README.md:1-13` gives the pitch, the live URL and the stack on the first screen. A fresh clone runs `npm ci`, lint, 11/11 tests and build with no extra steps. There's no LICENSE file yet (note 1). |
| 14 | CI green, checks guard the facts | **PASS** (M0 part) | `.github/workflows/ci.yml:16-114` runs lint, test, build at both bases (the build runs `tsc --noEmit`, `package.json:14`), budget, history, gitleaks and glb on every PR and on main. CI run 39247674838 at 6b53ca6 succeeded (14:51 Asia/Jerusalem), and main's run at 2c30eda succeeded. The link check and the facts-route tests come with M1. |
| 15 | Perf budget measured and enforced | **PASS** (M0 part) | `scripts/budget.mjs:15-16,49-58`. The first screen is 33.1 KB gzip against 200 KB, and the whole `dist` is 43.8 KB raw against 6 MB. Enforcement was proved locally: a seeded 300 KB script gave `OVER`, exit 1; a seeded 6.1 MB file gave `OVER`, exit 1. The phone cap of 3 MB arrives with the asset tiers (`budget.mjs:8`), and no 3D ships in M0. |
| 16 | No internals on screen or in history | **PASS** | `history-check --all`: `clean (full history, 20 commit(s), 56 file version(s))`. The lockfile scan is clean. A whole-word grep of the tree, every patch, message, identity, ref and path for team codenames, the hiring-role word, scene-node prefixes (`CLICK_`, `LGT_`, `STOP_`), `.blend`, vertex counts and the old room's name returns 0 real hits. The only matches are `User-agent` in robots.txt and the npm packages `cli-cursor` and `restore-cursor`. The test GLB names are all `cube`. The preview repo's history is clean too (8 commits). |
| 17 | No secrets, identity slips, outside material | **PASS** | gitleaks 8.30.1 over full history: 19 commits, `no leaks found`. No key patterns in the tree. All 20 commits are `Roi Yotvat <95028994+roiyot26@users.noreply.github.com>` as author and committer, with no co-author or sign-off trailers. The preview repo's 8 commits use the same identity (`preview.yml:21-24`). The deploy key is a repository secret (`preview.yml:48`) and isn't in the repo. No third-party names, data or brand assets. No phone pattern. The fonts are OFL 1.1 and credited (`public/fonts/OFL-*.txt`, `README.md:15-19`). |
| 18 | Accessible, reduced motion, fallback | **PASS** (M0 part) | `index.html:2` `lang="en"`. There's one `h1` (`:15`, visually hidden). The table has a `caption` and `th scope="col"` (`:17-19`). There are no images, so no alt text is needed, and no focusables, so focus doesn't apply. There are no animations, so reduced motion has nothing to stop. three.js isn't in the bundle, so no WebGL fallback is needed yet. axe finds 0 violations (QA). The manual contrast check is below. |

**noindex:** the preview `index.html:4` has `<meta name="robots" content="noindex, nofollow" />`, and CI asserts it (`preview.yml:42`). The preview root and `pr-1/` also carry it. Production (`/h0-layout/`) correctly has none.

**Weight (measured with curl from the preview):**

| File | Raw | gzip -9 | On the wire |
|---|---|---|---|
| `index.html` | 1,394 B | 668 B | 657 B |
| `assets/index-89VfCM64.js` | 871 B | 515 B | 497 B |
| `assets/index-BePazGy_.css` | 1,912 B | 915 B | 896 B |
| `fonts/plex-mono-500-sub.woff2` | 12,604 B | 12,651 B | 12,604 B |
| `fonts/barlow-sc-600-sub.woff2` | 19,200 B | 19,247 B | 19,200 B |
| **First paint** | **35,981 B (35.1 KB)** | **33,996 B (33.2 KB)** | **33,854 B** |

That's 17% of the 200 KB first-paint cap. The phone (3 MB) and desktop (6 MB) world budgets don't apply yet, since no 3D ships. The whole build is 43.8 KB raw.

**Manual contrast check** (WCAG 2.x, from the token values in `src/style.css:4-8,47`). There are no links in M0.

| Pair | Ratio | Need |
|---|---|---|
| Cell text #F2EEE4 on flap #23262A | 13.11 | 4.5 |
| COMING SOON #E3B341 on flap #23262A | 7.81 | 4.5 |
| Column heads and note #B9B2A3 on body #16181A | 8.44 | 4.5 |
| Caption #E3B341 on body #16181A | 9.15 | 4.5 |
| Cell text on hinge row #0E0F10 | 16.56 | 4.5 |
| COMING SOON on hinge row #0E0F10 | 9.86 | 4.5 |

Every pair passes AA, and every pair also clears AAA (7:1). The hinge row is darker than the flap, so the layered background axe couldn't resolve only raises contrast.

## Findings

No blockers. Every M0-scope rule passes.

1. **Low (carried over from QA, unchanged): the preview's robots.txt has no effect.**
   - **Check:** `curl` of `/h0-layout-preview/robots.txt` returns 200, but the host root `https://roiyot26.github.io/robots.txt` returns 404, and crawlers only read the root.
   - The noindex meta covers every preview page and is asserted in CI, so there's no hiring-rule reason to raise this.
2. **Low (carried over from QA, unchanged): axe returns `color-contrast` as "incomplete".**
   - **Check:** the manual ratios above. They're 7.81:1 at the lowest, so this is informational only.
3. **Low (carried over from QA, unchanged): `npm audit` reports 8 dev-tooling advisories** (2 critical, 4 high, 2 moderate, through vitest/tinypool, vite/esbuild and the glTF CLI's micromatch/braces).
   - **Check:** `npm audit --omit=dev` finds 0 vulnerabilities, so nothing ships.
   - **Hiring angle (Rule 13, M1):** a technical reviewer's fresh `npm ci` prints "8 vulnerabilities (2 critical)". Bump the pinned versions before the M1 gate, as QA already advised.

## Notes for M1 (not M0 findings)

1. **LICENSE (Rule 13).** There's no LICENSE file. `package.json:7` says `"UNLICENSED"`, and GitHub reports no licence. M1's Rule 13 tick needs a LICENSE file. Which licence (including "all rights reserved") is the owner's call.
2. **Anonymous placeholder (Rule 1).** The live `/h0-layout/` page is indexable and doesn't name the owner. That's fine while nothing links to it. Don't link or pin it from any profile until M1 is on main.
3. **Rule 14 at M1.** CI still needs lychee, the facts-route tests (name, role, "portfolio", CV and contact at 1440 and 390 with JS off) and axe on every route.
4. **Rule 15 at M1–M3.** `budget.mjs` still needs the per-route caps and the per-tier lists from `assets.json`, including the 3 MB phone cap.
5. **Contact at M1.** The M1 check uses the plan's recorded ruling: email obfuscated as in §8, no phone, LinkedIn `https://www.linkedin.com/in/roi-yotvat-874ba9209/` exact, and GitHub `roiyot26`.
