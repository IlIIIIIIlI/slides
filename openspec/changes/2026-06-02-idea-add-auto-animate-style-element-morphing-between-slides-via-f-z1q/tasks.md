## 1. Dependency & plugin setup
- [ ] 1.1 Add `"gsap": "^3.12"` to `dependencies` in `package.json` and install via pnpm (update `pnpm-lock.yaml`).
- [ ] 1.2 Create `lib/animation/flip.ts`: import `gsap` and `Flip` from `gsap/Flip`, guard `if (typeof window !== 'undefined') gsap.registerPlugin(Flip)` behind a module-level `registered` flag, and re-export `{ gsap, Flip }`.

## 2. Schema changes
- [ ] 2.1 In `core/schemas/types.ts`, add optional `animKey?: string` to the shared block/base block type used by content blocks (title, bullets, code).
- [ ] 2.2 In `core/schemas/types.ts`, add optional `autoAnimate?: boolean` to the presentation/deck type.

## 3. Diff logic (pure)
- [ ] 3.1 Create `core/rendering/morph.ts` exporting `resolveAnimKey(block, occurrenceIndex)`, `flipIdFor(animKey)` returning `` `flip-${animKey}` ``, and `sharedAnimKeys(prev, next)`.
- [ ] 3.2 Implement `resolveAnimKey`: prefer explicit `block.animKey`; else map title→`"title"`, code→`"code:${occurrenceIndex}"`; else return undefined.
- [ ] 3.3 Implement `sharedAnimKeys` as the intersection of resolved keys present in both slides, preserving order.

## 4. Rendering integration
- [ ] 4.1 In `core/rendering/adapter.ts`, when rendering each block, call `resolveAnimKey` and, if defined, set `data-flip-id={flipIdFor(key)}` on the outermost rendered element.
- [ ] 4.2 Ensure stamped elements are direct, positionable DOM nodes (avoid React.Fragment as the stamped element) so Flip can read their rects.

## 5. Player hook
- [ ] 5.1 Create `hooks/use-auto-animate.ts` exporting `useAutoAnimate({ containerRef, currentIndex, prevIndex, slides, enabled })`.
- [ ] 5.2 In the hook, compute `keys = sharedAnimKeys(slides[prevIndex], slides[currentIndex])` and the corresponding `data-flip-id` selector list.
- [ ] 5.3 Capture `Flip.getState(selector)` in the cleanup of a `useLayoutEffect` keyed on `currentIndex` (previous nodes still mounted), store in a ref.
- [ ] 5.4 After the new slide mounts, run `Flip.from(state, { duration: 0.5, ease: 'power2.inOut', absolute: true })` against the matched ids.
- [ ] 5.5 Early-return (skip capture) when `!enabled` or `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.

## 6. Wire into player
- [ ] 6.1 In `app/player/page.tsx`, import `lib/animation/flip.ts` (dynamic import so GSAP loads only in the player route) and `hooks/use-auto-animate.ts`.
- [ ] 6.2 Add a `containerRef` on the slide container element and pass `currentIndex`, `prevIndex`, `slides`, and `enabled = presentation.autoAnimate !== false` to `useAutoAnimate`.

## 7. Tests
- [ ] 7.1 Create `core/rendering/morph.test.ts` (run via `scripts/run-unit-tests.cjs`) covering: explicit key match, derived title key, repeated code-block occurrence keys, empty-intersection case, and `flipIdFor` output.
- [ ] 7.2 Add a test asserting `core/rendering/adapter.ts` stamps `data-flip-id` for keyed blocks and omits it for unkeyed blocks (use jsdom already in deps).

## 8. Docs
- [ ] 8.1 Update `DESIGN_REVIEW.md` with an "Auto-Animate / Flip morphing" section describing `animKey`, the `autoAnimate` deck flag, derived-key behavior, and reduced-motion handling.
- [ ] 8.2 Add a short authoring note in `README.md` showing how to set `animKey` on blocks and `autoAnimate: false` on a deck.
