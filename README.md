# slides

## Auto-Animate / Flip Morphing

The player supports GSAP Flip-style element morphing between consecutive slides. Shared elements (title, code blocks) automatically morph position and size during navigation.

### Setting `animKey` on blocks

In a `SlideSpec`, add `animKey` to any `ContentBlock` to give it a stable identity across slides:

```json
{
  "contentBlocks": [
    { "type": "headline", "content": "My Slide Title", "animKey": "main-title" },
    { "type": "code-block", "content": "console.log('hello')" }
  ]
}
```

If `animKey` is omitted, the system auto-derives one:
- `headline` → `"title"`
- `code-block` → `"code:0"`, `"code:1"`, … (by occurrence)

Any block without a key (e.g., `supporting`, `bullet-list`) does not participate in morphing.

### Disabling morphing for a deck

Set `"autoAnimate": false` at the presentation level to disable all morphing for that deck:

```json
{
  "id": "...",
  "autoAnimate": false,
  "slides": [ ... ]
}
```

### Reduced-motion

Morphing is automatically disabled when the user's OS preference is `prefers-reduced-motion: reduce`.

## Math support

When uploading Word (.docx) or PowerPoint (.pptx) files that contain equations,
the slide generator preserves them as LaTeX rather than dropping them.

**How it works:**

1. **OMML → LaTeX conversion** – Office equations are stored as OOXML Math (OMML)
   markup. A self-contained TypeScript converter in `lib/generation/omml/` parses
   each `m:oMath` / `m:oMathPara` element and produces LaTeX strings, with no
   machine-learning or external-process dependencies.  The mapping logic is
   ported from [markitdown](https://github.com/microsoft/markitdown)'s
   `omml.py` converter.

2. **Extraction integration** – `lib/generation/extract.ts` pre-processes DOCX /
   PPTX XML before text flattening, replacing inline equations with `$...$` and
   display-mode paragraphs with `$$...$$`.

3. **KaTeX rendering** – The inline markdown renderer (`lib/markdown-inline.tsx`)
   splits text on `$$...$$` then `$...$` and passes matched segments to
   `katex.renderToString` with `throwOnError: false`.  Invalid expressions render
   as a styled error fallback rather than crashing the slide.

## Changelog

### 2026-06-05 — Bounding-box-aware PDF ingestion via liteparse

Replaced the `pdf-parse` library with `@llamaindex/liteparse` for server-side PDF text extraction. The old library produced a flat string with no positional information; liteparse exposes per-item coordinates so every extracted text chunk now carries a precise bounding box (`x1`, `y1`, `x2`, `y2`) relative to the page dimensions. This enables the PDF viewer to scroll to and highlight the exact region of the document that corresponds to each generated slide section. Scanned or image-heavy pages are automatically detected by comparing text-area coverage against page area and re-parsed with optional OCR; pages with little text are screen-captured and passed to the vision pipeline as images. The change also adds per-line rectangle data so the highlight overlay follows multi-line paragraphs without painting over unrelated text.

### 2026-06-05 — Auto-Animate-style element morphing between slides

Added GSAP Flip-plugin-based element morphing so that shared content blocks (headlines, code blocks) smoothly animate their position and size when the user navigates between consecutive slides. Each `ContentBlock` now accepts an optional `animKey` field to declare a stable cross-slide identity; the system auto-derives keys for `headline` and `code-block` types when the field is omitted. The feature can be disabled per-deck via `autoAnimate: false` on `PresentationSpec` and is automatically suppressed when the user's OS `prefers-reduced-motion` setting is active. This brings the slide player closer to Reveal.js-style auto-animate UX without requiring a full framework dependency.
