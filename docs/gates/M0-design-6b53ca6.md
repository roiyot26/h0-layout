# M0 design gate record

```
Milestone: M0 Repo, pipeline, guards
Gate: design reviewer          Result: PASS (final, after two PASS WITH FIXES rounds)
Date: 2026-10-19 (Asia/Jerusalem)   SHA: 6b53ca6 (first pass 2c30eda, re-check 3751cb6)
Preview: https://roiyot26.github.io/h0-layout-preview/pr-2/     Screenshots: docs/gates/M0/shots/
Findings: 8, all cleared (fixes 1-4 and 6-8 in PR #2, fix 5 in PR #1)
Fixes required before the next gate: none
```

The full review follows: the first pass at 2c30eda, the re-check at 3751cb6 and the final pass at 6b53ca6.

- **Verdict: PASS WITH FIXES** (no blockers)
- **Date:** 2026-10-19
- **SHA gated:** `2c30eda` (main). The live Pages deployment reports 2c30eda (deployed 14:18 Asia/Jerusalem, UTC+3), and the deployed CSS matches `src/style.css` at that SHA, so the live site and the repo agree.
- **Preview noted:** PR #1, head `bde4205` (branch `placeholder-scale-note`).
- **Gate order:** design (this record), then QA, then product review, then the owner.
- **Scope:** only the "coming soon" departure-board placeholder. Missing M1 content (the real rows, "Skip to the facts", the buttons, the 3D) is expected and isn't flagged here.

## What I checked
- **Style guide:** read STYLE.md v1.3.1 in full; §2 (palette and contrast), §6 (board type, colour and layout) and §7 (fonts) apply here.
- **Method:** a read-only clone of the repo at 2c30eda, plus the live site and the PR preview. I used headless Chromium in a fresh context for every shot, at DPR 1.
  - Live: 1440×900, 390×844, 360×780 and 700×900.
  - Preview: the same four sizes.
  - Both at 1440 and 390 with `prefers-reduced-motion: reduce` and with JS disabled.
- **Measurements:** computed styles for every visible element, plus the fonts Chromium actually rendered (CDP `getPlatformFontsForNode`). WCAG 2.x contrast computed from the CSS values.
- **Results:**
  - **No overflow:** `scrollWidth` equals the viewport at 1440, 700, 390 and 360, and the page doesn't scroll at any size.
  - **No-JS and reduced motion:** both are pixel-identical to the default render. The JS only sets `data-base`, and there are no animations (`getAnimations()` = 0).
  - **Interactive elements:** there are none (0 focusables), so focus rings and 44px targets don't apply in M0.
  - **Safe areas:** there's no `viewport-fit=cover`, so the UA keeps content out of the notch, and the 24px body padding holds at 360.
  - **The engineer's shots:** they match mine. The only differences are anti-aliasing inside the text boxes.

**(a) Calm, intentional first step?** Yes. It's one dark board with one row and one signal-yellow accent, centred, with lots of quiet space and nothing moving. "--:-- · H0 LAYOUT · 1 · COMING SOON" in the board idiom reads as a deliberate placeholder, not a stock "under construction" page. The colours are exactly the guide's tokens. What lets it down is the type (finding 1): the board is set in whatever monospace and sans the platform happens to have, which is the default-system-font tell.

**(b) Contrast:** all pairs pass, and every token matches §2 / §6.

| Pair | Value | Need |
|---|---|---|
| Board text #F2EEE4 on flap #23262A | 13.11 | 4.5 |
| COMING SOON #E3B341 on flap | 7.81 | 4.5 |
| Column heads and note #B9B2A3 on body #16181A | 8.44 | 4.5 |
| Caption #F2EEE4 on body | 15.36 | 4.5 |
| Caption rule #E3B341 on body (UI) | 9.15 | 3 |

**(c) Layout:**

| Viewport | Board width | Caption | Cells | Notes |
|---|---|---|---|---|
| 1440 | 1060px (within the 1120 max) | 28px | 22px | 4 columns |
| 390 | 342px | 20px | 15px | PLATFORM hidden; "COMING SOON" ends 19px inside the board edge |
| 360 | 316px | | 15px | fits, 8px spare in REMARKS |

**PR #1 preview vs live:** one visible difference. The preview adds a second note, "Scale 1:87 (H0).", 24px under the first one (see finding 5). It also adds `<meta name="robots" content="noindex, nofollow">`, which is correct for a preview. The CSS is byte-identical.

## Findings

1. **Worth fixing: the type isn't on-guide (system fonts, default weight).**
   - **What ships:** the caption is `system-ui, sans-serif` 600 (rendered here as Noto Sans), and the cells, heads and note are `ui-monospace…` 400 (rendered here as Liberation Mono; SF Mono on macOS, Consolas on Windows).
   - **The guide (§6 / §7):** IBM Plex Mono **Medium** with tabular-nums for the board, and Barlow Semi Condensed **SemiBold** for the header.
   - So the placeholder looks different on every OS, and it's the default-system-font tell.
   - **Fix:**
     - Self-host the measured subsets: Plex Mono Medium 11.9 KB, Barlow SemiBold 19.2 KB.
     - Load them with `@font-face{font-family:'IBM Plex Mono';src:url(plex-mono-500-sub.woff2) format('woff2');font-weight:500;font-display:swap}` and `@font-face{font-family:'Barlow Semi Condensed';src:url(barlow-sc-600-sub.woff2) format('woff2');font-weight:600;font-display:swap}`.
     - Then set `body{font:500 16px/1.5 'IBM Plex Mono',ui-monospace,monospace}` and `.board caption{font:600 clamp(20px,3vw,28px)/1.2 'Barlow Semi Condensed',system-ui,sans-serif}`.
     - Per §2 the header colour is signal yellow, so also set `.board caption{color:var(--signal)}`.

2. **Minor: the board tracking is off-guide and drifts with size.**
   - `letter-spacing:0.08em` is set on `.board` (16px), so it inherits as a fixed **1.28px**.
   - That's 0.058em at 22px and 0.085em at 15px, against the guide's **0.04em**.
   - **Fix:** `.board td{letter-spacing:0.04em}` and `.board th{letter-spacing:0.06em}`, set on the elements themselves so the em resolves against their own size.

3. **Minor: the hinge reads as a strike-through, not as flaps.**
   - The 1px hinge runs unbroken across all four cells and the gutters between them. At 390 it sits about 2–3px below the cap centre, so it reads as a line struck through the text rather than a row of flaps.
   - **Fix:**
     - Break it at the column gutters (§6's 12px): `.board{border-spacing:12px 6px;margin-inline:-12px;width:calc(100% + 24px)}`.
     - Use the guide's hinge colour `#0E0F10` (now `#0e0f11`).
     - Re-check the cap centre on the hinge once Plex Mono is in (finding 1). If it's still low, use `.board td{padding-block:11px 9px}` at ≤640px.

4. **Minor: the phone breakpoint doesn't match the guide.**
   - PLATFORM is hidden at `max-width:640px`. §6 drops PLATFORM below **883px**, where the board switches to stacked rows.
   - At 641–882px the placeholder shows a 4-column board that the real board will never show (seen at 700px, which looks fine but is off-plan).
   - **Fix:** `@media (max-width:882px){.board .wide{display:none}}`. The cell size is already 15px at ≤480, and the 16px floor already holds at 883 through the clamp.

5. **Minor, PR #1 (bde4205) only: the scale note reads as an orphan.**
   - "Scale 1:87 (H0)." is a second `.note` with the full `margin-top:24px` plus the default paragraph margin. That leaves a 39px gap at 390, so it floats as a separate footer line.
   - **Fix:** `.note + .note{margin-top:4px}`, or put it in the first note as a trailing sentence.

## Shots (reviewer's working set, not committed)
- `live-1440-default.png`, `live-390-default.png` and `live-360-default.png`, plus the `-reduced` and `-nojs` variants (pixel-identical to default) and `live-700-default.png`.
- `pr1-*.png`: the same set for the PR #1 preview.
- `zoom-1440-hinge.png` and `zoom-390-hinge.png`: the hinge across the text (finding 3).

---

## Re-check 3751cb6 · 2026-10-19

- **Verdict: PASS WITH FIXES** (no blockers)
- **What I re-checked:** PR #2, head `3751cb6` (one commit per fix: e91a08e, 8344f19, 6bc6b13, 4cd2075, 3751cb6). I used the preview https://roiyot26.github.io/h0-layout-preview/pr-2/ and a read-only clone.
- **PR #1:** `060094b`, rebuilt on its own preview.
- **Main:** still `2c30eda`, unchanged.
- **Shots:** fresh headless Chromium contexts at DPR 1, in `shots-M0-fix/`.
  - 1440, 700, 390 and 360.
  - Reduced motion and no-JS at 1440 and 390.
  - Fonts blocked at 1440, 390 and 360, to see the swap fallback.
  - Trial renders of the suggested fixes at 640, 480, 390 and 360, using an injected stylesheet; nothing in the repo was changed.

### The original findings

1. **Fonts: cleared (e91a08e).**
   - **Loading:** `document.fonts` has `IBM Plex Mono 500 loaded` and `Barlow Semi Condensed 600 loaded`, and `fonts.check()` is true for both. CDP shows every glyph on the page rendered from the custom fonts (no fallback glyphs): "IBM Plex Mono Medm" and "Barlow Semi Condensed SemiBold".
   - **Files:** Plex Mono is 12,604 B and Barlow 19,200 B. Both URLs get the preview base prepended, and both return 200 as `font/woff2`.
   - **Preload:** Plex Mono's preload is used. It's fetched once (initiator `link`, at about 30 ms), with no second request from the CSS and no console warning. Barlow isn't preloaded and is fetched once from the CSS. That's fine, because it only sets the caption.
   - **Swap:** comparing the fonts-blocked render with the loaded one, nothing moves vertically. Columns shift ≤2.5px sideways, and measured CLS is ≤0.004.
   - **Caption:** #E3B341 on #16181A, 9.15:1.
   - **Contrast:** the other pairs are unchanged (13.11, 7.81, 8.44) and pass.
   - **No-JS and reduced motion:** both are pixel-identical to the default render, and the fonts load without JS.
2. **Tracking: cleared (8344f19).**
   - td: 0.88px at 22px, 0.616px at 15.4px and 0.6px at 15px, so 0.04em at every size.
   - th: 0.78px at 13px = 0.06em.
3. **Hinge: cleared (6bc6b13).**
   - It breaks at every gutter: the gutter pixels are #16181A and the hinge pixels #0E0F10.
   - **Measured position** (hinge row centre against the centre of the capitals' ink):
     - 1440: 1px high.
     - 390: 1px high on the first and third flaps, dead centre on the middle one (see new finding 7).
     - 360: dead centre.
   - These are the reverse of the engineer's figures, probably due to sub-pixel rasterisation. Either way the offset is ≤1px, which is **acceptable** on a 41–53px flap.
4. **Breakpoint: cleared (4cd2075).** PLATFORM is `none` at 882px and `table-cell` at 883px, and 700px shows 3 columns.
5. **Scale note (PR #1, 060094b): still open.**
   - `.note + .note{margin-top:4px}` collapses against the first note's own 15px bottom margin, so the gap is 15px.
   - **Fix (product call):** make it the last sentence of the first note: `<p class="note">The layout is still on the workbench. Please check the timetable again soon. Scale 1:87 (H0).</p>`, and delete the `.note + .note` rule.

**Extra: caption alignment cleared (3751cb6).** The caption's left edge equals the first flap's left edge at 1440, 700, 390 and 360 (190, 24, 24, 24). Its right edge, and its 2px rule, equals the last flap's right edge (1250, 676, 366, 350.2).

### New findings

6. **Worth fixing: 2px horizontal scroll at 360, plus a lopsided edge.**
   - The new 12px gutters add 24px to the row. At 360 the cells' min-content is 326.2px against a 312px station, so the table runs to 362.2px and `scrollWidth` is 362.
   - The right margin also drops to 9.8px against 24px on the left (`zoom-360-right-edge-4x.png`). It only happens once Plex Mono has loaded; the fallback fits.
   - **Fix:** use the guide's 16px phone inset (§11): `@media (max-width:480px){body{padding-inline:16px}}`.
   - Tested: `scrollWidth` is 360/390/480 at 360/390/480. The flaps sit 16px from both edges at 360 (16→344) and stay aligned with the caption.
7. **Minor: the hinge steps 1px between adjacent flaps at 390.**
   - The flaps are 42.5px tall (15px × 1.5 + 20px), so `calc(50% ± 0.5px)` lands on different pixel rows in different cells: rows 419 / 420 / 419.
   - **Fix:** use the guide's 1.42em row height, snapped to an odd pixel height so the 1px hinge sits on one row: `@media (max-width:640px){.board td{line-height:21px;padding:9px 8px 11px}}`.
   - Tested: the flaps are 41px, the hinge is on the same row in every flap, and it's dead centre on the capitals at 640, 480, 390 and 360.
8. **Minor: corner radius (the engineer's open question).**
   - STYLE.md §6 says **"Flap radius 2 px, 2 px gap between cells"**. It defines the radius per flap, and it gives the board body no radius of its own. Here the board body is the page background, so there are no outer board corners to round.
   - **Recommendation:** round **every flap at 2px**, as a real split-flap does. Replace the two `:first-child` / `:last-child` radius rules with `.board td{border-radius:2px}`.
   - Tested in the suggested-fix renders: it reads as four separate flaps, and there's no other change.

**Gate result:** findings 1–4 cleared. Finding 5 is still open as a product call. Finding 6 should be fixed before QA; findings 7–8 are minor and cheap. Nothing blocks.

**Re-check shots (`shots-M0-fix/`):**
- `pr2-1440-default.png`, `pr2-390-default.png` and `pr2-360-default.png`, plus `-reduced`, `-nojs` and `-fonts-blocked`, and `pr2-700-default.png`.
- `zoom-390-hinge-4x.png` and `zoom-360-right-edge-4x.png`.
- `pr2-{640,480,390,360}-suggested-fixes.png`: fixes 6–8 applied in the browser only.
- `pr1-390-default.png` and `pr1-1440-default.png` for the note gap, and `live-*` for main.

---

## Final 6b53ca6 · 2026-10-19

- **Verdict: PASS.** All M0 design findings are cleared. Ready for QA.
- **What I checked:**
  - PR #2 at head `6b53ca6`. The fixes are in 72c6ad5 (16px inset), 1a7d092 (odd flap height) and 3ee2cc9 (every flap rounded).
  - PR #1 at head `d896769`.
  - Both previews, with fresh headless Chromium contexts at DPR 1. PR #2 at 1440, 883, 882, 700, 640, 480, 390 and 360, plus reduced motion and no-JS at 1440 and 390. PR #1 at 1440 and 390.
  - Shots: the reviewer's working set (not committed); the committed set is `docs/gates/M0/shots/`.

**Results:**
- **Fix 6 (side inset):**
  - The flap edges are 16/16px at 360, 390 and 480, and 24/24 at 640, 700 and 882.
  - `scrollWidth` equals `clientWidth` at 1440, 883, 882, 700, 640, 480, 390 and 360.
- **Fix 7 (hinge):**
  - The flaps are 41px at ≤640, and 43.1 / 49.1 / 53px above that.
  - The hinge sits on one pixel row across every flap at every width.
  - At ≤640 the hinge row centre is within 0.25px of the flap's middle (the flap box starts on a quarter pixel). On the capitals it measured dead centre at 640, 480, 390 and 360.
  - The other build measured it 1px low, and either way the offset is ≤1px. Accepted per the product ruling: the hinge belongs at the flap's middle, so the padding stays 9/11.
- **Fix 8 (corners):** every flap computes `border-radius: 2px`.
- **PR #1:**
  - There's a single note: "The layout is still on the workbench. Please check the timetable again soon. Scale 1:87 (H0)."
  - No `.note + .note` rule is left, in the diff or in the built CSS.
  - The PR only touches `index.html`'s note line, so it doesn't overlap PR #2's head change (the preload).
- **No regressions:**
  - Both fonts load: Plex Mono once via the preload, Barlow once via the CSS.
  - The caption is #E3B341 (9.15:1), and the colour tokens are unchanged, so contrast holds (13.11 / 7.81 / 8.44).
  - PLATFORM is `none` at 882 and `table-cell` at 883.
  - The caption and its rule line up exactly with the first and last flap edges at every width.
  - Reduced motion and no-JS are pixel-identical to the default render.
