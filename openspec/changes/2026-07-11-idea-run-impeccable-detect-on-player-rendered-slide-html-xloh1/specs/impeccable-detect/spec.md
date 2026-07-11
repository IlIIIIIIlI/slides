## ADDED Requirements

### Requirement: Player DOM snapshot for detection
The system SHALL produce a Node-runnable HTML snapshot of a slide as rendered for the player, derived from a `SlideSpec` and theme, suitable for loading into `jsdom` without calling an LLM.

#### Scenario: Snapshot includes block attribution attributes
- **Given** a `SlideSpec` with three `contentBlocks` (e.g. headline, supporting, code-block)
- **When** `renderSlideToHtml` (or equivalent in `core/validation/impeccable/render-snapshot.ts`) builds the player HTML using `core/rendering/adapter.ts` conventions
- **Then** each block root element has `data-block-index` equal to its index in `contentBlocks`
- **And** each block root has `data-block-type` equal to the block's `type`
- **And** if the block has `animKey`, the root has `data-anim-key` with that value

#### Scenario: Snapshot runs under unit tests without a browser
- **Given** the test runner invoked via `pnpm test` / `scripts/run-unit-tests.cjs`
- **When** a unit test calls the snapshot + detect entrypoint with a fixture slide
- **Then** the call completes using `jsdom` (already in package dependencies)
- **And** no Playwright/Puppeteer browser is required for the default path

### Requirement: Deterministic Impeccable-style detect
The system SHALL run a deterministic rule-based detector (Impeccable-inspired, zero LLM cost) over the snapshotted slide document and return a structured `DetectReport` per slide.

#### Scenario: Gradient text is reported
- **Given** player HTML where a text node or its block root uses gradient text styling (e.g. background-clip text / gradient fill patterns used in the player CSS)
- **When** `detectSlideHtml` runs the rule registry in `core/validation/impeccable/`
- **Then** the report includes a finding with a stable `ruleId` for gradient text
- **And** `severity` is at least `warn`
- **And** no external HTTP or model API is called

#### Scenario: Two-axis grid or busy mesh background is reported
- **Given** slide or block container HTML/CSS that applies a multi-axis grid or mesh-style background pattern flagged by the rule
- **When** detect runs
- **Then** a finding is emitted with a stable `ruleId` for that background anti-pattern
- **And** if the style is on the slide root rather than a block, `path` is slide-scoped (`slides[{n}]`)

#### Scenario: Low-contrast type is reported
- **Given** text whose effective foreground/background luminance ratio falls below the rule threshold in the snapshot environment
- **When** detect runs
- **Then** a low-contrast finding is included with evidence useful for repair (selector or style snippet)

#### Scenario: Clean slide produces no error-level findings
- **Given** a fixture slide whose player HTML follows allowed typography and background patterns for the default theme in `core/theming/presets.ts`
- **When** detect runs with the default rule set
- **Then** the report has zero findings with `severity: "error"`

### Requirement: Finding to contentBlock path mapping
Each finding SHALL map to a SlideSpec path that generation repair can target, preferring the nearest ancestor content block when the violating node is nested inside a block.

#### Scenario: Nested element maps to parent block path
- **Given** a violation on a `<span>` inside the block root for `contentBlocks[1]`
- **When** `map-findings` resolves the DOM node
- **Then** `path` is `slides[{slideIndex}].contentBlocks[1]`
- **And** `blockIndex` is `1`

#### Scenario: Slide-level violation has slide path
- **Given** a violation on a slide background element with no `data-block-index` ancestor
- **When** mapping runs
- **Then** `path` is `slides[{slideIndex}]`
- **And** `blockIndex` is omitted

### Requirement: Validate pipeline integration
Post-generation and on-demand validation SHALL include Impeccable detect results alongside existing structural validation without replacing `core/validation/antislop/`.

#### Scenario: Validate API returns impeccable reports
- **Given** a presentation payload accepted by `app/api/validate/`
- **When** validation runs successfully through schema/structural checks
- **Then** the response includes per-slide Impeccable `DetectReport` data (or an equivalent aggregated field documented in the handler)
- **And** structural antislop results remain present if they were previously returned

#### Scenario: lib/generation validate attaches reports
- **Given** `lib/generation/validate.ts` is invoked on a deck after generation or import
- **When** detect completes for each slide
- **Then** the validate result object includes impeccable findings consumable by repair and UI layers

### Requirement: Constrained re-prompt from findings
When repair is driven by Impeccable findings, the system SHALL constrain the model prompt to offending content blocks rather than requiring a full-deck rewrite.

#### Scenario: Repair prompt lists only offending blocks
- **Given** detect findings on `contentBlocks[0]` and `contentBlocks[3]` of one slide
- **When** `lib/generation/repair.ts` (with helpers in `lib/generation/prompts.ts`) builds a repair prompt from those findings
- **Then** the prompt includes the rule messages and current JSON for those block indices
- **And** the prompt instructs replacement of only the listed blocks (or equivalent scoped patch instructions already used by the repair module)

#### Scenario: Iteration cap after re-detect
- **Given** a repair cycle triggered by detect findings
- **When** a repaired slide is re-snapshotted and re-detected
- **Then** automatic re-prompt does not exceed the configured maximum iterations (documented default ≤ 2)

### Requirement: UI surfacing of detect severity
Workspace or fidelity UI SHALL surface Impeccable detect error/warn counts using the existing fidelity/slop presentation patterns.

#### Scenario: Slop badge reflects detect findings
- **Given** a slide or deck with one or more Impeccable findings of severity `error` or `warn`
- **When** the fidelity UI renders `components/fidelity/slop-badge.tsx` (or its parent consumer)
- **Then** the user-visible state indicates design/detect issues (count or badge variant)
- **And** the badge does not require a vision model result to show detect-only findings
