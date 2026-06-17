## Why

The existing slide generator (`lib/generation/deck.ts` + `single-draft.ts`) takes a free-form prompt or an extracted document and asks Anthropic to invent a deck structure. For users who already have a structured knowledge artifact — for example the JSON knowledge graph produced by Egonex-AI/Understand-Anything's multi-agent pipeline, or any compatible `{nodes, edges}` graph emitted by a React Flow editor — that's a regression: the deck's outline (which concept comes first, which morphs into which) is already encoded in the graph and we throw it away.

This change introduces a **graph-walk deck mode** as a first-class ingest source. A knowledge graph (nodes = concepts, edges = relationships) is parsed, walked depth-first from a chosen root, and each node is expanded by Claude into one `SlideSpec` slide. Edges that link two concepts become **Auto-Animate `animKey` continuity** — a shared `concept:auth` token, for instance, morphs across every linked slide using the GSAP Flip pipeline already shipped in `core/rendering/morph.ts` and `lib/animation/flip.ts`.

The net effect: the existing Anthropic-SDK generator becomes an *explainer-deck builder* for arbitrary domain graphs, with zero changes to the player, the schema renderer, or the morph engine — we only add an upstream ingest path.

## What Changes

- **NEW** `KnowledgeGraph` schema in `core/schemas/types.ts` (`nodes: GraphNode[]`, `edges: GraphEdge[]`, plus optional `rootId`, `concepts: string[]` per node).
- **NEW** `lib/generation/graph/` package:
  - `parse.ts` — accept either the Understand-Anything shape (`{ nodes, edges }` with `data.label`, `data.summary`) or a generic React Flow export; normalize to `KnowledgeGraph`.
  - `walk.ts` — depth-first traversal from `rootId` (or highest-out-degree node), producing an ordered `WalkStep[]` that records `nodeId`, `depth`, `parentId`, and `sharedConcepts` (intersection of `concepts` with parent).
  - `animkey.ts` — derive `animKey` strings from shared concepts (`"concept:<slug>"`) and attach them to whichever block in the slide is the concept's primary surface (headline by default).
  - `generate.ts` — for each `WalkStep`, call the existing Anthropic client (mirroring `single-draft.ts`) with a graph-aware system prompt to produce one `SlideSpec`, then run the result through `animkey.ts` and `core/validation`.
- **NEW** `lib/generation/prompts.ts` export `GRAPH_NODE_SLIDE_PROMPT` — instructs the model to write a slide that explains *this* node given its neighbors as context.
- **NEW** API route `app/api/presentations/from-graph/route.ts` — POST `{ graph, rootId?, theme? }` → streams progress and writes a finished `Presentation` to `data/presentations/<uuid>.json`.
- **NEW** workspace UI affordance `components/workspace/graph-upload.tsx` — paste/upload a graph JSON, pick a root node, and submit; reuses `hooks/use-generate.ts` for progress.
- **UPDATE** `hooks/use-generate.ts` — add a `source: 'prompt' | 'document' | 'graph'` discriminator and a `generateFromGraph(graph, opts)` method.
- **UPDATE** `core/schemas/types.ts` — add optional `source: 'graph'` and `graphProvenance?: { nodeId, parents: string[] }` on `Slide` for traceability in the player.
- Tests for parser, walker, animKey derivation, and the API route; one golden-JSON fixture under `data/presentations/`.

## Impact

- Affected specs: new capability `graph-deck-generation`.
- Affected code: `core/schemas/`, `core/validation/`, `lib/generation/` (additive), `hooks/use-generate.ts`, `app/api/presentations/`, `components/workspace/`.
- No changes to the player runtime, `core/rendering/morph.ts`, `lib/animation/flip.ts`, or any existing presentation JSON — the morph engine already consumes `animKey`; we just author them from the graph instead of from heuristics in `core/rendering/adapter.ts`.
- New optional dependency: none. React Flow is *not* added — we only consume its JSON export shape. The graph is rendered (if at all) by whoever produced it.

## Inspired by

- https://github.com/Egonex-AI/Understand-Anything

## Decision

- [ ] **Adopt** — proceed with `tasks.md`
- [ ] **Defer** / **Reject**

_novelty 4/5 · effort 3/5 · promoted from a Project Steward idea you approved._
