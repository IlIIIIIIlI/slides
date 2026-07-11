import { JSDOM } from 'jsdom';
import { getEnabledRules } from './rules';
import { mapFindings, type RawFinding } from './map-findings';
import type { DetectContext, DetectReport } from './types';

/**
 * Run Impeccable-style deterministic detect on a player HTML snapshot.
 * Zero LLM / network — jsdom only.
 */
export function detectSlideHtml(html: string, ctx: DetectContext): DetectReport {
  const started = Date.now();
  const { run, skipped } = getEnabledRules(ctx);

  const dom = new JSDOM(wrapHtml(html));
  const document = dom.window.document;

  const raw: RawFinding[] = [];
  for (const rule of run) {
    const hits = rule.check({
      document,
      slideIndex: ctx.slideIndex,
      enabledRuleIds: ctx.enabledRuleIds,
      disabledRuleIds: ctx.disabledRuleIds,
    });
    for (const hit of hits) {
      raw.push({
        ruleId: hit.ruleId,
        severity: hit.severity,
        message: hit.message,
        target: hit.target,
        path: hit.path,
        blockIndex: hit.blockIndex,
        animKey: hit.animKey,
        scope: hit.scope,
        evidence: hit.evidence,
      });
    }
  }

  const findings = mapFindings(raw, ctx.slideIndex);

  return {
    slideIndex: ctx.slideIndex,
    findings,
    rulesRun: run.map((r) => r.id),
    rulesSkipped: skipped,
    durationMs: Date.now() - started,
  };
}

function wrapHtml(html: string): string {
  // If caller already passed a full document, use as-is; else wrap fragment.
  if (/<html[\s>]/i.test(html) || /<!doctype/i.test(html)) return html;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
}
