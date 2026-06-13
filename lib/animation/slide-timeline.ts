"use client";

import { useEffect, useRef } from "react";
import type { TimelineEntry } from "@/core/schemas/types";

// Runs a GSAP timeline against elements on the current slide.
//
// Elements are targeted via [data-anim="<target>"] attributes — stable
// across re-renders unlike fragile class/index-based selectors.
//
// Each TimelineEntry describes a FROM state; GSAP animates the element
// from those values to its natural CSS state (a "reveal from" pattern).
//
// The timeline is created after the slide mounts (slideIndex change) and
// killed in the effect's cleanup callback, preventing memory leaks when
// slides advance or the component unmounts.
export function useSlideTimeline(
  containerRef: React.RefObject<HTMLElement | null>,
  timeline: TimelineEntry[] | undefined,
  slideIndex: number,
) {
  const tlRef = useRef<{ kill(): void } | null>(null);

  useEffect(() => {
    if (!timeline || timeline.length === 0) return;
    if (typeof window === "undefined") return;

    let cancelled = false;

    import("gsap").then(({ gsap }) => {
      if (cancelled || !containerRef.current) return;

      const tl = gsap.timeline();
      tlRef.current = tl;

      for (const entry of timeline) {
        const el = containerRef.current!.querySelector<Element>(
          `[data-anim="${CSS.escape(entry.target)}"]`,
        );
        if (!el) continue;

        const { duration = 0.6, ease = "power2.out", stagger, delay, ...fromVars } = entry.tween;
        const tweenOpts: Record<string, unknown> = { ...fromVars, duration, ease };
        if (stagger !== undefined) tweenOpts.stagger = stagger;
        if (delay !== undefined) tweenOpts.delay = delay;

        tl.from(el, tweenOpts, entry.at);
      }
    });

    return () => {
      cancelled = true;
      tlRef.current?.kill();
      tlRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideIndex]);
}
