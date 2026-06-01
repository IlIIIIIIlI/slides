## 1. Dependencies & assets
- [x] 1.1 Add `katex` to `dependencies` in `package.json` and run `pnpm install` to update `pnpm-lock.yaml`.
- [x] 1.2 Add `@import 'katex/dist/katex.min.css';` near the top of `app/globals.css` so KaTeX styling is available app-wide.

## 2. OMML→LaTeX converter (new capability)
- [x] 2.1 Create `lib/generation/omml/omml.ts` exporting `ommlToLatex(omml: string): string` that parses with `new JSDOM(omml, { contentType: 'text/xml' })` and dispatches on element `localName`.
- [x] 2.2 Implement element handlers in `lib/generation/omml/handlers.ts`: `f` (fraction → `\frac`), `rad`/`deg` (`\sqrt` / `\sqrt[..]`), `sSup`/`sSub`/`sSubSup` (`^{}`/`_{}`), `nary` (sum/int/prod from `m:chr` with sub/sup limits), `m`/`mr`/`e` (matrix rows/cells), `d`/`dPr` (delimiters → `\left(...\right)`), `acc` (accent → `\hat`/`\vec` by char), `bar` (`\overline`), `func`/`fName` (named functions like `\sin`), `limLow`/`limUpp` (`\lim_{}`), `r`/`t` (text runs, with special-character escaping).
- [x] 2.3 Add a recursive `convertChildren(el)` helper and a fallback in `omml.ts` that returns `el.textContent` for unmapped elements (never throw).
- [x] 2.4 Create `lib/generation/omml/omml.test.ts` covering fraction, radical-with-degree, n-ary summation with limits, matrix, accent, delimiters, and unknown-element degradation (mirrors the spec scenarios). Use the same `*.test.ts` pattern picked up by `scripts/run-unit-tests.cjs`.

## 3. Extraction integration
- [x] 3.1 In `lib/generation/extract.ts`, before plain-text flattening of DOCX/PPTX XML, locate each `m:oMath`/`m:oMathPara` fragment in the source XML string.
- [x] 3.2 Replace each `m:oMath` with `\$` + `ommlToLatex(fragment)` + `\$` (inline) and each `m:oMathPara` with `$$...$$` (block) before flattening, so the LaTeX survives into the extracted text.
- [x] 3.3 Add `lib/generation/extract.test.ts` cases: inline DOCX equation yields `$...$`, `m:oMathPara` yields `$$...$$`, and a math-free document is byte-for-byte unchanged.

## 4. Schema & slide rendering
- [x] 4.1 In `core/schemas/types.ts`, document that body/bullet strings MAY contain `$...$`/`$$...$$` math and add an optional `hasMath?: boolean` hint on the relevant content type.
- [x] 4.2 In `lib/markdown-inline.tsx`, add a tokenizer that splits text on `$$...$$` then `$...$`, rendering math segments via `katex.renderToString(latex, { throwOnError: false, displayMode })` with `dangerouslySetInnerHTML`, and passing non-math segments through the existing inline pipeline.
- [x] 4.3 Ensure block math (`$$`) renders as a block-level element and inline math as a span; verify the existing code-highlighting path is untouched.

## 5. Verification & docs
- [x] 5.1 Run `npm test` (`scripts/run-unit-tests.cjs`) and confirm new converter + extraction tests pass alongside existing `lib/generation/*.test.ts`.
- [x] 5.2 Run `npm run build` to confirm the KaTeX CSS import and renderer changes compile under Next.js 15 / React 19.
- [x] 5.3 Update `README.md` with a short "Math support" note describing DOCX/PPTX equation preservation and KaTeX rendering, and credit the OMML mapping ported from markitdown.
