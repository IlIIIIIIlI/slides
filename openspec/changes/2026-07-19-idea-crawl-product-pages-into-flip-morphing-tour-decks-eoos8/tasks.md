## 1. Types and synthesis input contract

- [ ] 1.1 Read `lib/generation/anim-key-synthesis.ts` and `lib/generation/extract.ts` to capture the exact spatial fields (`bbox`, `_role`, content normalization) PDF blocks pass into synthesis; document that contract in a short comment at the top of the new web extract module (no behavior change to synthesis).
- [ ] 1.2 Inspect `core/schemas/types.ts` for `SlideSpec` / `ContentBlock` / presentation root fields; decide how to attach `sourceUrl` per slide (existing meta/notes field vs minimal type extension) and implement the minimal typed approach without breaking stored decks under `data/presentations/`.

## 2. Web layout extract (`lib/generation/web-layout-extract.ts`)

- [ ] 2.1 Add `extractBlocksFromHtml(html: string, options: { baseUrl: string })` using **jsdom**: strip script/style, resolve base URL, collect landmark nodes (logo, `nav`, `h1`–`h3`, main paragraphs, primary button/CTA link).
- [ ] 2.2 Assign each region an existing synthesis role (`title` | `body` | `code` | `figure` | `other`) and a normalized bbox in fixed bands (e.g. top strip nav, top-left logo, title band, content, CTA) so cross-page IoU can hit ≥ 0.5 for shared chrome.
- [ ] 2.3 Map regions to player `ContentBlock` types already rendered by `components/player/slide-view.tsx` / `core/rendering/adapter.ts` (headline for title, supporting/bullet-list for body, image/figure for logo when URL available).
- [ ] 2.4 Mark footers, tiny text, and decorative nodes as `_role: "other"` so they stay out of the match pool.
- [ ] 2.5 Add `lib/generation/web-layout-extract.test.ts` with fixture HTML strings (shared nav/logo vs different H1) and assert block roles, bbox presence, and stable text normalization.

## 3. Product crawl orchestrator (`lib/generation/product-crawl.ts`)

- [ ] 3.1 Implement `crawlProductPath({ urls, title?, options? })`: validate URL count/cap (e.g. max 12), https/http only, SSRF guard (block localhost, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, link-local, metadata IPs).
- [ ] 3.2 Implement sequential `fetch` with timeout; on non-OK or network error, throw/return a structured failure naming the URL.
- [ ] 3.3 Per URL: `extractBlocksFromHtml` → one `SlideSpec` (headline from H1 or `<title>`); assemble deck object consistent with `lib/generation/deck.ts` helpers if present, else mirror shape of existing files in `data/presentations/`.
- [ ] 3.4 Call existing anim-key synthesis entrypoint used by PDF import (same function as `extract.ts` post-process) across the slide array; leave `autoAnimate` default/true; do not set keys on `other` roles.
- [ ] 3.5 Add `lib/generation/product-crawl.test.ts` with **mocked fetch** returning fixture HTML pairs; assert slide count, `sourceUrl` traceability, and shared `lp:` keys on chrome between slide 0 and 1.

## 4. API route

- [ ] 4.1 Create `app/api/presentations/crawl/route.ts` (`POST`) parsing JSON `{ urls, title?, options? }`, calling `crawlProductPath`, persisting via the same storage pattern as sibling routes under `app/api/presentations/`.
- [ ] 4.2 Return `{ id, title, slideCount }` (or existing presentation DTO) on success; `400` for validation/SSRF; `502`/`500` with failing URL on fetch/extract failure.
- [ ] 4.3 Align auth/error JSON style with `app/api/presentations/` and `app/api/validate/` handlers.

## 5. Workspace UI

- [ ] 5.1 Add a crawl entry UI in `components/workspace/` (e.g. `product-crawl-form.tsx`): textarea for one URL per line, optional deck title, submit button, inline errors.
- [ ] 5.2 Wire submit to `POST /api/presentations/crawl` using the same fetch/error patterns as `hooks/use-generate.ts` / presentation list hooks; on success refresh list via `hooks/use-presentation-list.ts` or navigate to `app/player` for the new id.
- [ ] 5.3 Mount the control from the workspace route under `app/(site)/workspace/` next to existing import/generate actions without redesigning the whole page.

## 6. Docs and regression

- [ ] 6.1 Extend `README.md` Auto-Animate / Imported decks section with **Product path crawl**: multi-URL → `web-layout-extract` → `anim-key-synthesis` → `lp:` keys; note MVP is static HTML GET (not full SPA interaction); note SSRF limits.
- [ ] 6.2 Run `pnpm test` / `npm test` (`scripts/run-unit-tests.cjs`) and fix failures in new tests plus any import breakage in `anim-key-synthesis` consumers.
- [ ] 6.3 Manually smoke (or script) a two-URL crawl against local fixtures via the orchestrator; confirm player opens the deck and chrome blocks carry matching `lp:` keys in the saved JSON under `data/presentations/`.
