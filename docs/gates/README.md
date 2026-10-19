# Gate records

One file per gate: `M<n>-<gate>-<sha7>.md`, where gate is `design`, `qa`, `hiring` or
`roi`. Screenshots for a milestone live in `M<n>/shots/<width>-<name>.png`.

```
Milestone: M0 Repo, pipeline, guards
Gate: <role>                    Result: PASS | FAIL | PASS WITH FIXES
Date: YYYY-MM-DD (Asia/Jerusalem)   SHA: <sha7>
Preview: <url>     Screenshots: docs/gates/M0/shots/
Findings: numbered, each with severity and the exact check that failed
Fixes required before the next gate: (PASS WITH FIXES only)
```

Records name roles, never people.
