# Performance Contract Schema

Every gauntlet project has a standing Performance lane that must report every round -- it
gates every other lane's verdicts (a round with stale, missing, or failing performance
evidence still gets its other lane verdicts recorded, but flagged `void: true`). This
document defines the shape that report takes for a project that doesn't render frames --
no browser-canvas/browser-webgpu starter harness applies here. You build the harness;
this document defines only the shape it must fill.

## What to measure

Pick the metric(s) that actually matter for this project's goal -- don't default to
"make everything faster" without a stated budget. Typical choices by project type:

- **cli** -- wall-clock time for the primary command(s), invocation to exit.
- **backend-service** -- request latency (p50/p95/p99) under a defined load, and memory
  growth over a sustained run.
- **library** -- time and memory for the operations the goal actually exercises -- a hot
  path, not the whole test suite.

Whatever you pick, write the budget down as a human-editable tuning constant, the same
way a feel spec keeps its numbers human-owned. Do not silently loosen a budget that's
failing -- that's the builder cheating the bar.

## The report shape

Every round's `performanceGate` block in that generation's record
(`.gauntlet/progress/generations/gen-NNNN.json`) needs:

```json
{
  "performanceGate": {
    "evaluated": true,
    "pass": true,
    "evidence": ["path/to/this-rounds/perf-report.json"],
    "reason": "required when pass is false"
  }
}
```

`evidence` must point at a real file this round produced -- a JSON report, a log,
whatever your harness writes -- containing the actual measured numbers and the budget
they were checked against. A `performanceGate` with no evidence citation, or
`evaluated: false`, means this round's other lane verdicts get recorded with
`void: true` -- the harness must run, and it must run every round, not just when
something feels slow.

## Environment signature

Record whatever makes a measurement meaningful to compare across rounds -- hardware
class, runtime version, load parameters, whatever varies enough to matter for this
project. Include it in the evidence file. A number without its environment isn't
comparable to the next round's number.
