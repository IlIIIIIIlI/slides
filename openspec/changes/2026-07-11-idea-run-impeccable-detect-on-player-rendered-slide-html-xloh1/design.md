# Design: Impeccable detect on player-rendered slide HTML

## Context

This repo is a Next.js 15 App Router deck app (`ai-nextjs-slides`). Slides are authored as `SlideSpec` JSON (`core/schemas/types.ts`) with `contentBlocks` (headline, supporting, bullet-list, code-block, etc.). The player renders them through `core/rendering/adapter.ts` into `components/player/slide-view.tsx`. Structural antislop already lives under `core/validation/antislop/`; fidelity and vision paths live under `lib/generation/fidelity.ts` and `lib/generation/vision.ts`. Dependencies already include **`jsdom`** and **`modern-screenshot`** — enough for DOM snapshots without a new browser stack for the default path.

The approved idea: after generation or import, snapshot each slide's **player DOM**, run Impeccable-style **deterministic detect** (~46 rules, no LLM), map findings to **contentBlock paths**, and use those paths for **constrained re-prompt** of only offending blocks.

## Goals / Non-Goals

**Goals**
- Detect visual slop that only exists post-CSS (gradient text, multi-axis grid backgrounds, low-contrast type, etc.) on player HTML.
- Attribute findings to `slides[s].contentBlocks[i]` (and optionally `animKey`) with high confidence when a block root is identifiable.
- Integrate into post-generate / post-import validate → repair without mandatory vision or LLM detect calls.
- Keep the default path Node-runnable for `scripts/run-unit-tests.cjs` and API routes.

**Non-Goals**
- Replacing `core/validation/antislop/` or DESIGN.md guidance.
- Full Impeccable "craft" / LLM rewrite features — **detect only**.
- Pixel-perfect browser screenshot CI for every rule (jsdom + computed-style heuristics first; real paint only if a rule cannot be expressed in DOM/CSS).
- Auto-merging repair without the existing generation/repair flow.

## Decisions

### 1. Where detection lives

**Decision:** New package-style folder `core/validation/impeccable/` next to `core/validation/antislop/`.

| File | Role |
|------|------|
| `types.ts` | `ImpeccableFinding`, `DetectReport`, severity, rule ids |
| `rules.ts` | Rule registry (id, description, severity, `check(doc, ctx)`) |
| `detect.ts` | `detectSlideHtml(html, ctx) → DetectReport` |
| `render-snapshot.ts` | SlideSpec → player HTML string via adapter + jsdom document |
| `map-findings.ts` | Finding DOM node → contentBlock path |
| `index.ts` | Public API |
| `*.test.ts` | Fixtures for gradient-text, grid-bg, contrast, attribution |

**Rationale:** Mirrors antislop layout; stays importable from `lib/generation/validate.ts` and `app/api/validate/` without pulling React client components into Node tests.

### 2. Snapshot strategy

**Decision:** Default = **HTML string from rendering adapter + jsdom**.

1. Given a `SlideSpec` (and theme from `core/theming/presets.ts` / deck theme), call the same block→HTML mapping the player uses (`core/rendering/adapter.ts`). Prefer extracting a pure `renderSlideToHtml(slide, theme) → string` helper if the adapter is currently React-only — either export a string builder from the adapter or a thin server helper under `core/validation/impeccable/render-snapshot.ts` that reuses adapter class names / structure.
2. Load HTML into `jsdom` with a minimal document shell that includes the CSS variables / utility classes needed for contrast and background rules (inject critical player CSS from `app/globals.css` subset or a test fixture stylesheet — document the minimal set in code comments).
3. Run rules against `document` / element styles (`getComputedStyle` where jsdom supports it; fall back to inline/class heuristics when computed styles are incomplete).

**Fallback / optional path:** For rules that need layout boxes (overflow, collision), document an optional `modern-screenshot` HTML capture path used only in browser-side workspace checks — not required for CI unit tests of the core rule set.

### 3. Block attribution in the DOM

**Decision:** Ensure each content block root in player markup carries:

- `data-block-index="{i}"` — stable index into `slide.contentBlocks`
- `data-block-type="{type}"` — e.g. `headline`, `code-block`
- `data-anim-key="{animKey}"` when present (aligns with morph / README animKey behavior)

Implementation touch points:
- `core/rendering/adapter.ts` (and any React wrappers in `components/player/slide-view.tsx`) must set these attributes on the outermost element per block.
- `map-findings.ts` walks from the rule's target element up to the nearest `[data-block-index]` and builds path `slides[{slideIndex}].contentBlocks[{i}]`.
- If no block ancestor is found (slide-level background, chrome), path is `slides[{slideIndex}]` with `scope: "slide"`.

### 4. Rule set (Impeccable-inspired, deterministic)

**Decision:** Port a **curated subset first**, structured so all ~46 rule ids can be registered with enable/disable flags. Priority rules that match the product idea and DESIGN-adjacent slop:

- Gradient text / clipped gradients on type
- Two-axis (or busy) grid / mesh backgrounds on slide or block containers
- Low-contrast text vs background (relative luminance threshold)
- Excessive text-shadow / glow on body copy
- Decorative line / divider spam
- Overlapping or zero-gap stacked blocks (when geometry available)
- Font-size floor for body vs headline hierarchy inversion
- Pure icon/emoji-as-heading anti-patterns if detectable in HTML

Each rule returns zero or more findings:

```ts
type ImpeccableFinding = {
  ruleId: string;           // e.g. "gradient-text"
  severity: "error" | "warn" | "info";
  message: string;
  slideIndex: number;
  /** JSON-ish path for repair prompts */
  path: string;             // "slides[0].contentBlocks[2]" | "slides[0]"
  blockIndex?: number;
  animKey?: string;
  evidence?: {
    selector?: string;
    snippet?: string;       // truncated class/style
  };
};

type DetectReport = {
  slideIndex: number;
  findings: ImpeccableFinding[];
  rulesRun: string[];
  durationMs: number;
};
```

Rules that cannot be implemented faithfully under jsdom stay registered as `skipped` with reason in test/docs — do not fake green.

### 5. Integration points

| Stage | File(s) | Behavior |
|-------|---------|----------|
| Validate | `lib/generation/validate.ts`, `app/api/validate/` | After structural/schema validation, run detect on each slide; attach `impeccable: DetectReport[]` to the validate result |
| Repair | `lib/generation/repair.ts`, `lib/generation/prompts.ts` | Group findings by `path`; build constrained re-prompt payload listing only offending blocks + rule messages (reuse repair patterns already used for validate failures) |
| Generation complete | `lib/generation/single-draft.ts` / deck pipeline / `hooks/use-generate.ts` consumers | Optionally auto-run detect; surface counts in UI |
| Import | `lib/generation/extract.ts` post-path, anim-key synthesis exit | Run detect after imported SlideSpecs are built so PDF/PPTX imports get the same badge |
| UI | `components/fidelity/slop-badge.tsx` | Accept or map Impeccable error/warn counts (label e.g. "Design detect") without requiring vision |

### 6. Constrained re-prompt contract

When repair is triggered from Impeccable findings:

1. Collect unique `blockIndex` values with `severity >= warn` (configurable threshold).
2. Pass into repair prompt builder: block type, current block JSON, ruleId + message list.
3. Instruct the model to return **only** replacement `contentBlocks` entries (or patch ops) for those indices — not a full slide rewrite — consistent with how `lib/generation/repair.ts` already scopes fixes when possible.
4. Re-run detect on the repaired slide; cap iterations (e.g. 1–2) to avoid loops.

### 7. Dependency / licensing

**Decision:** Implement rules **in-repo** inspired by pbakaus/impeccable's public detect heuristics rather than adding an unmaintained or browser-only package if it does not fit Node. Cite inspiration in `core/validation/impeccable/README.md` or module header. No new LLM provider deps. Avoid adding Playwright unless a later change requires it; this change uses **jsdom** first.

## Data flow

```
SlideSpec (+ theme)
    → render-snapshot (adapter HTML + data-block-* attrs)
    → jsdom document
    → detect(rules)
    → map-findings → DetectReport
    → validate API / repair prompts / slop-badge
```

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| jsdom computed styles incomplete vs real browser | Prefer class/style attribute heuristics for Tailwind-heavy markup; document known gaps; optional browser path later |
| False positives on intentional marketing slides | Severity levels + allowlist rule disable at deck level (`detectOptions` or reuse presentation flags) |
| Adapter React-only, hard to snapshot in Node | Extract pure HTML/string rendering for blocks used by both player and detect |
| Attribute missing on some block types | Task checklist covers every ContentBlock type rendered in `slide-view` |
| Repair over-prompting | Path-scoped prompts + max iterations |

## Testing strategy

- Unit: synthetic HTML fixtures with known violations assert ruleId + path.
- Unit: clean fixture SlideSpec → zero error-severity findings.
- Unit: `map-findings` with nested spans inside a block root.
- Integration: `validate.ts` includes impeccable reports in result shape.
- Integration: repair prompt includes only listed block indices (snapshot or string contains assertions).
- No network, no API keys in detect tests.

## Rollout

1. Attributes + snapshot + 5–10 high-value rules + tests.
2. Validate API + slop-badge wiring.
3. Repair constrained re-prompt.
4. Expand rule registry toward full 46 with skip markers for unsupported rules.
