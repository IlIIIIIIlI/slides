import type { PresentationSpec, SlideSpec } from '@/core/schemas/types';
import type { Rule, SlopViolation } from '../types';

// ContentBlock has no 'card' type and no children field. We detect the "nested
// cards" anti-pattern by proxy: a framework or comparison slide with an
// unusually high block count indicates the AI tried to cram a card grid into a
// flat content structure, and a `visualMode` containing "card" is an explicit
// layout hint from the generation pipeline.
const FRAMEWORK_BLOCK_THRESHOLD = 4;

export const nestedCardsRule: Rule = {
  id: 'nested-cards',
  check({ slide }: { slide: SlideSpec; deck: PresentationSpec }): SlopViolation[] {
    const isCardMode =
      typeof slide.visualMode === 'string' &&
      /card/i.test(slide.visualMode);

    const isFrameworkOrComparison =
      slide.intent === 'framework' || slide.intent === 'comparison';

    const structuralBlocks = slide.contentBlocks.filter(
      (b) => b.type === 'supporting' || b.type === 'bullet-list' || b.type === 'comparison',
    );

    const overloaded = structuralBlocks.length > FRAMEWORK_BLOCK_THRESHOLD;

    if (!isCardMode && !(isFrameworkOrComparison && overloaded)) return [];

    return [
      {
        ruleId: 'nested-cards',
        severity: 'error',
        slideId: slide.id,
        message: isCardMode
          ? `Slide uses "card" visual mode with ${structuralBlocks.length} structural blocks — nested-card density is an AI-overengineering tell.`
          : `Framework/comparison slide has ${structuralBlocks.length} structural blocks (threshold: ${FRAMEWORK_BLOCK_THRESHOLD}). Likely a flattened card grid.`,
        suggestion:
          'Break this slide into multiple focused slides, each with a single clear point rather than a grid of sub-sections.',
      },
    ];
  },
};
