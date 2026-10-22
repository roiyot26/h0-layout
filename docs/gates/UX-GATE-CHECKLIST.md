# H0 · UX & motion gate checklist (UX reviewer, gate 2, after design)

```
Gate: UX reviewer (flow, motion, first-visitor UX)
Date: 2026-10-19 (Asia/Jerusalem, UTC+3)            Applies from: M1 (no retro pass on M0)
Specs read in full: TECH-PLAN.md (2026-10-19 14:07), STYLE.md v1.3.1, CONTENT.md v4.0
Gate order per milestone: design reviewer → UX reviewer → QA → hiring-rules reviewer → owner (Roi)
Record name: docs/gates/M<n>-ux-<sha7>.md
```

This is the set of measurable criteria I'll gate each milestone against, plus the spec flags I found while reading. I haven't gated anything yet. Where a spec gives a value, I quote it with its section. Where a spec says nothing, the value is **my proposal** (marked **P**), and it stays a proposal until the director rules on it or the spec adopts it.

Severity, used for criteria and flags alike: **Blocker** fails the gate. **High** fails the gate unless the director waives it in writing. **Medium** gives PASS WITH FIXES, and the fix has to land before Roi's gate. **Low** is a note.

---

## 0. How I measure (every milestone)

| Tool | Setup | What it gives |
|---|---|---|
| **Viewports** | 1440×900 DPR 1 (desktop) and 390×844 DPR 3 with `hasTouch`/`isMobile` (phone). 360×780 is a spot check. | |
| **Motion modes** | `page.emulateMedia({ reducedMotion: 'reduce' })` and `'no-preference'`; JS off (`javaScriptEnabled: false`) for flow-only checks | |
| **Headless video** | Playwright `recordVideo` at each viewport, plus a CDP `Page.startScreencast` with per-frame timestamps; ffmpeg pulls out frames, and per-frame SSIM against the start and end frames gives crossfade and slide durations. Repeated identical frames (`mpdecimate`) count as dropped frames. | durations, easing shape, jank, visible flashes |
| **DevTools performance trace** | CDP `Tracing.start` with `devtools.timeline`, `disabled-by-default-devtools.timeline.frame`, `blink.user_timing`, `loading` | frame durations (`PipelineReporter`/`DrawFrame`), long tasks, long animation frames (LoAF), INP via Event Timing, layout shifts |
| **In-page observers** | `PerformanceObserver` for `layout-shift` (excluding `hadRecentInput`), `longtask`, `long-animation-frame`, `event` (durationThreshold 16) | CLS, task lengths, interaction latency |
| **Camera pose log** (**P**, needs the engineer) | A preview-only `?trace=1` hook that writes one `performance.mark` per frame with `{t, u, pos, yaw, pitch, roll, fov, opacityA/B}`. It's stripped from production builds, because the internals rule bans console and DOM internals. | hop and ride duration, easing curve fit, angular speed, height above the terrain |
| **Virtual clock** | Playwright `page.clock` (fixed step 16.67 ms) for deterministic SwiftShader runs | timing correctness, independent of how slow SwiftShader is |
| **Keyboard script** | Playwright Tab/Shift+Tab/Enter/Space/arrows/Esc; `document.activeElement` and its rect logged after every key press; focus-ring screenshots | focus order, focus loss, traps, visible focus |

**The SwiftShader caveat** (TECH-PLAN header: "SwiftShader captures are slow … have unreliable timing"): on the box I gate **durations and curves from the pose log under the virtual clock**. **Frame pacing** (fps, frames over 50 ms) is gated only on a real GPU: a recorded desktop run, and a real phone from M5 on. Until then a frame-pacing criterion reads "not yet measurable", never PASS.

**Frame-pacing thresholds** (**P**, used wherever a criterion says "pacing OK"):
- **Desktop (real GPU, 1440):** during any camera motion or animation, p95 frame time ≤ 18.2 ms (≥ 55 fps), **no frame over 50 ms**, ≤ 1% of frames over 33.4 ms, and ≤ 2 dropped frames per 1.0 s hop.
- **Phone (real mid-range device):** median ≥ 30 fps (TECH-PLAN §3, STYLE §11), p95 ≤ 40 ms, no frame over 100 ms during a hop.
- **DOM layout:** CLS = 0.000 during scripted transitions, which means transform and opacity only.

**Motion-comfort rules** (they apply to every 3D milestone):
- Camera angular speed ≤ 45°/s (TECH-PLAN §2, STYLE §5).
- **Camera roll 0° at every frame** (**P**).
- No camera shake or bob (**P**).
- FOV changes at ≤ 20°/s (**P**).
- "The camera never moves on its own" (TECH-PLAN §2).
- No full-frame luminance flash more than 3 times per second (WCAG 2.3.1).
- Every looping motion can be stopped.

---

## 1. Baseline criteria (checked at every milestone from M1 on)

| ID | Criterion | Threshold | Measured | Spec source |
|---|---|---|---|---|
| B1 | **Landing to Roi's facts.** The facts are name, role, "I build…" line, CV, LinkedIn, GitHub and Email. | All of them are painted and inside the first viewport at 1440×900 and 390×844 by **FCP ≤ 1.5 s** (Lighthouse mobile). **Hard ceiling: 10 s on any path, including the 3D path** (landing → Enter the layout → one hop → that station's panel readable). The facts never wait on 3D bytes. | Trace FCP; bounding rects of each fact element at the first frame that contains them; scripted 3D path timed from `navigationStart` | TECH-PLAN §7 Routes ("in the first viewport at 1440 and 390"); §6.4 FCP ≤ 1.5 s; STYLE header "Facts are on first paint in real HTML" |
| B2 | **Skip to the facts** is always visible and always reachable | Visible (not covered, opacity 1) in every state: board, overview, station, ride, sheet at full, discovery running, night state. Same corner, ±1 px, on every route at each width. **Mouse: 1 click. Keyboard: the first Tab stop on every route, and ≤ 2 key presses from any focus inside 3D.** Activation paints the `/timetable` h1 within ≤ 2.5 s (LCP). | Rect diff across routes and states; Tab count logged from load and from inside the canvas region; occlusion test with `elementFromPoint` at the control's centre | CONTENT §1 ("stays in the same corner on every screen"); TECH-PLAN §3 Facts mode ("always in the same corner"); hiring rule 2 ("≤2 clicks") |
| B3 | **Hop motion** | Neighbours on the same straight (Workshop ↔ Bootcamp, Campus ↔ City): **1.0 ± 0.05 s, easeInOutCubic** = `cubic-bezier(0.65, 0, 0.35, 1)`, with the pose-log fit RMSE ≤ 2% of the distance. Every other hop: a **300 ± 30 ms crossfade** (**P**: linear opacity, no dip to black). Reduced motion: a **200 ± 20 ms crossfade with 0 translation** (the pose is identical on every intermediate frame). Peak angular speed ≤ 45°/s, including hops that start from an orbited pose. Pacing OK. | Pose log and video SSIM | TECH-PLAN §2 Station hop; STYLE §5; M2 exit; STYLE §12 Camera |
| B4 | **No motion sickness** | The §0 comfort rules; no involuntary camera motion; no tunnel blink: the hop camera never enters the tunnel and arcs over the hill with ≥ 12 mm clearance on every frame (ruling 2) | Pose log, video luminance trace | TECH-PLAN §2 ("camera never moves on its own"), §2 Ride (≤ 45°/s) |
| B5 | **Loader and board pacing** | One flip is 60 ms (30 + 30), with ≤ 6 intermediate glyphs; a cell settles in ≤ 420 ms; 20 ms left-to-right stagger; a row settles in ≤ 1.44 s on desktop and ≤ 1.28 s on phones (±50 ms); rows flip **concurrently, never queued** (**P**); `DELAYED · n%` at **8.0 ± 0.25 s**; reduced motion: 0 board animations | `getAnimations()`, video, pose of the CSS flaps via the trace | TECH-PLAN §4 Flaps / Honest delay; STYLE §6 Flap timing |
| B6 | **Discoveries are play only** | No discovery opens a modal, takes focus without the visitor asking, navigates (except the optional clay-view chip), or blocks a hop, Skip, the switcher or Esc while it runs. With storage empty every fact is reachable. No toast, badge, score, timer or sound on a find. | A script starts each discovery and then hops or skips within 1 s, which must work; DOM grep for progress text | CONTENT §7, §8; STYLE rules 4, §8 Rules; TECH-PLAN §5 |
| B7 | **Keyboard and focus** | Tab order equals visual order, with no positive `tabindex`; focus never lands on `<body>` after any action (hop, slide, sheet, discovery, Esc); no trap, and the canvas region is left with one Tab; visible focus everywhere: **yellow #E3B341 on dark (9.15:1), enamel blue #1F3A5F 2 px with a 2 px offset on cream (9.91:1), never yellow on cream**; the focused element is never fully hidden under a sticky or fixed layer (WCAG 2.4.11) | Keyboard script, focus screenshots, `activeElement` log | TECH-PLAN §7 Accessibility; STYLE §2, §7 |
| B8 | **Scroll and touch feel** | No scroll-jacking: no `preventDefault` on `wheel`/`touchmove` outside the canvas, and no programmatic scroll the visitor didn't ask for. Native scroll on every DOM page and in the sheet. `touch-action: none` only on the canvas. Pinch-zoom on the page is never disabled. **Targets ≥ 44 × 44 px with ≥ 8 px gaps** (contiguous full-width list rows are exempt from the gap rule, **P**). A tap-versus-drag threshold of 8 px or 150 ms (**P**). INP ≤ 200 ms, and the first visual response to a tap within ≤ 100 ms (**P**). | Listener audit (`getEventListeners` over CDP), rect checks, Event Timing | TECH-PLAN §7 ("Targets ≥44 × 44 px with ≥8 px gaps"); STYLE §9 ("user-scalable is never disabled"), §11 Touch |
| B9 | **Sound off by default** | 0 audio requests and 0 `AudioContext` output before the visitor turns sound on, including after the bell and other clicks; the Sound setting isn't stored; the soundtrack starts only from its chip, and the same chip stops it (WCAG 1.4.2, **P**) | Request log; `AudioContext.state`; chip toggle test | TECH-PLAN §3 Audio; STYLE §8 Sound |
| B10 | **prefers-reduced-motion fully honoured** | 0 translation, rotation or scale animations anywhere (DOM or 3D); full-frame changes are 200 ms opacity crossfades; small UI changes are instant; the facts are identical; nothing 3D loads unless the visitor asks for it | `getAnimations()` filtered by property; pose log; request log | TECH-PLAN §1, §2, §3, §4; STYLE §5, §6, §8 |

---

## 2. Per-milestone criteria

### M1 · HTML-first site (static; flow only)
Scope: 13 routes plus `/cv.pdf`, JS on and off, reduced motion on and off, at 1440, 390 and 360. Nothing animates in M1.

| ID | Criterion | Threshold | Measured | Source |
|---|---|---|---|---|
| M1-01 | Reading order on `/` | The accessibility tree and the visual y-order are both: Skip to the facts → h1 "Roi Yotvat" → role line → intro → CV · LinkedIn · GitHub · Email → languages → (Enter the layout, absent in M1) → board `<table>` with `<caption>` → footer. The visual order is monotonic in y (no CSS `order` or absolute reordering). **The phone puts the first-screen block above the board** (flag F7). | Accessibility snapshot; rect y-sequence at 1440, 390 and 360 | CONTENT §1–2; STYLE §11 Arrival |
| M1-02 | Time to facts | Every B1 element is in the first viewport at 1440×900, 390×844 and **360×780** (**P**); FCP ≤ 1.5 s, LCP ≤ 2.5 s (Lighthouse mobile) on `/`, `/timetable`, `/now` and `/workshop` | Rects; Lighthouse CI | TECH-PLAN §6.4, §7 Routes |
| M1-03 | Skip link | The first Tab stop on all 13 routes (on `/timetable` it becomes "Skip to content"/main, **P**); visible without focus; ≥ 44 px tall (48 px per STYLE §11); same corner ±1 px across routes; activating it puts the `/timetable` h1 in the viewport at load | Keyboard script; rects | B2 |
| M1-04 | Focus order and visibility | Tab presses from load: CV ≤ 3, Email ≤ 6, first board row ≤ 8 (**P**). Every focusable element shows the §2 ring colours (≥ 3:1, as specified). There is no focusable element with no visible box. | Keyboard script; screenshots | B7 |
| M1-05 | Tap targets | Every link and button is ≥ 44 × 44 px with ≥ 8 px gaps. **The board rows are links, and their specified heights are 31.2 px on desktop and 42.6 px stacked**, so they fail unless the row hit area is enlarged (flag F5). | Rects at 1440, 390 and 360 | TECH-PLAN §7; STYLE §6 |
| M1-06 | No layout shift | CLS = 0.000 on all 13 routes at the three widths, with fonts delayed by 3 s (the swap with size-adjusted fallbacks has to hold). Lighthouse's ≤ 0.05 is the CI floor, not my bar. | `layout-shift` observer with route interception delaying woff2 | TECH-PLAN §3 Fonts ("no reflow"), §6.4 |
| M1-07 | No-JS path | All 13 routes return 200 and are fully navigable: board rows are working `<a href>`, the email fallback "name [at] domain [dot] tld" is visible, Skip works, and nothing is hidden waiting for JS. **"Enter the layout" is absent, not a dead button.** The no-JS render is pixel-identical to the JS render, except for the email text. | JS-off context; pixel diff | TECH-PLAN §1 Pages, §8 Email, §11 M1 |
| M1-08 | Reduced motion and static | `document.getAnimations().length === 0` with reduced motion on and off; hover and focus colour transitions ≤ 150 ms; no `scroll-behavior: smooth` under reduced motion | `getAnimations()`; computed styles | B10 |
| M1-09 | Reflow and zoom | No horizontal scroll at 360, 390 or 1440, at 200% zoom on 1440, or at a 320 px CSS reflow (WCAG 1.4.10); the board stacks below 883 px with no row wrapping | `scrollWidth`; zoom emulation | STYLE §6 Stacked, §9 Phone |
| M1-10 | Native scroll | No `wheel`/`touchmove` `preventDefault`; body is not `overflow: hidden`; in-page anchors land with their target fully visible (`scroll-margin` clears any fixed Skip bar) | Listener audit; anchor test | B8 |
| M1-11 | Kage diagram page | "← Back to the City" is the first focusable after Skip, ≥ 44 px; no horizontal scroll at 390 or 360; the numbered text list follows the SVG in reading order | Rects; accessibility snapshot | STYLE §9 Page chrome, Phone |

### M2 · Blockout and camera (preview, `ENABLE_3D` on)

| ID | Criterion | Threshold | Measured | Source |
|---|---|---|---|---|
| M2-01 | Same-straight hop | 1.0 ± 0.05 s, `cubic-bezier(0.65, 0, 0.35, 1)`, RMSE ≤ 2%; heading change 0° from authored poses; ≤ 45°/s from orbited poses (a 30° orbit offset gives exactly 45°/s at mid-ease, so the hop also has to un-orbit within it, **P**) | Pose log | TECH-PLAN §2; STYLE §5; M2 exit |
| M2-02 | Other hops | 300 ± 30 ms linear crossfade with no black dip (no frame's luminance falls below 0.9 × min(start, end)) (**P**) | Video SSIM and luminance | TECH-PLAN §2 |
| M2-03 | Overview ↔ station | One defined transition (flag F9). Until a ruling: a 300 ms crossfade | Pose log | (spec silent) |
| M2-04 | Camera clearance | ≥ 12 mm above the height map **and above every roof or mesh** on every frame of every hop, including the tunnel hill (crest 110 mm) and the City shed (ridge 105 mm) (flag F2) | Pose log against a sampled height map and roof boxes | TECH-PLAN §2 Orbit; STYLE §5 |
| M2-05 | Arrival choreography | Labels hidden within ≤ 1 frame of hop start; they fade in over 150 ± 20 ms after arrival; DOF refocus 250 ± 30 ms; total settle ≤ 1.30 s for an ease hop | Pose log and DOM opacity trace | TECH-PLAN §2; STYLE §5, §7 |
| M2-06 | Focus during hops | Labels hide by opacity plus `pointer-events: none`, **never** by `display`/`visibility`, and stay in the DOM; `activeElement` is never `<body>`; one polite announcement on arrival ("Teaching Campus · 2022–26"), **P**; after the hop, focus moves to the arrival panel's heading (ruling 6) | Keyboard script | flag F6, ruling 6 |
| M2-07 | History | Exactly one `pushState` per completed hop, on arrival; `document.title` updates on arrival; Back and Forward hop and land on the right station at 1440 and 390; a cold deep link boots parked with a pose delta of 0 from the first 3D frame | `history.length`, pose log | TECH-PLAN §2 Deep links; M2 exit |
| M2-08 | Input during a hop | Input is **queued, and the last destination wins**: the hop in progress finishes, then goes to the last requested station; earlier requests drop (ruling 7). Never more than one pending target. Spamming the arrow key 5× in 1 s leaves 1 history entry per arrival and no stutter | Pose log, `history.length` | flag F10, ruling 7 |
| M2-09 | Arrow keys | They hop only while focus is inside the layout region (switcher, labels, canvas); never when focus is in a panel, sheet or text; no `preventDefault` on arrows elsewhere | Keyboard script | flag F10 |
| M2-10 | Ride | 0.128 ± 0.005 m/s; lap 41.7 ± 1.5 s plus 4 × 6 s dwell; camera ≤ 45°/s (expected ~15°/s on R3); chase spring lag 0.35 s; Esc and the 48 px ✕ exit within ≤ 100 ms, and focus returns to the "Ride the train" control | Pose log | TECH-PLAN §2 Ride; STYLE §5 |
| M2-11 | Idle | 60 s parked at a station gives a pose delta of 0 (nothing moves the camera on its own) | Pose log | TECH-PLAN §2 |
| M2-12 | Orbit and touch | Clamps hold (STYLE §5 and §11); damping settles in ≤ 400 ms (**P**); no inertia under reduced motion; tap versus drag at 8 px; one-finger drag never scrolls the page and never moves the sheet | Pose log; touch emulation | STYLE §5, §11 Touch |
| M2-13 | Reduced motion | Every hop is a 200 ms fade with 0 translation, and nothing auto-advances; on "Ride the train" the train stays parked, and station changes are 200 ms fades on input (ruling 4) | Pose log | TECH-PLAN §2, §3; ruling 4 |
| M2-14 | Pacing | Desktop real-GPU thresholds (§0) on a hop and a ride; recorded in the 20 s capture Roi sees | Trace | M2 Roi sees |
| M2-15 | Skip and production | B2 holds in every 3D state; the production build still serves the M1 site (all M1-xx criteria re-checked on production) | Rects; Tab counts | M2 exit |

### M3 · Loader and asset loading

| ID | Criterion | Threshold | Measured | Source |
|---|---|---|---|---|
| M3-01 | Facts readable from first paint | Every content row's final text is **visible** at FCP (no blank rows waiting on bytes), with JS on and off and with reduced motion on and off (flag F1) | Rects plus a pixel check of row text at the FCP frame | TECH-PLAN §4 "First paint, already the facts" |
| M3-02 | Flap timing | B5 values; rows flip concurrently, and the whole board settles ≤ 2.0 s after the last threshold (**P**) | Video, `getAnimations()` timing | TECH-PLAN §4; STYLE §6 |
| M3-03 | Status honesty | `BOARDING` → `ON TIME` only after `ready`; `DELAYED · n%` at 8.0 ± 0.25 s with n non-decreasing and updated ≥ 1×/s; `100%` during a slow compile; no stall at 99% | GLB held for 40 s; throttled phone profile | TECH-PLAN §4 |
| M3-04 | Skip pulse | Exactly one pulse, **600 ms, ease-in-out, scale ≤ 1.04** (**P**); under reduced motion a colour or outline change only, with no scale | Video | TECH-PLAN §4 Honest delay |
| M3-05 | "Enter the layout" button state | Focusable while loading (`aria-disabled`, not `disabled`), with a visible state ("Boarding · 42%"); enabling it causes no layout shift; one polite live message on ready; at most one announcement for DELAYED | Keyboard script; live-region log | TECH-PLAN §4 Status, Leaving; flag F16 |
| M3-06 | Board slide-up | 500 ± 30 ms, `cubic-bezier(0.22, 1, 0.36, 1)` (**P** for "ease-out"), transform only, CLS 0; pacing OK; reduced motion: a 200 ms opacity fade with no translate. Focus then moves to the layout region (current-station control) and the "Departures" control returns the board with focus back on "Enter the layout" | Video, trace, keyboard | TECH-PLAN §4 Leaving; STYLE §6 |
| M3-07 | Board works during loading | A board-row click at 50% of the bytes starts navigation within ≤ 100 ms; no long task over 50 ms during a flip cascade on desktop (**P**) | Event Timing; long tasks | TECH-PLAN §4 ("Every row is a link that works before 3D") |
| M3-08 | Reduced motion | 0 board animations; rows already final; `aria-live` message unchanged | `getAnimations()` | TECH-PLAN §4 Reduced motion |

### M4 · Art pass and bake (desktop 3D public)

| ID | Criterion | Threshold | Measured | Source |
|---|---|---|---|---|
| M4-01 | Re-run M2 motion | M2-01…M2-14 on the full art; desktop pacing OK at every station, golden | Trace on a real GPU | M4 exit |
| M4-02 | Kage close-up | 1.0 ± 0.05 s ease from the City view; ≤ 45°/s; path ≥ 12 mm from every mesh (no clipping through the shed roof, flag F9); reduced motion: 200 ms crossfade | Pose log | TECH-PLAN §2; STYLE §5 |
| M4-03 | Kage page handoff | `/now/kage-diagram` opens with focus on its h1 or kicker; "← Back to the City" restores the City view and puts focus back on the sheet hotspot within ≤ 300 ms, with no 3D reload (**P**) | Keyboard script, request log | STYLE §9 |
| M4-04 | Labels | ≤ 6 on desktop; 0 overlaps; wagon labels only at the Workshop view; sub-pixel shimmer ≤ 1 px frame to frame while parked; leaders ≤ 40 px | DOM rect log | STYLE §7 |
| M4-05 | DOF and bloom | Refocus over 250 ms with no pumping (focus distance monotonic); bloom pixel share stable within ±0.1 percentage points while parked | Pose and render log | TECH-PLAN §3 Post |
| M4-06 | Station panel (desktop) | Facts panel heading readable ≤ 1.3 s after hop start; it doesn't cover Skip or the current label; it's reachable by keyboard in ≤ 2 Tabs after arrival (flag F12) | Rects, keyboard | (spec silent) |
| M4-07 | First-visitor journeys, desktop | J1–J3 from §3 pass | Scripted | — |

### M5 · Phone tier, facts mode, perf

| ID | Criterion | Threshold | Measured | Source |
|---|---|---|---|---|
| M5-01 | Phone pacing | Real mid-range device: median ≥ 30 fps, p95 ≤ 40 ms, no frame over 100 ms during hops; the DPR step-down (below 40 fps over 3 s) causes no layout shift and no more than a 1-frame visual pop | Recorded device trace | TECH-PLAN §3 Phone tier; M5 exit |
| M5-02 | Interactive after opt-in | ≤ 5 s on a mid-range phone over 4G (real device, recorded) | Recording | M5 exit |
| M5-03 | Bottom sheet | Peek 88 px, half ≤ 40% of the viewport (338 px at 844), full 92% with 3D paused; snaps take **280 ms `cubic-bezier(0.2, 0, 0, 1)`**, velocity-aware (**P**), instant under reduced motion; content scrolls natively with `overscroll-behavior: contain`; handle 96 × 44 px; a vertical drag in the sheet never orbits | Touch emulation, video | STYLE §11 |
| M5-04 | Switcher | 4 buttons ≥ 44 px tall, equal width, gaps ≥ 8 px, labels fully visible with no clipping (flag F19); hops follow B3; a cut or crossfade under reduced motion; first visual response ≤ 100 ms | Rects, Event Timing | STYLE §11 |
| M5-05 | Touch | Tap vs drag at 8 px; pinch 0.3–0.7 m; azimuth ±20°; labels ≤ 4, ≥ 44 px, ≥ 8 px apart; ride ✕ 48 × 48 px top-left with a 16 px inset, not colliding with any other control (flag F11) | Rects; touch script | STYLE §11 |
| M5-06 | Facts-mode routing | No redirect for Save-Data, no WebGL, a 3D crash or reduced motion: the requested route stays, with a one-line `/timetable` offer; the 3D control is hidden without WebGL (rulings 4 and 9); in every case there are no 3D requests before opt-in | Request log | TECH-PLAN §1, §3 |
| M5-07 | Main thread | INP ≤ 200 ms (p98 of scripted taps); while loading behind the board, no task over 100 ms while the visitor scrolls the first screen (**P**, flag F13) | Trace | TECH-PLAN §6.5 |
| M5-08 | Lighthouse | TECH-PLAN §6.4 thresholds green; CLS ≤ 0.01 on my bar | LHCI | TECH-PLAN §6.4 |
| M5-09 | First-visitor journeys, phone | J4 and J5 from §3 pass | Scripted | — |

### M6 · Ten discoveries and stamp card

| ID | Criterion | Threshold | Measured | Source |
|---|---|---|---|---|
| M6-01 | Trigger feedback | Each of the 10 works by tap and by Enter/Space, with an `aria-label` and ≥ 44 px; visible acknowledgement ≤ 100 ms after input (night portal: the glow **holds** until the pack decodes, flag F15) | Event Timing, video | STYLE §8 |
| M6-02 | Never blocks (B6) | During each running discovery, hop, Skip, switcher, ticket menu and Esc all work within ≤ 100 ms; nothing takes focus by itself | Script | CONTENT §7; STYLE rule 4 |
| M6-03 | Timings | Evening `t` 0 → 0.7 over 2.5 s easeInOutSine (curve **P**, by analogy with §8.1); night blend 2.5 s easeInOutSine, lap 83.3 ± 3 s; Hebrew swap 60 ms per sign; bell barriers 1.2 s down → **hold 3 s (P)** → 1.2 s up, lamps at 1 Hz only while down; chord 3 s; garden wagon 300 ms crossfade; plane 1.2 + 15.0 ± 0.5 + 1.6 ≈ 17.8 s; stamp 180 ms (scale 1.15 → 1.0, opacity 0 → 1) on the next card opening | Pose/animation log, video | STYLE §8, §8.1, §8.2, §8.3 |
| M6-04 | Reduced motion | End states as stills, entered and left with 200 ms crossfades (**P**, flag F8): bell down 4 s (**P**), night train lit at the portal 10 s, plane still **visible from the Workshop view** for 10 s (flag F14), wagon coupled, Hebrew set, stamp appears instantly | Pose log, video | STYLE §8 Rules, §8.1, §8.3 |
| M6-05 | Sound (B9) | Request log is clean until opt-in; then only the 58 KB pack; the soundtrack only from its chip, and the same chip stops it in 1 tap; Sound off stops everything within ≤ 100 ms (with a 150 ms fade, **P**); the board click sound plays at most once per row, not once per cell (**P**) | Request log, audio graph | TECH-PLAN §3; STYLE §8 |
| M6-06 | No auto-repeat | Nothing repeats on its own more than once per 10 s | 60 s idle capture | STYLE §8 Rules |
| M6-07 | Ride interplay | The night train never freezes a ride the visitor started for its 83 s; the portal is `aria-disabled` while riding, or the visitor can end the night run (flag F15) | Script | STYLE §8.1 |
| M6-08 | Stamp card | Opens and closes by keyboard; Esc closes it and focus returns to the ticket-menu trigger; slots ≥ 44 px, focusable; the only progress text is "Found x of 10" | Keyboard script, DOM grep | STYLE §8.2 |
| M6-09 | Pacing under load | Desktop pacing OK with the plane flying, the night train running and a hop all at once; the hop rail is at 190 mm during the flight | Trace, pose log | TECH-PLAN §2 plane |

### M7 · Hardening and v1

| ID | Criterion | Threshold | Measured | Source |
|---|---|---|---|---|
| M7-01 | Full regression | Every M1–M6 criterion on the production candidate at 1440, 390 and 360, with reduced motion on and off and JS off | All of §0 | M7 exit |
| M7-02 | Real devices | One iPhone and one Android, recorded: pacing, sheet gestures, switcher, one ride, Skip; VoiceOver and TalkBack reach Skip and the facts in ≤ 3 swipes | Recordings | M7 exit |
| M7-03 | Journeys | J1–J5 pass on production | Scripted | — |
| M7-04 | Base swap | With `SITE_BASE=/`, deep links, Back/Forward and Skip behave the same as under `/h0-layout/` | Route script on both builds | TECH-PLAN §9 |

---

## 3. First-time-visitor journeys (M4 on; all at M7)

| # | Journey | Pass |
|---|---|---|
| J1 | Hiring manager: land on `/`, then CV | ≤ 1 click; CV link visible at FCP |
| J2 | Land, then Skip, then read the stations on `/timetable` | `/timetable` h1 visible ≤ 2.5 s after the click; ≤ 1 click; ≤ 1 Tab + Enter by keyboard |
| J3 | Keyboard only: land → Enter the layout → visit all four stations → Kage diagram → back → Skip | No focus loss (`activeElement` ≠ body at any step); every step has visible focus; ≤ 30 key presses (**P**); no trap |
| J4 | Reduced motion on: the same as J3 on 390 with touch | 0 translation frames; the facts are identical |
| J5 | Phone touch: land → Enter the layout → switcher × 4 → sheet half/full → "Ride the train" one lap → ✕ | No gesture conflict; every target ≥ 44 px; ≤ 10 s from landing to the first station panel on 4G |

---

## 4. Spec flags (ranked)

| # | Sev | Where | Quote | Problem | Fix |
|---|---|---|---|---|---|
| F1 | **Blocker** (M3) | TECH-PLAN §4 Real bytes / Reduced motion; STYLE §6 Progress → flaps, Reduced motion | "Row *k* of the six content rows flips when `loaded/total ≥ k/6`" · "Reduced motion: no flips or cascade; each row's final text appears as its threshold passes" · TECH-PLAN §1: "Reduced motion … visitors … nothing 3D auto-loads for them" | This contradicts §4's own "First paint, already the facts". Read literally, the CV row (k=5) and CONTACT row (k=6) only appear once ~83–100% of the 4.91 MB (desktop) or 2.29 MB (phone) has arrived. On slow 4G that's well past 10 s. Under reduced motion nothing 3D loads, so **the rows never appear at all**. Blanking static HTML rows so they can flip in is also a visible regression after first paint. If thresholds pass together (cached visit), queued rows would take 6 × 1.44 = 8.6 s. | Content rows render final text at first paint and stay readable. Bytes drive **only the status row** (BOARDING → `DELAYED · n%` → ON TIME), plus an optional one-time cosmetic cascade per row that never blanks a readable cell and never starts before FCP (rulings 1 and 11). Rows flip concurrently, with ≥ 120 ms between row starts (**P**), and the board settles ≤ 2.0 s after the last threshold. Reduced motion: no cascade at all. |
| F2 | **Blocker** (M2) | TECH-PLAN §2 Station hop; STYLE §5, §1.1, §1 | "the camera eases along the track for 1.0 s … at 0.12 m above the rail" · "Campus ↔ City … through the tunnel … a quick dark blink" · "hill crest 110 mm above rail on the track line" · portals "63 mm high" · City shed "ridge 105 mm above rail" | A camera 120 mm above the rail is above the 63 mm portal, so it can't pass "through the tunnel". It skims the hill crest with 10 mm to spare, which breaks the "never < 12 mm above terrain" rule (TECH-PLAN §2 Orbit) and makes a close-up grass smear at mid-ease peak speed (≈ 840 mm/s). It arrives 15 mm above the City shed's glass ridge, looking at the roof rather than the Kage box. The rail pose also doesn't match the authored station views (0.45–0.6 m off-centre, 0.15–0.25 m up, STYLE §5), so each hop would need an unspecified jump at its start and end. | Campus ↔ City arcs over the hill, ≥12 mm clearance, no tunnel, no blink. Workshop ↔ Bootcamp (front straight) takes a direct path along the straight, ≥12 mm from scenery. Both 1.0 s cubic-bezier(0.65, 0, 0.35, 1). Only the train ride, chase or cab view, goes through the tunnel. |
| F3 | **High** (M2/M3) | TECH-PLAN §1 Boot, §2 Ride; STYLE §5 Riding; TECH-PLAN §3 Facts mode | "The layout is revealed by 'Ride the layout'" · "**Ride** (optional, 'Ride the layout' button)" · "Riding the loop: an optional view ('Ride the layout' / the Ride button)" · "Reduced-motion visitors who press 'Ride the layout' get station views as cuts" | The primary CTA means two things: enter the 3D view, and start the optional 41.7 s (+ 24 s of dwell) train ride. If it starts the ride, a first-time visitor's first click locks them into a 66 s loop, and hop-as-default (Settled 7) is undercut. Under reduced motion, "station views as cuts" implies auto-advancing cuts, so the camera moves on its own. | "Enter the layout" = reveal the 3D view, parked at the overview, with hops as navigation. A separate in-scene **"Ride the train"** control (48 px, next to the switcher) starts the train. Under reduced motion, "Ride the train" keeps the train parked, and station changes are 200 ms fades only on Next/Previous (no auto-advance). (Rulings 3 and 4.) |
| F4 | **High** (M3/M5) | TECH-PLAN §1 ("Reduced motion, Save-Data and no-WebGL visitors are pointed to `/timetable`"), §3 Facts mode, M5 exit; CONTENT §6 ("all land on `/timetable`"); STYLE header ("Reduced motion gets the facts version") **vs** TECH-PLAN §2/§3 and STYLE §5/§6/§8 (200 ms crossfades, board under reduced motion, plane on Platform 1), M3 shot `390-board-reduced-motion`, M6 shot `390-paper-plane-reduced-motion` | (as quoted) | The docs disagree on whether a reduced-motion visitor gets a redirect or a reduced 3D. A redirect from `/` or a deep link sends them away from the page they asked for, hides the board, and makes every reduced-motion 3D spec dead code. Reduced motion means "less motion", not "no 3D". | Under reduced motion, stay on the requested route: show the static board with final text, auto-load nothing 3D, and keep "Enter the layout" available (opt-in), giving 200 ms crossfades and stills. "Pointed to" means a visible "Facts" suggestion, never a redirect. Save-Data and no WebGL stay on the requested route with a one-line `/timetable` offer; the 3D control is hidden without WebGL (ruling 9). Fix the wording of CONTENT §6, TECH-PLAN §1/§3 and the M5 exit to match. |
| F5 | **High** (M1) | STYLE §6 Desktop / Stacked; TECH-PLAN §7 Accessibility | "row height 1.42em = 31.2 px" · "Row height is 2 × 1.42em = 42.6 px" · "Every content row is a link" · "Targets ≥44 × 44 px with ≥8 px gaps" | Every board row is a link below the project's own 44 px minimum (31.2 px on desktop, 42.6 px on phones), and the rows touch, with no 8 px gap. That fails M1-05 as written. | Desktop: a 44 px row pitch (31.2 px flap row + 12.8 px inter-row space), with the link's hit area covering the full 44 px row. Stacked: a 48 px pitch (42.6 + 5.4). Add a stated exception: contiguous full-width rows need no gap (WCAG 2.5.8 spacing is met). This adds 7 × 12.8 = 90 px of height on desktop and 7 × 5.4 = 38 px on phones, so the design reviewer should re-check the layout (it interacts with F7). |
| F6 | **High** (M2) | TECH-PLAN §2; STYLE §5, §7 | "Labels hide while moving and fade in over 150 ms" · "labels hide while the camera hops" | Labels are hop triggers. If the focused label is hidden with `display`/`visibility`, keyboard focus drops to `<body>` on every label-initiated hop. Nothing says where focus goes on arrival or how arrival is announced. | Hide labels with `opacity: 0` + `pointer-events: none` only, so they stay in the DOM. On arrival, focus moves to the arrival panel's heading (ruling 6), and one polite live message gives "<Station> · <years>". Focus never lands on `<body>` (M2-06). |
| F7 | **Medium** (M1) | STYLE §11 Arrival vs TECH-PLAN §7 Routes, CONTENT §1–2 | "Arrival: the split-flap board, full width, with stacked rows" · "`/` shows name, role … CV, LinkedIn, GitHub and email in the first viewport at 1440 and 390" | If the board comes first on phones, my estimate is ≈ 380 px of board (≈ 418 px after F5) plus a ≈ 590 px first-screen block, which is more than 844 px, so the contact links fall below the fold. The visual order is also unstated for desktop. | DOM and visual order: first-screen facts block → Enter the layout / Skip to the facts → board, at every width. Gate M1-01/02 at 360×780 too. |
| F8 | **Medium** (M2–M6) | TECH-PLAN §2 ("a 200 ms crossfade"), §3 Night ("`t` jumps with a 200 ms crossfade"); STYLE §3.1 ("`t` jumps with no blend (a 200 ms crossfade…)"), §8.1 ("the swap to night is instant"), §8 Rules ("with no blends"), §8 #3 ("cut under reduced motion"), §11 ("a cut under reduced motion"), §6 ("station views as cuts") | (as quoted) | There are five different reduced-motion rules for the same kind of change. "Instant" golden → night is a full-frame luminance step (L ≈ 0.2 → 0.05) twice in 10 s, which is harsher than a fade. There are also **missing reduced-motion fallbacks** for: the board's 500 ms slide-up, the Skip pulse, the portal's 600 ms glow pulse, the Kage close-up's 1.0 s ease, the sheet snaps, and orbit inertia. | One rule: under reduced motion, any **full-frame** change (camera, light state `t`, plane and night-train stills) is a **200 ms linear opacity crossfade**; any **small UI** change (flaps, sign swap, stamp, sheet snap) is instant; **0 translation, rotation or scale anywhere**. Then: board slide → a 200 ms fade; Skip and portal pulses → a colour or outline change only; Kage close-up → a 200 ms crossfade; orbit → no inertia. |
| F9 | **Medium** (M2/M4) | TECH-PLAN §2 Station hop, §2 Kage; STYLE §5 Kage close-up, §9 | "and non-neighbours: a 300 ms crossfade" (the overview isn't a station) · "The Kage close-up is a 1.0 s ease in from the City station view, then `/now/kage-diagram` opens over it" | (a) No transition is defined for overview ↔ station (35 → 50 mm, 1.25 m → 0.5 m), which is the most common first hop. (b) The close-up runs from a rooftop-height view (0.15–0.25 m) down to 40 mm above the platform beside a shed whose eaves are 75 mm, so the path can cut through the glass roof. It has no reduced-motion spec. "Opens over it" doesn't say whether it's an overlay or a page load (a cold reboot of the 3D on Back), or where focus goes. | (a) Overview ↔ station = a 300 ms crossfade (rule: anything that isn't a same-straight neighbour). (b) A 1.0 s ease along a path kept ≥ 12 mm from every mesh (enter from the open platform side, or fade the roof glazing to 0 over the first 300 ms); under reduced motion, a 200 ms crossfade. The diagram opens as a `pushState` overlay with focus on its kicker; Back/Esc restores the City view and puts focus on the sheet hotspot, with no reload (M4-03). |
| F10 | **Medium** (M2) | TECH-PLAN §2 ("Next/Previous (arrow keys) all hop"); CONTENT §3 | (as quoted) | Nothing says what happens to input during a 1 s hop (queue, ignore or retarget), and history behaviour mid-hop is undefined. Global arrow keys would hijack scroll in panels and sheets and clash with screen-reader navigation. | Input during a hop is queued and the last destination wins (ruling 7, M2-08). Arrows act only while focus is inside the layout region (switcher uses a roving tabindex), never in a scrollable panel. `pushState` only on final arrival. |
| F11 | **Medium** (M3/M5) | TECH-PLAN §4 Leaving; STYLE §6, §11 Train cam; TECH-PLAN §3 Facts mode | "stays reachable as the 'Timetable' button, top left" · "Exit is a 48 × 48 px ✕ top-left with 16 px inset" · "'Skip to the facts', always in the same corner" (corner unnamed) · ticket menu (location unnamed) | Three controls are given top-left, and two aren't placed at all. The "Timetable" button re-shows the board, while "/timetable" is the facts page that Skip goes to, so one word means two destinations. | Corner map (**P**): Skip to the facts **top-right** on every screen (rule 2); the "Departures" board button (renamed from "Timetable") top-left; ride ✕ top-left while riding (it replaces Departures, which comes back on exit); ticket menu bottom-right on desktop and in the phone header row. Check that none overlaps at 360. |
| F12 | **Medium** (M4) | STYLE §5/§7 and TECH-PLAN §2 (desktop panels aren't defined; only the phone sheet is, in STYLE §11) | TECH-PLAN §8 "station panels" | On desktop, the place where a station's facts appear in 3D, its size and its open/close motion are unspecified, so time-to-facts in the 3D path can't be gated. | A right-side panel, 400 px wide, opening on arrival together with the 150 ms label fade (opacity only); it never covers Skip or the current label; its heading is the next Tab stop (M4-06). *(Focus moves to the heading on arrival, per ruling 6.)* |
| F13 | **Medium** (M3/M5) | TECH-PLAN §1 Boot, §6.5, M5 exit | "3D requests start only after the `load` event, on idle" · "A `longtask` observer flags tasks over 200 ms … It only warns" · "interactive ≤5 s after opt-in" | The 4.91 MB / 2.29 MB background load (GLB parse, KTX2 uploads, `compileAsync`) runs on the main thread while the visitor reads, scrolls and taps board rows. A warn-only 200 ms bar allows visible scroll and tap jank, and it's 4× the 50 ms long-task line. The M5 exit's "after opt-in" contradicts the idle preload on phones. | Gate: no task over 100 ms while the board is visible (desktop and phone), INP ≤ 200 ms, texture uploads spread at ≤ 1 per frame. On phones the 3D loads only on opt-in, never on idle, and the 5 s budget is timed from the tap. Save-Data doesn't change that, because nothing loads until the tap. *(Settled by ruling 10.)* |
| F14 | **Medium** (M6) | TECH-PLAN §2 plane Reduced motion; STYLE §8.3 | "shows the plane **resting on Platform 1** (Bootcamp, platform centre x 1310) for **10 s**" | The visitor clicks the plane from the Workshop station view (x 860). A 50 mm lens at ~0.5 m frames about x 670–1050, so x 1310 is out of frame. A reduced-motion visitor sees the plane vanish and nothing happen for 10 s. | Rest it somewhere visible in the Workshop view, such as the Workshop halt platform at x ≈ 960 or the goods-shed roof, for 10 s, then a 200 ms crossfade back to the bench. Or crossfade the camera to Bootcamp only if the visitor asked for it (not recommended). |
| F15 | **Low–Med** (M6) | STYLE §8.1 Response 1, 5, 7 | "a 2700 K glow pulse (one, 600 ms) as feedback while it decodes" · "The railbus holds at its current platform (or the next one, if it's riding)" | The 449 KB night pack decodes in ~2–3 s on 4G, but feedback ends at 600 ms, which invites repeat clicks. A visitor's own ride is frozen for ~88 s (2.5 + 83.3 + 2.5) with no way to end the night run. | The glow holds steady (`aria-busy`) until the blend starts, and repeat clicks are ignored. The portal is `aria-disabled` while riding (or the ride ends first). An "End night run" chip, or Esc, blends back over 1.0 s. |
| F16 | **Low** (M3) | TECH-PLAN §4 Status | "`ON TIME` … only when every byte is in **and** `renderer.compileAsync` has resolved … Then 'Ride the layout' enables" | The primary CTA stays dead for the whole load, and "compile up to about 65 s" on software GL is in the plan's header. A disabled `<button>` also drops out of the Tab order. | `aria-disabled` with a visible state ("Boarding · 42%"). A press on "Enter the layout" during loading records intent and enters on `ready` (the visitor asked for it), and Esc cancels. |
| F17 | **Low** | TECH-PLAN §2 / STYLE §5 crossfades; TECH-PLAN §4 / STYLE §6 "slides the board up over 500 ms (ease-out)"; STYLE §8 #2 Evening "over 2.5 s"; STYLE §11 sheet; STYLE §7 label fade | (curves not given) | Only the hop (easeInOutCubic) and the night blend (easeInOutSine) name a curve. | Crossfades: linear. Board slide: `cubic-bezier(0.22, 1, 0.36, 1)`. Evening and real-sky blends: easeInOutSine `cubic-bezier(0.37, 0, 0.63, 1)`. Sheet snaps: 280 ms `cubic-bezier(0.2, 0, 0, 1)`. Label fade-in: 150 ms ease-out. |
| F18 | **Low** (M6) | STYLE §8 #4 Chord bell, §8 Rules | "barriers lower over 1.2 s, lamps alternate at 1 Hz, then the barriers rise" · reduced motion: "barriers down" | The hold time and the rise time aren't given, and the reduced-motion still has no duration, so it could stay down forever. | 1.2 s down → 3 s hold → 1.2 s up (5.4 s), with lamps flashing only while down. Reduced motion: barriers down for 4 s, then up, with 200 ms crossfades. |
| F19 | **Low** (M5) | STYLE §11 Station switcher | "each ≥ 72 × 44 px … 'Labels: 2021 Bootcamp', '2022–26 Campus' … 14 px" | Measured with PIL on the box (Barlow Semi Condensed Medium 14 px): "2022–26 Campus" is **93.5 px** and "2021 Bootcamp" **83.6 px**. Even equal flex buttons at (358 − 24)/4 = 83.5 px force a wrap, so the labels wrap unevenly. | A two-line label (year / name) in 4 equal 83.5 × 48 px buttons, or shorten the labels to "Bootcamp / Campus / City / Workshop" with the year as a 12 px second line. This is the design reviewer's call on the look. |
| F20 | **Low** (M2) | TECH-PLAN §11 M2 exit; STYLE §5 | "An adjacent hop takes 1.0 ± 0.05 s and a far hop is a 300 ± 30 ms crossfade" · "Heading change is 0°" | Bootcamp ↔ Campus are adjacent but get a crossfade, so the exit wording misclassifies them. The 0° heading only holds from authored poses: after a ±30° orbit, easeInOutCubic's peak (1.5× the average) gives exactly 45°/s, right at the cap. | Exit wording: "same-straight neighbour" and "every other hop". Un-orbit to the authored pose inside the 1.0 s (M2-01), or cap the orbit offset carried into a hop at ±25°. |
| F21 | **Low** (process) | TECH-PLAN §11 Gates | "Every milestone ends in four written gates … design reviewer → QA → hiring-rules reviewer → Roi's explicit approval" · gate is `design`, `qa`, `hiring` or `roi` | The UX reviewer's gate (private gate table row 2, record name `ux`) isn't in the plan, and the private gate table says `owner` where the plan says `roi`. | Five gates: design → UX → QA → hiring rules → owner. Add `ux` to the record-name list and make the last gate's name match. |
| F22 | **Low** | TECH-PLAN §7 Accessibility vs STYLE §12 Phone | "Targets ≥44 × 44 px with ≥8 px gaps" · "(stamp grid excepted at 360: 4 px)" | The exception exists only in the style guide. | Mirror the stamp-grid exception, and F5's contiguous-row exception, in TECH-PLAN §7. |
| F23 | **Low** (M6) | TECH-PLAN §3 Audio; STYLE §8 | "The soundtrack loop starts only from its own 'Soft soundtrack' chip" · "Optional board click sound" | No stop affordance is named (WCAG 1.4.2 needs one for audio over 3 s), and a per-cell click on a 51-cell cascade would chatter. | The chip toggles "Soundtrack on/off"; Sound off stops everything with a 150 ms fade; the board clicks at most once per row. |
| F24 | **Low** (M6) | STYLE §7 HTML labels; §8 #3 | "anchored to the station's sign post" · Hebrew trigger: "click a sign" | The navigation chip and the Hebrew-signs hotspot sit on the same post. A tap meant for navigation or reading may flip every sign to Hebrew. | Keep ≥ 8 px between the chip's hit area and the sign hotspot; make the sign hotspot live only in that station's own view, not at the overview. |
| F25 | **Low** (M5) | STYLE §11; §6 | (only 390×844 portrait, 360×780, and the 883 / 1164 px board breakpoints are specified) | Phone landscape (844×390) and tablets (768–1163) have no 3D overview, sheet or switcher spec. | Under 883 px wide, or under 500 px tall, use the phone tier and layout. Add 844×390 to the M5 spot checks. |

**Cross-gate notes (not mine to gate):**
- Hiring-rule 1 and the TECH-PLAN §7 test expect the word **"portfolio"** on `/`, but the CONTENT §1 first-screen copy doesn't contain it. That's for the hiring-rules reviewer and the content writer.
- STYLE's header still names CONTENT **v3.8** as the source of truth, while CONTENT is v4.0. That's for the design reviewer and the director.

---

## 5. Headline numbers per milestone

| Milestone | Headline numbers |
|---|---|
| M1 | Facts in the first viewport at 1440, 390 and 360 by FCP ≤ 1.5 s; Skip = Tab 1 on all 13 routes; targets ≥ 44 px with ≥ 8 px gaps (board rows fail as specified, F5); CLS 0.000 with fonts delayed; 0 animations; the no-JS render matches |
| M2 | Ease hop 1.0 ± 0.05 s `cubic-bezier(.65,0,.35,1)`; crossfade 300 ± 30 ms; reduced motion 200 ± 20 ms with 0 translation; ≤ 45°/s, roll 0; ≥ 12 mm clearance on every frame; labels back in 150 ms, DOF 250 ms; 0 focus losses; desktop p95 ≤ 18.2 ms, no frame over 50 ms |
| M3 | Rows readable at FCP; flip 60 ms, cell ≤ 420 ms, row ≤ 1.44 / 1.28 s, board ≤ 2.0 s; DELAYED at 8.0 ± 0.25 s; slide 500 ± 30 ms (reduced motion: 200 ms fade); no task over 50 ms during a cascade |
| M4 | M2 numbers on full art; Kage close-up 1.0 s with no clipping; panel readable ≤ 1.3 s after a hop; label shimmer ≤ 1 px |
| M5 | Phone median ≥ 30 fps, p95 ≤ 40 ms; interactive ≤ 5 s after opt-in; INP ≤ 200 ms; sheet snaps 280 ms; half sheet ≤ 40%; no task over 100 ms while reading |
| M6 | Feedback ≤ 100 ms; the 10 discoveries never block (hop and Skip ≤ 100 ms mid-discovery); plane 17.8 s; night 2.5 + 83.3 + 2.5 s; 0 audio before opt-in; reduced-motion stills visible in frame |
| M7 | Full regression; journeys J1–J5; 2 real devices; ≤ 3 screen-reader swipes to the facts |

## Director rulings (2026-10-19), adopted; gate against these
1. Board rows are static HTML at first paint, independent of the 3D; under reduced motion they appear instantly with no flip. The flap cascade is optional and runs at most once per visit, after first paint; it never blanks a readable cell, and it is skipped entirely under reduced motion.
2. The hop camera never enters the tunnel: it arcs over the hill with at least 12 mm clearance. Only the train ride, chase or cab view, goes through the tunnel.
3. Labels: "Enter the layout" turns on 3D; "Ride the train" starts the 66 s ride.
4. One reduced-motion rule: 3D stays, hops become a 200 ms fade, and every animation gets the proposed fallback. /timetable is always offered, never forced.
5. Board-row hit areas are at least 44 px, gated at M1.
6. After a hop, focus moves to the arrival panel's heading; labels fade but stay in the DOM.
7. Input during a hop is queued, and only the last destination is kept.
8. The medium-severity fixes are adopted as written above. The engineer is writing all of this into the specs.
9. Save-Data or no WebGL: no redirect. The requested route shows its full HTML with a one-line `/timetable` offer; without WebGL the 3D control is hidden.
10. Phones load 3D only after the tap, with no idle preload; the M5 "≤ 5 s" is timed from that tap.
11. The flap cascade is cosmetic: optional, one-time, after first paint, never blanks a readable cell, and skipped entirely under reduced motion.

Where a criterion conflicts with a ruling, the ruling wins, and the criterion is read as amended.
Values marked P are adopted as gate thresholds.
