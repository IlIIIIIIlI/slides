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

### 2026-06-13 — GSAP-driven reveal timeline DSL with strict schema validation

Added a `timeline` field to `SlideSpec` (core schemas) and the `Slide` interface (app/slides), enabling per-slide sequenced element reveals driven by GSAP. Each timeline entry has three fields: `at` (when the animation fires), `target` (which element to animate, identified by a stable `data-anim` attribute), and `tween` (the from-state for the reveal animation).

**Why:** The player was previously limited to static slide content with only Flip-based cross-slide morphing. This change introduces a reveal DSL so Claude-generated decks can describe bullet-point staggering, KaTeX block fade-ins, and other sequenced animations as first-class schema data — without requiring ad-hoc CSS or custom component props.

Four implementation concerns raised in code review were addressed:

1. **Strict tween property whitelist** — `TimelineTween` only allows visual transform/opacity properties (`opacity`, `x`, `y`, `xPercent`, `yPercent`, `scale`, `scaleX`, `scaleY`, `rotation`) plus timing parameters (`duration`, `ease`, `stagger`, `delay`). Layout-breaking properties (`width`, `height`, `left`, `top`, `margin`, `padding`), colour properties, and DOM-manipulation keys (`innerHTML`, `attr`) are excluded at both the TypeScript type level and the runtime validator.

2. **Clarified `at` field semantics** — numeric `at` values place the tween at an absolute second offset from the timeline start; string values use GSAP's standard position-parameter syntax (`"+=0.5"` for 0.5 s after the previous tween ends, `"-=0.2"` for a 200 ms overlap, `"<"` to align with the start of the previous tween, etc.). Both forms are validated in `lib/generation/validate.ts`.

3. **SSR-safe plugin registration** — A new `lib/animation/scroll-trigger.ts` module mirrors the existing `flip.ts` pattern: it registers GSAP's ScrollTrigger plugin only when `typeof window !== 'undefined'`, preventing Next.js SSR from accessing browser APIs during server-side rendering.

4. **React lifecycle cleanup** — The `useSlideTimeline` hook in `lib/animation/slide-timeline.ts` imports GSAP dynamically, creates a timeline, and registers a cleanup callback that calls `tl.kill()` to release all tweens. A `cancelled` flag prevents the async import from starting a timeline if the effect was already cleaned up (e.g., rapid slide navigation or component unmount).

**Stable element targeting** — `components/player/adjustable.tsx` now renders `data-anim={elKey}` on its wrapper `<div>`. Every existing adjustable element in the player (headline, supporting, points, code, quote, bigNumber, etc.) is automatically addressable as a timeline target by its logical key name.

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
