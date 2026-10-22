# H0 layout

A portfolio laid out as a 1:87 (H0) model railway. This is milestone 1: the
HTML-first site. Every page is static HTML that works without JavaScript; the 3D
layout comes later, on top of it.

- Site: https://roiyot26.github.io/h0-layout/
- PR previews: https://roiyot26.github.io/h0-layout-preview/pr-<n>/ (noindex)

## Stack

Vite 6, TypeScript (strict) and vanilla three.js r186. No framework. Assets go
through gltf-transform (meshopt, quantisation, KTX2).

## Content and pages

- `src/site/content.ts` is the one content file. `scripts/routes.mjs` is the one
  route list (13 pages plus `/cv.pdf`), with each page's title, `h1`, the facts the
  checks look for, and its first-screen byte cap.
- `src/site/pages.ts` renders every page from those two files. Vite builds one
  entry (`src/main.ts`, the stylesheet and the email script), and a small plugin in
  `vite.config.ts` writes each page, `404.html` and `sitemap.xml` with the hashed
  asset URLs. The dev server renders the same pages on request.
- The email address is never in the HTML: the page carries its parts reversed, and
  the script rebuilds the address on focus or click.

Build-time flags:

| Variable | Default | What it does |
|---|---|---|
| `SITE_BASE` | `/` | The public path |
| `SHOW_COMPANIES` | on | Employer names on the board, station pages and timetable; `0` swaps in neutral lines (the CV always names them) |
| `SHOW_DOODLE_REPO` | off | The Doodle Reborn repo link; turn it on when that repo is public |
| `NOINDEX` | off | `1` adds a noindex meta (PR previews) |

## Fonts

IBM Plex Mono Medium and Barlow Semi Condensed SemiBold and Medium, self-hosted as
latin woff2 subsets in `public/fonts/` (from the IBM Plex and Google Fonts OFL
sources), plus Patrick Hand, loaded only on the Kage diagram page. All are under the
SIL Open Font License 1.1; the license files sit next to them.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Type check and build to `dist/` |
| `npm run lint` / `npm test` | ESLint / Vitest |
| `npm run size` / `npm run budget` | size-limit and the byte budget (`scripts/budget.mjs`) |
| `npm run glb-check` | meshopt, KTX2 and triangle/draw caps on the test GLB |
| `npm run history-check` | The history check over every commit, path and ref |
| `node scripts/content-check.mjs dist [--companies on\|off]` | Content and honesty checks on a build (CI runs both company states) |
| `npm run prepare` | Enables the pre-push hook (`git config core.hooksPath .githooks`) |

`SITE_BASE` sets the public path (default `/`). CI builds both `/h0-layout/` and `/`.

### Browser and link checks (`e2e/`)

They run on the built site and have their own package, so the root lockfile stays
untouched. Build first with `SITE_BASE=/h0-layout/ npm run build`, then in `e2e/` run
`npm ci` and `npx playwright install chromium`.

| Command (in `e2e/`) | CI job | What it does |
|---|---|---|
| `npm run links` | `links` | Internal links, anchors and routes must resolve. An external 404, 410 or DNS failure fails; LinkedIn is never fetched and must match the pinned URL in `external-allowlist.json` |
| `npm run guard` | `links` | No `mailto:`, email address (plain or entity-encoded) or phone number in shipped text files; PDFs are exempt |
| `npm run facts` | `facts` | JS off, at 1440 and 390: each route's title, `h1` and facts, no overflow, and the fixed hiring facts in the first viewport; the CV download, board hit areas and order, the email fallback and 360 px widths |
| `npm run axe` | `axe` | axe on every route at 1440 and 390 |
| `npm run smoke` | `axe` | JS on, at 1440 and 390: no page or console errors, and the email assembles on click |

## History rules

- Every commit is authored and committed with the account's GitHub noreply address.
  The check fails any commit with another author or committer email.
- Commit messages are plain and describe the change. No co-author trailers.
- A list of banned terms is kept only as SHA-256 hashes in
  `scripts/banned.sha256.json`. `scripts/history-check.mjs` splits text on camelCase
  and non-alphanumerics, then hashes single tokens and runs of up to five tokens, so
  it matches whole words and dotted or hyphenated terms. Phone-number shapes are
  banned too.
- **Path rule:** an entry may carry `"allowIn": ["*.pdf"]`. That term is then not
  checked inside the contents of files ending in `.pdf` (the published CV is a PDF).
  It is still checked in every other file, in file paths, commit messages,
  author fields and ref names. Patterns are suffix matches of the form `*.ext`.
- **Scope rule:** an entry may carry `"scope": "metadata"`. It is then checked only
  in commit metadata (author and committer fields, messages) and ref names, not in
  file contents or paths. Multi-word terms are hashed as their words joined together,
  so any spacing or punctuation between the words still matches.
- The pre-push hook (`.githooks/pre-push`) runs the check on the commits being
  pushed and on the branch names. CI runs it over the full history, plus gitleaks
  with its default rules.
- Merge pull requests locally with a merge commit made under the same identity,
  then push main. The web merge button records GitHub as the committer, which the
  check rejects.

## Known audit findings

`npm audit` reports 3 high advisories in the braces and micromatch chain pulled in
by the glTF Transform CLI (`@gltf-transform/cli`). The CLI is a dev dependency
only: it runs in CI on this repo's own GLB files and never ships to the site. There
is no fixed version yet, so we're waiting on an upstream fix. The owner accepted
this as a dev-only risk.

## Test GLB

`test/fixtures/cube.glb` is a 12-triangle cube with meshopt compression and a KTX2
(ETC1S) texture. It is self-contained, so its KTX2 is embedded; production GLBs
must reference their textures. Rebuild it with `scripts/make-test-glb.mjs`.

## Gates

From M1 on, each milestone ends in five written gates, in this order: design, UX,
QA, hiring rules, owner approval. Records live in `docs/gates/` as
`M<n>-<gate>-<sha7>.md` and name roles only.

## Licence

The source code in this repository is under the MIT License (see `LICENSE`).

The following are not covered by the MIT License. They are (c) 2026 Roi Yotvat,
all rights reserved:

- the site's written content and copy, including the content file
  (`content.ts`) and everything in `cv/`, even though they sit next to the code;
- the CV (`cv.pdf`);
- all images, screenshots, 3D models, textures and renders, including
  `docs/gates/*/shots/`;
- Roi Yotvat's name, likeness and personal brand.

The fonts in `public/fonts/` are under the SIL Open Font License 1.1 (see the
license files next to them). The generated test fixtures in `test/fixtures/` are
code and are under the MIT License.
