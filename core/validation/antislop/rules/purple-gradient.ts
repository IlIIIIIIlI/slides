import type { PresentationSpec, SlideSpec } from '@/core/schemas/types';
import { getPresetById } from '@/core/theming/presets';
import type { Rule, SlopViolation } from '../types';

const PURPLE_RE = /(purple|violet|indigo|#7c3aed|#8b5cf6|linear-gradient[^)]*(?:purple|violet|#a78bfa))/i;

function hasPurpleBackground(presetId: string): boolean {
  const preset = getPresetById(presetId);
  if (!preset) return false;
  return PURPLE_RE.test(preset.tokens.background);
}

function slidePurpleMatches(slide: SlideSpec): string[] {
  const hits: string[] = [];

  if (slide.renderProps?.color && PURPLE_RE.test(slide.renderProps.color)) {
    hits.push(slide.renderProps.color);
  }

  if (slide.visualMode && PURPLE_RE.test(slide.visualMode)) {
    hits.push(slide.visualMode);
  }

  return hits;
}

export const purpleGradientRule: Rule = {
  id: 'purple-gradient',
  check({ slide, deck }: { slide: SlideSpec; deck: PresentationSpec }): SlopViolation[] {
    const matches = slidePurpleMatches(slide);
    if (matches.length === 0) return [];

    const intentional = hasPurpleBackground(deck.themePresetId);
    const severity = intentional ? 'info' : 'error';

    return [
      {
        ruleId: 'purple-gradient',
        severity,
        slideId: slide.id,
        message: `Purple/violet/indigo gradient detected: "${matches[0]}". This is a common AI default.`,
        suggestion: intentional
          ? 'Your theme uses purple intentionally — verify the gradient has semantic meaning.'
          : 'Replace with a theme-semantic color from your palette (e.g., use semanticColors.solution or .highlight).',
      },
    ];
  },
};
