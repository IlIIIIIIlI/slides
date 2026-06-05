## ADDED Requirements

### Requirement: Shared element identity across consecutive slides
The rendering layer SHALL determine which content blocks are "the same element" across two consecutive slides using a stable animation key resolved from each block.

#### Scenario: Explicit animKey matches
- **Given** slide A has a block with `animKey: "hero-title"` and slide B has a block with `animKey: "hero-title"`
- **When** `sharedAnimKeys(A, B)` is computed in `core/rendering/morph.ts`
- **Then** the returned list includes `"hero-title"`

#### Scenario: Derived key for title blocks
- **Given** slide A and slide B each have exactly one title block with no explicit `animKey`
- **When** `resolveAnimKey` runs on each title block
- **Then** both resolve to `"title"` and `sharedAnimKeys(A, B)` includes `"title"`

#### Scenario: Derived key for repeated code blocks
- **Given** slide A has two code blocks and slide B has two code blocks, all without explicit keys
- **When** keys are resolved
- **Then** they resolve to `"code:0"` and `"code:1"` by occurrence so the first code block of A morphs into the first of B

#### Scenario: No shared keys yields empty diff
- **Given** slide A contains only an image block and slide B contains only a chart block, none with matching keys
- **When** `sharedAnimKeys(A, B)` is computed
- **Then** it returns an empty array and no morph occurs

### Requirement: Flip-id stamping during rendering
The rendering adapter SHALL stamp a `data-flip-id` attribute on the outermost DOM element of any block whose animation key resolves to a value.

#### Scenario: Block with resolvable key gets data-flip-id
- **Given** a title block rendered by `core/rendering/adapter.ts`
- **When** the slide is rendered in the player
- **Then** the rendered element exposes `data-flip-id="flip-title"` per `flipIdFor("title")`

#### Scenario: Block without resolvable key is unstamped
- **Given** a decorative spacer block whose `resolveAnimKey` returns undefined
- **When** it is rendered
- **Then** the element has no `data-flip-id` attribute

### Requirement: Morph animation on slide navigation
The player SHALL animate position and size of shared elements when navigating between consecutive slides using GSAP's Flip plugin.

#### Scenario: Forward navigation morphs shared title
- **Given** the player is on slide A showing a title at the top-left, and slide B places the same `animKey` title centered and larger
- **When** the user advances to slide B
- **Then** the title visually animates from its slide-A rect to its slide-B rect via `Flip.from()` over ~0.5s

#### Scenario: Only matched elements animate
- **Given** slide A and slide B share a `"title"` key but slide B introduces a new image with no match in A
- **When** navigation occurs
- **Then** only the title is passed to `Flip.from()` and the new image renders normally without a morph attempt

### Requirement: Opt-out and reduced-motion respect
The player SHALL skip morph animation when disabled per presentation or when the user prefers reduced motion.

#### Scenario: autoAnimate disabled on deck
- **Given** the presentation schema has `autoAnimate: false`
- **When** the user navigates between slides
- **Then** no Flip state is captured and slides swap statically as before

#### Scenario: prefers-reduced-motion honored
- **Given** the OS/browser reports `prefers-reduced-motion: reduce`
- **When** the user navigates between slides
- **Then** the morph is skipped regardless of the `autoAnimate` setting

### Requirement: SSR-safe plugin registration
The animation module SHALL register the Flip plugin only in the browser and exactly once.

#### Scenario: No registration during server render
- **Given** the player route is server-rendered
- **When** `lib/animation/flip.ts` is imported
- **Then** `gsap.registerPlugin(Flip)` is not invoked on the server and no `window` access occurs
