# H0 layout

A portfolio laid out as a 1:87 (H0) model railway. This is milestone 0: the repo,
the build pipeline and the guards. The live page is a placeholder until the first
real version lands.

- Site: https://roiyot26.github.io/h0-layout/
- PR previews: https://roiyot26.github.io/h0-layout-preview/pr-<n>/ (noindex)

## Stack

Vite 5, TypeScript (strict) and vanilla three.js r186. No framework. Assets go
through gltf-transform (meshopt, quantisation, KTX2).

## Fonts

IBM Plex Mono Medium and Barlow Semi Condensed SemiBold, self-hosted as latin
woff2 subsets in `public/fonts/` (from the IBM Plex and Google Fonts OFL sources).
Both are under the SIL Open Font License 1.1; the license files sit next to them.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Type check and build to `dist/` |
| `npm run lint` / `npm test` | ESLint / Vitest |
| `npm run size` / `npm run budget` | size-limit and the byte budget (`scripts/budget.mjs`) |
| `npm run glb-check` | meshopt, KTX2 and triangle/draw caps on the test GLB |
| `npm run history-check` | The history check over every commit, path and ref |
| `npm run prepare` | Enables the pre-push hook (`git config core.hooksPath .githooks`) |

`SITE_BASE` sets the public path (default `/`). CI builds both `/h0-layout/` and `/`.

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

## Test GLB

`test/fixtures/cube.glb` is a 12-triangle cube with meshopt compression and a KTX2
(ETC1S) texture. It is self-contained, so its KTX2 is embedded; production GLBs
must reference their textures. Rebuild it with `scripts/make-test-glb.mjs`.

## Gates

From M1 on, each milestone ends in five written gates, in this order: design, UX,
QA, hiring rules, owner approval. Records live in `docs/gates/` as
`M<n>-<gate>-<sha7>.md` and name roles only.
