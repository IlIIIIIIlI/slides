import type { PresentationSpec, SlideSpec } from '@/core/schemas/types';
import type { Rule, SlopViolation } from '../types';

const MIN_BULLETS = 3;
const EM_DASH = '—';

function extractVerb(line: string): string | null {
  const m = line.match(/^\s*[-*•]?\s*([A-Za-z]+)\b/);
  return m ? m[1].toLowerCase() : null;
}

export const bulletParallelismFakeRule: Rule = {
  id: 'bullet-parallelism-fake',
  check({ slide }: { slide: SlideSpec; deck: PresentationSpec }): SlopViolation[] {
    const violations: SlopViolation[] = [];

    for (let i = 0; i < slide.contentBlocks.length; i++) {
      const block = slide.contentBlocks[i];
      if (block.type !== 'bullet-list') continue;

      const lines = block.content.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length < MIN_BULLETS) continue;

      const verbs = lines.map(extractVerb);
      const allSameVerb =
        verbs.every((v) => v !== null) &&
        new Set(verbs).size === 1;

      const allEndWithEmDash = lines.every((l) => l.trimEnd().endsWith(EM_DASH));

      if (!allSameVerb && !allEndWithEmDash) continue;

      const reason = allSameVerb
        ? `all ${lines.length} bullets start with the same verb ("${verbs[0]}")`
        : `all ${lines.length} bullets end with an em-dash explanation`;

      violations.push({
        ruleId: 'bullet-parallelism-fake',
        severity: 'info',
        slideId: slide.id,
        blockIndex: i,
        message: `Fake bullet parallelism: ${reason}.`,
        suggestion:
          'Vary the sentence structure or rewrite as a single coherent statement rather than forced parallel bullets.',
      });
    }

    return violations;
  },
};
