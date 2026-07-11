/** Severity for Impeccable visual-slop findings (mirrors antislop levels). */
export type ImpeccableSeverity = 'error' | 'warn' | 'info';

/** Stable rule id (e.g. "gradient-text", "low-contrast-text"). */
export type ImpeccableRuleId = string;

export type FindingScope = 'block' | 'slide';

export interface ImpeccableEvidence {
  selector?: string;
  snippet?: string;
}

export interface ImpeccableFinding {
  ruleId: ImpeccableRuleId;
  severity: ImpeccableSeverity;
  message: string;
  slideIndex: number;
  /** JSON-ish path for repair prompts: "slides[0].contentBlocks[2]" | "slides[0]" */
  path: string;
  blockIndex?: number;
  animKey?: string;
  scope?: FindingScope;
  evidence?: ImpeccableEvidence;
}

export interface DetectReport {
  slideIndex: number;
  findings: ImpeccableFinding[];
  rulesRun: string[];
  rulesSkipped: Array<{ ruleId: string; reason: string }>;
  durationMs: number;
}

export interface DetectContext {
  slideIndex: number;
  /** Optional rule id allowlist; when set, only these rules run. */
  enabledRuleIds?: string[];
  /** Optional rule id blocklist. */
  disabledRuleIds?: string[];
}

export interface RuleCheckContext extends DetectContext {
  document: Document;
}

export interface DetectRule {
  id: ImpeccableRuleId;
  description: string;
  severity: ImpeccableSeverity;
  /** When false, rule is registered but skipped (jsdom/layout limitations). */
  enabled: boolean;
  skipReason?: string;
  check: (ctx: RuleCheckContext) => Omit<ImpeccableFinding, 'slideIndex' | 'path' | 'blockIndex' | 'animKey' | 'scope'> & {
    /** Element that triggered the finding (for map-findings). */
    target?: Element | null;
    /** Pre-set path when known (rare). */
    path?: string;
    blockIndex?: number;
    animKey?: string;
    scope?: FindingScope;
  }[];
}

export interface DetectOptions {
  slideIndex?: number;
  enabledRuleIds?: string[];
  disabledRuleIds?: string[];
}
