# antislop-linting

## ADDED Requirements

### Requirement: Deterministic SlideSpec lint pass

The system SHALL provide a pure-function linter `lintPresentation(presentation: Presentation): SlopReport` in `core/validation/antislop/` that evaluates each `SlideSpec` against a fixed rule set and returns structured violations plus a 0–100 score per slide and per deck.

#### Scenario: Clean deck scores high
- **Given** a `Presentation` whose slides use the `editorial` preset from `core/theming/presets.ts`, no em-dashes in headlines, no purple gradients, no nested cards, and no buzzwords
- **When** `lintPresentation` is called
- **Then** every `slideScore` is `>= 85` and `deckScore >= 85` with `violations: []`

#### Scenario: Purple gradient background is flagged as error
- **Given** a slide whose `background` field is `"linear-gradient(135deg,#7c3aed,#a78bfa)"`
- **When** the linter runs
- **Then** the returned report includes a violation with `ruleId: "purple-gradient"` and `severity: "error"` on that slide
- **And** the slide's score is reduced by at least 25 points

#### Scenario: Em-dash overuse across headline blocks
- **Given** a slide whose headline content contains two or more `—` (U+2014) characters
- **When** the linter runs
- **Then** a `ruleId: "em-dash-overuse"` violation with `severity: "warn"` is reported referencing the offending `blockIndex`

#### Scenario: Nested card blocks are rejected
- **Given** a `card` ContentBlock that contains a child block of type `card`
- **When** the linter runs
- **Then** a `ruleId: "nested-cards"` violation with `severity: "error"` is reported and the slide score drops below 75

#### Scenario: Buzzword threshold
- **Given** a slide whose supporting text contains the words `"unleash"` and `"seamlessly"`
- **When** the linter runs
- **Then** a single `ruleId: "marketing-buzzwords"` violation listing both matched terms in `message` is reported

#### Scenario: Performance budget
- **Given** a 30-slide presentation each with up to 20 content blocks
- **When** `lintPresentation` is invoked
- **Then** the call completes in under 150ms wall time measured with `performance.now()`

### Requirement: Self-critique repair turn

The deck generation pipeline in `lib/generation/deck.ts` SHALL run the anti-slop linter after schema validation and, when the deck score falls below the configured threshold, issue a single Claude critique turn that re-drafts only the failing slides using a prompt built by `prompts.buildAntiSlopCritique`.

#### Scenario: Failing slide is regenerated once
- **Given** initial generation produces a deck with one slide scoring `40` due to a `purple-gradient` and `marketing-buzzwords` violation, and `ANTISLOP_THRESHOLD` is unset (default 70)
- **When** `generateDeck` runs
- **Then** exactly one additional Claude call is made containing only that slide's JSON and its violations
- **And** if the redrafted slide scores higher than the original it replaces the original; otherwise the original is kept

#### Scenario: Already-clean deck skips critique
- **Given** the initial draft has `deckScore >= 70`
- **When** `generateDeck` runs
- **Then** no anti-slop critique call is made to Claude

#### Scenario: Disabling via env
- **Given** environment variable `ANTISLOP_DISABLED=1`
- **When** `generateDeck` runs
- **Then** the linter is not invoked, no critique turn happens, and generation matches pre-change behaviour

### Requirement: Slop badge in fidelity UI

The app SHALL surface the slop score in `components/fidelity/` via a `SlopBadge` component that renders a colour-coded badge with a tooltip listing the top violations.

#### Scenario: Green badge for crisp slide
- **Given** a slide with `slopScore >= 85`
- **When** `<SlopBadge report={...} />` renders
- **Then** the badge displays `"Crisp"` with the success colour variant from `components/ui/badge.tsx`

#### Scenario: Red badge with violation tooltip
- **Given** a slide with `slopScore = 50` and three violations
- **When** the user hovers the badge
- **Then** a tooltip (built with `components/ui/tooltip.tsx`) shows the three violation messages and their `ruleId`s in severity order

### Requirement: On-demand validation endpoint

The `POST /api/validate` route SHALL accept `{ presentation, mode: "antislop" | "fidelity" | "all" }` and return the corresponding reports.

#### Scenario: Antislop-only request
- **Given** a client POSTs `{ presentation, mode: "antislop" }` to `/api/validate`
- **When** the route handler runs
- **Then** the JSON response contains `{ slopReport: SlopReport }` and no `fidelityReport`, with HTTP 200

#### Scenario: Unknown mode is rejected
- **Given** a client POSTs `{ presentation, mode: "bogus" }`
- **When** the route handler runs
- **Then** it responds with HTTP 400 and a JSON body `{ error: "invalid mode" }`
