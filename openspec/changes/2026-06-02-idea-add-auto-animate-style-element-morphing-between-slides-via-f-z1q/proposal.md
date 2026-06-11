## Why

The presentation player at `app/player/page.tsx` renders slides statically — navigating between slides swaps DOM with no continuity. reveal.js's signature "Auto-Animate" effect smoothly morphs shared elements (titles, bullets, code blocks) that persist across consecutive slides, making transitions feel polished and intentional.

We already render slides from typed schemas (`core/schemas/types.ts`) through the rendering adapter (`core/rendering/adapter.ts`). By assigning stable element ids to slide content and diffing consecutive slides by those ids, we can capture the layout state of shared elements and use GSAP's Flip plugin (`Flip.from()`) to animate position/size/style deltas on each navigation. This is a high-impact, low-effort polish layer that reuses the existing React/Next player and adds a single dependency (`gsap`).

## What Changes

- Add `gsap` dependency and register its `Flip` plugin in a new client-only module `lib/animation/flip.ts`.
- Extend `core/schemas/types.ts` so slide content blocks carry an optional stable `animKey` (string) used to match elements across consecutive slides.
- Add `core/rendering/morph.ts` — pure functions that diff two slide schemas by `animKey` and produce a list of shared element keys to capture/animate.
- Update `core/rendering/adapter.ts` (and the React components it produces) to stamp `data-flip-id` attributes on rendered blocks that have an `animKey`.
- Add a new client hook `hooks/use-auto-animate.ts` that, on slide index change, captures Flip state of matched elements before unmount and runs `Flip.from()` after the new slide mounts.
- Wire the hook into `app/player/page.tsx` behind a per-presentation `autoAnimate` toggle (default on, honors `prefers-reduced-motion`).
- Unit tests for the diff logic and id-stamping; docs in `DESIGN_REVIEW.md`.

## Impact

- Affected specs: new capability `slide-morph-animation`.
- Affected code: `package.json`, `core/schemas/types.ts`, `core/rendering/adapter.ts`, new `core/rendering/morph.ts`, new `lib/animation/flip.ts`, new `hooks/use-auto-animate.ts`, `app/player/page.tsx`.
- New runtime dependency: `gsap` (~zero peer deps, MIT/standard GSAP license — Flip is free).
- Backward compatible: slides without `animKey` simply do not morph (fall back to current behavior).

## Inspired by

- https://github.com/greensock/GSAP
- https://github.com/hakimel/reveal.js

## Decision

- [ ] **Adopt** — proceed with `tasks.md`
- [ ] **Defer** / **Reject**

_novelty 3/5 · effort 2/5 · promoted from a Project Steward idea you approved._
