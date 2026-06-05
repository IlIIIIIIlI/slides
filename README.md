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

### 2026-06-05 — Hardened OMML→LaTeX converter: n-ary, limits, and grouping characters

The OMML→LaTeX converter in `lib/generation/omml/` is a TypeScript port of Microsoft's markitdown `omml.py`. Since the original port, upstream markitdown hardened several math handlers that our fork was missing or implementing only partially — causing those equation types to fall back to the KaTeX error tile when uploading DOCX or PPTX files.

This change closes four coverage gaps:

- **N-ary operators (`m:nary`)** — the `nary` handler now correctly defaults to the integral glyph (`∫`) when no `m:chr` is specified (per the OMML spec), falls back to the raw Unicode glyph for unknown operators instead of emitting `\sum`, and honours `m:limLoc = undOvr` by emitting `\limits` so summation/product limits render above and below the operator. The glyph→command table gains `\oint`, `\bigsqcup`, `\bigvee`, and `\bigwedge`.

- **Lower limits (`m:limLow`)** — previously only detected `lim` as a special operator; now recognises the full set (`lim`, `max`, `min`, `sup`, `inf`, `gcd`, `det`) and emits `\cmd_{…}` for each. Non-operator bases still use `\underset`.

- **Upper limits (`m:limUpp`)** — previously always emitted `\overset`; now detects operator bases and emits `\cmd^{…}` instead, matching upstream behaviour.

- **Grouping characters (`m:groupChr`)** — handler was absent entirely; added to emit `\overbrace{…}` (⏞), `\underbrace{…}` (⏟), or `\overset`/`\underset` for arbitrary grouping glyphs based on the `m:pos` attribute.

All four handlers are covered by new focused unit tests (`lib/generation/omml/omml-nary-limits.test.ts`) that assert correct LaTeX output **and** confirm KaTeX accepts each expression without error. The test suite grows from 36 to 50 passing tests.
