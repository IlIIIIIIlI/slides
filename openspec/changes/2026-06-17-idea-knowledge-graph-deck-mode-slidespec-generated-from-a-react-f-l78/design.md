## Context

Today `lib/generation/deck.ts` orchestrates: extract → plan → draft → repair → validate, all driven by `@anthropic-ai/sdk`. The structural decisions (slide count, ordering, which blocks share `animKey`) are made by the model plus the heuristic auto-derivation documented in `README.md` (`headline → "title"`, `code-block → "code:N"`).

For a knowledge graph, those decisions are already encoded:
- **Slide order** = a depth-first walk from a root node.
- **Slide content** = the node's label + summary + neighbor context.
- **`animKey` continuity** = concepts shared between a node and its parent in the walk.

So we want to *bypass* planning and *constrain* drafting to one-node-at-a-time, while keeping repair/validate/render untouched.

## Goals / Non-Goals

Goals:
- One new ingest path, no regressions to prompt/document ingest.
- Reuse `core/schemas`, `core/validation`, the Anthropic client, and the morph engine verbatim.
- Accept the Understand-Anything JSON shape AND a minimal generic React Flow shape, so any compatible graph works.
- Deterministic walk order for a given `(graph, rootId)` so re-generation is reproducible.

Non-Goals:
- Bundling React Flow itself or a graph editor UI.
- Multi-root / multi-component graphs (we pick one root; we surface a warning if disconnected).
- Editing the graph after upload (read-only ingest).
- Changing how `animKey` is *consumed* — `core/rendering/morph.ts` and `lib/animation/flip.ts` stay byte-identical.

## Decisions

### 1. Graph input shape

A discriminated union in `core/schemas/types.ts`:

```ts
export interface GraphNode {
  id: string;
  label: string;             // becomes slide title
  summary?: string;          // becomes slide body seed
  concepts?: string[];       // tokens that drive animKey continuity
  data?: Record<string, unknown>; // raw payload for the prompt
}
export interface GraphEdge {
  id?: string;
  source: string;
  target: string;
  label?: string;            // relationship verb shown on the bridging slide
}
export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootId?: string;
}
```

`lib/generation/graph/parse.ts` normalizes two inputs into this:
- **React Flow / Understand-Anything**: `{ nodes: [{ id, data: { label, summary, concepts } }], edges: [{ source, target, label }] }`.
- **Already-normalized** `KnowledgeGraph` (passthrough).

If `concepts` is absent on a node, we derive a single concept token by slugifying `label` (so every node still has one stable handle).

### 2. Walk algorithm

`lib/generation/graph/walk.ts` runs iterative DFS:
- Root = `graph.rootId` if set; else node with maximum out-degree; ties broken by `id` lex order (deterministic).
- Use an explicit stack; push children sorted by edge insertion order so the result is stable.
- Skip already-visited nodes (cycle-safe).
- Emit `WalkStep { nodeId, parentId | null, depth, edgeLabel, sharedConcepts }` where `sharedConcepts = intersection(node.concepts, parent.concepts)`.
- If the graph has disconnected components, walk the largest first, then the next, separated by a `WalkStep` with `parentId: null` and `depth: 0` — the generator turns those into section-break slides.

### 3. `animKey` mapping

`lib/generation/graph/animkey.ts` takes a `SlideSpec` plus the `WalkStep` and:
- For each `c` in `sharedConcepts`, attach `animKey: "concept:<slug>"` to the *headline* block (if absent) — this is the morph anchor the player already animates via `lib/animation/flip.ts`.
- If the headline already has an `animKey`, append the concept anchor to a hidden `decoration` block (`type: 'concept-tag'`) instead, so we don't clobber user intent.
- Honor the deck-level `autoAnimate: false` escape hatch already documented in the README — when set, `animkey.ts` is a no-op.

This preserves the existing auto-derivation rules (`headline → "title"`, `code-block → "code:N"`) for blocks we *don't* touch.

### 4. Per-node drafting

`lib/generation/graph/generate.ts` calls Anthropic once per `WalkStep` (sequentially, to keep token usage predictable and to let the UI stream). System prompt = `GRAPH_NODE_SLIDE_PROMPT` from `lib/generation/prompts.ts`:

> You are drafting ONE slide for a knowledge-graph explainer deck. The current node is `<label>` (summary: `<summary>`). The previous slide covered `<parent.label>` connected by `<edgeLabel>`. Children to be covered next: `<child.label[]>`. Produce one `SlideSpec` JSON matching the schema. Reuse any of these concept tokens verbatim in `contentBlocks[].animKey` if the block is the primary surface for that concept: `<sharedConcepts>`.

The response goes through the existing `lib/generation/repair.ts` and `core/validation/index.ts` paths — same fallback safety as `single-draft.ts`.

### 5. API route

`app/api/presentations/from-graph/route.ts` is a thin POST handler that:
1. Validates the body against `KnowledgeGraph` (zod-style guard in `core/validation`).
2. Calls `lib/generation/graph/generate.ts` and pipes progress (one SSE event per node) back to the client.
3. On completion, writes the finished `Presentation` (with `source: 'graph'`) to `data/presentations/<uuid>.json`, matching the existing storage convention.

It **does not** introduce a new persistence layer — it reuses whatever `app/api/presentations/route.ts` already does for prompt-based generation.

### 6. UI

`components/workspace/graph-upload.tsx` is a single Radix `Tabs` panel sibling to the existing prompt/document inputs in the workspace page. It accepts a `.json` file or pasted text, runs `parse.ts` client-side to give immediate feedback (node count, edge count, suggested roots), and on submit calls `useGenerate().generateFromGraph(...)`.

No new heavy UI library. React Flow is intentionally *not* bundled; if we later want an in-app graph editor that's a separate change.

## Risks / Trade-offs

- **Token cost.** One Anthropic call per node — a 30-node graph is 30 calls. Mitigation: sequential streaming so the user sees progress; surfacing node count up-front; the existing per-deck cap in `lib/generation/deck.ts` is reused as a hard ceiling.
- **Cycle / hub explosion.** A hub node would otherwise dominate. The DFS visited-set bounds this; we also cap walk length to the same per-deck slide limit.
- **Concept-token collisions across unrelated decks.** `animKey` is per-presentation so collisions are scoped — no global registry needed.
- **Graph schema drift.** We only require `nodes[].id`, `nodes[].label`, `edges[].source`, `edges[].target`. Everything else is best-effort and falls back to slug-of-label.

## Migration Plan

Purely additive. No existing presentation JSON changes shape. The optional `source` and `graphProvenance` fields on `Slide` default to undefined; the player ignores them.
