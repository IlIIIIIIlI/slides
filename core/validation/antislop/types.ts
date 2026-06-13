import type { PresentationSpec, SlideSpec } from '@/core/schemas/types';

export type SlopSeverity = 'info' | 'warn' | 'error';

export interface SlopViolation {
  ruleId: string;
  severity: SlopSeverity;
  slideId: string;
  blockIndex?: number;
  message: string;
  suggestion: string;
}

export interface SlideSlop {
  slideId: string;
  score: number;
  violations: SlopViolation[];
}

export interface SlopReport {
  generatedAt: string;
  score: number;
  violations: SlopViolation[];
  slideScores: SlideSlop[];
}

export interface Rule {
  id: string;
  check(ctx: { slide: SlideSpec; deck: PresentationSpec }): SlopViolation[];
}
