# Change: Crawl product pages into Flip-morphing tour decks

## Why

PDF/PPTX import already turns static pages into morphing decks via `lib/generation/extract.ts` + `lib/generation/anim-key-synthesis.ts` (role + grid fingerprint + IoU → stable `lp:<role>:<n>` keys). Product walkthroughs live on the web as ordered URL sequences (landing → feature → pricing → signup). Those paths have shared chrome (nav, logo, primary CTA) that *should* Flip-morph between steps—but the repo has no multi-URL scrape → layout-bbox → synthesis path. Authors either hand-write `animKey`s or import a flat PDF that never saw real DOM chrome continuity.

## What Changes

- Add a **product-path crawl** pipeline: ordered list of product URLs → per-step HTML fetch + DOM layout extract (blocks + normalized bboxes) → `SlideSpec[]` → existing `synthesizeAnimKeys` / role+IoU in `lib/generation/anim-key-synthesis.ts`.
- Reuse the PDF fidelity pattern: blocks with spatial metadata feed synthesis; explicit `animKey`s are never overwritten; `_role: "other"` stays out of the match pool.
- Expose crawl via a new API route under `app/api/presentations/` (or sibling) and a workspace entry so users paste a multi-URL path without authoring `.pptx`.
- Optional per-step screenshot (via server-side capture or stored layout snapshot) as `image` / figure blocks when pure text extract is insufficient for marketing chrome.
- Document the crawl → Flip tour flow next to the existing Auto-Animate / PDF synthesis sections in `README.md`.

## Capabilities

### New Capabilities
- `product-crawl-tour`: Multi-URL product page crawl produces a presentation deck with layout-derived blocks and synthesized `lp:` animKeys so shared UI chrome Flip-morphs across consecutive tour steps in the existing player (`core/rendering/morph.ts`, `hooks/use-auto-animate.ts`).

### Modified Capabilities
- None (anim-key synthesis and player morph stay as-is; crawl is a new *source* of spatially annotated slides, parallel to PDF extract).

## Impact

- **New:** `lib/generation/product-crawl.ts` (URL sequence orchestration), `lib/generation/web-layout-extract.ts` (jsdom DOM → blocks + bboxes), tests under `lib/generation/*.test.ts`.
- **Reuse:** `lib/generation/anim-key-synthesis.ts` (unchanged contract: role + FNV content hash + 12×9 grid IoU ≥ 0.5), `lib/generation/deck.ts` / presentation persistence under `app/api/presentations/`, `core/schemas/types.ts` `SlideSpec` / `ContentBlock` shapes.
- **API/UI:** new route handler + workspace control to submit ordered URLs and open the resulting deck in `app/player/`.
- **Deps:** prefer existing `jsdom` for HTML parse/layout; do **not** add Firecrawl/open-lovable as a hard runtime dependency—mirror their scrape→structure *loop* with fetch + DOM extract. Screenshot capture may use env-gated tooling if present; otherwise layout-only extract is the MVP.
- **Out of scope:** full SPA interaction recording, authenticated crawls, rewriting PPTX/PDF import, changing Flip player behavior or `autoAnimate` semantics.

## Inspired by

- https://github.com/firecrawl/open-lovable

## Decision

- [ ] **Adopt** — proceed with `tasks.md`
- [ ] **Defer** / **Reject**

_novelty 4/5 · effort 3/5 · promoted from a Project Steward idea you approved._
