# GSAP-driven timeline track in app/player/ with per-slide reveal DSL in schemas

## Why

Your player is React/Next with Radix primitives but presentations are currently static reveals. Add a `timeline: [{at, target, tween}]` field to core/schemas/, then drive it with GSAP + @gsap/react's useGSAP hook for sequenced bullet reveals, KaTeX-block fade-ins, and ScrollTrigger-backed scrubbing during preview. Generation side (lib/generation/) can have Claude emit timeline arrays alongside slide content, turning your deck output into something closer to a Keynote Magic Move without leaving the existing schema-validated pipeline.

## Inspired by

- https://github.com/greensock/GSAP


## Decision

- [ ] **Adopt** — proceed with `tasks.md`
- [ ] **Defer** / **Reject**

_novelty 4/5 · effort 2/5 · promoted from a Project Steward idea you approved._
