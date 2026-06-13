import type { PresentationSpec, SlideSpec } from '@/core/schemas/types';
import type { Rule, SlopViolation } from '../types';

// Stem-based patterns cover inflected forms (e.g. "seamlessly", "revolutionary").
const BUZZWORD_PATTERNS: RegExp[] = [
  /\bunleas\w*\b/i,
  /\bseamless\w*\b/i,
  /\brevolution\w*\b/i,
  /\bleverag\w*\b/i,      // leverage / leveraged / leverages
  /\bempow\w*\b/i,        // empower / empowering / empowers
  /\bunlock\w*\b/i,
  /\bsupercharg\w*\b/i,
  /\bgame-chang\w*\b/i,
  /\bcutting-edge\b/i,
  /\bsynerg\w*\b/i,
  /\bholistic\w*\b/i,
  /\brobust\w*\b/i,
  /\btransform\w*\b/i,
  /\bdisrupt\w*\b/i,
];

const MIN_DISTINCT_HITS = 2;

function matchBuzzwords(text: string): string[] {
  return BUZZWORD_PATTERNS.flatMap((re) => {
    const m = text.match(re);
    return m ? [m[0].toLowerCase()] : [];
  });
}

export const marketingBuzzwordsRule: Rule = {
  id: 'marketing-buzzwords',
  check({ slide }: { slide: SlideSpec; deck: PresentationSpec }): SlopViolation[] {
    const hits = new Set<string>();

    for (const block of slide.contentBlocks) {
      for (const hit of matchBuzzwords(block.content)) {
        hits.add(hit);
      }
    }

    if (hits.size < MIN_DISTINCT_HITS) return [];

    return [
      {
        ruleId: 'marketing-buzzwords',
        severity: 'warn',
        slideId: slide.id,
        message: `${hits.size} distinct marketing buzzwords detected: ${Array.from(hits).join(', ')}.`,
        suggestion: 'Replace vague marketing language with concrete, specific claims backed by evidence.',
      },
    ];
  },
};
