# slides

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
