# Anti-Slop Linter for SlideSpecs

## Why

Claude-generated SlideSpecs in this repo (see `lib/generation/deck.ts`, `lib/generation/single-draft.ts`) routinely smuggle in telltale "AI slop" patterns: Inter-everywhere typography, purple/indigo gradient backgrounds, em-dash overuse in headlines, marketing buzzwords ("unleash", "seamlessly", "revolutionize"), and nested card-in-card layouts. Today `lib/generation/fidelity.ts` only scores visual/structural fidelity against source documents — it has no signal for these stylistic anti-patterns, so they survive into render and read as obviously machine-made.

Inspired by [pbakaus/impeccable](https://github.com/pbakaus/impeccable), we can wrap a small set of deterministic anti-pattern rules as a fast (~4ms/slide) static-analysis pass over the JSON `SlideSpec`, then (a) feed violations back into the generation loop as a self-critique repair turn alongside the existing `lib/generation/repair.ts` step, and (b) surface a visible "slop score" badge in `components/fidelity/`.

## What Changes

- Add a new `core/validation/antislop/` module with pure-function rules operating on `SlideSpec` / `Presentation` JSON (no DOM, no jsdom).
- Each rule returns structured `SlopViolation { ruleId, severity, slideId, blockIndex?, message, suggestion }`. Aggregate into a `SlopReport { score: 0..100, violations: [] }` per slide and per deck.
- Wire the linter into `core/validation/index.ts` so it runs after schema validation and before fidelity scoring in `lib/generation/deck.ts` and `lib/generation/single-draft.ts`.
- Add a self-critique repair turn: when deck-level slop score < threshold (default 70), pass violations + offending slide JSON back to Claude via a new prompt in `lib/generation/prompts.ts` and re-draft only the failing slides (re-using the `repair.ts` machinery).
- Surface results in the UI: new `components/fidelity/slop-badge.tsx` rendered alongside the existing fidelity preview, with a hover tooltip listing top violations.
- Expose the linter via `app/api/validate/` (extend existing route) so the workspace can re-run it on demand after manual edits.
- Add unit tests covering each rule + a perf assertion (<10ms per slide on a 20-block fixture).

## Impact

- **Affected specs:** new `antislop-linting` capability.
- **Affected code:**
  - new: `core/validation/antislop/{index.ts,rules/*.ts,types.ts,score.ts}`
  - modified: `core/validation/index.ts`, `lib/generation/deck.ts`, `lib/generation/single-draft.ts`, `lib/generation/prompts.ts`, `lib/generation/repair.ts`, `app/api/validate/route.ts`
  - new UI: `components/fidelity/slop-badge.tsx`, integration in `components/fidelity/pdf-preview.tsx` and workspace slide cards
  - tests: `core/validation/antislop/*.test.ts` run by `scripts/run-unit-tests.cjs`
- **No new runtime deps.** Rules are plain TS over the typed `SlideSpec` from `core/schemas/types.ts`.
- **Back-compat:** linter is additive; if `ANTISLOP_DISABLED=1` env is set, generation behaves as today.

## Inspired by

- https://github.com/pbakaus/impeccable

## Decision

- [ ] **Adopt** — proceed with `tasks.md`
- [ ] **Defer** / **Reject**

_novelty 5/5 · effort 2/5 · promoted from a Project Steward idea you approved._
