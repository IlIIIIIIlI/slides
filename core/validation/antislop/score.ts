import type { SlopViolation, SlideSlop, SlopReport } from './types';
import type { SlideSpec, PresentationSpec } from '@/core/schemas/types';
import { ALL_RULES } from './rules';

// env var is always a string; parse explicitly to avoid string comparison bugs.
export const ANTISLOP_THRESHOLD = process.env.ANTISLOP_THRESHOLD
  ? parseInt(process.env.ANTISLOP_THRESHOLD, 10)
  : 70;

const SEVERITY_PENALTY: Record<string, number> = {
  error: 25,
  warn: 10,
  info: 3,
};

export function scoreSlide(slide: SlideSpec, deck: PresentationSpec): SlideSlop {
  const violations: SlopViolation[] = ALL_RULES.flatMap((rule) =>
    rule.check({ slide, deck }),
  );

  const penalty = violations.reduce(
    (acc, v) => acc + (SEVERITY_PENALTY[v.severity] ?? 0),
    0,
  );
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return { slideId: slide.id, score, violations };
}

export function lintPresentation(deck: PresentationSpec): SlopReport {
  const slideScores = deck.slides.map((slide) => scoreSlide(slide, deck));

  const allViolations = slideScores.flatMap((s) => s.violations);
  const deckScore =
    slideScores.length > 0
      ? Math.round(slideScores.reduce((sum, s) => sum + s.score, 0) / slideScores.length)
      : 100;

  return {
    generatedAt: new Date().toISOString(),
    score: deckScore,
    violations: allViolations,
    slideScores,
  };
}
