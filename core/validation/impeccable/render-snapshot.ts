import type { SlideSpec, ThemePreset } from '@/core/schemas/types';
import { renderSlideToHtml } from '@/core/rendering/adapter';
import { DEFAULT_PRESET_ID, getPresetById } from '@/core/theming/presets';
import { detectSlideHtml } from './detect';
import type { DetectOptions, DetectReport } from './types';

/**
 * Minimal CSS injected alongside the slide snapshot for detect heuristics.
 *
 * Sourced from player theme patterns (app/globals.css + ThemeTokens):
 * - --slide-bg / surfaces for background rules
 * - --slide-text-* for contrast resolution of var() references
 * - body font-size baseline so rem sizes are meaningful under jsdom
 *
 * We do not pull the full Tailwind build; rules primarily inspect inline styles
 * and data-block attributes emitted by renderSlideToHtml.
 */
export const SNAPSHOT_BASE_CSS = `
  html, body { margin: 0; padding: 0; font-size: 16px; }
  .slide-root { box-sizing: border-box; min-height: 200px; padding: 2rem; }
  .type-display { letter-spacing: -0.035em; line-height: 1; }
  .block-bullet-list { margin: 0; }
`.trim();

export function buildSnapshotDocumentHtml(
  slide: SlideSpec,
  theme?: ThemePreset | string,
): string {
  const preset =
    typeof theme === 'string' || theme === undefined
      ? getPresetById(typeof theme === 'string' ? theme : slide.themePresetId) ??
        getPresetById(DEFAULT_PRESET_ID)!
      : theme;

  const body = renderSlideToHtml(slide, preset);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>${SNAPSHOT_BASE_CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}

/**
 * Compose snapshot → detect → mapped findings for one SlideSpec.
 * Read-only: never mutates animKey or contentBlocks.
 */
export function detectSlideSpec(
  slide: SlideSpec,
  theme?: ThemePreset | string,
  slideIndex = 0,
  options?: DetectOptions,
): DetectReport {
  const html = buildSnapshotDocumentHtml(slide, theme);
  return detectSlideHtml(html, {
    slideIndex: options?.slideIndex ?? slideIndex,
    enabledRuleIds: options?.enabledRuleIds,
    disabledRuleIds: options?.disabledRuleIds,
  });
}
