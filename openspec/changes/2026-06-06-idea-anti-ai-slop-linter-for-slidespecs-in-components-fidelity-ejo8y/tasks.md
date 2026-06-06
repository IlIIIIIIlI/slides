# Tasks

## 1. Types and scaffolding
- [ ] 1.1 Add `core/validation/antislop/types.ts` exporting `SlopViolation`, `SlopReport`, `Severity = "info" | "warn" | "error"`, and `Rule` interface `{ id: string; severity: Severity; check(ctx: { slide: SlideSpec; deck: Presentation }): SlopViolation[] }`.
- [ ] 1.2 Create `core/validation/antislop/index.ts` exporting `lintSlide(slide, deck)`, `lintPresentation(deck)`, and `DEFAULT_RULES` array.
- [ ] 1.3 Add `core/validation/antislop/score.ts` implementing the scoring formula (errors −25, warns −10, info −3, clamped 0–100) plus `deckScoreFrom(slideScores)`.

## 2. Rules
- [ ] 2.1 `rules/inter-everywhere.ts` — flag when `theming.fontFamily` (or per-block font) is `Inter` and the deck has no explicit `fontPair` override, cross-checking presets from `core/theming/presets.ts`.
- [ ] 2.2 `rules/purple-gradient.ts` — regex over `background`, `theming.accent`, and inline style strings. Downgrade to `info` when `theming.presetId` is a known purple preset.
- [ ] 2.3 `rules/em-dash-overuse.ts` — count U+2014 in headline + supporting content; per-slide threshold >1, deck threshold > slides.length × 0.4.
- [ ] 2.4 `rules/marketing-buzzwords.ts` — export `BUZZWORDS` const and flag slides with ≥2 distinct hits across text blocks.
- [ ] 2.5 `rules/nested-cards.ts` — walk `contentBlocks` recursively; flag `card` inside `card` or inside a `layout: "card"` slide.
- [ ] 2.6 `rules/headline-titlecase-overkill.ts` — info-level rule for >8-word Title Case headlines.
- [ ] 2.7 `rules/bullet-parallelism-fake.ts` — info-level rule detecting same-verb-start + em-dash pattern in `bullet-list` blocks.
- [ ] 2.8 Register all rules in `DEFAULT_RULES` (order: errors first, warns, infos).

## 3. Pipeline integration
- [ ] 3.1 In `core/validation/index.ts`, re-export `lintPresentation` and `SlopReport` so external callers have one entry point.
- [ ] 3.2 In `lib/generation/deck.ts`, after schema validation/repair: call `lintPresentation`. If `process.env.ANTISLOP_DISABLED === "1"` skip entirely.
- [ ] 3.3 Add `lib/generation/prompts.ts` export `buildAntiSlopCritique(slide, violations)` that returns a Claude system+user message pair instructing a redraft fixing only the listed violations.
- [ ] 3.4 Extend `lib/generation/repair.ts` with `repairSlopSlides(deck, report, client)` that calls Claude once for the union of failing slides (score < threshold) and returns updated `SlideSpec`s. Threshold from `process.env.ANTISLOP_THRESHOLD ?? 70`.
- [ ] 3.5 In `deck.ts`, replace failing slides only when the redrafted score improves; cap at one retry per generation.
- [ ] 3.6 Mirror the same lint-then-critique flow in `lib/generation/single-draft.ts` for single-slide regeneration.

## 4. API
- [ ] 4.1 Update `app/api/validate/route.ts` to parse `{ presentation, mode }`, default `mode` to `"all"`, and branch on `"antislop" | "fidelity" | "all"`.
- [ ] 4.2 Return `400 { error: "invalid mode" }` for unknown modes; reuse the existing fidelity path from `lib/generation/fidelity.ts`.

## 5. UI
- [ ] 5.1 Add `components/fidelity/slop-badge.tsx` using `components/ui/badge.tsx` + `components/ui/tooltip.tsx`. Props: `report: SlopReport | SlideSlopReport`, `variant?: "slide" | "deck"`.
- [ ] 5.2 Color mapping: `>=85` success, `70–84` warning, `<70` destructive. Tooltip lists top 3 violations sorted by severity then ruleId.
- [ ] 5.3 Render `<SlopBadge>` in `components/fidelity/pdf-preview.tsx` next to the existing fidelity controls.
- [ ] 5.4 Render per-slide `<SlopBadge>` on each slide card in `components/workspace/slide-transfer.tsx` (or nearest workspace slide card component).
- [ ] 5.5 Add a "Re-lint" button on the workspace that POSTs to `/api/validate` with `mode: "antislop"` and updates local state via a new hook `hooks/use-slop-report.ts`.

## 6. Tests (run by `scripts/run-unit-tests.cjs`)
- [ ] 6.1 `core/validation/antislop/rules/purple-gradient.test.ts` — positive + negative fixtures, including the preset-downgrade case.
- [ ] 6.2 `core/validation/antislop/rules/em-dash-overuse.test.ts` — slide-level and deck-level thresholds.
- [ ] 6.3 `core/validation/antislop/rules/marketing-buzzwords.test.ts` — single-hit (no violation) vs. two-hit (violation), case-insensitive.
- [ ] 6.4 `core/validation/antislop/rules/nested-cards.test.ts` — direct nesting + layout-card-with-card.
- [ ] 6.5 `core/validation/antislop/rules/inter-everywhere.test.ts` — Inter without override flags; Inter with `fontPair` override does not.
- [ ] 6.6 `core/validation/antislop/score.test.ts` — scoring math + clamping + `performance.now()` assertion (<150ms on 30×20 fixture).
- [ ] 6.7 `core/validation/antislop/index.test.ts` — end-to-end: load a fixture from `data/presentations/*.json`, run `lintPresentation`, snapshot the report shape.
- [ ] 6.8 `lib/generation/deck.test.ts` (new or extended) — mock Claude client, assert exactly one critique call when initial deck score is forced below threshold and zero calls when above.
- [ ] 6.9 Register all new test files in `scripts/run-unit-tests.cjs` discovery glob if it is path-list based.

## 7. Docs
- [ ] 7.1 Add an "Anti-slop linting" section to `README.md` covering rule list, scoring, `ANTISLOP_DISABLED` / `ANTISLOP_THRESHOLD` env flags, and the `/api/validate` `mode` parameter.
- [ ] 7.2 Append a short note to `DESIGN_REVIEW.md` linking the new capability and explaining how it complements existing fidelity scoring.
