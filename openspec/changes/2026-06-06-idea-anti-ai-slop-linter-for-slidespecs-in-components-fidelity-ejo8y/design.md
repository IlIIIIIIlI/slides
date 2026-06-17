# Design: Anti-Slop Linter

## Context

The generation pipeline today is:

1. `lib/generation/deck.ts` calls Claude (`@anthropic-ai/sdk`) to draft a `Presentation` of `SlideSpec`s (shape defined in `core/schemas/types.ts`).
2. `lib/generation/validate.ts` schema-checks the JSON; `lib/generation/repair.ts` does one round-trip with Claude on schema errors.
3. `lib/generation/fidelity.ts` rasterises slides via `@napi-rs/canvas` + source PDFs and computes a visual fidelity score.
4. The workspace UI (`components/fidelity/pdf-preview.tsx`) renders side-by-side previews.

None of these steps look at *stylistic* AI tells. The linter slots in between (2) and (3): pure JSON static analysis, no canvas/jsdom, fast enough to run on every slide on every regeneration.

## Rule set (v1)

All rules live in `core/validation/antislop/rules/` as `({slide, deck}) => SlopViolation[]` functions. Each exports `{ id, severity, check }`.

| ruleId | Severity | Checks |
|---|---|---|
| `inter-everywhere` | warn | `theming.fontFamily` or per-block font equals `Inter` / `"Inter", sans-serif` AND deck has no `fontPair` override. Cross-references `core/theming/presets.ts`. |
| `purple-gradient` | error | Any `background`, `theming.accent`, or inline gradient string matches `/(purple|violet|indigo|#7c3aed|#8b5cf6|linear-gradient.*(purple|violet|#a78bfa))/i`. |
| `em-dash-overuse` | warn | Count of `—` (U+2014) in headline + supporting blocks > 1 per slide, or > deck.slides.length × 0.4 across deck. |
| `marketing-buzzwords` | warn | Hits against a curated list (`unleash, seamlessly, revolutionize, leverage, empower, unlock, supercharge, game-changing, cutting-edge, robust, synergy, holistic`). Threshold: ≥2 distinct hits per slide = violation. |
| `nested-cards` | error | `ContentBlock` of type `card` containing children whose type is also `card`, OR `layout: "card"` slide with a `card` block inside. |
| `headline-titlecase-overkill` | info | Headline is Title Case longer than 8 words (common Claude tell). |
| `bullet-parallelism-fake` | info | All bullets in a `bullet-list` start with the same verb form AND end with em-dash explanations. |

Rules are intentionally cheap: regex + structural walks over the typed tree. No tokenisation libraries.

## Scoring (`score.ts`)

```
slideScore = 100
  - sum(violations where severity=error) * 25
  - sum(violations where severity=warn)  * 10
  - sum(violations where severity=info)  * 3
clamp to [0, 100]
deckScore = mean(slideScores)
```

Thresholds:
- `>= 85` → green badge ("crisp")
- `70..84` → yellow ("some tells")
- `< 70` → red ("sloppy") AND triggers self-critique repair turn.

## Self-critique loop

In `lib/generation/deck.ts` after schema repair:

1. Run `lintPresentation(presentation)` → `SlopReport`.
2. If `deckScore < 70` and not already retried, collect slides with `slideScore < 70`.
3. Build a critique message via `prompts.buildAntiSlopCritique(slide, violations)` and call the same Claude client used by `repair.ts`, asking for a redraft of *only* those slides.
4. Re-lint; keep the better-scoring version per slide. Cap at one retry to bound latency/cost.

Env flags: `ANTISLOP_DISABLED=1` skips entirely; `ANTISLOP_THRESHOLD=<n>` overrides 70.

## API

Extend `app/api/validate/route.ts` to accept `{ presentation, mode: "antislop" | "fidelity" | "all" }` and return `{ slopReport?, fidelityReport? }`. The workspace re-uses this after manual edits.

## UI

- `components/fidelity/slop-badge.tsx`: small `Badge` (reuses `components/ui/badge.tsx`) showing score + colour. Tooltip (`components/ui/tooltip.tsx`) lists top 3 violation messages.
- Rendered next to the existing fidelity preview in `components/fidelity/pdf-preview.tsx` and on each slide card in workspace.

## Performance

Target: < 5ms per slide for a 20-block fixture, asserted in `score.test.ts` via `performance.now()`. No async, no IO. Whole-deck lint on a 30-slide deck should stay under 150ms so it never blocks the streaming UI.

## Why not jsdom / rendered HTML?

The slop signals we care about (Inter font, purple gradients, em-dash text, buzzwords, nested cards) all live in the structured spec. Linting JSON keeps us deterministic, dependency-free, and runnable inside the API route without spinning up a headless renderer.

## Risks / tradeoffs

- False positives on legitimate purple brand decks → mitigated by checking `theming.presetId` against `core/theming/presets.ts`; if the user explicitly picked a purple preset, downgrade `purple-gradient` to `info`.
- Self-critique retries cost an extra Claude call. Capped at one retry, only on failing slides, and skippable via env.
- Buzzword list is opinionated → kept in a single exported `const BUZZWORDS` array so it's easy to tune.
