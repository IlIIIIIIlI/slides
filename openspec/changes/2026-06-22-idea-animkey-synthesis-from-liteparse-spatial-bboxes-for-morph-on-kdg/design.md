# Design: animKey synthesis from liteparse bboxes

## Context

- Extraction pipeline: `lib/generation/extract.ts` ingests `.pptx`/`.pdf`/`.docx` and produces the `SlideSpec[]` consumed by `app/api/presentations/`, the workspace, and ultimately the player.
- For PPTX and PDF, `extract.ts` uses `@llamaindex/liteparse` (already a dependency). Liteparse returns per-element bounding boxes in page coordinates plus a textual/role classification.
- The Flip morph pipeline lives in `core/rendering/morph.ts` + `lib/animation/flip.ts`; it pairs blocks across consecutive slides by `animKey` (see `core/rendering/morph.test.ts`).
- Key derivation today: `core/rendering/adapter.ts` assigns `"title"` to the first headline and `"code:N"` to code blocks by occurrence; everything else without an explicit `animKey` is dropped from morphing.

## Goals

- Imported PPTX/PDF decks morph titles, figures, and recurring quoted-code blocks without manual `animKey` annotation.
- Zero changes to the public `SlideSpec` schema; zero behavior change for LLM-authored decks.
- Deterministic: the same input produces the same keys (necessary for caching under `data/presentations/` and for diff-free re-imports).
- Cheap: O(N·M) per slide pair where N, M are blocks per slide (a deck has tens, not thousands).

## Non-goals

- Cross-slide reordering / global optimal matching. We only consider page i ↔ page i+1, matching the Flip semantic ("shared element between two adjacent steps").
- Image-content similarity beyond a perceptual digest of the cropped pixels we already produce in `lib/generation/image-crop.ts`.
- Rewriting `core/rendering/adapter.ts` key derivation — the synthesizer writes `animKey` directly on the block, and `adapter.ts`'s existing "keep explicit animKey" branch handles it.

## Decisions

### Where the code lives
A new file `lib/generation/anim-key-synthesis.ts` with a single entry point:

```ts
export function synthesizeAnimKeys(
  slides: ExtractedSlide[],   // internal shape carrying bbox + role per block
  opts?: { gridCols?: number; gridRows?: number; iouThreshold?: number }
): SlideSpec[];
```

`ExtractedSlide` is a new internal type (kept in the same file or in `core/schemas/types.ts` under a non-exported `// extraction-only` section) that extends the public `SlideSpec` with `_bbox?: [x,y,w,h]` and `_role?: "title"|"body"|"figure"|"code"|"other"` per block, plus `_pageW`, `_pageH` per slide. These leading-underscore fields are stripped before the spec is returned to callers.

### Fingerprint
For each block on a page we compute:
1. **Spatial key** = `[round(x / pageW * gridCols), round(y / pageH * gridRows), round(w / pageW * gridCols), round(h / pageH * gridRows)]` with default 12×9 grid (matches a 4:3/16:9 slide intuitively).
2. **Content key** = FNV-1a 32-bit hash of:
   - For text blocks: `normalize(text)` — lowercased, whitespace-collapsed, non-alphanumeric stripped, truncated to first 120 chars (so a title that gets a trailing page-number change still matches).
   - For figure blocks: liteparse's image hash if present, otherwise the bbox-derived crop's first 16 bytes hashed (we already have `lib/generation/image-crop.ts`).
   - For code blocks: first non-empty line of `normalize(code)` so reformatting doesn't break the match.
3. **Role**: `_role`.

### Matching across adjacent pages
For slides `i` and `i+1`:
1. Build a multimap from `(role, contentKey)` → blocks for slide i.
2. For each block on slide i+1, look up exact `(role, contentKey)` matches; among those, pick the one whose spatial key has highest IoU (Intersection-over-Union) on the quantized grid, requiring IoU ≥ `opts.iouThreshold` (default 0.5).
3. On match, propagate the previous block's `animKey` (creating one if it didn't have one yet) onto the current block.
4. Unmatched blocks get a freshly minted key only if they later match forward; otherwise no key.

### Key shape
`lp:<role>:<n>` where `<n>` is a monotonically increasing counter scoped to the whole deck, e.g. `lp:title:1`, `lp:figure:3`. Prefix `lp:` ("liteparse") makes the origin obvious in serialized JSON under `data/presentations/` and avoids any collision with the LLM path's `title` / `code:N`.

### Honoring explicit animKey
If a block arrives with `animKey` already set (the LLM authoring path, or a hand-edited spec), the synthesizer leaves it untouched and does NOT include it in its matching pool. This guarantees the synthesizer is purely additive.

### Integration with extract.ts
In `lib/generation/extract.ts`:
1. When the liteparse branch produces blocks, attach `_bbox` / `_role` / page dims on the internal slide.
2. Just before the function returns `SlideSpec[]`, call `synthesizeAnimKeys(slides)` and then strip `_*` fields.
3. The DOCX path (which currently has no spatial info) skips synthesis — the function is a no-op on blocks without `_bbox`.

### Configuration
No user-facing knobs in v1. The `gridCols`, `gridRows`, `iouThreshold` are exposed only for tests. If empirical results need tuning, we can promote them to environment-driven settings later.

## Risks

- **False matches** between visually similar but semantically different blocks (e.g. two page-footer artifacts on every slide getting the same key, then morphing absurdly). Mitigation: requires *both* role and content-hash equality, and ignores blocks with role `"other"`.
- **Liteparse bbox jitter** between pages causing IoU misses. Mitigation: quantize to a coarse 12×9 grid before comparing.
- **Performance** on long decks. Mitigation: comparison is pairwise adjacent only, and each lookup is O(1) on the hash map.

## Migration

None. The change is internal to the extraction pipeline. Existing presentations in `data/presentations/*.json` are unaffected; on next re-extraction they will gain `animKey`s where applicable.
