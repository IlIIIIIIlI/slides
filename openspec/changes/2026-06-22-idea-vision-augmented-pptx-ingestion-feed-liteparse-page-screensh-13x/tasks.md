# Implementation Tasks — Vision-augmented PPTX ingestion

## 1. Dependency + types
- [ ] 1.1 Bump `@llamaindex/liteparse` from `^2.0.4` to `^2.1.2` in `package.json`; run `pnpm install` and commit the updated `pnpm-lock.yaml`.
- [ ] 1.2 In `lib/generation/extract.ts`, add a `PageArtifact` type (`{ index: number; markdown: string; bbox: unknown; screenshotPng?: Buffer }`) and export it.
- [ ] 1.3 In `lib/generation/vision.ts`, extract the inline base64-image-block construction into a named export `toBase64ImageBlock(png: Buffer): ImageBlockParam` (import the type from `@anthropic-ai/sdk/resources/messages`). Update the existing call site in `vision.ts` to use it.

## 2. Screenshot ingestion in `lib/generation/extract.ts`
- [ ] 2.1 Read `SLIDES_VISION_INGEST` once at module top (`'on' | 'text-only' | 'auto'`, default `'auto'`).
- [ ] 2.2 In the PPTX branch of `parseDeck()`, pass `{ renderScreenshots: shouldRender, screenshotMaxEdgePx: 1024 }` to `liteparse.parse`. `shouldRender` = `true` when flag is `on`, or `auto` + mime is PPTX.
- [ ] 2.3 Wrap the screenshot-enabled call in a try/catch; on failure, re-invoke with `renderScreenshots: false` and `console.warn('[extract-vision] screenshot render failed, falling back to text-only', err)`.
- [ ] 2.4 Map liteparse's per-page result into `PageArtifact[]`, attaching the PNG `Buffer` to each page where present.
- [ ] 2.5 For DOCX inputs, hard-set `renderScreenshots: false` regardless of flag.

## 3. New module `lib/generation/extract-vision.ts`
- [ ] 3.1 Create the file; export `buildExtractionContent(pages: PageArtifact[], opts: { maxPages?: number; maxTotalImageBytes?: number; instructionText: string }): MessageParam['content']`.
- [ ] 3.2 Implement per-page emission: a `text` block (header `=== Page <n> ===` + markdown + fenced bbox JSON) followed by an `image` block (via `toBase64ImageBlock`) when `screenshotPng` is present and non-empty.
- [ ] 3.3 Implement page-cap eviction: when `pages.length > maxPages`, keep all text blocks but drop image blocks for the (length-of-markdown ASC) lowest pages until image-block count ≤ `maxPages`.
- [ ] 3.4 Implement byte-cap eviction: while `sum(image.source.data decoded length) > maxTotalImageBytes`, drop the largest remaining image block (ties broken by lowest page index).
- [ ] 3.5 Append the `instructionText` text block at the end of the content array.
- [ ] 3.6 Emit `console.info('[extract-vision]', { pages: N, imagesKept, imagesDropped, totalBytes })` once per call.

## 4. Disk cache under `public/extracted/<deckId>/`
- [ ] 4.1 Add a `lib/generation/extract-cache.ts` with `readPageCache(deckId, sha256): Promise<Buffer[] | null>` and `writePageCache(deckId, sha256, buffers: Buffer[]): Promise<void>`.
- [ ] 4.2 `writePageCache` MUST write `page-<n>.png` (1-indexed) and a `meta.json` of `{ sha256, pages, createdAt }`.
- [ ] 4.3 In `lib/generation/extract.ts`, compute the buffer sha256 via `crypto.createHash('sha256')` BEFORE invoking liteparse; call `readPageCache` first and, on hit, skip rendering and load PNGs from disk.
- [ ] 4.4 On a render miss, call `writePageCache` with the rendered buffers after liteparse returns.

## 5. Wire into the extraction call site
- [ ] 5.1 In `lib/generation/deck.ts`, replace the flat-string `content` arg in the extraction `anthropic.messages.create` call with `buildExtractionContent(pages, { maxPages: 60, maxTotalImageBytes: 25 * 1024 * 1024, instructionText: buildExtractionPrompt({ withVision: shouldRender }) })`.
- [ ] 5.2 Thread `shouldRender` (returned from `extractDeck`) back to the caller so the prompt can branch.
- [ ] 5.3 Update `lib/generation/prompts.ts::buildExtractionPrompt` to accept `{ withVision: boolean }` and, when true, append a paragraph: "You will also receive a page screenshot for each slide. Use these images to derive accent/brand colors, chart descriptions, and figure-text alignment when the markdown is ambiguous."

## 6. Tests
- [ ] 6.1 Extend `lib/generation/extract.test.ts`: stub liteparse to return 3 pages with synthetic PNG buffers; assert message content has 3 text + 3 image blocks in interleaved order with a trailing instruction text block.
- [ ] 6.2 In the same file, add a test for `SLIDES_VISION_INGEST=text-only` ⇒ 0 image blocks; and for DOCX mime ⇒ 0 image blocks.
- [ ] 6.3 Add a test that forces `liteparse.parse` to throw on the first call and resolve on the retry; assert the warn log fires and image-block count is 0.
- [ ] 6.4 Create `lib/generation/extract-vision.test.ts` with unit tests for: ordering, page-cap eviction (75 pages, cap 60, drops shortest-markdown pages first), byte-cap eviction (drops largest first), and DOCX-no-screenshots path.
- [ ] 6.5 Add a cache test in `lib/generation/extract.test.ts` (or new `extract-cache.test.ts`): pre-populate a temp `public/extracted/<deckId>/` and assert `liteparse.parse` is invoked with `renderScreenshots: false` and the cached PNGs flow through.
- [ ] 6.6 Run `npm test` and ensure `lib/generation/vision.test.ts`, `lib/generation/fidelity.test.ts`, `lib/generation/repair.test.ts`, and `lib/generation/validate.test.ts` remain green.

## 7. Docs + evidence
- [ ] 7.1 In `README.md`, add a "Visual fidelity (PPTX vision ingest)" subsection under or beside the existing "Math support" section, documenting `SLIDES_VISION_INGEST`, the 60-page / 25-MB caps, and the `public/extracted/<deckId>/` cache location.
- [ ] 7.2 Update `DESIGN_REVIEW.md` with a one-paragraph note explaining how this change addresses the "imported decks look generic after regeneration" failure mode.
- [ ] 7.3 After implementation, save `.steward/evidence/extract-vision.log` capturing `npm run build` output and the `[extract-vision]` log line from a fixture import.
