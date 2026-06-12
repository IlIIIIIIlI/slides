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

**Supported OMML constructs:**

| Construct | Example OMML element | LaTeX output |
|-----------|----------------------|--------------|
| Fraction | `m:f` | `\frac{num}{den}` |
| Radical | `m:rad` | `\sqrt[n]{x}` |
| Sub/superscript | `m:sSub`, `m:sSup`, `m:sSubSup` | `x_{a}^{b}` |
| N-ary operators | `m:nary` | `\sum_{i=1}^{n}`, `\int\limits_{a}^{b}`, `\prod`, `\oint`, … |
| Over/under limits | `m:limLow`, `m:limUpp` | `\lim_{x→0}`, `\max_{k}`, `\overset{…}{f}` |
| Grouping chars | `m:groupChr` | `\overbrace{a+b}`, `\underbrace{x}`, `\overset{→}{abc}` |
| Accent | `m:acc` | `\hat{v}`, `\vec{v}`, `\tilde{x}` |
| Bar | `m:bar` | `\overline{x}`, `\underline{x}` |
| Matrix | `m:m` | `\begin{matrix}…\end{matrix}` |
| Delimiter | `m:d` | `\left(…\right)` |
| Named function | `m:func` | `\sin`, `\log`, `\operatorname{…}` |


## Changelog

### 2026-06-11 — Ship slides as an MCP skill: author decks from Claude Code, Cursor, or Gemini

The `mcp/` directory packages the slide generation pipeline as a [Model Context Protocol](https://modelcontextprotocol.io/) server. Any MCP-capable AI editor can now author, edit, and preview presentation decks by calling typed tools against the running Next.js app — without touching the UI.

**What's included:**

- **`mcp/server.mjs`** — stdio MCP server with nine tools: `get_slide_schema`, `list_presentations`, `get_presentation`, `create_presentation`, `update_slides`, `add_slides_from_topic`, `regenerate_slide`, `delete_presentation`, `get_player_url`.
- **`mcp/schema.ts`** — JSON Schema definitions for the full `Slide` and `Presentation` types, re-exported from the existing type system so agents get the same constraints the app enforces (headline ≤ 80 chars, points ≤ 5 items, etc.).
- **`mcp/cli.mjs`** — one-shot installer (`node mcp/cli.mjs install`) that writes the MCP server entry into Claude Code / Claude Desktop config files. Also available as `npm run mcp:install`.

**New API endpoint:**

`POST /api/presentations` creates an empty presentation so agents can author slides from scratch without going through the full document-upload pipeline.

**Install (once the Next.js app is running):**

```bash
node mcp/cli.mjs install          # registers the MCP server in Claude Code + Claude Desktop
# or
npm run mcp:install
```

Then restart Claude Code / Claude Desktop. The `get_slide_schema` tool should appear. Call it first to get the typed schema, then use `create_presentation` + `update_slides` to author a deck.

**Why:** Turns the project from a standalone app into a reusable agent skill — any Claude/Cursor/Gemini session can generate a slide deck grounded in the same validated schema primitives the player renders.

### 2026-06-06 — Fix Vercel deployment: remove stale pnpm lockfile

Removed `pnpm-lock.yaml` from the repository. The file predated the addition of `katex` and `gsap` as dependencies, so Vercel (which prefers pnpm over npm when a `pnpm-lock.yaml` is present) was failing every deployment with a frozen-install error for those missing packages. Removing the stale lockfile causes Vercel to fall back to `npm` with the up-to-date `package-lock.json`, which includes all current dependencies. Local development and CI are unaffected — the project continues to use `npm`.

### 2026-06-05 — Hardened OMML→LaTeX converter: n-ary, limits, and grouping characters

The OMML→LaTeX converter in `lib/generation/omml/` is a TypeScript port of Microsoft's markitdown `omml.py`. Since the original port, upstream markitdown hardened several math handlers that our fork was missing or implementing only partially — causing those equation types to fall back to the KaTeX error tile when uploading DOCX or PPTX files.

This change closes four coverage gaps:

- **N-ary operators (`m:nary`)** — the `nary` handler now correctly defaults to the integral glyph (`∫`) when no `m:chr` is specified (per the OMML spec), falls back to the raw Unicode glyph for unknown operators instead of emitting `\sum`, and honours `m:limLoc = undOvr` by emitting `\limits` so summation/product limits render above and below the operator. The glyph→command table gains `\oint`, `\bigsqcup`, `\bigvee`, and `\bigwedge`.

- **Lower limits (`m:limLow`)** — previously only detected `lim` as a special operator; now recognises the full set (`lim`, `max`, `min`, `sup`, `inf`, `gcd`, `det`) and emits `\cmd_{…}` for each. Non-operator bases still use `\underset`.

- **Upper limits (`m:limUpp`)** — previously always emitted `\overset`; now detects operator bases and emits `\cmd^{…}` instead, matching upstream behaviour.

- **Grouping characters (`m:groupChr`)** — handler was absent entirely; added to emit `\overbrace{…}` (⏞), `\underbrace{…}` (⏟), or `\overset`/`\underset` for arbitrary grouping glyphs based on the `m:pos` attribute.

All four handlers are covered by new focused unit tests (`lib/generation/omml/omml-nary-limits.test.ts`) that assert correct LaTeX output **and** confirm KaTeX accepts each expression without error. The test suite grows from 36 to 50 passing tests.

### 2026-06-05 — Bounding-box-aware PDF ingestion via liteparse

Replaced the `pdf-parse` library with `@llamaindex/liteparse` for server-side PDF text extraction. The old library produced a flat string with no positional information; liteparse exposes per-item coordinates so every extracted text chunk now carries a precise bounding box (`x1`, `y1`, `x2`, `y2`) relative to the page dimensions. This enables the PDF viewer to scroll to and highlight the exact region of the document that corresponds to each generated slide section. Scanned or image-heavy pages are automatically detected by comparing text-area coverage against page area and re-parsed with optional OCR; pages with little text are screen-captured and passed to the vision pipeline as images. The change also adds per-line rectangle data so the highlight overlay follows multi-line paragraphs without painting over unrelated text.

### 2026-06-05 — Auto-Animate-style element morphing between slides

Added GSAP Flip-plugin-based element morphing so that shared content blocks (headlines, code blocks) smoothly animate their position and size when the user navigates between consecutive slides. Each `ContentBlock` now accepts an optional `animKey` field to declare a stable cross-slide identity; the system auto-derives keys for `headline` and `code-block` types when the field is omitted. The feature can be disabled per-deck via `autoAnimate: false` on `PresentationSpec` and is automatically suppressed when the user's OS `prefers-reduced-motion` setting is active. This brings the slide player closer to Reveal.js-style auto-animate UX without requiring a full framework dependency.
