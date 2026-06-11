## Why

The OMML→LaTeX converter in `lib/generation/omml/` is a TypeScript port of markitdown's `omml.py`. Since the original port, upstream markitdown (v0.1.2+) hardened several math handlers — notably `do_nary` (n-ary operators like Σ, ∏, ∫ with limits), `do_limUpp`/`do_limLow` (over/under limits) and `do_groupChr` (grouping characters such as overbraces). Equations using these constructs that our fork handles incompletely fall back to the styled KaTeX error tile (see `lib/markdown-inline.tsx`, `throwOnError: false`), degrading the slide for any uploaded DOCX/PPTX containing summations, integrals or limit notation.

This change closes the coverage gap by diffing our `tag2meth`-style handler map against the current upstream and porting the missing/stale `nary`, `limUpp`, `limLow` and `groupChr` logic. It is a pure-logic port: no new dependencies, no UI changes, no schema changes — it strengthens an existing differentiator.

## What Changes

- Port upstream markitdown's hardened `do_nary` handler so n-ary operators emit correct LaTeX (`\sum`, `\prod`, `\int`, `\oint`, `\bigcup`, etc.) with proper sub/superscript placement from `m:sub`/`m:sup` and `m:naryPr` `m:chr` / `m:limLoc`.
- Port/repair `do_limUpp` and `do_limLow` so over-script and under-script limits map to `\overset`/`\underset` (or `^`/`_` when the base is an operator) matching upstream behavior.
- Port `do_groupChr` so grouping characters (overbrace/underbrace and arbitrary `m:chr`) render correctly using `m:groupChrPr` position (`top`/`bot`).
- Ensure each handler is registered in the converter's tag→method dispatch map (the `tag2meth` equivalent in `lib/generation/omml/`).
- Add focused unit tests with real OMML fixtures for each ported case, wired into the existing `scripts/run-unit-tests.cjs` runner.
- Update README math section to note the expanded n-ary / limit / grouping coverage.

## Impact

- Affected specs: `omml-conversion` (new capability spec capturing converter behavior).
- Affected code: `lib/generation/omml/` (handler modules + dispatch map), new test file under `lib/generation/omml/`, README math section.
- No new dependencies; no changes to extraction pipeline (`lib/generation/extract.ts`), renderer (`lib/markdown-inline.tsx`), schemas, or API routes.
- Fewer uploaded equations fall back to the KaTeX error tile.

## Inspired by

- https://github.com/microsoft/markitdown

## Decision

- [ ] **Adopt** — proceed with `tasks.md`
- [ ] **Defer** / **Reject**

_novelty 2/5 · effort 1/5 · promoted from a Project Steward idea you approved._
