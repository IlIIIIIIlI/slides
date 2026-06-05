## Context

The player (`app/player/page.tsx`) reads a presentation, walks an ordered list of slides, and renders the active slide via the rendering pipeline in `core/rendering/adapter.ts`, which maps schema blocks (defined in `core/schemas/types.ts`) to React/Tailwind components. Navigation currently performs a hard swap of the active slide's React subtree — no shared layout continuity.

GSAP's Flip plugin works on a capture/play model: record the bounding rect + transform of target DOM nodes (`Flip.getState(targets)`), mutate the DOM (here: render the next slide), then `Flip.from(state, {...})` to animate the deltas. We need (1) stable ids so we know which elements are "the same" across two slides, (2) a place to capture state at the right moment, and (3) a play step after the new slide commits.

## Goals / Non-Goals

- Goals: Morph shared title/bullet/code blocks between consecutive slides; opt-out and reduced-motion respect; no regression for slides lacking animKeys; pure, testable diff logic.
- Non-Goals: Cross-fade of non-matched elements (we keep existing enter behavior), per-character text morphing, editing UI to assign animKeys (auto-derivation is sufficient initially).

## Decisions

### Element identity (`animKey`)
Add optional `animKey?: string` to the block types in `core/schemas/types.ts`. When absent, `core/rendering/morph.ts` derives a deterministic key for stable block kinds:
- title/heading blocks → `"title"` (one per slide)
- code blocks → `"code:" + hash(language)` so a code block persists across slides regardless of body changes
- explicit `animKey` always wins.
This lets generated decks (in `data/presentations/*.json`) morph without re-generation, while authored keys give precise control.

### Diff function (pure)
`core/rendering/morph.ts` exports:
```ts
export function sharedAnimKeys(prev: SlideSchema, next: SlideSchema): string[]
export function flipIdFor(animKey: string): string // -> `flip-${animKey}`
export function resolveAnimKey(block: SlideBlock): string | undefined
```
`sharedAnimKeys` returns the intersection of resolved keys present in both slides (these are the elements that will morph). Pure, no DOM — unit testable.

### DOM stamping
`core/rendering/adapter.ts` (and the JSX components it emits) set `data-flip-id={flipIdFor(key)}` on the outermost element of any block whose `resolveAnimKey` is defined. The Flip layer selects via `[data-flip-id]`.

### Capture/play orchestration
New `hooks/use-auto-animate.ts`:
```ts
useAutoAnimate({ containerRef, currentIndex, prevIndex, slides, enabled })
```
Mechanism (React 19, client):
1. Before committing the new slide, in a `useLayoutEffect` keyed on `currentIndex`, read the *previous* render's `[data-flip-id]` nodes still in the DOM and `Flip.getState(selector)`. Because React unmounts on swap, we capture state in the cleanup of the prior effect (the previous slide's nodes are still mounted at cleanup time).
2. Store captured state in a ref.
3. After the new slide's `useLayoutEffect` fires (nodes mounted), call `Flip.from(state, { duration: 0.5, ease: 'power2.inOut', targets: container.querySelectorAll('[data-flip-id]'), absolute: true })`.
4. Only animate ids returned by `sharedAnimKeys(prev,next)` to avoid GSAP trying to morph unmatched nodes.
If `enabled` is false or `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, skip capture entirely.

### Plugin registration
`lib/animation/flip.ts` does `gsap.registerPlugin(Flip)` exactly once, guarded for SSR (`typeof window !== 'undefined'`), and re-exports `gsap` and `Flip`. Player imports from here so the plugin is registered before any animation.

### Toggle
Add `autoAnimate?: boolean` to the presentation/deck schema (default treated as `true`). The player reads it and passes `enabled` to the hook.

## Risks / Trade-offs

- Capture timing in React 19 concurrent rendering: we use `useLayoutEffect` (synchronous, pre-paint) and capture in the cleanup phase to guarantee old nodes exist. If flicker appears, fall back to keeping both slides mounted briefly during transition.
- GSAP bundle size (~Flip + core ≈ 70KB min): acceptable, lazy-loaded only in the player route via dynamic import in `lib/animation/flip.ts`.
- Derived code keys could collide if a slide has two code blocks; we index by occurrence (`code:N`) to disambiguate.

## Migration Plan

No data migration required. Existing JSON in `data/presentations/` works unchanged (auto-derived keys). Authors may add `animKey` for finer control later.

## Open Questions

- Should non-matched elements get a default fade/slide enter, or keep current static appearance? (Initial: keep current; revisit after review.)
