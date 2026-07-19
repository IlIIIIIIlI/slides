## ADDED Requirements

### Requirement: Multi-URL product path crawl produces a morph-ready deck
The system SHALL accept an ordered list of product page URLs and produce a persisted presentation whose slides correspond one-to-one with those URLs in order, each slide built from DOM layout extraction of that page, with `animKey` values synthesized by the existing role + spatial IoU pipeline in `lib/generation/anim-key-synthesis.ts` so shared chrome can Flip-morph in the player.

#### Scenario: Ordered URLs become ordered slides
- **Given** a valid crawl request with three distinct https product URLs in path order
- **When** the crawl pipeline completes successfully
- **Then** the saved presentation contains exactly three slides in the same order as the URLs
- **And** each slide is traceable to its source URL (metadata or equivalent on the slide/deck)

#### Scenario: Shared chrome receives stable lp animKeys across steps
- **Given** two consecutive product page HTML fixtures that share the same nav label text and logo alt/text in the same top layout band
- **When** web layout extract runs and `anim-key-synthesis` runs on the resulting adjacent slides
- **Then** the matched chrome blocks share identical `animKey` values of the form `lp:<role>:<n>`
- **And** blocks whose content differs between steps (e.g. page H1) do not incorrectly share those chrome keys

#### Scenario: Explicit animKeys are never overwritten
- **Given** a content block that already has an `animKey` set before synthesis
- **When** anim-key synthesis runs on the crawl-produced slides
- **Then** that block’s `animKey` remains unchanged

#### Scenario: Non-chrome noise is excluded from matching
- **Given** extracted regions classified as role `other` (footer, decorative, page chrome noise)
- **When** synthesis matches adjacent slides
- **Then** those blocks are excluded from the matching pool (consistent with PDF import rules in README)

### Requirement: Web layout extract yields synthesis-compatible spatial blocks
The system SHALL parse fetched HTML with jsdom in `lib/generation/web-layout-extract.ts` and emit content blocks that include normalized bounding boxes and roles consumable by `lib/generation/anim-key-synthesis.ts`, mapping landmarks onto existing roles (`title`, `body`, `code`, `figure`, `other`) without requiring a new player block type for MVP.

#### Scenario: Landmark mapping for a simple marketing page
- **Given** HTML containing a logo image or logo link, a top nav, an H1, body copy, and a primary CTA control
- **When** `extractBlocksFromHtml` runs
- **Then** the output includes at least one `title`-role block for the H1 and at least one spatial block for logo or nav suitable for cross-page matching
- **And** each synthesis-eligible block has a normalized bbox usable by the 12×9 grid fingerprint path

#### Scenario: Empty or thin document degrades safely
- **Given** HTML with no meaningful landmarks (empty body)
- **When** extract runs for that step
- **Then** the pipeline still emits a slide with a placeholder headline derived from the page title or URL host
- **And** the overall crawl does not crash

### Requirement: Crawl API and safety controls
The system SHALL expose a POST API under `app/api/presentations/crawl` that validates input, enforces URL safety, and returns or persists a presentation the workspace/player can open.

#### Scenario: Successful crawl request
- **Given** an authenticated or existing presentations API convention already used by the app
- **When** a client POSTs `{ "urls": ["https://example.com/a", "https://example.com/b"] }` with optional title
- **Then** the handler runs the crawl orchestrator and responds with the new presentation id (and enough data for the UI to navigate to the player)

#### Scenario: Reject unsafe or invalid URLs
- **Given** a request containing a non-http(s) URL, an empty `urls` array, or a URL targeting a private/loopback address
- **When** the crawl API handles the request
- **Then** it responds with 400 (or equivalent client error) and does not fetch private network targets

#### Scenario: Per-step fetch failure surfaces clearly
- **Given** one URL in the path returns network failure or non-OK HTTP status
- **When** the crawl runs
- **Then** the API returns an error payload that names the failing URL
- **And** no partial presentation is silently published as success (MVP fail-closed)

### Requirement: Workspace entry for product tour crawl
The system SHALL provide a workspace UI control to paste an ordered multi-line list of product URLs, submit a crawl, show progress or errors, and open the resulting deck in the existing player.

#### Scenario: User creates a Flip tour from URLs
- **Given** the user is on the workspace surface that already supports generation/import entry points
- **When** they paste two or more https URLs (one per line) and submit
- **Then** the client calls the crawl API and on success navigates to or lists the new presentation for playback with morphing enabled by default

#### Scenario: Client-side validation before submit
- **Given** fewer than one URL or clearly invalid lines only
- **When** the user submits
- **Then** the UI blocks the request and shows a validation message without calling the API

### Requirement: Documentation of crawl Flip tours
The system SHALL document product-path crawl as a source of Flip-morphing decks alongside the existing Auto-Animate and PDF synthesis sections in `README.md`.

#### Scenario: README describes crawl → lp keys
- **Given** a developer reads `README.md`
- **When** they look for product tour / URL crawl behavior
- **Then** they find that multi-URL crawl feeds layout extract into `anim-key-synthesis.ts` and yields `lp:` keys for shared chrome without authoring PPTX
