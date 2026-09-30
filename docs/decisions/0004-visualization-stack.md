# ADR 0004: Visualization stack

- **Status:** Accepted, 2026-09-30
- **Deciders:** Claude, per the approved plan (docs/PLAN.md §3.2)

## Context
The walkthrough must be seekable, replayable at several speeds, steppable for reduced motion, and fully
accessible, while looking like a "digital-rain terminal" inspired by *The Matrix*. Animations that run on
their own clocks (fire-and-forget) can't be scrubbed or replayed exactly.

## Decision
- **Primary:** SVG + HTML/CSS, rendered as pure functions of `(step, progress)` supplied by our own playback
  clock. Within-step progress reaches views as the CSS variable `--p` or through a ref, so React commits once
  per step, not per frame.
- **Geometry:** `d3-scale`, `d3-shape`, `d3-interpolate` (small, DOM-free modules).
- **Canvas 2D:** only where density demands it: the token rain (decorative, ≤30 fps), the compressed
  vocabulary strip, and heatmaps of long contexts. Each has a text alternative or is `aria-hidden`.
- **Motion (`motion/react`):** only for UI chrome outside the walkthrough timeline (drawers, panels).
- **Not used:** GSAP (duplicates our clock), PixiJS (not needed at our element counts).
- **3D:** Three.js + React Three Fiber with WebGLRenderer, post-MVP only, lazy-loaded on demand, and never
  the only way to understand anything (WebGPURenderer is still experimental; `@react-three/a11y` is
  unmaintained).

## Consequences
- We build and test a small clock and state machine (docs/PLAN.md §3.5) instead of adopting a timeline library.
- Reduced motion is cheap: step mode sets `--p = 1` and never starts the frame loop.
- Visual tests can snapshot any `(scene, step, progress)` deterministically.

## Sources (checked 2026-09-29)
- Three.js WebGPURenderer status: https://threejs.org/manual/#en/webgpurenderer
- Motion reduced-motion support: https://motion.dev/docs/react-accessibility
- d3-shape: https://d3js.org/d3-shape
