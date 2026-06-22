# Implementation tasks

## 1. Internal extraction shape

- [ ] In `lib/generation/extract.ts`, define a local `ExtractedBlock` type that extends `ContentBlock` with optional `_bbox: [number, number, number, number]` and `_role: "title" | "body" | "figure" | "code" | "other"`.
- [ ] Define `ExtractedSlide` carrying `_pageW`, `_pageH`, and `blocks: ExtractedBlock[]`.
- [ ] Add a single `stripInternal(slides: ExtractedSlide[]): SlideSpec[]` helper at the bottom of `extract.ts` that deletes every leading-underscore field before returning.

## 2. Wire liteparse bboxes through extraction

- [ ] In `extract.ts`, locate the PPTX/PDF branches that call `@llamaindex/liteparse` and capture the per-element `bbox`, role, and page dimensions on each `ExtractedBlock`/`ExtractedSlide`.
- [ ] Map liteparse element types onto the five `_role` values: heading→`title`, paragraph/list→`body`, image/figure→`figure`, code/preformatted→`code`, else→`other`.
- [ ] Ensure the DOCX branch leaves `_bbox`/`_role` undefined.

## 3. Synthesizer module

- [ ] Create `lib/generation/anim-key-synthesis.ts` exporting `synthesizeAnimKeys(slides: ExtractedSlide[], opts?): ExtractedSlide[]`.
- [ ] Implement `normalizeText(s: string): string` (lowercase, collapse whitespace, strip non-alphanumeric, truncate to 120).
- [ ] Implement `fnv1a32(s: string): number` (32-bit FNV-1a, no external dep).
- [ ] Implement `quantizeBBox(bbox, pageW, pageH, cols=12, rows=9): [number, number, number, number]`.
- [ ] Implement `iou(a, b): number` over quantized cells.
- [ ] Implement `contentKey(block: ExtractedBlock): number` — text for body/title, first non-empty line for code, image-crop hash (reuse helper in `lib/generation/image-crop.ts`) for figure.
- [ ] Implement adjacent-pair matching with role+content equality and IoU ≥ 0.5.
- [ ] Mint keys of the form `lp:${role}:${counter}` where `counter` increments per first-occurrence and is shared by every later match.
- [ ] Skip any block that already has `animKey` set, and never reuse a key that appears verbatim on an existing block.

## 4. Hook the synthesizer into extract.ts

- [ ] At the end of `extract.ts`'s PPTX/PDF code path, call `synthesizeAnimKeys(extractedSlides)`.
- [ ] Pipe the result through `stripInternal` before returning.
- [ ] Confirm the DOCX path simply returns `stripInternal(extractedSlides)` with no synthesis call (function is also a no-op on bbox-less blocks, but we skip explicitly for clarity).

## 5. Tests

- [ ] Create `lib/generation/anim-key-synthesis.test.ts` runnable by `scripts/run-unit-tests.cjs`.
- [ ] Test: title block at the same bbox+text across three synthetic slides receives a single shared `animKey` starting with `lp:title:`.
- [ ] Test: figure with bbox shifted by 8% of page dims still matches (IoU passes).
- [ ] Test: figure with bbox shifted by 40% of page dims does NOT match (IoU fails).
- [ ] Test: a block arriving with `animKey: "hero-title"` is left untouched and that key is not reused.
- [ ] Test: DOCX-style input (no `_bbox` anywhere) returns slides whose blocks all have `animKey === undefined`.
- [ ] Test: determinism — calling `synthesizeAnimKeys` twice on a deep clone of the same input yields the same `animKey` map.
- [ ] Test: stripping — after the full `extract.ts` pipeline, `JSON.stringify` of the result contains no leading-underscore keys.

## 6. Extend extract.test.ts

- [ ] In `lib/generation/extract.test.ts`, add one integration test that feeds a minimal in-memory liteparse-like fixture through `extract.ts` and asserts that a recurring headline gets a stable `animKey` on adjacent slides.

## 7. Documentation

- [ ] In `README.md`, under the existing "Auto-Animate / Flip Morphing" section, add a subsection "Imported decks (PPTX / PDF)" describing the `lp:<role>:<n>` synthesis rule and that explicit `animKey`s always win.
- [ ] Mention that synthesis is disabled implicitly when `autoAnimate: false` is set at the deck level (no code change required — the morph pipeline already short-circuits).

## 8. Verification

- [ ] Run `pnpm test` (or `npm test`) and confirm new + existing tests pass.
- [ ] Run `pnpm build` to confirm no TypeScript regressions in `extract.ts` or `core/rendering/adapter.ts` from the new internal types.
- [ ] Manually extract one PPTX from `public/extracted/test-04/` (or any sample) and inspect the resulting `SlideSpec[]` for `lp:` keys on shared elements; save the resulting JSON snippet under `.steward/evidence/anim-key-synthesis.log`.
