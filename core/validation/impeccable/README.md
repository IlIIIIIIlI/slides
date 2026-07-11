# Impeccable detect (`core/validation/impeccable`)

Deterministic **visual-slop detection** on **player-rendered slide HTML**.  
Inspired by [pbakaus/impeccable](https://github.com/pbakaus/impeccable) — **detect only**, zero LLM cost.

## Flow

```
SlideSpec (+ theme)
  → renderSlideToHtml (adapter: data-block-index / type / anim-key)
  → jsdom document (+ minimal CSS variables)
  → rule registry
  → map-findings → DetectReport
  → validate API / repair prompts / slop-badge
```

Structural antislop under `core/validation/antislop/` remains complementary (token/JSON checks). This module catches patterns that only appear **after** CSS (gradient text, mesh backgrounds, low contrast, etc.).

## Public API

| Export | Role |
|--------|------|
| `detectSlideSpec(slide, theme?, slideIndex?)` | Snapshot + detect for one slide |
| `detectSlideHtml(html, ctx)` | Detect on an HTML string |
| `renderSlideToHtml(spec, theme?)` | Player-shaped HTML with block attrs |
| `mapFindings` / `resolveBlockPath` | DOM node → `slides[n].contentBlocks[i]` |
| `ALL_RULES` / `HIGH_VALUE_RULES` | Rule registry |

## Enabled rules (high-value)

| ruleId | Severity | Notes |
|--------|----------|-------|
| `gradient-text` | warn | `background-clip: text` + gradient / transparent fill |
| `multi-axis-grid-background` | warn | Multi-layer gradient / mesh / grid backgrounds |
| `low-contrast-text` | error | Approx. WCAG contrast &lt; 4.5:1 |
| `excessive-text-shadow` | warn | Multi-layer or large-blur glow on type |
| `decorative-line-spam` | info | Many `hr` / border dividers |
| `font-size-hierarchy` | warn | Body size ≥ headline size |
| `emoji-as-heading` | warn | Headline is mostly emoji |

## Skipped rules

Remaining Impeccable-inspired ids are **registered** with `enabled: false` and a `skipReason`:

- **Layout** — needs real geometry (overlap, overflow, tap targets)
- **Paint** — needs browser screenshot / pixels (blur over text, glassmorphism)
- **Future** — heuristic not ported yet

Skipped rules never produce findings (no fake greens).

## Snapshot CSS

`SNAPSHOT_BASE_CSS` only sets a 16px root, padding, and display typography.  
Contrast/background rules resolve `--slide-*` CSS variables from the slide root inline style (theme tokens from `core/theming/presets.ts`).

## Non-goals

- No Playwright/Puppeteer on the default path (jsdom only)
- No full Impeccable “craft” / LLM rewrite
- Does not mutate `animKey` or content (read-only analysis)
