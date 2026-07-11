# Change: Run Impeccable detect on player-rendered slide HTML

## Why

`DESIGN.md` and the existing `core/validation/antislop/` checks operate on **SlideSpec / token-level structure**, not on the **player-rendered DOM**. Gradient text, two-axis grid backgrounds, low-contrast type, and other visual slop patterns only appear after `components/player/slide-view.tsx` (via `core/rendering/adapter.ts`) turns blocks into HTML/CSS. Generators and importers can therefore ship decks that pass structural validation but still look sloppy in the player.

[Impeccable](https://github.com/pbakaus/impeccable) provides a **deterministic ~46-rule detector** with **zero LLM cost**. Running it on a snapshot of each slide's player DOM after generation or import catches those post-render failures and maps each finding back to a `contentBlocks[i]` path so `lib/generation/repair.ts` (or a constrained re-prompt) can fix only the offending blocks.

## What Changes

- Add a server-side (or Node-testable) pipeline that renders a slide's player HTML into a **jsdom** document (reusing the existing `jsdom` dependency; optional HTML path via `modern-screenshot` only where layout metrics need a real paint path).
- Vendor or thin-wrap Impeccable's **detect** rule set (deterministic CSS/DOM heuristics) under `core/validation/impeccable/` so unit tests do not depend on network or an LLM.
- Map each rule finding to a **SlideSpec contentBlock path** (e.g. `slides[2].contentBlocks[1]`) using `data-block-index` / `data-anim-key` attributes emitted by the player adapter.
- Expose results through existing fidelity/antislop surfaces: extend `components/fidelity/slop-badge.tsx` consumers and the generation validate/repair path (`lib/generation/validate.ts`, `lib/generation/repair.ts`, `app/api/validate/`).
- Wire detect into post-generation and post-import hooks so findings can drive **block-scoped re-prompt** rather than full-deck regeneration.

## Capabilities

### New Capabilities
- `impeccable-detect`: Deterministic visual-slop detection on player-rendered slide HTML, with finding → contentBlock path mapping and integration into validate/repair.

### Modified Capabilities
- None (no existing OpenSpec capability documents this path yet; antislop remains structural and is complementary).

## Impact

- **Rendering**: `core/rendering/adapter.ts` / `components/player/slide-view.tsx` must emit stable `data-*` attributes for block attribution.
- **Validation**: new `core/validation/impeccable/` module; may feed into `core/validation/index.ts` and `lib/generation/validate.ts`.
- **Repair / generation**: `lib/generation/repair.ts`, `lib/generation/prompts.ts`, `lib/generation/single-draft.ts` (or deck pipeline) consume block paths for constrained re-prompt.
- **API**: `app/api/validate/` may return Impeccable findings alongside existing checks.
- **UI**: `components/fidelity/slop-badge.tsx` and workspace fidelity UI surface detect severity without requiring vision models.
- **Deps**: prefer pure detection logic + existing `jsdom`; add a small local port/vendor of Impeccable detect rules rather than a heavy browser runtime. Do not add LLM calls for detection.
- **Tests**: unit tests with fixture HTML / minimal SlideSpecs under `core/validation/impeccable/` and integration with `lib/generation/validate.test.ts` / repair tests.

## Inspired by

- https://github.com/pbakaus/impeccable

## Decision

- [ ] **Adopt** — proceed with `tasks.md`
- [ ] **Defer** / **Reject**

_novelty 3/5 · effort 2/5 · promoted from a Project Steward idea you approved._
