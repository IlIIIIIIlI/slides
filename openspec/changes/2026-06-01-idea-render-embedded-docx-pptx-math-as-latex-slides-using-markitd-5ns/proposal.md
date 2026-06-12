# Render embedded DOCX/PPTX math as LaTeX slides

## Why

When a user uploads a technical Word or PowerPoint document, its equations are stored as OOXML Math (OMML) markup. Our current ingestion path (`lib/generation/extract.ts`) flattens documents to plain text, so fractions, radicals, matrices, integrals and limits collapse into garbled Unicode or vanish entirely. That makes generated slides useless for STEM/academic decks.

markitdown ships a self-contained OMML→LaTeX converter (`converter_utils/docx/math/omml.py`) with no ML dependencies. By porting that mapping into a TypeScript module, we can preserve real math during extraction, emit it as LaTeX in the slide schema, and render it client-side with KaTeX inside our existing markdown rendering layer (`lib/markdown-inline.tsx`). This is the differentiator that turns slide generation from bullet-only into genuinely usable technical decks.

## What Changes

- Add a new `docx-math` capability: a TypeScript OMML→LaTeX converter under `lib/generation/omml/` that parses `m:oMath` XML fragments and returns LaTeX strings.
- Extend `lib/generation/extract.ts` so that DOCX and PPTX extraction surfaces equations as inline/block LaTeX delimited spans (`$...$` / `$$...$$`) instead of dropping them.
- Add a `math` content classification to the slide schema (`core/schemas/types.ts`) and the inline markdown renderer (`lib/markdown-inline.tsx`) so LaTeX is rendered with KaTeX.
- Add `katex` (runtime) to dependencies and wire its CSS into `app/globals.css`.
- Add unit tests for the converter and the extraction integration using the existing `scripts/run-unit-tests.cjs` harness.

## Impact

- Affected specs: new `docx-math` capability.
- Affected code: `lib/generation/extract.ts`, `lib/generation/omml/` (new), `lib/markdown-inline.tsx`, `core/schemas/types.ts`, `app/globals.css`, `package.json`.
- No breaking changes to existing presentations; documents without math behave exactly as before.

## Inspired by

- https://github.com/microsoft/markitdown

## Decision

- [ ] **Adopt** — proceed with `tasks.md`
- [ ] **Defer** / **Reject**

_novelty 4/5 · effort 3/5 · promoted from a Project Steward idea you approved._
