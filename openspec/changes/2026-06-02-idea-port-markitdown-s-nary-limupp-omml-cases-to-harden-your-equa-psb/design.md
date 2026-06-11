## Context

`lib/generation/omml/` is a self-contained TS port of markitdown's `omml.py`. The Python original uses a dictionary mapping OMML element tags (e.g. `nary`, `limUpp`, `limLow`, `groupChr`) to handler methods (`do_nary`, `do_limUpp`, ...) — referred to as the `tag2meth` map. The converter walks `m:oMath` / `m:oMathPara` subtrees and dispatches each child element to its handler, accumulating LaTeX.

Upstream markitdown updated these handlers after our port was taken. The constructs they cover are common in academic/business equations:
- **n-ary** (`m:nary`): Σ, ∏, ∫, ∮, ⋃, ⋂ etc., with optional lower/upper bounds and a custom operator char (`m:naryPr/m:chr`).
- **limUpp / limLow** (`m:limUpp`, `m:limLow`): a base with an upper or lower limit (e.g. `lim_{x→0}`, function-over-arrow).
- **groupChr** (`m:groupChr`): a base wrapped by a grouping character above or below (overbrace/underbrace).

We cannot see the exact internal naming of our fork beyond the directory, so the design references the upstream-equivalent handler names and requires the implementer to locate the existing dispatch map and either add or replace these handlers.

## Goals / Non-Goals

Goals:
- Match current upstream markitdown semantics for `nary`, `limUpp`, `limLow`, `groupChr`.
- Pure logic; deterministic LaTeX output; no new runtime deps.
- Test parity with concrete OMML fixtures.

Non-Goals:
- Re-architecting the converter or its parser.
- Changing extraction or rendering.
- Supporting OMML features beyond the four handlers above.

## Decisions

### Decision: Mirror upstream handler semantics rather than invent mappings
We port the LaTeX-emission logic verbatim from the current markitdown `omml.py` tag2meth handlers so behavior stays diff-able against upstream for future weekend ports.

- **nary**: read `m:naryPr/m:chr` (default `∫` per OMML spec when absent); map the operator glyph to a LaTeX command via a glyph→command table (`∑→\sum`, `∏→\prod`, `∫→\int`, `∮→\oint`, `⋃→\bigcup`, `⋂→\bigcap`, `⨆→\bigsqcup`, `⋁→\bigvee`, `⋀→\bigwedge`, default fallback emits the raw glyph). Read `m:naryPr/m:limLoc` (`undOvr` vs `subSup`) to decide between `\limits` placement and inline `_{}^{}`. Emit `\op_{sub}^{sup}{body}` where `sub`/`sup` come from `m:sub`/`m:sup` children (omit if empty), and `body` from `m:e`.
- **limLow / limUpp**: render the base `m:e`; if the base is a known operator name (e.g. `lim`, `max`, `min`, `sup`, `inf`) emit `\base_{lim}` (limLow) / `\base^{lim}` (limUpp); otherwise emit `\underset{lim}{base}` (limLow) / `\overset{lim}{base}` (limUpp). The limit text comes from `m:lim`.
- **groupChr**: read `m:groupChrPr/m:chr` and `m:groupChrPr/m:pos` (`top`/`bot`). For the standard overbrace `⏞`/`\u23DE` use `\overbrace{e}`; underbrace `⏟`/`\u23DF` use `\underbrace{e}`; for other chars fall back to `\overset{chr}{e}` (pos=top) or `\underset{chr}{e}` (pos=bot).

### Decision: Keep the dispatch map as the single integration point
All four handlers must be reachable from the converter's tag→method map so the recursive walk picks them up. The implementer registers `nary`, `limUpp`, `limLow`, `groupChr` keys pointing at the (new or updated) handler functions.

### Decision: Test via real OMML XML fixtures
Unit tests feed each handler raw `m:oMath` XML (extracted from markitdown's own test corpus or hand-authored) and assert exact LaTeX strings, ensuring KaTeX would parse them without the error fallback.

## Risks / Trade-offs

- **Stale parser internals**: if our fork's element-access helpers differ from upstream, handlers must adapt to the existing parse representation. Mitigation: locate and reuse the converter's existing child-element accessor used by sibling handlers (e.g. fraction/superscript) rather than introducing a new XML access path.
- **Glyph table drift**: operator-glyph→LaTeX table may miss exotic operators; default-to-raw-glyph keeps output non-fatal under KaTeX (which can render many unicode operators).

## Migration Plan

No data migration. Behavior-additive: previously-erroring equations now render. No feature flag needed.
