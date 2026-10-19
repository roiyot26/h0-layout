# Gate records

One file per gate: `M<n>-<gate>-<sha7>.md`. Screenshots for a milestone live in
`M<n>/shots/<width>-<name>.png`.

From M1 on, every milestone passes five gates in this order:

1. `design`: design reviewer
2. `ux`: UX reviewer
3. `qa`: QA (acceptance)
4. `hiring`: hiring-rules reviewer
5. `owner`: the owner's approval

M0 used the earlier four-gate order (design, QA, hiring rules, owner); its owner
record is `M0-owner-approval-6b53ca6.md`.

```
Milestone: M0 Repo, pipeline, guards
Gate: <role>                    Result: PASS | FAIL | PASS WITH FIXES
Date: YYYY-MM-DD (Asia/Jerusalem)   SHA: <sha7>
Preview: <url>     Screenshots: docs/gates/M0/shots/
Findings: numbered, each with severity and the exact check that failed
Fixes required before the next gate: (PASS WITH FIXES only)
```

A gate fix lands as a small PR; a gate reruns only if the fix touches its area, otherwise the gate that raised it checks just the fix.

Records name roles, never people.
