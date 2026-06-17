import type { PresentationSpec, SlideSpec } from '@/core/schemas/types';
import type { Rule, SlopViolation } from '../types';

const WORD_COUNT_THRESHOLD = 8;
const CAPITAL_RATIO_THRESHOLD = 0.8;
// Minor words normally lowercase in title case (articles, prepositions, conjunctions).
const MINOR_WORDS = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for',
  'so', 'yet', 'at', 'by', 'in', 'of', 'on', 'to', 'up', 'as', 'is', 'it']);

function isTitleCase(text: string): boolean {
  const words = text.split(/\s+/).filter((w) => /^[a-zA-Z]/.test(w));
  // Only consider words longer than 3 chars (avoids false positives from minor words).
  const significant = words.filter((w) => w.length > 3 && !MINOR_WORDS.has(w.toLowerCase()));
  if (significant.length < 3) return false;
  const capitalized = significant.filter((w) => /^[A-Z]/.test(w)).length;
  return capitalized / significant.length > CAPITAL_RATIO_THRESHOLD;
}

export const headlineTitleCaseOverkillRule: Rule = {
  id: 'headline-titlecase-overkill',
  check({ slide }: { slide: SlideSpec; deck: PresentationSpec }): SlopViolation[] {
    const violations: SlopViolation[] = [];

    for (let i = 0; i < slide.contentBlocks.length; i++) {
      const block = slide.contentBlocks[i];
      if (block.type !== 'headline') continue;

      const words = block.content.trim().split(/\s+/);
      if (words.length <= WORD_COUNT_THRESHOLD) continue;
      if (!isTitleCase(block.content)) continue;

      violations.push({
        ruleId: 'headline-titlecase-overkill',
        severity: 'info',
        slideId: slide.id,
        blockIndex: i,
        message: `Headline has ${words.length} words in Title Case: "${block.content}".`,
        suggestion:
          'Use sentence case for slide headlines (only the first word capitalised). Title Case in long headlines is a strong AI generation tell.',
      });
    }

    return violations;
  },
};
