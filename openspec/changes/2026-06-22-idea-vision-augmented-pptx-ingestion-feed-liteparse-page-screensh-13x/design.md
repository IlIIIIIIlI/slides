# Design — Vision-augmented PPTX ingestion

## Goal

When `extractDeck()` ingests a `.pptx` (and, where available, a `.pdf`), the Claude call that builds the canonical `Presentation` JSON should see **both** the structured text (markdown + bbox JSON we already produce) **and** the rendered page screenshot, so charts, brand colors, and figure-text alignment survive the round trip into our `core/schemas/types.ts` `Presentation` model.

## Current flow (baseline, what's in the repo today)

```
lib/generation/extract.ts
  ├─ parsePptx(buffer)  → liteparse.parse({ buffer, mode: 'pptx' })
  │     ├─ preprocess OMML via lib/generation/omml/*
  │     └─ return { pages: [{ markdown, bbox }] }
  └─ flattenForLLM(pages) → string (markdown joined with "\n\n---\n\n")

lib/generation/deck.ts
  └─ anthropic.messages.create({
       model: ...,
       messages: [{ role: 'user', content: flattenForLLM(pages) }]
     })
```

`lib/generation/vision.ts` already constructs `image` content blocks for a *different* path (single-image vision for slide thumbnails). We will lift its base64 helper.

## New flow

```
lib/generation/extract.ts
  └─ parsePptx(buffer) → liteparse.parse({
         buffer,
         mode: 'pptx',
         renderScreenshots: true,         // ← v2.1.2 API
         screenshotMaxEdgePx: 1024,
     })
     → { pages: PageArtifact[] }

  type PageArtifact = {
     index: number;
     markdown: string;
     bbox: BBoxJson;           // existing shape from liteparse
     screenshotPng?: Buffer;   // undefined when render fails or for DOCX
  }

lib/generation/extract-vision.ts   (NEW)
  buildExtractionContent(pages, { maxPages, includeScreenshots }):
     → Anthropic MessageParam['content']     // (TextBlockParam | ImageBlockParam)[]

lib/generation/deck.ts
  anthropic.messages.create({
     model: ...,
     messages: [{ role: 'user', content: buildExtractionContent(pages, opts) }]
  })
```

### Content-block layout sent to Claude

For each page (in order):

1. `text` block: `"=== Page <n> ===\n<markdown>\n\n<bbox JSON fenced as ```json … ```>"`
2. `image` block (when present): `{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: <b64> } }`

Then a final `text` block carrying the existing extraction instruction (currently the string built in `lib/generation/prompts.ts::buildExtractionPrompt`). Order matters: text-then-image per page lets the model anchor visual reasoning to the page's structured content.

### Size/cost guardrails

- `screenshotMaxEdgePx: 1024` (liteparse option) — empirically keeps PNGs under ~900 KB.
- Hard cap `maxPages` (default 60). When exceeded, `buildExtractionContent` drops screenshots from the lowest-information pages first, where "lowest information" = shortest markdown body. (Implemented as a stable sort by markdown length, keep the top-N images, but always keep ALL text.)
- Hard cap `maxTotalImageBytes` (default 25 MB) — same drop strategy, evaluated after the page cap.
- Counters surfaced via `console.info('[extract-vision]', { pages, imagesKept, imagesDropped, totalBytes })` so the steward's evidence log captures the decision.

### Caching to `public/extracted/<deckId>/`

Writing the PNGs under `public/extracted/<deckId>/page-<n>.png` matches the existing `public/extracted/test-04/` layout. The cache key is `(sha256(buffer), pageIndex)`; we write `meta.json` next to the PNGs recording the hash so a re-upload of the same file short-circuits screenshot rendering. The `<deckId>` directory is created lazily; cleanup is out of scope for this change (handled elsewhere in the workspace lifecycle).

### Feature flag

`process.env.SLIDES_VISION_INGEST` (read once at module load in `extract.ts`):
- `"on"` (default for PPTX): screenshots requested + included.
- `"text-only"`: skip `renderScreenshots`, behave like today.
- `"auto"`: PPTX → on, DOCX/other → off.

DOCX always uses text-only since liteparse does not render DOCX pages.

### Failure handling

- If `liteparse.parse({ renderScreenshots: true })` throws, retry once with `renderScreenshots: false`. Log `[extract-vision] screenshot render failed, falling back to text-only`.
- If an individual page's `screenshotPng` is missing/empty, the page's `image` block is simply omitted; the `text` block still ships. This is the same partial-success behavior `lib/generation/vision.ts` uses today for thumbnail failures.

### Why not a separate vision pass?

A two-pass design (text extract → vision repair) was considered. Rejected because: (a) doubles Claude calls per import, (b) the existing `lib/generation/repair.ts` loop already handles validation repairs and shouldn't be conflated with extraction, (c) Anthropic's interleaved text/image messages handle this natively in one call, and (d) the prompt in `lib/generation/prompts.ts` is already structured per-page so interleaving is a one-line change.

## Test plan

- `lib/generation/extract.test.ts` — extend the existing PPTX fixture test to assert: when `SLIDES_VISION_INGEST=on`, the messages payload contains N image blocks where N = page count (mocked liteparse returns deterministic PNG buffers); when `text-only`, zero image blocks.
- `lib/generation/extract-vision.test.ts` (new) — pure unit test on `buildExtractionContent`: ordering (text-before-image per page), page cap eviction order, byte cap eviction order, DOCX path produces no image blocks.
- `lib/generation/vision.test.ts` — keep green (only the base64 helper export changed).
- Manual smoke (in `.steward/evidence/`): import `public/snowflake-eg1.png`-derived PPTX fixture, capture the `[extract-vision]` log line.
