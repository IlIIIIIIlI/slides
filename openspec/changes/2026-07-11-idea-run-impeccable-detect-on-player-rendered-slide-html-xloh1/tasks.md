## 1. Block attribution in player render path

- [ ] 1.1 Audit `core/rendering/adapter.ts` and `components/player/slide-view.tsx` for every `ContentBlock` type root and list gaps where `data-block-index` / `data-block-type` / `data-anim-key` are missing
- [ ] 1.2 Add `data-block-index`, `data-block-type`, and optional `data-anim-key` on each block outermost element in the adapter/player path (preserve existing `animKey` morph behavior from README / `core/rendering/morph.ts`)
- [ ] 1.3 Add or extend a unit test in `core/rendering/adapter.test.ts` asserting the three attributes for at least headline, supporting, bullet-list, and code-block

## 2. Impeccable detect module skeleton

- [ ] 2.1 Create `core/validation/impeccable/types.ts` with `ImpeccableFinding`, `DetectReport`, severity union, and rule id string type
- [ ] 2.2 Create `core/validation/impeccable/rules.ts` with a registry array and enable flags; seed high-value rules (gradient-text, multi-axis/grid background, low-contrast type) plus stubs/skips for remaining Impeccable-inspired ids toward ~46
- [ ] 2.3 Create `core/validation/impeccable/detect.ts` exporting `detectSlideHtml(html: string, ctx: { slideIndex: number }) => DetectReport` using `jsdom`
- [ ] 2.4 Create `core/validation/impeccable/map-findings.ts` to walk to `[data-block-index]` and set `path` / `blockIndex` / `animKey`
- [ ] 2.5 Create `core/validation/impeccable/index.ts` re-exporting the public API; add a one-line module comment citing pbakaus/impeccable as inspiration (detect-only, no LLM)

## 3. SlideSpec → HTML snapshot

- [ ] 3.1 Implement `core/validation/impeccable/render-snapshot.ts` that builds player HTML for one slide from `SlideSpec` + theme (`core/theming/presets.ts`), reusing adapter class names/structure from `core/rendering/adapter.ts`
- [ ] 3.2 Inject the minimal CSS/variables needed for contrast and background rules (document the subset; pull from `app/globals.css` patterns only as needed)
- [ ] 3.3 Export `detectSlideSpec(slide, theme, slideIndex)` that composes snapshot → detect → mapped findings

## 4. Unit tests for detect and mapping

- [ ] 4.1 Add `core/validation/impeccable/detect.test.ts` with fixture HTML for gradient-text, grid/mesh background, and low-contrast cases; assert `ruleId` and severity
- [ ] 4.2 Add mapping tests: nested span → `slides[n].contentBlocks[i]`; slide-level node → `slides[n]` without `blockIndex`
- [ ] 4.3 Add a clean default-theme slide fixture that expects zero `error` findings
- [ ] 4.4 Ensure tests run via existing `scripts/run-unit-tests.cjs` / `pnpm test` with no network

## 5. Validate pipeline wiring

- [ ] 5.1 Extend `lib/generation/validate.ts` to run `detectSlideSpec` per slide after structural/schema checks and attach reports to the validate result type
- [ ] 5.2 Update `lib/generation/validate.test.ts` with a case that injects violating HTML/spec and expects impeccable findings on the result
- [ ] 5.3 Wire `app/api/validate/` handler to return the new impeccable field without breaking existing clients (additive JSON field)
- [ ] 5.4 Keep `core/validation/antislop/` behavior unchanged; call detect as a complementary step from `core/validation/index.ts` only if that barrel is the shared entry — otherwise call from `lib/generation/validate.ts` only

## 6. Constrained repair / re-prompt

- [ ] 6.1 Add a helper in `lib/generation/prompts.ts` (e.g. `buildImpeccableRepairPrompt`) that accepts findings grouped by `blockIndex` and embeds rule messages + current block JSON
- [ ] 6.2 Integrate into `lib/generation/repair.ts` so Impeccable-driven repair scopes to listed blocks and enforces max iterations (default ≤ 2) with re-detect between attempts
- [ ] 6.3 Extend `lib/generation/repair.test.ts` to assert the prompt or repair input includes only the offending indices

## 7. Generation and import hooks

- [ ] 7.1 Invoke detect at end of successful generation path used by `lib/generation/single-draft.ts` / deck assembly so reports are available to the client (`hooks/use-generate.ts` consumers)
- [ ] 7.2 After import pipelines that produce SlideSpecs (`lib/generation/extract.ts` and any PPTX/DOCX path), run detect so imported decks get the same findings as generated ones
- [ ] 7.3 Do not overwrite explicit `animKey` values during detect (read-only analysis)

## 8. UI: slop badge / fidelity

- [ ] 8.1 Extend props or mapping for `components/fidelity/slop-badge.tsx` to accept detect error/warn counts (or a small DTO from validate)
- [ ] 8.2 Wire workspace/fidelity parent that already shows slop to pass Impeccable aggregates when present
- [ ] 8.3 Verify badge can show detect-only issues without vision/`lib/generation/vision.ts` results

## 9. Docs and evidence

- [ ] 9.1 Document the detect flow, rule list, and skip reasons for unimplemented rules in a short `core/validation/impeccable/README.md` or README section in the repo root if that matches project docs style
- [ ] 9.2 Run `pnpm test` and `pnpm lint` (and `pnpm build` if feasible); save output under `.steward/evidence/impeccable-detect.log`
