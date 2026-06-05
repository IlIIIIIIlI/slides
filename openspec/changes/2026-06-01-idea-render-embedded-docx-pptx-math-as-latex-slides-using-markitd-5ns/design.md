# Design: OMML→LaTeX math rendering

## Context

The repo is a Next.js 15 (App Router, React 19, TypeScript) app. Document ingestion lives in `lib/generation/extract.ts`; slides are described by a schema in `core/schemas/types.ts` and rendered through `lib/markdown-inline.tsx` (which already integrates `react-syntax-highlighter` for code). There is a custom unit-test runner `scripts/run-unit-tests.cjs` that picks up `*.test.ts(x)` files (see `lib/generation/*.test.ts`).

We want to preserve Office math when extracting DOCX/PPTX, carry it through generation as LaTeX, and render it with KaTeX.

## Goals / Non-Goals

- Goal: Convert OMML (`m:` namespace) elements — fraction, radical, superscript/subscript, n-ary (sum/integral/product), matrix, delimiter, accent, bar, limits, functions, text runs — into valid LaTeX.
- Goal: Render that LaTeX in slides with no server-side ML dependencies.
- Non-Goal: Round-tripping LaTeX back to OMML.
- Non-Goal: Supporting MathML or LaTeX embedded in PDFs (separate path).

## Decisions

### 1. Port, don't shell out
markitdown's converter is Python; shelling out adds a Python runtime dependency to a Node/Next deployment. We instead port the mapping logic to TypeScript in `lib/generation/omml/`. The mapping is a finite static table (the same approach markitdown uses via its `omml.py` element handlers), so a port is low-risk and keeps the build self-contained.

### 2. XML parsing with `jsdom`
`jsdom@^24` is already a dependency. We parse OMML fragments with `new JSDOM(xml, { contentType: 'text/xml' })` and walk the DOM. This avoids adding an XML parser. Element lookups use `localName` to be namespace-agnostic (`oMath`, `f`, `num`, `den`, `rad`, `nary`, `m` (matrix), `d`, `e`, `sup`, `sub`, `r`, `t`, `acc`, `bar`, `func`, `limLow`, `limUpp`).

### 3. Converter shape
```ts
// lib/generation/omml/omml.ts
export function ommlToLatex(omml: string): string
export function convertOMathElement(el: Element): string  // recursive dispatch
```
A dispatch map keyed by `localName` produces LaTeX, recursing into child `e`/`num`/`den`/etc. Unknown elements degrade to their concatenated text content rather than throwing.

### 4. Extraction integration
`lib/generation/extract.ts` currently returns plain text per document. We add a preprocessing step: before/while flattening, locate `<m:oMath>` (DOCX `word/document.xml`, PPTX slide XML `a:` runs containing `m:oMathPara`) and replace each with a delimited LaTeX token:
- inline math (`m:oMath` inside a text run) → `$<latex>$`
- display math (`m:oMathPara`) → `$$<latex>$$`

DOCX/PPTX are zip containers; we read the relevant XML parts. If the existing extractor already unzips (it handles these formats today), we hook into that XML. The replacement happens on the raw XML string before text flattening so the math survives.

### 5. Schema and rendering
- `core/schemas/types.ts`: document that bullet/body text MAY contain LaTeX math delimited by `$...$` (inline) and `$$...$$` (block). No structural schema change is strictly required, but we add an explicit comment + optional `hasMath` hint flag for renderers.
- `lib/markdown-inline.tsx`: add a tokenizer pass that splits text on `$$...$$` and `$...$`, and renders matched segments via `katex.renderToString(latex, { throwOnError: false, displayMode })` injected with `dangerouslySetInnerHTML`. Non-math text continues through the existing inline pipeline.
- `app/globals.css`: `@import 'katex/dist/katex.min.css';`.

### 6. Error handling
The converter never throws on malformed OMML; it returns best-effort text. KaTeX is invoked with `throwOnError: false` so a bad expression renders as red error text rather than crashing the slide.

## Risks / Trade-offs

- KaTeX coverage is a subset of LaTeX; exotic OMML constructs may render imperfectly. Mitigated by `throwOnError: false` fallback.
- jsdom XML parsing of large slide decks adds CPU; extraction is already an async server step so this is acceptable.

## Migration

None. Existing presentation JSON in `data/presentations/` is unaffected; the math path only activates when source DOCX/PPTX contain OMML.
