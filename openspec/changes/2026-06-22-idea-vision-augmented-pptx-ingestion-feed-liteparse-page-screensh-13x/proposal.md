# Vision-augmented PPTX ingestion

## Why

Today `lib/generation/extract.ts` ingests PPTX/PDF decks by flattening liteparse's per-page markdown plus the OMML→LaTeX pre-pass and handing **text only** to Claude in `lib/generation/deck.ts`. Charts, figure-text alignment, brand colors, and any decorative layout that doesn't survive markdown flattening are dropped, which is the root cause of the recurring "imported decks look generic after regeneration" complaint logged in `DESIGN_REVIEW.md`.

liteparse v2.1.x exposes a per-page screenshot/render API meant for vision agents. The repo already ships an Anthropic image-content code path (`lib/generation/vision.ts` builds `image` blocks for `@anthropic-ai/sdk`'s messages API), so the missing piece is wiring the rendered PNG into the same extraction request that already carries the markdown + bbox JSON.

## What Changes

- Bump `@llamaindex/liteparse` from `^2.0.4` to `^2.1.2` in `package.json` to pick up the page-screenshot API.
- Extend `lib/generation/extract.ts` so PPTX/PDF parses produce a `PageArtifact = { markdown, bbox, screenshotPng }` per page instead of just markdown.
- Add `lib/generation/extract-vision.ts` (new) that turns a `PageArtifact[]` into Anthropic `MessageParam.content` blocks (`image` + `text`) reusing the same base64 encoding helper currently in `lib/generation/vision.ts`.
- Update the extraction call site in `lib/generation/deck.ts` (and any other extract consumer found in the grep below) to forward the multimodal content blocks instead of a single text string.
- Add a `VISION_INGEST` feature flag (env: `SLIDES_VISION_INGEST`, default `on` for PPTX, `off` for DOCX which has no screenshots) so we can fall back to text-only extraction if liteparse screenshot generation fails or the page count blows the request budget.
- Cache rendered PNGs under `public/extracted/<deckId>/page-<n>.png` (matching the existing `public/extracted/test-04/` convention) so re-runs and downstream slide regeneration can reuse the same artifacts.
- New tests in `lib/generation/extract.test.ts` and a new `lib/generation/extract-vision.test.ts` covering: multimodal payload shape, base64 size guard, screenshot-failure fallback, and DOCX (no-screenshot) parity.
- Update README "Math support" section with a sibling "Visual fidelity (PPTX vision ingest)" subsection explaining the flag and the cache directory.

## Impact

- Affected specs: new capability `pptx-vision-ingestion`.
- Affected code: `lib/generation/extract.ts`, `lib/generation/extract.test.ts`, `lib/generation/deck.ts`, new `lib/generation/extract-vision.ts` + test, `lib/generation/vision.ts` (export `toBase64ImageBlock` helper), `package.json`, `README.md`.
- No DB / schema changes. No new external services. Adds one peer behavior to liteparse (screenshot rendering) which is already an opt-in API on the bumped version.
- Token cost: each PPTX page adds ~1 image (typ. 400–900 KB at 1024px max edge). The flag and a per-deck page cap (default 60) bound the worst case.

## Inspired by

- https://github.com/run-llama/liteparse

## Decision

- [ ] **Adopt** — proceed with `tasks.md`
- [ ] **Defer** / **Reject**

_novelty 3/5 · effort 3/5 · promoted from a Project Steward idea you approved._
