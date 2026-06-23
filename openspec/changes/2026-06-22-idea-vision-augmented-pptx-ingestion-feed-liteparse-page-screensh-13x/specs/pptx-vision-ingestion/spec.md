# pptx-vision-ingestion

## ADDED Requirements

### Requirement: Per-page screenshots SHALL accompany text in PPTX extraction

When `lib/generation/extract.ts` ingests a `.pptx` file with `SLIDES_VISION_INGEST` set to `on` or `auto`, the system MUST request page screenshots from liteparse (v2.1.2+) and forward them to Claude as `image` content blocks alongside the existing per-page markdown + bbox text blocks in a single `anthropic.messages.create` call.

#### Scenario: PPTX import sends interleaved text + image blocks
- **Given** a PPTX deck with 3 pages and `SLIDES_VISION_INGEST=on`
- **And** liteparse v2.1.2 returns markdown, bbox, and a non-empty PNG buffer for each page
- **When** `extractDeck(buffer, { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })` is called
- **Then** the resulting Anthropic `messages[0].content` array contains 3 text blocks and 3 image blocks in `[text, image, text, image, text, image, instructionText]` order
- **And** each image block has `source.type === 'base64'` and `source.media_type === 'image/png'`

#### Scenario: Per-page text block carries both markdown and bbox JSON
- **Given** a PPTX page whose liteparse markdown is `"# Title"` and whose bbox JSON has 4 elements
- **When** `buildExtractionContent` is invoked on that single page
- **Then** the emitted text block's `text` field begins with `"=== Page 1 ==="`, contains `"# Title"`, and contains a fenced ```json``` block with the 4 bbox elements

### Requirement: The system SHALL gracefully fall back when screenshots are unavailable

Failures in screenshot generation MUST NOT abort extraction. The system must downgrade to text-only and log the downgrade.

#### Scenario: liteparse screenshot rendering throws
- **Given** liteparse is configured with `renderScreenshots: true`
- **And** `liteparse.parse` throws an error whose message contains `"screenshot"`
- **When** `extractDeck` runs
- **Then** liteparse is re-invoked with `renderScreenshots: false`
- **And** a single `console.warn` line beginning with `"[extract-vision] screenshot render failed"` is emitted
- **And** the returned content array contains zero image blocks

#### Scenario: Individual page screenshot is empty
- **Given** a 2-page PPTX where page 1 has a valid PNG and page 2's PNG buffer is zero-length
- **When** `buildExtractionContent` runs
- **Then** the content array contains 2 text blocks but only 1 image block (the one for page 1)

#### Scenario: DOCX extraction never requests screenshots
- **Given** a `.docx` upload
- **When** `extractDeck` runs with `SLIDES_VISION_INGEST=auto`
- **Then** `liteparse.parse` is invoked with `renderScreenshots: false`
- **And** the content array contains zero image blocks

### Requirement: The system SHALL enforce per-request image budgets

Large decks MUST be truncated to keep request size and cost predictable. Text for every page is always preserved; only image blocks are dropped.

#### Scenario: Page cap drops images from text-heaviest pages last
- **Given** a 75-page PPTX (cap = 60) with varied markdown lengths
- **When** `buildExtractionContent` runs with `maxPages: 60`
- **Then** the content array contains 75 text blocks and exactly 60 image blocks
- **And** the 15 dropped image blocks correspond to the 15 pages with the shortest markdown bodies

#### Scenario: Total-byte cap drops largest images first
- **Given** a 10-page deck whose PNGs sum to 40 MB and `maxTotalImageBytes: 25 * 1024 * 1024`
- **When** `buildExtractionContent` runs
- **Then** the sum of `image.source.data` (decoded) sizes is ≤ 25 MB
- **And** the dropped images are the ones with the largest individual byte size, breaking ties by lowest page index

### Requirement: The system SHALL cache rendered screenshots on disk

Re-uploads of the same file MUST reuse previously rendered PNGs instead of re-rendering.

#### Scenario: Cache hit on identical buffer
- **Given** a PPTX buffer whose sha256 is `"abc123…"`
- **And** `public/extracted/<deckId>/meta.json` records `{ sha256: "abc123…", pages: 5 }` and 5 sibling `page-<n>.png` files exist
- **When** `extractDeck` runs for that buffer
- **Then** `liteparse.parse` is invoked with `renderScreenshots: false`
- **And** the 5 PNG buffers are loaded from disk
- **And** the resulting content array still contains 5 image blocks

#### Scenario: Cache miss writes new PNGs and meta.json
- **Given** no `public/extracted/<deckId>/` directory exists
- **When** `extractDeck` renders 4 pages
- **Then** files `public/extracted/<deckId>/page-1.png` through `page-4.png` and `public/extracted/<deckId>/meta.json` are written
- **And** `meta.json` contains the buffer sha256 and `pages: 4`

### Requirement: The extraction prompt SHALL instruct the model to use visual evidence

The prompt built by `lib/generation/prompts.ts::buildExtractionPrompt` must explicitly direct Claude to consult the per-page images for figure semantics, chart data, and brand colors.

#### Scenario: Prompt mentions visual inputs
- **Given** vision ingest is enabled for this call
- **When** `buildExtractionPrompt({ withVision: true })` is invoked
- **Then** the returned string contains the phrase `"page screenshot"` and instructs the model to derive `accentColor` / chart descriptions from the images when text is ambiguous
