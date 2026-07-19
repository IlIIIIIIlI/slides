# Design: Product crawl → Flip-morphing tour decks

## Context

**slides** (`ai-nextjs-slides`) is a Next.js 15 app. Decks are JSON `Presentation` documents with `slides: SlideSpec[]` and per-block `ContentBlock`s. The player morphs consecutive slides when blocks share stable `animKey` values (GSAP Flip via `lib/animation/flip.ts`, `core/rendering/morph.ts`, `hooks/use-auto-animate.ts`).

PDF import already:
1. Parses pages with bboxes in `lib/generation/extract.ts` (`@llamaindex/liteparse`).
2. Assigns roles and synthesizes `lp:<role>:<n>` keys in `lib/generation/anim-key-synthesis.ts`.
3. Never overwrites explicit keys; excludes `_role: "other"`.

This change adds a **web product path** as a second spatial source: an ordered multi-URL crawl yields the same kind of layout-annotated blocks so synthesis can lock shared chrome across steps.

## Goals / Non-Goals

**Goals**
- Accept an ordered list of product URLs (min 2 for morph value; allow 1 for degenerate single-slide decks).
- For each URL: fetch HTML, extract structural UI regions as content blocks with normalized page-relative bboxes.
- Map regions into existing block types used by the player (`headline`, `supporting`, `bullet-list`, figure/image-like blocks as already modeled in `core/schemas/types.ts`).
- Run **the same** anim-key synthesis used for PDF so keys look like `lp:title:1`, `lp:figure:3`, etc.
- Persist a normal presentation JSON consumable by `app/player/` with morph enabled (`autoAnimate` default true).
- Unit-test extract + crawl orchestration + synthesis integration without live network (fixture HTML).

**Non-Goals**
- Browser automation of clicks/forms (no full Playwright tour recorder in MVP).
- Firecrawl cloud API or vendoring open-lovable.
- Perfect pixel-identical screenshots of every SaaS marketing site.
- Changing IoU threshold, grid size, or `lp:` key format in `anim-key-synthesis.ts` unless a crawl-specific bug forces a pure additive helper.
- PPTX/DOCX crawl (already out of spatial synthesis by design).

## Architecture

```
Ordered URLs (client / API)
        │
        ▼
lib/generation/product-crawl.ts
  crawlProductPath({ urls, options })
        │  per URL
        ▼
  fetchHtml(url)  ──►  web-layout-extract.extractBlocksFromHtml(html, { baseUrl })
        │                         │
        │                         ├─ role heuristics (nav/logo/cta/title/body/other)
        │                         ├─ quantized bbox (same 12×9 grid contract as PDF path)
        │                         └─ ContentBlock[] + spatial meta for synthesis
        ▼
  assemble slides (one SlideSpec per URL; title from <title>/h1)
        │
        ▼
lib/generation/anim-key-synthesis.ts  (existing)
  synthesize across adjacent slides → animKey = lp:<role>:<n>
        │
        ▼
lib/generation/deck.ts / presentations API
  persist Presentation → data/presentations/<id>.json
        │
        ▼
app/player  Flip morph on nav/logo/CTA keys
```

### Component responsibilities

| Piece | Path | Responsibility |
|-------|------|----------------|
| Crawl orchestrator | `lib/generation/product-crawl.ts` | Validate URL list, sequential fetch, timeout/error per step, build `SlideSpec[]`, call synthesis, return deck draft |
| Web layout extract | `lib/generation/web-layout-extract.ts` | jsdom parse; select landmark nodes (header/nav/main/h1–h3/button/a.cta/img[logo]/ approximate layout boxes; emit blocks + `_role` + bbox fields compatible with synthesis input |
| Anim keys | `lib/generation/anim-key-synthesis.ts` | **Unchanged public API**; crawl adapters must produce the same input shape PDF extract already feeds |
| API | `app/api/presentations/crawl/route.ts` (new) | `POST` body `{ urls: string[], title?: string }`; returns created presentation id + summary |
| UI | `components/workspace/` + workspace page | Multi-line URL input, submit, progress, link to player |
| Types | `core/schemas/types.ts` | Only if crawl needs a thin optional field (e.g. `sourceUrl` on slide meta); prefer no schema break—store URL in slide notes/meta already allowed by types |

### Data shapes

**Request (API)**
```ts
{
  urls: string[];          // ordered product path, https only
  title?: string;          // deck title; default from first page <title>
  options?: {
    maxUrls?: number;      // hard cap e.g. 12
    timeoutMs?: number;    // per-fetch
    includeScreenshots?: boolean; // MVP may no-op or stub
  }
}
```

**Per-step intermediate (internal)**
```ts
{
  url: string;
  title: string;
  blocks: Array<ContentBlock & {
    // spatial fields required by anim-key-synthesis input
    // match whatever extract.ts already attaches for PDF
    // e.g. bbox: { x, y, w, h } normalized 0–1, _role: Role
  }>;
}
```

**Output:** standard presentation JSON already used under `data/presentations/`.

### Layout extract strategy (repo-specific)

Use **jsdom** (already a dependency) server-side:

1. Load HTML; resolve relative links against `baseUrl`.
2. Prefer semantic regions:
   - `header img, [class*=logo], a[href="/"]` → figure/logo role
   - `nav a` cluster → single nav chrome block (text join) role suitable for synthesis (map to existing roles: treat logo as `figure`, primary heading as `title`, body copy as `body`, primary CTA button/link as distinct fingerprintable block—map CTA to `other` **only if** it would create spurious matches; prefer a stable role the synthesis already matches, e.g. treat primary CTA as `body` with strong content hash **or** extend role enum **only if** `anim-key-synthesis.ts` already allows custom roles—**do not invent roles synthesis ignores**. Ground rule: map crawl regions onto existing roles in `anim-key-synthesis.ts` (`title`, `body`, `code`, `figure`, `other`). Nav bar → one `body` or `figure` block with consistent bbox band (top strip); logo → `figure` top-left; H1 → `title`; primary CTA → `body` bottom/mid with CTA text hash.
3. Approximate bboxes without a full layout engine: use document-order + simple column heuristics (full-width top band y=0–0.12 for nav; title band; content columns). Quantize the same way synthesis expects so IoU ≥ 0.5 works across pages that share chrome.
4. Strip scripts/styles; ignore footers/page noise as `_role: "other"`.

If two consecutive product pages share nav text + similar top-band bbox, synthesis assigns the same `lp:…` key → Flip morphs chrome in the player.

### Screenshot option

MVP: **layout extract only** (deterministic, testable with fixtures under e.g. `lib/generation/fixtures/product-crawl/`).  
Stretch: if `includeScreenshots` and a capture path is available, attach a step image via existing image block patterns (`components/workspace/slide-image-field.tsx` / generation image helpers)—still run synthesis on structural blocks, not on full-bleed screenshots alone.

### Integration with deck generation

- Prefer **direct SlideSpec assembly** from extract (no LLM required for MVP), so crawl is offline-reproducible and cheap—aligned with PDF spatial path rather than `single-draft.ts` LLM authoring.
- Optional later: pass crawl outline through `lib/generation/prompts.ts` for copy polish **after** keys are synthesized (must not strip `animKey`).

### Error handling

- Invalid URL / non-http(s) → 400.
- Single step fetch failure → mark step error or fail whole crawl with partial report (design choice: **fail the request if any required step fails**, with per-URL error list—simpler for agents).
- Empty extract → one placeholder headline from URL hostname so the slide still exists.
- SSRF: block private IP ranges / localhost in `product-crawl.ts` fetch helper.

### Player / morph

No player changes. Deck leaves `autoAnimate` unset/true. Reduced-motion and deck-level `autoAnimate: false` continue to short-circuit morph as today.

## Alternatives considered

1. **LLM-only page → slides without bboxes** — loses stable chrome keys; Flip would only auto-derive weak keys (`title`, `code:0`), not cross-page nav/CTA continuity. Rejected for the stated novelty.
2. **Full browser screenshot + vision** (`lib/generation/vision.ts`) — heavier, flaky; can be a follow-up. MVP uses DOM structure like open-lovable’s structure loop.
3. **Depend on Firecrawl API** — external key and network; not in `package.json`. Reimplement the loop with fetch + jsdom.
4. **Fork anim-key-synthesis for web roles** — unnecessary if crawl maps to existing roles and bbox contract.

## Risks / Mitigations

| Risk | Mitigation |
|------|------------|
| Approximate bboxes miss IoU 0.5 across pages | Normalize chrome to fixed bands (top nav, top-left logo) so consecutive product pages share grid cells |
| Heavy JS marketing sites return empty HTML | Detect thin body; surface clear error; optional note in README that static HTML works best for MVP |
| SSRF via user URLs | Allowlist http(s); deny private nets |
| Overwriting author keys | Synthesis already preserves explicit `animKey` |
| Scope creep into SPA crawler | Cap URLs; sequential GET only |

## Testing strategy

- Fixture HTML pairs (shared nav/logo/CTA, different H1/body) → extract → synthesis → assert same `lp:` keys on chrome blocks, different keys on changed body.
- Unit tests mirror `anim-key-synthesis.test.ts` / `extract.test.ts` style via `scripts/run-unit-tests.cjs`.
- API route: invalid body, SSRF rejection, happy path with mocked fetch.
