## 1. Locate and diff the existing converter

- [ ] 1.1 Inventory the files in `lib/generation/omml/` and identify the tag→method dispatch map (the `tag2meth` equivalent) and the existing sibling handlers (e.g. fraction, sup/sub) to reuse their child-element accessor pattern.
- [ ] 1.2 Pull the current upstream markitdown `omml.py` (`do_nary`, `do_limUpp`, `do_limLow`, `do_groupChr`) and write down the exact LaTeX-emission semantics each produces.
- [ ] 1.3 Note in a short comment which of the four handlers are missing vs. stale in the fork.

## 2. Port the n-ary handler

- [ ] 2.1 In `lib/generation/omml/`, add a glyph→LaTeX-command table covering `∑→\sum`, `∏→\prod`, `∫→\int`, `∮→\oint`, `⋃→\bigcup`, `⋂→\bigcap`, `⨆→\bigsqcup`, `⋁→\bigvee`, `⋀→\bigwedge`, with raw-glyph fallback.
- [ ] 2.2 Implement the `nary` handler: read `m:naryPr/m:chr` (default `∫`), `m:naryPr/m:limLoc`, and the `m:sub`/`m:sup`/`m:e` children; emit `\op_{sub}^{sup}{body}` with empty scripts omitted and `\limits` placement honored for `undOvr`.
- [ ] 2.3 Register `nary` in the dispatch map alongside existing handlers.

## 3. Port the limit handlers

- [ ] 3.1 Add a known-operator set (`lim`, `max`, `min`, `sup`, `inf`, `gcd`, `det`) for choosing script vs. overset/underset behavior.
- [ ] 3.2 Implement `limLow`: render `m:e`; if base is a known operator emit `\base_{lim}`, else `\underset{lim}{base}` from `m:lim`.
- [ ] 3.3 Implement `limUpp`: render `m:e`; if base is a known operator emit `\base^{lim}`, else `\overset{lim}{base}`.
- [ ] 3.4 Register `limLow` and `limUpp` in the dispatch map.

## 4. Port the grouping-character handler

- [ ] 4.1 Implement `groupChr`: read `m:groupChrPr/m:chr` and `m:groupChrPr/m:pos`; map `⏞`(`\u23DE`)→`\overbrace{e}`, `⏟`(`\u23DF`)→`\underbrace{e}`, else `\overset{chr}{e}` (top) / `\underset{chr}{e}` (bot).
- [ ] 4.2 Register `groupChr` in the dispatch map.

## 5. Tests

- [ ] 5.1 Create `lib/generation/omml/omml-nary-limits.test.ts` (or extend the existing omml test file) with raw `m:oMath` XML fixtures for: summation with bounds, default integral, product with `undOvr`, unknown operator glyph fallback.
- [ ] 5.2 Add fixtures and assertions for `limLow` on `lim` (→`\lim_{x \to 0}`) and `limUpp` on a non-operator base (→`\overset{...}{...}`).
- [ ] 5.3 Add fixtures and assertions for overbrace, underbrace, and a non-brace bottom grouping char.
- [ ] 5.4 Add a nested fixture (`m:f` containing `m:nary`) asserting the dispatch map reaches the nested handler.
- [ ] 5.5 For each expected LaTeX string, assert `katex.renderToString(latex, { throwOnError: true })` does not throw, proving the output avoids the error tile.
- [ ] 5.6 Confirm the new tests run via `node scripts/run-unit-tests.cjs` (and `npm test`), updating the runner's discovery glob if it does not auto-pick the new file.

## 6. Docs

- [ ] 6.1 Update the README "Math support" section to note that n-ary operators (Σ/∏/∫), over/under limits, and grouping characters (over/underbrace) are now covered by the OMML→LaTeX converter.
- [ ] 6.2 Add an inline code comment in the dispatch map referencing the upstream markitdown `omml.py` handler names to keep future diffs cheap.
