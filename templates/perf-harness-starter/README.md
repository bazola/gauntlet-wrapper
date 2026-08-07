# Performance harness starter

Scaffolded by gauntlet-wrapper into `harness/` for browser-canvas / browser-webgpu
projects. This is a **primitives layer**, not a finished measurement -- it gets you a
working GPU hardware gate, honest (non-vsync-paced) frame-time sampling, a heap-growth
check, and a report writer that matches the `.gauntlet/` performance contract. It does
**not** know anything about this specific project's scenes, content, or stress
scenarios.

## What's here

- `harness/gpu-gate.ts` -- verifies headless Chromium gets a real hardware WebGPU
  adapter, not a software fallback (SwiftShader/llvmpipe). Every perf run calls this
  first and voids the whole run if it fails -- a number captured on the wrong hardware
  isn't a number.
- `harness/perf-lib.ts` -- reusable primitives: frame-time statistics/histogram (pure
  functions), CDP heap/GC helpers, the browser launch-arg recipe, and
  `sampleFrameTimes(page, durationMs)` -- a generic `requestAnimationFrame` sampler that
  works against any page without needing the app to expose special hooks.
- `harness/run-perf.ts` -- the CLI entry point. Reads `harness/perf.config.json`,
  navigates to the configured URL, samples frames + heap growth, checks against budgets,
  writes a timestamped report to `harness/perf-out/`.
- `harness/perf.config.example.json` -- copy to `harness/perf.config.json` and edit the
  URL and budgets for this project. The budget numbers are yours to own and tune, the
  same way a feel spec's tuning constants are human-owned, never the agent's to loosen
  quietly.

## Wiring it in

1. Copy `harness/perf.config.example.json` to `harness/perf.config.json`, point `url` at
   wherever this project's **built** artifact is served (not the dev server -- HMR
   reloads mid-measurement invalidate a run), and set real budgets.
2. Merge `package.json.snippet.json`'s `devDependencies`/`scripts` into this project's
   own `package.json`.
3. `npm install && npm run build && npm run preview` (or however this project serves its
   build), then in another terminal `npm run perf`.
4. The report's top-level `performanceGate` block (`evaluated`, `pass`, `evidence`,
   `reason`) is exactly the shape a `.gauntlet/progress/generations/gen-NNNN.json` record
   expects -- cite `harness/perf-out/report-<timestamp>.json` directly as evidence.

## Extending it for a real scenario

A generic rAF sampler measures whatever happens to be on screen for the sampled window.
If this project needs a specific, repeatable, worst-case scenario (max entity count, a
specific screen, scripted input), build that on top of `perf-lib.ts`'s primitives the
same way a hand-built stress-scene check would -- inject the scenario setup via
`page.evaluate()` before sampling, the rest of the pipeline (frame stats, heap trace,
report shape) stays the same.
