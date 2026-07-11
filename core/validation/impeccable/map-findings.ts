import type { FindingScope, ImpeccableFinding } from './types';

export interface RawFinding {
  ruleId: string;
  severity: ImpeccableFinding['severity'];
  message: string;
  target?: Element | null;
  path?: string;
  blockIndex?: number;
  animKey?: string;
  scope?: FindingScope;
  evidence?: ImpeccableFinding['evidence'];
}

/**
 * Walk from a DOM node up to the nearest [data-block-index] ancestor.
 * Returns slide-scoped path when no block root is found.
 */
export function resolveBlockPath(
  target: Element | null | undefined,
  slideIndex: number,
): Pick<ImpeccableFinding, 'path' | 'blockIndex' | 'animKey' | 'scope'> {
  if (!target) {
    return { path: `slides[${slideIndex}]`, scope: 'slide' };
  }

  let el: Element | null = target;
  while (el) {
    if (el.hasAttribute('data-block-index')) {
      const raw = el.getAttribute('data-block-index');
      const blockIndex = raw != null && raw !== '' ? Number(raw) : NaN;
      if (Number.isFinite(blockIndex)) {
        const animKey = el.getAttribute('data-anim-key') ?? undefined;
        return {
          path: `slides[${slideIndex}].contentBlocks[${blockIndex}]`,
          blockIndex,
          animKey: animKey || undefined,
          scope: 'block',
        };
      }
    }
    el = el.parentElement;
  }

  return { path: `slides[${slideIndex}]`, scope: 'slide' };
}

/** Attach path / blockIndex / animKey to raw rule findings. */
export function mapFindings(raw: RawFinding[], slideIndex: number): ImpeccableFinding[] {
  return raw.map((f) => {
    if (f.path && f.scope) {
      return {
        ruleId: f.ruleId,
        severity: f.severity,
        message: f.message,
        slideIndex,
        path: f.path,
        blockIndex: f.blockIndex,
        animKey: f.animKey,
        scope: f.scope,
        evidence: f.evidence,
      };
    }

    const mapped = resolveBlockPath(f.target, slideIndex);
    return {
      ruleId: f.ruleId,
      severity: f.severity,
      message: f.message,
      slideIndex,
      path: f.path ?? mapped.path,
      blockIndex: f.blockIndex ?? mapped.blockIndex,
      animKey: f.animKey ?? mapped.animKey,
      scope: f.scope ?? mapped.scope,
      evidence: f.evidence,
    };
  });
}
