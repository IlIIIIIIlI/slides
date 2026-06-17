import type { PresentationSpec, SlideSpec } from '@/core/schemas/types';
import type { Rule, SlopViolation } from '../types';

const EM_DASH = '—';
const SLIDE_THRESHOLD = 1;
const DECK_RATIO_THRESHOLD = 0.4;

function countEmDashes(text: string): number {
  let n = 0;
  for (const ch of text) if (ch === EM_DASH) n++;
  return n;
}

export const emDashOveruseRule: Rule = {
  id: 'em-dash-overuse',
  check({ slide, deck }: { slide: SlideSpec; deck: PresentationSpec }): SlopViolation[] {
    const violations: SlopViolation[] = [];

    const textBlocks = slide.contentBlocks.filter(
      (b) => b.type === 'headline' || b.type === 'supporting',
    );

    let slideTotal = 0;
    for (const block of textBlocks) {
      slideTotal += countEmDashes(block.content);
    }

    if (slideTotal > SLIDE_THRESHOLD) {
      violations.push({
        ruleId: 'em-dash-overuse',
        severity: 'warn',
        slideId: slide.id,
        message: `${slideTotal} em-dashes on a single slide (threshold: ${SLIDE_THRESHOLD}).`,
        suggestion: 'Use commas, colons, or restructure the sentence to reduce em-dash reliance.',
      });
      return violations;
    }

    // Deck-level ratio check: only fire on the first slide (avoids duplicate violations
    // per slide while still reporting the deck-wide signal).
    const isFirstSlide = deck.slides.length > 0 && deck.slides[0].id === slide.id;
    if (!isFirstSlide) return violations;

    const totalEmDashes = deck.slides.reduce((sum, s) => {
      const t = s.contentBlocks
        .filter((b) => b.type === 'headline' || b.type === 'supporting')
        .reduce((acc, b) => acc + countEmDashes(b.content), 0);
      return sum + t;
    }, 0);

    const totalTextBlocks = deck.slides.reduce(
      (sum, s) =>
        sum + s.contentBlocks.filter((b) => b.type === 'headline' || b.type === 'supporting').length,
      0,
    );

    // Require at least 3 em-dashes before the ratio check fires to avoid false
    // positives on very short decks where a single dash skews the ratio.
    if (totalEmDashes >= 3 && totalTextBlocks > 0 && totalEmDashes / totalTextBlocks > DECK_RATIO_THRESHOLD) {
      violations.push({
        ruleId: 'em-dash-overuse',
        severity: 'warn',
        slideId: slide.id,
        message: `${totalEmDashes} em-dashes across ${totalTextBlocks} text blocks (${Math.round((totalEmDashes / totalTextBlocks) * 100)}% ratio exceeds ${DECK_RATIO_THRESHOLD * 100}% threshold).`,
        suggestion: 'Review the deck for em-dash overuse — a common AI writing tell.',
      });
    }

    return violations;
  },
};
