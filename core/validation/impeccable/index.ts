/**
 * Impeccable-inspired visual-slop detection on player-rendered slide HTML.
 * Detect only (deterministic DOM/CSS heuristics) — no LLM.
 * Inspired by https://github.com/pbakaus/impeccable
 */

export type {
  ImpeccableSeverity,
  ImpeccableRuleId,
  ImpeccableFinding,
  ImpeccableEvidence,
  DetectReport,
  DetectContext,
  DetectOptions,
  DetectRule,
  FindingScope,
} from './types';

export { detectSlideHtml } from './detect';
export { mapFindings, resolveBlockPath } from './map-findings';
export {
  buildSnapshotDocumentHtml,
  detectSlideSpec,
  SNAPSHOT_BASE_CSS,
} from './render-snapshot';
export {
  ALL_RULES,
  HIGH_VALUE_RULES,
  getEnabledRules,
  parseColor,
  contrastRatio,
  relativeLuminance,
} from './rules';
export { renderSlideToHtml, computeBlockMeta } from '@/core/rendering/adapter';
