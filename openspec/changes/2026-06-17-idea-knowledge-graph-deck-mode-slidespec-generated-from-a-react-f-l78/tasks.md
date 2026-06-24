# Implementation Tasks

## 1. Schema & validation

- [ ] 1.1 Extend `core/schemas/types.ts`: add `GraphNode`, `GraphEdge`, `KnowledgeGraph` interfaces and `WalkStep` (export from a new `graph` sub-namespace for tidiness).
- [ ] 1.2 Extend `core/schemas/types.ts` `Slide` with optional `source?: 'prompt' | 'document' | 'graph'` and `graphProvenance?: { nodeId: string; parents: string[] }` — keep both optional so existing JSON in `data/presentations/*.json` remains valid.
- [ ] 1.3 In `core/validation/index.ts`, add `validateKnowledgeGraph(input): { ok: true, graph } | { ok: false, error }` that enforces unique `node.id` values and that every `edge.source`/`edge.target` resolves; export it alongside the existing slide validator.

## 2. Graph ingest package (`lib/generation/graph/`)

- [ ] 2.1 Create directory `lib/generation/graph/` with an `index.ts` barrel.
- [ ] 2.2 `lib/generation/graph/parse.ts`: implement `parseGraph(raw: unknown): KnowledgeGraph` that normalizes the Understand-Anything / React Flow shape (`nodes[].data.{label,summary,concepts}`) and the already-normalized shape. Fall back to `slugify(label)` for `concepts` when absent.
- [ ] 2.3 `lib/generation/graph/walk.ts`: implement iterative DFS `walkGraph(graph): WalkStep[]`. Pick root deterministically (explicit `rootId` > max out-degree > lex `id`). Track visited set, sort children by edge insertion order, compute `sharedConcepts = intersection(node.concepts, parent.concepts)`. Emit a section-break step between disconnected components.
- [ ] 2.4 `lib/generation/graph/animkey.ts`: implement `attachConceptAnimKeys(slide: SlideSpec, step: WalkStep, opts: { autoAnimate: boolean }): SlideSpec`. Attach `animKey: "concept:<slug>"` to the headline; if headline already has an explicit `animKey`, append a hidden `concept-tag` block (define this block variant in `core/schemas/types.ts` and register it as a passthrough in `core/rendering/adapter.ts` so the renderer ignores it but the morph engine still sees the key).
- [ ] 2.5 `lib/generation/graph/generate.ts`: implement `generateDeckFromGraph(graph, opts, onStep)`. For each `WalkStep`: build prompt context, call Anthropic via the same client wiring as `lib/generation/single-draft.ts`, run the response through `lib/generation/repair.ts` and `core/validation`, then `attachConceptAnimKeys`. Yield progress via `onStep(stepIndex, total)`.
- [ ] 2.6 Add `GRAPH_NODE_SLIDE_PROMPT` to `lib/generation/prompts.ts` (one slide per node; reuse shared concept tokens verbatim as `animKey`).

## 3. Tests

- [ ] 3.1 `lib/generation/graph/parse.test.ts`: cover Understand-Anything shape, normalized shape, missing-concepts fallback, and rejection of duplicate node ids — wire into `scripts/run-unit-tests.cjs`.
- [ ] 3.2 `lib/generation/graph/walk.test.ts`: cover explicit root, inferred root by out-degree, cycle handling, disconnected-components section break, and order determinism (run twice, assert equal).
- [ ] 3.3 `lib/generation/graph/animkey.test.ts`: assert headline gets `concept:<slug>`, code blocks retain auto-derived `code:N`, multi-concept fan-out, and `autoAnimate: false` no-op.
- [ ] 3.4 `lib/generation/graph/generate.test.ts`: stub `@anthropic-ai/sdk` (same pattern used in `lib/generation/vision.test.ts`) and verify one model call per node, validation/repair re-entry on bad JSON, and final `Presentation` carries `source: 'graph'` plus `graphProvenance`.
- [ ] 3.5 Add a golden fixture `data/presentations/__graph-fixture.json` (small 4-node graph deck) and an integration test that re-runs `generateDeckFromGraph` against the captured Anthropic response and diffs the output.

## 4. API route

- [ ] 4.1 Create `app/api/presentations/from-graph/route.ts` with a POST handler.
- [ ] 4.2 Validate body via `validateKnowledgeGraph`; on failure return 400 with the field path.
- [ ] 4.3 Stream progress as SSE (`text/event-stream`), emitting one event per `WalkStep` with `{ index, total, nodeId }`.
- [ ] 4.4 On completion, persist the `Presentation` JSON to `data/presentations/<uuid>.json` using the same writer module as `app/api/presentations/route.ts` (factor it out into `app/api/presentations/_store.ts` if it currently lives inline).
- [ ] 4.5 Add a thin `route.test.ts` that posts a fixture graph through the handler with a mocked Anthropic client and asserts a 200 stream + a written file under a temp `data/presentations/`.

## 5. Client hook

- [ ] 5.1 In `hooks/use-generate.ts`, add a `source` discriminator and a `generateFromGraph(graph: KnowledgeGraph, opts)` method that POSTs to `/api/presentations/from-graph` and consumes the SSE stream into the same progress state used by the prompt/document paths.
- [ ] 5.2 Ensure existing call sites (workspace prompt input, document upload) remain source-compatible — no signature changes to their entry points.

## 6. Workspace UI

- [ ] 6.1 Add a new Radix `Tabs` panel labeled "Graph" to the workspace page (alongside the existing prompt/document inputs in `app/(site)/workspace/`).
- [ ] 6.2 Create `components/workspace/graph-upload.tsx`: file-drop + textarea, runs `parseGraph` client-side, displays node count / edge count / root-candidate `Select`, and a Generate button.
- [ ] 6.3 Surface parse errors inline (use the existing `components/ui/` primitives — no new UI deps).
- [ ] 6.4 Wire the Generate button to `useGenerate().generateFromGraph`; on success redirect to `/player?id=<uuid>` using the same navigation as the prompt flow.

## 7. Renderer compatibility (defensive)

- [ ] 7.1 In `core/rendering/adapter.ts`, ensure the new `concept-tag` block (if introduced in 2.4) is treated as a non-visual passthrough so it never renders but still surfaces its `animKey` to `core/rendering/morph.ts`.
- [ ] 7.2 Add a `core/rendering/adapter.test.ts` case proving `concept-tag` blocks produce no DOM but appear in the morph key set.

## 8. Docs

- [ ] 8.1 Append a "Knowledge-graph deck mode" section to `README.md` documenting the accepted JSON shape (Understand-Anything + normalized), the `concept:<slug>` `animKey` convention, the `autoAnimate: false` opt-out, and a curl example against `/api/presentations/from-graph`.
- [ ] 8.2 Add a short note in `DESIGN_REVIEW.md` summarizing why graph ingest bypasses planning while still routing through repair/validate.

## 9. Verification

- [ ] 9.1 `pnpm test` (runs `scripts/run-unit-tests.cjs`) — all new tests green.
- [ ] 9.2 `pnpm build` — no type errors in `core/schemas/types.ts` consumers.
- [ ] 9.3 Manual smoke: paste the README curl example's graph, generate, open the resulting deck in `/player`, and confirm a shared `concept:` token visibly morphs across two consecutive slides under default settings, and does NOT morph when `autoAnimate: false` is set.
- [ ] 9.4 Capture evidence under `.steward/evidence/` (build + test log; optional Playwright screenshot of the morphing transition).
