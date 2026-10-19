# H0 build contract (UX rulings)

The rulings below are the contract that M1 and later milestones build against. They
were adopted by the director on 2026-10-19 after the UX reviewer's checklist
(`docs/gates/UX-GATE-CHECKLIST.md`). Where the tech plan or the style guide says
something different, this file wins, and the conflicts are listed at the end with how
they were resolved. Roles only.

**Gates, per milestone, from M1 on:** design → UX → QA → hiring rules → owner.
Records: `docs/gates/M<n>-<gate>-<sha7>.md`, with `ux` for the UX gate.

**Ownership:** From M2 the second engineer owns the three.js world and its triangle and draw-call budget; the first engineer owns the repo, CI, the static site and merges.

## Rulings

1. **Board rows are static HTML at first paint.** Every content row (four stations,
   CV, CONTACT) is in the HTML with its final text and works as a link before any
   JS or 3D. The rows never wait for bytes: download progress drives only the status
   row (BOARDING → `DELAYED · n%` → ON TIME). A flap cascade is cosmetic, starts no
   earlier than first paint and never blanks a readable cell. Under reduced motion
   the rows appear instantly with no flip.
2. **The hop camera never enters the tunnel.** On the Campus ↔ City hop it arcs over
   the tunnel hill, keeping at least 12 mm from every mesh on every frame. Only the
   cab-view ride goes through the tunnel.
3. **Labels.** "Enter the layout" turns on the 3D view (parked, hops as navigation).
   "Ride the train" starts the optional ride: one lap of 41.7 s plus 4 × 6 s dwell,
   about 66 s.
4. **One reduced-motion rule.** The 3D stays available; hops become a 200 ms fade;
   every animation has a reduced-motion fallback (see medium fix F8 below).
   `/timetable` is always offered, never forced: no visitor is redirected away from
   the route they asked for.
5. **Board-row hit areas are at least 44 px** tall, gated at M1.
6. **Focus after a hop** moves to the arrival panel's heading. Labels fade (opacity
   and `pointer-events: none`) but stay in the DOM, so focus is never lost to `<body>`.
7. **Input during a hop is queued, and the last destination wins.** The hop in
   progress finishes; then the camera goes to the most recently requested station.
   Earlier queued requests are dropped.
8. **The checklist's medium fixes are adopted exactly as written:**

| # | Fix (as written in the checklist) |
|---|---|
| F7 | DOM and visual order: first-screen facts block → Ride/Skip → board, at every width. Gate M1-01/02 at 360×780 too. |
| F8 | One rule: under reduced motion, any **full-frame** change (camera, light state `t`, plane and night-train stills) is a **200 ms linear opacity crossfade**; any **small UI** change (flaps, sign swap, stamp, sheet snap) is instant; **0 translation, rotation or scale anywhere**. Then: board slide → a 200 ms fade; Skip and portal pulses → a colour or outline change only; Kage close-up → a 200 ms crossfade; orbit → no inertia. |
| F9 | (a) Overview ↔ station = a 300 ms crossfade (rule: anything that isn't a same-straight neighbour). (b) A 1.0 s ease along a path kept ≥ 12 mm from every mesh (enter from the open platform side, or fade the roof glazing to 0 over the first 300 ms); under reduced motion, a 200 ms crossfade. The diagram opens as a `pushState` overlay with focus on its kicker; Back/Esc restores the City view and puts focus on the sheet hotspot, with no reload (M4-03). |
| F10 | Retarget, never queue (M2-08). Arrows act only while focus is inside the layout region (switcher uses a roving tabindex), never in a scrollable panel. `pushState` only on final arrival. *(The first sentence is superseded by ruling 7; the rest stands.)* |
| F11 | Corner map (**P**): Skip to the facts **top-right** on every screen (rule 2); the "Departures" board button (renamed from "Timetable") top-left; ride ✕ top-left while riding (it replaces Departures, which comes back on exit); ticket menu bottom-right on desktop and in the phone header row. Check that none overlaps at 360. |
| F12 | A right-side panel, 400 px wide, opening on arrival together with the 150 ms label fade (opacity only); it never covers Skip or the current label; its heading is the next Tab stop (M4-06). *(Focus moves to the heading on arrival, per ruling 6.)* |
| F13 | Gate: no task over 100 ms while the board is visible (desktop and phone), INP ≤ 200 ms, texture uploads spread at ≤ 1 per frame. State explicitly whether phones preload on idle (and whether Save-Data opts out) or load on opt-in, and measure the M5 "≤ 5 s" from the tap under that rule. |
| F14 | Rest it somewhere visible in the Workshop view, such as the Workshop halt platform at x ≈ 960 or the goods-shed roof, for 10 s, then a 200 ms crossfade back to the bench. Or crossfade the camera to Bootcamp only if the visitor asked for it (not recommended). |

## Conflicts and how they were resolved

| Conflict | Resolution |
|---|---|
| Plan §2 / style §5: the Campus ↔ City hop rides 0.12 m above the rail "through the tunnel" as a dark blink. Checklist F2 proposes a straight translation in front of the hill. | Ruling 2: the hop arcs over the hill with ≥ 12 mm clearance and never enters the tunnel. 1.0 s, easeInOutCubic, as before. The tunnel blink is removed. |
| Plan §4 / style §6: row *k* flips in at *k*/6 of the bytes; under reduced motion each row appears as its threshold passes. | Ruling 1: rows are static and final at first paint; bytes drive the status row only. |
| Plan §1 / style §5–6: one button, "Ride the layout", both reveals the 3D and starts the ride. | Ruling 3: "Enter the layout" (3D) and "Ride the train" (the ride) are separate controls. |
| Plan §1 / §3 and the style header: reduced-motion visitors are "pointed to" or get "the facts version" at `/timetable`; elsewhere reduced motion gets crossfades and stills in 3D. | Ruling 4: no redirect. Reduced motion stays on the requested route with 3D available and 200 ms fades. Nothing 3D auto-loads under reduced motion (plan §1, kept); "Enter the layout" is the opt-in. Save-Data and no-WebGL also stay on the route (every route is a full HTML page) with a one-line `/timetable` offer; without WebGL the 3D control is hidden. |
| Style §6: desktop row height 31.2 px, stacked 42.6 px, rows are links; plan §7 needs ≥ 44 px targets. | Ruling 5: each row's link hit area is ≥ 44 px (checklist F5: a 44 px desktop pitch, 48 px stacked). Contiguous full-width rows need no 8 px gap. |
| Checklist F6 / F12 / M2-06: the initiating control keeps focus and the panel heading is the next Tab stop. | Ruling 6: focus moves to the arrival panel's heading. Labels still hide by opacity only. |
| Checklist F10 / M2-08: retarget mid-hop, never queue. | Ruling 7: queue, last destination wins. The other parts of F10 stand. |
| Style §8.3: under reduced motion the paper plane rests on Platform 1 (x 1310), out of frame from the Workshop view. | F14: it rests somewhere visible in the Workshop view for 10 s. |
| Style §3.1 / §8.1: the night swap is "instant" or "jumps" under reduced motion. | F8: full-frame changes are a 200 ms linear crossfade. |
| Style §5–6: the board stays reachable as the "Timetable" button, top left. | F11: renamed "Departures"; Skip is top-right. |
| Style §11: the phone arrival is the board first. | F7: facts block → Ride/Skip → board at every width. |

## Watch list for M1

- `npm audit` has 3 high advisories in the braces/micromatch chain under the glTF
  Transform CLI. It's a dev dependency that runs only in CI on our own GLB files and
  never ships. There's no fixed version yet; the owner accepted this as a dev-only
  risk. Re-check at each milestone gate and bump as soon as a fix is released.
