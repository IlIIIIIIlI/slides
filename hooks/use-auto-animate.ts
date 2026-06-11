"use client";

import { useRef, useLayoutEffect, useCallback } from 'react';

interface UseAutoAnimateOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  currentIndex: number;
  enabled: boolean;
}

export function useAutoAnimate({ containerRef, currentIndex, enabled }: UseAutoAnimateOptions) {
  // Holds Flip state captured just before slide navigation
  const capturedStateRef = useRef<unknown>(null);
  // Track whether GSAP Flip is available (browser-only)
  const flipRef = useRef<{ Flip: { getState: (t: NodeListOf<Element>) => unknown; from: (s: unknown, opts: object) => unknown } } | null>(null);

  // Load GSAP Flip lazily (client only)
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    import('@/lib/animation/flip').then((mod) => {
      flipRef.current = mod as unknown as typeof flipRef.current;
    });
  }, []);

  // After new slide mounts, run Flip animation from captured state
  useLayoutEffect(() => {
    if (!capturedStateRef.current || !enabled) return;
    const flip = flipRef.current;
    if (!flip) return;
    flip.Flip.from(capturedStateRef.current, {
      duration: 0.5,
      ease: 'power2.inOut',
      absolute: true,
    });
    capturedStateRef.current = null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // Call this synchronously before changing slide index to capture current positions
  const captureFlipState = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const flip = flipRef.current;
    if (!flip || !containerRef.current) return;
    const targets = containerRef.current.querySelectorAll('[data-flip-id]');
    if (targets.length === 0) return;
    capturedStateRef.current = flip.Flip.getState(targets);
  }, [enabled, containerRef]);

  return { captureFlipState };
}
