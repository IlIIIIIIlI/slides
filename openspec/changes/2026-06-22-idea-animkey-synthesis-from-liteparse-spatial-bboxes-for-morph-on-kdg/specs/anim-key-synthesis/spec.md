# anim-key-synthesis

## ADDED Requirements

### Requirement: Synthesize stable animKeys for imported blocks with bounding boxes

The extraction pipeline SHALL enrich each `ContentBlock` that originated from a liteparse-backed source (PPTX, PDF) with a synthesized `animKey` when the same spatial+semantic block appears on the immediately preceding slide.

#### Scenario: Title persists across consecutive PPTX pages

- **Given** an imported PPTX deck whose slides 1, 2, and 3 each carry a headline with text "Quarterly Review" inside the same top-of-page bbox
- **When** `lib/generation/extract.ts` finishes parsing and invokes `synthesizeAnimKeys`
- **Then** the headline block on slides 1, 2, and 3 each carries the same `animKey` value (e.g. `"lp:title:1"`)
- **And** that key starts with the literal prefix `"lp:"`

#### Scenario: Figure that shifts slightly still matches

- **Given** a PDF whose page 4 and page 5 both contain a chart image, with bboxes that differ by less than 10% of page width/height
- **When** the synthesizer runs with default parameters
- **Then** the figure block on page 5 receives the same `animKey` as the figure block on page 4

#### Scenario: Unrelated new content gets no propagated key

- **Given** a PPTX where page 7 introduces a brand-new bullet block that did not appear on page 6
- **When** the synthesizer runs
- **Then** the new block has `animKey === undefined` unless it recurs on a later page

### Requirement: Explicit animKeys are never overwritten

The synthesizer MUST treat any `ContentBlock` with a pre-existing `animKey` as read-only and exclude it from its matching pool.

#### Scenario: LLM-authored block keeps its key

- **Given** a deck whose slide 2 has a headline with `animKey: "hero-title"` set by the LLM authoring path
- **When** `synthesizeAnimKeys` runs over that deck
- **Then** the `animKey` of that block remains exactly `"hero-title"`
- **And** no other synthesized block on any slide is assigned `"hero-title"`

### Requirement: DOCX and other bbox-less inputs are unaffected

When a block has no spatial bbox attached (e.g. DOCX path, or a manually-constructed `SlideSpec`), the synthesizer MUST leave it unchanged.

#### Scenario: DOCX import does not gain synthesized keys

- **Given** a `.docx` file whose extraction pathway does not produce per-block bboxes
- **When** the extraction pipeline runs
- **Then** no block in the resulting `SlideSpec[]` has an `animKey` set by the synthesizer
- **And** the resulting spec is identical to what `extract.ts` would have returned before this change

### Requirement: Synthesis is deterministic

Given identical extraction input, `synthesizeAnimKeys` MUST produce identical `animKey` assignments across runs.

#### Scenario: Re-running extraction yields the same keys

- **Given** the same PPTX file is extracted twice in the same process
- **When** both resulting `SlideSpec[]` arrays are compared
- **Then** every block's `animKey` field is strictly equal between the two runs

### Requirement: Internal extraction fields are not leaked

The public `SlideSpec[]` returned by `lib/generation/extract.ts` MUST NOT contain any fields used internally by the synthesizer (e.g. `_bbox`, `_role`, `_pageW`, `_pageH`).

#### Scenario: Returned slides have only public schema fields

- **Given** a PPTX has been extracted
- **When** the resulting `SlideSpec[]` is serialized via `JSON.stringify`
- **Then** no key in the serialized output begins with an underscore
