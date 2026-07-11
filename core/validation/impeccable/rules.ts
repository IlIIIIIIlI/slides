/**
 * Impeccable-inspired deterministic detect rules (detect only — no LLM craft).
 * Inspired by https://github.com/pbakaus/impeccable
 *
 * High-value rules run under jsdom; remaining ids stay registered as disabled
 * stubs so the registry can grow toward ~46 without faking green.
 */

import type { DetectRule, RuleCheckContext } from './types';

function styleAttr(el: Element): string {
  return (el.getAttribute('style') ?? '') + ' ' + (el.getAttribute('class') ?? '');
}

function snippet(el: Element, max = 120): string {
  const s = styleAttr(el).replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max) + '…' : s;
}

/** Parse #rgb / #rrggbb / rgb() / rgba() to [r,g,b] 0–255. */
export function parseColor(input: string | null | undefined): [number, number, number] | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (s === 'transparent' || s === 'inherit' || s === 'currentcolor') return null;

  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      return [
        parseInt(h[0] + h[0], 16),
        parseInt(h[1] + h[1], 16),
        parseInt(h[2] + h[2], 16),
      ];
    }
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  const rgb = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  return null;
}

/** Relative luminance (sRGB) 0–1. */
export function relativeLuminance(rgb: [number, number, number]): number {
  const lin = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function resolveCssColor(
  value: string | null | undefined,
  doc: Document,
): [number, number, number] | null {
  if (!value) return null;
  const direct = parseColor(value);
  if (direct) return direct;

  // var(--slide-text-primary) etc. — resolve from slide root inline style
  const varMatch = value.match(/var\(\s*(--[\w-]+)\s*\)/);
  if (varMatch) {
    const root = doc.querySelector('.slide-root') as HTMLElement | null;
    if (root) {
      const style = root.getAttribute('style') ?? '';
      const re = new RegExp(`${varMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^;]+)`);
      const m = style.match(re);
      if (m) return parseColor(m[1].trim());
    }
  }
  return null;
}

function getInlineDecl(style: string, prop: string): string | null {
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i');
  const m = style.match(re);
  return m ? m[1].trim() : null;
}

// ─── Implemented rules ───────────────────────────────────────────────

const gradientTextRule: DetectRule = {
  id: 'gradient-text',
  description: 'Gradient fill / background-clip:text on type (common AI marketing tell)',
  severity: 'warn',
  enabled: true,
  check({ document }) {
    const findings: ReturnType<DetectRule['check']> = [];
    const all = Array.from(document.querySelectorAll('[style], [class]'));
    for (const el of all) {
      const bag = styleAttr(el);
      const hasClip =
        /background-clip\s*:\s*text/i.test(bag) ||
        /-webkit-background-clip\s*:\s*text/i.test(bag) ||
        /bg-clip-text/i.test(bag);
      const hasGradient =
        /linear-gradient|radial-gradient|conic-gradient/i.test(bag) ||
        /bg-gradient-/i.test(bag);
      const fillTransparent =
        /(-webkit-)?text-fill-color\s*:\s*transparent/i.test(bag) ||
        /text-transparent/i.test(bag);

      if ((hasClip && hasGradient) || (hasClip && fillTransparent) || (hasGradient && fillTransparent && /clip/i.test(bag))) {
        findings.push({
          ruleId: 'gradient-text',
          severity: 'warn',
          message: 'Gradient or clipped gradient text detected. Prefer solid type colors from the theme.',
          target: el,
          evidence: { snippet: snippet(el) },
        });
      }
    }
    return findings;
  },
};

const multiAxisGridBgRule: DetectRule = {
  id: 'multi-axis-grid-background',
  description: 'Busy multi-axis grid or mesh backgrounds on slide/block containers',
  severity: 'warn',
  enabled: true,
  check({ document }) {
    const findings: ReturnType<DetectRule['check']> = [];
    const candidates = Array.from(
      document.querySelectorAll('.slide-root, [data-block-index], [style], [class]'),
    );
    for (const el of candidates) {
      const bag = styleAttr(el);
      // Two or more stacked gradients / mesh / grid-bg patterns
      const gradientCount = (bag.match(/(?:linear|radial|conic)-gradient/gi) ?? []).length;
      const meshOrGrid =
        /mesh|grid-bg|bg-grid|background-image\s*:[^;]*repeating-linear-gradient/i.test(bag) ||
        (/background(?:-image)?\s*:[^;]*linear-gradient/i.test(bag) &&
          /background(?:-image)?\s*:[^;]*linear-gradient/i.test(bag) &&
          gradientCount >= 2);

      const multiBackgroundLayers =
        gradientCount >= 2 ||
        (bag.match(/background-image\s*:/gi) ?? []).length +
          (bag.includes('background:') && bag.includes('gradient') ? 1 : 0) >=
          1 && gradientCount >= 2;

      if (meshOrGrid || multiBackgroundLayers) {
        findings.push({
          ruleId: 'multi-axis-grid-background',
          severity: 'warn',
          message: 'Multi-axis grid or mesh-style background detected. Prefer a flat theme surface.',
          target: el,
          evidence: { snippet: snippet(el) },
        });
      }
    }
    return findings;
  },
};

/** WCAG AA body text threshold (approx). */
const MIN_CONTRAST = 4.5;

const lowContrastTextRule: DetectRule = {
  id: 'low-contrast-text',
  description: 'Text color vs background fails approximate contrast threshold',
  severity: 'error',
  enabled: true,
  check({ document }) {
    const findings: ReturnType<DetectRule['check']> = [];
    const root = document.querySelector('.slide-root') as HTMLElement | null;
    const rootStyle = root?.getAttribute('style') ?? '';
    const defaultBg =
      resolveCssColor(getInlineDecl(rootStyle, 'background') ?? getInlineDecl(rootStyle, '--slide-bg'), document) ??
      parseColor('#fafafa');
    const defaultFg =
      resolveCssColor(getInlineDecl(rootStyle, 'color') ?? getInlineDecl(rootStyle, '--slide-text-primary'), document) ??
      parseColor('#09090b');

    const textEls = Array.from(
      document.querySelectorAll('h1, h2, h3, h4, p, li, blockquote, span, label, code, pre, div[data-block-index]'),
    );

    for (const el of textEls) {
      const style = el.getAttribute('style') ?? '';
      const className = el.getAttribute('class') ?? '';
      if (!style && !className) continue;

      // Skip pure containers with no text
      const text = (el.textContent ?? '').trim();
      if (!text) continue;

      let colorDecl = getInlineDecl(style, 'color');
      if (!colorDecl && /text-\[#([0-9a-f]{3,8})\]/i.test(className)) {
        const m = className.match(/text-\[#([0-9a-f]{3,8})\]/i);
        if (m) colorDecl = `#${m[1]}`;
      }

      // Resolve CSS variables commonly used on text
      if (!colorDecl) {
        if (/--slide-text-faint|text-faint/.test(style + className)) {
          colorDecl = getInlineDecl(rootStyle, '--slide-text-faint') ?? '#d4d4d8';
        }
      }

      const fg = resolveCssColor(colorDecl, document) ?? defaultFg;
      let bgDecl =
        getInlineDecl(style, 'background-color') ??
        getInlineDecl(style, 'background');
      // Walk up for background
      if (!bgDecl) {
        let p: Element | null = el.parentElement;
        while (p && !bgDecl) {
          const ps = p.getAttribute('style') ?? '';
          bgDecl =
            getInlineDecl(ps, 'background-color') ??
            getInlineDecl(ps, 'background') ??
            null;
          p = p.parentElement;
        }
      }
      const bg = resolveCssColor(bgDecl, document) ?? defaultBg;
      if (!fg || !bg) continue;

      const ratio = contrastRatio(fg, bg);
      if (ratio < MIN_CONTRAST) {
        findings.push({
          ruleId: 'low-contrast-text',
          severity: 'error',
          message: `Low-contrast text (ratio ~${ratio.toFixed(2)}:1, need ≥${MIN_CONTRAST}:1).`,
          target: el,
          evidence: {
            snippet: snippet(el),
            selector: el.tagName.toLowerCase(),
          },
        });
      }
    }
    return findings;
  },
};

const excessiveTextShadowRule: DetectRule = {
  id: 'excessive-text-shadow',
  description: 'Heavy glow / multi text-shadow on body copy',
  severity: 'warn',
  enabled: true,
  check({ document }) {
    const findings: ReturnType<DetectRule['check']> = [];
    for (const el of Array.from(document.querySelectorAll('[style]'))) {
      const style = el.getAttribute('style') ?? '';
      const shadow = getInlineDecl(style, 'text-shadow');
      if (!shadow || shadow === 'none') continue;
      const layers = shadow.split(/,(?![^(]*\))/).length;
      const blurMatch = shadow.match(/(\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px/g);
      const bigBlur = blurMatch?.some((part) => {
        const nums = part.match(/(\d+(?:\.\d+)?)px/g)?.map((n) => parseFloat(n));
        return nums && nums[2] != null && nums[2] >= 8;
      });
      if (layers >= 2 || bigBlur) {
        findings.push({
          ruleId: 'excessive-text-shadow',
          severity: 'warn',
          message: 'Excessive text-shadow / glow on type.',
          target: el,
          evidence: { snippet: snippet(el) },
        });
      }
    }
    return findings;
  },
};

const decorativeLineSpamRule: DetectRule = {
  id: 'decorative-line-spam',
  description: 'Too many decorative hr / border dividers on a slide',
  severity: 'info',
  enabled: true,
  check({ document }) {
    const hrs = document.querySelectorAll('hr, .divider, [class*="divider"]');
    const borders = Array.from(document.querySelectorAll('[style]')).filter((el) => {
      const s = el.getAttribute('style') ?? '';
      return /border-(?:top|bottom)\s*:\s*(?!0|none)/i.test(s) || /border\s*:\s*[^;]*solid/i.test(s);
    });
    const count = hrs.length + borders.length;
    if (count >= 4) {
      return [
        {
          ruleId: 'decorative-line-spam',
          severity: 'info',
          message: `Decorative line / divider spam (${count} dividers).`,
          target: document.querySelector('.slide-root'),
          scope: 'slide',
          path: undefined,
          evidence: { snippet: `${count} divider-like elements` },
        },
      ];
    }
    return [];
  },
};

const fontSizeHierarchyRule: DetectRule = {
  id: 'font-size-hierarchy',
  description: 'Body text larger than or equal to headline (hierarchy inversion)',
  severity: 'warn',
  enabled: true,
  check({ document }) {
    const findings: ReturnType<DetectRule['check']> = [];
    const headlines = Array.from(
      document.querySelectorAll('[data-block-type="headline"], h1, h2'),
    );
    const bodies = Array.from(
      document.querySelectorAll('[data-block-type="supporting"], [data-block-type="bullet-list"] li, p.block-supporting'),
    );
    if (headlines.length === 0 || bodies.length === 0) return findings;

    const sizeOf = (el: Element): number | null => {
      const style = el.getAttribute('style') ?? '';
      const fs = getInlineDecl(style, 'font-size');
      if (!fs) return null;
      const m = fs.match(/([\d.]+)(rem|px|em)/);
      if (!m) return null;
      const n = parseFloat(m[1]);
      if (m[2] === 'px') return n / 16;
      return n;
    };

    const headlineSizes = headlines.map(sizeOf).filter((n): n is number => n != null);
    const bodySizes = bodies.map(sizeOf).filter((n): n is number => n != null);
    if (headlineSizes.length === 0 || bodySizes.length === 0) return findings;

    const minHeadline = Math.min(...headlineSizes);
    const maxBody = Math.max(...bodySizes);
    if (maxBody >= minHeadline) {
      findings.push({
        ruleId: 'font-size-hierarchy',
        severity: 'warn',
        message: `Typography hierarchy inversion: body (~${maxBody}rem) ≥ headline (~${minHeadline}rem).`,
        target: bodies[0],
        evidence: { snippet: `body ${maxBody}rem vs headline ${minHeadline}rem` },
      });
    }
    return findings;
  },
};

const emojiHeadingRule: DetectRule = {
  id: 'emoji-as-heading',
  description: 'Headline is primarily emoji / icon characters',
  severity: 'warn',
  enabled: true,
  check({ document }) {
    const findings: ReturnType<DetectRule['check']> = [];
    const heads = Array.from(
      document.querySelectorAll('[data-block-type="headline"], h1, h2'),
    );
    // Rough emoji / symbol-heavy pattern
    const emojiRe =
      /^(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\s]|[\u{1F1E0}-\u{1F1FF}])+$/u;
    for (const el of heads) {
      const text = (el.textContent ?? '').trim();
      if (!text) continue;
      if (emojiRe.test(text) || (text.length <= 4 && /[\u{1F300}-\u{1FAFF}]/u.test(text))) {
        findings.push({
          ruleId: 'emoji-as-heading',
          severity: 'warn',
          message: 'Headline is primarily emoji/icon characters.',
          target: el,
          evidence: { snippet: text.slice(0, 40) },
        });
      }
    }
    return findings;
  },
};

// ─── Stub / skipped rules (registered for completeness; not faked) ───

function stub(
  id: string,
  description: string,
  severity: DetectRule['severity'],
  reason: string,
): DetectRule {
  return {
    id,
    description,
    severity,
    enabled: false,
    skipReason: reason,
    check: () => [],
  };
}

const LAYOUT_SKIP = 'Needs real layout boxes (not reliable under jsdom)';
const PAINT_SKIP = 'Needs painted pixels / browser screenshot path';
const FUTURE = 'Registered for Impeccable parity; heuristic not ported yet';

const STUB_RULES: DetectRule[] = [
  stub('overlapping-blocks', 'Overlapping or zero-gap stacked blocks', 'warn', LAYOUT_SKIP),
  stub('text-overflow-clip', 'Text clipped by container overflow', 'error', LAYOUT_SKIP),
  stub('element-collision', 'Interactive/text elements collide', 'warn', LAYOUT_SKIP),
  stub('uneven-gaps', 'Inconsistent spacing rhythm', 'info', LAYOUT_SKIP),
  stub('margin-collapse-surprise', 'Unexpected margin collapse', 'info', LAYOUT_SKIP),
  stub('center-alignment-trap', 'Everything center-aligned marketing layout', 'info', FUTURE),
  stub('card-soup', 'Too many nested cards', 'warn', FUTURE),
  stub('icon-orphan', 'Decorative icon without label', 'info', FUTURE),
  stub('low-contrast-icon', 'Icon color fails contrast', 'warn', FUTURE),
  stub('tiny-tap-target', 'Touch target below 44px', 'warn', LAYOUT_SKIP),
  stub('line-length-extreme', 'Measure too wide or too narrow', 'info', LAYOUT_SKIP),
  stub('all-caps-body', 'Body copy in all caps', 'warn', FUTURE),
  stub('letter-spacing-abuse', 'Excessive tracking on body', 'info', FUTURE),
  stub('rainbow-palette', 'Too many unrelated accent colors', 'warn', FUTURE),
  stub('pure-black-on-white', 'Harsh pure black #000 on pure white', 'info', FUTURE),
  stub('white-on-pure-black', 'Harsh pure white on #000', 'info', FUTURE),
  stub('background-noise', 'Noise/texture overlay on content', 'info', PAINT_SKIP),
  stub('glassmorphism-overuse', 'Frosted glass stacks reducing readability', 'warn', PAINT_SKIP),
  stub('blur-text', 'Text under blur/filter', 'error', PAINT_SKIP),
  stub('animation-without-purpose', 'Decorative infinite animation class', 'info', FUTURE),
  stub('autoplay-motion', 'Auto-playing motion without reduced-motion', 'warn', FUTURE),
  stub('missing-focus-style', 'Interactive without focus ring', 'info', FUTURE),
  stub('placeholder-lorem', 'Lorem ipsum leftover', 'error', FUTURE),
  stub('placeholder-image', 'Broken or placeholder image src', 'warn', FUTURE),
  stub('stock-gradient-hero', 'Generic purple-blue hero gradient', 'warn', FUTURE),
  stub('soft-shadow-stack', 'Stacked soft shadows on every card', 'info', FUTURE),
  stub('border-radius-chaos', 'Inconsistent corner radii', 'info', FUTURE),
  stub('z-index-war', 'Extreme z-index values', 'info', FUTURE),
  stub('fixed-position-spam', 'Multiple fixed/sticky layers', 'warn', LAYOUT_SKIP),
  stub('horizontal-scroll-trap', 'Unintended horizontal overflow', 'warn', LAYOUT_SKIP),
  stub('font-family-mix', 'Too many font families on one slide', 'warn', FUTURE),
  stub('monospace-body', 'Body text forced to monospace without code intent', 'info', FUTURE),
  stub('underline-rainbow', 'Decorative multi-color underlines', 'info', FUTURE),
  stub('badge-pile', 'Excess status badges / chips', 'info', FUTURE),
  stub('chartjunk', 'Heavy chart decoration without data', 'warn', FUTURE),
  stub('qr-code-tiny', 'QR or dense graphic too small', 'warn', LAYOUT_SKIP),
  stub('contrast-on-image', 'Text over busy image without scrim', 'error', PAINT_SKIP),
  stub('low-opacity-text', 'Text opacity below readability floor', 'warn', FUTURE),
];

export const HIGH_VALUE_RULES: DetectRule[] = [
  gradientTextRule,
  multiAxisGridBgRule,
  lowContrastTextRule,
  excessiveTextShadowRule,
  decorativeLineSpamRule,
  fontSizeHierarchyRule,
  emojiHeadingRule,
];

export const ALL_RULES: DetectRule[] = [...HIGH_VALUE_RULES, ...STUB_RULES];

export function getEnabledRules(ctx: Pick<RuleCheckContext, 'enabledRuleIds' | 'disabledRuleIds'>): {
  run: DetectRule[];
  skipped: Array<{ ruleId: string; reason: string }>;
} {
  const disabled = new Set(ctx.disabledRuleIds ?? []);
  const allow = ctx.enabledRuleIds ? new Set(ctx.enabledRuleIds) : null;
  const run: DetectRule[] = [];
  const skipped: Array<{ ruleId: string; reason: string }> = [];

  for (const rule of ALL_RULES) {
    if (allow && !allow.has(rule.id)) continue;
    if (disabled.has(rule.id)) {
      skipped.push({ ruleId: rule.id, reason: 'disabled by options' });
      continue;
    }
    if (!rule.enabled) {
      skipped.push({ ruleId: rule.id, reason: rule.skipReason ?? 'disabled' });
      continue;
    }
    run.push(rule);
  }
  return { run, skipped };
}
