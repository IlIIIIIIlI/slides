import type { PresentationSpec, SlideSpec } from '@/core/schemas/types';
import { getPresetById } from '@/core/theming/presets';
import type { Rule, SlopViolation } from '../types';

const INTER_RE = /\binter\b/i;

export const interEverywhereRule: Rule = {
  id: 'inter-everywhere',
  check({ slide, deck }: { slide: SlideSpec; deck: PresentationSpec }): SlopViolation[] {
    // Only emit this violation once per deck (on the first slide) to avoid
    // flooding every slide with the same theme-level finding.
    const isFirstSlide = deck.slides.length > 0 && deck.slides[0].id === slide.id;
    if (!isFirstSlide) return [];

    const preset = getPresetById(deck.themePresetId);
    if (!preset) return [];

    const displayIsInter = INTER_RE.test(preset.displayFont);
    const bodyIsInter = INTER_RE.test(preset.bodyFont);

    if (!displayIsInter && !bodyIsInter) return [];

    const which = [
      displayIsInter ? `displayFont ("${preset.displayFont}")` : null,
      bodyIsInter ? `bodyFont ("${preset.bodyFont}")` : null,
    ]
      .filter(Boolean)
      .join(' and ');

    return [
      {
        ruleId: 'inter-everywhere',
        severity: 'warn',
        slideId: slide.id,
        message: `Theme preset "${preset.name}" uses Inter for ${which}. This is the default AI typeface choice.`,
        suggestion:
          'Switch to a distinctive typeface that reflects the deck\'s personality (e.g., Geist, Syne, DM Sans, Fraunces).',
      },
    ];
  },
};
