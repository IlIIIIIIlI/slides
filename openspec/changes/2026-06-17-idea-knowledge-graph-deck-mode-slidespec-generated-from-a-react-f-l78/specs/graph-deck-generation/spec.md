# graph-deck-generation Specification Delta

## ADDED Requirements

### Requirement: Knowledge graph ingest

The system SHALL accept a knowledge graph as a first-class input source for deck generation, alongside the existing prompt and document sources.

#### Scenario: Understand-Anything-shaped JSON is accepted
- **Given** a JSON payload with `nodes: [{ id, data: { label, summary, concepts } }]` and `edges: [{ source, target, label }]` (the Understand-Anything / React Flow export shape)
- **When** the client POSTs it to `/api/presentations/from-graph`
- **Then** the server normalizes it to a `KnowledgeGraph` and proceeds with generation without requiring any other field

#### Scenario: Already-normalized graph is accepted unchanged
- **Given** a JSON payload that already matches the `KnowledgeGraph` schema in `core/schemas/types.ts`
- **When** the client POSTs it to `/api/presentations/from-graph`
- **Then** the parser is a no-op pass-through and the same generation path runs

#### Scenario: Malformed graph is rejected with a useful error
- **Given** a JSON payload missing `nodes` or with edges referencing unknown node ids
- **When** the client POSTs it to `/api/presentations/from-graph`
- **Then** the server responds 400 with a message naming the first offending field and does not invoke the Anthropic SDK

### Requirement: Depth-first speaker order

The system SHALL determine slide order by a deterministic depth-first traversal of the graph from a single root.

#### Scenario: Explicit root is honored
- **Given** a `KnowledgeGraph` with `rootId` set to an existing node id
- **When** generation runs
- **Then** the first emitted slide corresponds to `rootId` and subsequent slides follow DFS pre-order over outgoing edges in insertion order

#### Scenario: Root is inferred when absent
- **Given** a `KnowledgeGraph` with no `rootId`
- **When** generation runs
- **Then** the root is the node with the highest out-degree, ties broken by lexicographic `id`, and the same `(graph)` input produces the same order on every run

#### Scenario: Cycles do not loop
- **Given** a graph containing a cycle `A → B → C → A`
- **When** the walk reaches a node already visited
- **Then** that node is skipped and the walk terminates with each node visited at most once

#### Scenario: Disconnected components are sectioned
- **Given** a graph with two disconnected components of sizes 5 and 3
- **When** generation runs
- **Then** the larger component is walked first, then the smaller, and a section-break slide (`parentId: null`, `depth: 0`) is emitted between them

### Requirement: Edges drive `animKey` continuity

The system SHALL convert shared concepts between graph-adjacent nodes into Auto-Animate `animKey` tokens on the resulting slides, reusing the existing morph pipeline in `core/rendering/morph.ts` and `lib/animation/flip.ts`.

#### Scenario: Shared concept morphs the headline
- **Given** parent node `P` with `concepts: ["auth"]` and child node `C` with `concepts: ["auth", "oauth"]`, walked consecutively
- **When** the slides are produced
- **Then** both slides' headline blocks carry `animKey: "concept:auth"` so the GSAP Flip pipeline morphs them across navigation

#### Scenario: Multiple shared concepts attach multiple anchors
- **Given** a parent/child pair sharing concepts `["auth", "jwt"]`
- **When** the slides are produced
- **Then** the child slide carries an `animKey: "concept:auth"` headline and an additional hidden `concept-tag` block with `animKey: "concept:jwt"` so both relationships morph

#### Scenario: Auto-derived keys are not clobbered
- **Given** a node whose generated slide already contains a `code-block` (auto-keyed `"code:0"` per the README)
- **When** `animkey.ts` attaches concept anchors
- **Then** the existing `code:0` key is preserved and the concept anchor is attached to the headline (or a new decoration block), not the code block

#### Scenario: Deck-level opt-out is honored
- **Given** the request body sets `autoAnimate: false` on the presentation options
- **When** generation runs
- **Then** `animkey.ts` adds no concept-derived `animKey` tokens, matching the existing README escape hatch

### Requirement: Per-node drafting via existing Anthropic pipeline

The system SHALL draft each slide by invoking the same Anthropic SDK client used in `lib/generation/single-draft.ts`, one call per walk step, with a graph-aware system prompt.

#### Scenario: Node context is passed to the model
- **Given** a walk step for node `C` with parent `P` and connecting edge labeled `"requires"`
- **When** the drafter calls Anthropic
- **Then** the system prompt includes `C.label`, `C.summary`, `P.label`, the edge label `"requires"`, and the list of `sharedConcepts`, and instructs the model to reuse those tokens in `contentBlocks[].animKey`

#### Scenario: Validation and repair are reused
- **Given** the model returns a `SlideSpec` that fails `core/validation`
- **When** the drafter receives the response
- **Then** it is routed through `lib/generation/repair.ts` exactly as `single-draft.ts` does, with no graph-specific bypass

#### Scenario: Provenance is recorded on every slide
- **Given** any successful walk step
- **When** the slide is persisted into the `Presentation`
- **Then** the slide carries `source: "graph"` and `graphProvenance: { nodeId, parents: [...] }` so the player can later display the originating node

### Requirement: Workspace UI affordance

The workspace page SHALL expose graph upload as a sibling to the existing prompt and document inputs without altering their behavior.

#### Scenario: User pastes graph JSON and sees a summary
- **Given** the user opens the workspace and selects the "Graph" tab
- **When** they paste JSON into the textarea
- **Then** the panel shows the parsed node count, edge count, and a dropdown of inferred root candidates, all computed client-side without a network call

#### Scenario: Submit reuses the shared generate hook
- **Given** a successfully parsed graph and a chosen root
- **When** the user clicks Generate
- **Then** `hooks/use-generate.ts`'s `generateFromGraph` is called, the same progress UI used by prompt-based generation streams updates, and on completion the new presentation appears in `data/presentations/` and the library list
