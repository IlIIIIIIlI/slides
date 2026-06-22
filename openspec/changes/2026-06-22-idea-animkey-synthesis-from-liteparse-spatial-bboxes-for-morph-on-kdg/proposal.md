# Change: Synthesize animKeys from liteparse spatial bboxes for imported decks

## Why

The Auto-Animate / Flip pipeline (see README "Auto-Animate / Flip Morphing" and `core/rendering/morph.ts`, `lib/animation/flip.ts`) morphs blocks across slides by their `animKey`. Today only LLM-authored decks get useful keys: `core/rendering/adapter.ts` derives `"title"` for headlines and `"code:0"`, `"code:1"`, ... for code blocks, and anything else without an explicit `animKey` is silently excluded from morphing. Imported PPTX/PDF decks — which flow through `lib/generation/extract.ts` and `@llamaindex/liteparse` — therefore never morph titles, figures, or quoted code, even when the same element clearly sits in the same place on consecutive pages.

Liteparse already returns per-block bounding boxes. By quantizing those bboxes and combining them with a normalized content hash, we can assign a *stable* `animKey` whenever the same spatial+semantic block recurs on the next page. Because `animKey` is already an optional field on `ContentBlock`, this is purely additive — no schema change, no behavior change for LLM-authored decks.

## What Changes

- **New capability `anim-key-synthesis`** that, post-extraction, enriches a `SlideSpec[]` with synthesized `animKey` values for blocks that liteparse located via bbox.
- **`lib/generation/extract.ts`** is updated to preserve each block's `bbox` (from liteparse) and a `sourcePageIndex` on an internal extraction shape, then call the new synthesizer before returning the final `SlideSpec[]`.
- **New module `lib/generation/anim-key-synthesis.ts`** implementing the matcher: quantize bbox to a 12-column × 9-row grid, hash normalized text (or image-crop digest) with FNV-1a, match blocks against the previous slide, and emit keys of the form `lp:<role>:<groupId>`.
- **New tests** `lib/generation/anim-key-synthesis.test.ts` covering: titles persisting across pages, figures repositioned slightly still matching, completely new blocks getting fresh keys, and respect for pre-existing `animKey` values (never overwritten).
- **README** gains a short subsection under "Auto-Animate / Flip Morphing" describing imported-deck synthesis.

## Impact

- Affected specs: new capability `anim-key-synthesis`.
- Affected code: `lib/generation/extract.ts`, new `lib/generation/anim-key-synthesis.ts` (+ test), `core/schemas/types.ts` (only an internal extraction-time `bbox` field if needed; `ContentBlock.animKey` is already present).
- No runtime dependencies added — `@llamaindex/liteparse` is already in `package.json`.
- Backwards compatible: LLM-authored decks bypass the synthesizer because they have no bbox; explicit `animKey`s are preserved verbatim.

## Inspired by

- https://github.com/run-llama/liteparse

## Decision

- [ ] **Adopt** — proceed with `tasks.md`
- [ ] **Defer** / **Reject**

_novelty 4/5 · effort 2/5 · promoted from a Project Steward idea you approved._
