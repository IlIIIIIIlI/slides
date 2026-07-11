import type { ContentBlock, SlideSpec, PresentationSpec, ThemePreset } from '@/core/schemas/types';
import type { BlockRenderMeta, Slide } from '@/app/slides';
import { resolveAnimKey } from '@/core/rendering/morph';
import { DEFAULT_PRESET_ID, getPresetById } from '@/core/theming/presets';

type SlideType = Slide['type'];

/** Player Adjustable elKey → ContentBlock type for data-block-* attribution. */
const EL_KEY_TO_BLOCK_TYPE: Record<string, ContentBlock['type'] | string> = {
  headline: 'headline',
  supporting: 'supporting',
  points: 'bullet-list',
  code: 'code-block',
  quote: 'quote-text',
  image: 'image-ref',
  bigNumber: 'metric',
  beforePoints: 'comparison',
  afterPoints: 'comparison',
};

function intentToType(spec: SlideSpec): SlideType {
  if (spec.renderProps?.iframeUrl) return 'iframe';
  if (spec.renderProps?.agentTree) return 'agent-tree';
  if (spec.renderProps?.bigNumber) return 'big-number';
  if (spec.renderProps?.code) return 'code';
  if (spec.renderProps?.quote) return 'quote';
  if (spec.renderProps?.beforePoints) return 'comparison';
  if (spec.renderProps?.leftContent) return 'split-visual';

  const map: Record<string, SlideType> = {
    title: 'title',
    agenda: 'goals',
    'section-divider': 'section-divider',
    statement: 'statement',
    'big-statement': 'statement',
    data: 'big-number',
    proof: 'image',
    framework: 'framework',
    comparison: 'comparison',
    quote: 'quote',
    code: 'code',
    image: 'image',
    demo: 'iframe',
    recap: 'recap',
    appendix: 'recap',
    quiz: 'quiz',
  };

  return map[spec.intent] ?? 'statement';
}

function extractHeadline(spec: SlideSpec): string {
  const block = spec.contentBlocks.find((b) => b.type === 'headline');
  return block?.content ?? '';
}

function extractSupporting(spec: SlideSpec): string | undefined {
  const block = spec.contentBlocks.find((b) => b.type === 'supporting');
  return block?.content;
}

function extractPoints(spec: SlideSpec): string[] | undefined {
  const block = spec.contentBlocks.find((b) => b.type === 'bullet-list');
  if (!block) return undefined;
  return block.content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function computeAnimKeys(spec: SlideSpec): string[] {
  const seen = new Map<string, number>();
  const keys: string[] = [];
  for (const block of spec.contentBlocks) {
    const kind = block.type === 'code-block' ? 'code-block' : block.type;
    const idx = seen.get(kind) ?? 0;
    seen.set(kind, idx + 1);
    const key = resolveAnimKey(block, idx);
    if (key) keys.push(key);
  }
  return keys;
}

/** Build per-block attribution metadata from a SlideSpec's contentBlocks. */
export function computeBlockMeta(spec: SlideSpec): BlockRenderMeta[] {
  const seen = new Map<string, number>();
  return spec.contentBlocks.map((block, index) => {
    const kind = block.type === 'code-block' ? 'code-block' : block.type;
    const occurrence = seen.get(kind) ?? 0;
    seen.set(kind, occurrence + 1);
    const animKey = resolveAnimKey(block, occurrence);
    return {
      index,
      type: block.type,
      animKey,
    };
  });
}

/**
 * Resolve data-block-* props for a player Adjustable elKey.
 * Falls back to synthesizing meta from slide fields when blockMeta is absent.
 */
export function blockAttrsForElKey(
  elKey: string,
  slide: Pick<Slide, 'blockMeta' | 'headline' | 'supporting' | 'points' | 'code' | 'quote' | 'imageUrl' | 'bigNumber' | 'beforePoints' | 'afterPoints' | 'animKeys'>,
): { dataBlockIndex?: number; dataBlockType?: string; dataAnimKey?: string } {
  const type = EL_KEY_TO_BLOCK_TYPE[elKey];
  if (!type) return {};

  const meta = slide.blockMeta ?? synthesizeBlockMetaFromSlide(slide);
  const found = meta.find((b) => b.type === type);
  if (!found) return {};
  return {
    dataBlockIndex: found.index,
    dataBlockType: found.type,
    ...(found.animKey ? { dataAnimKey: found.animKey } : {}),
  };
}

/** When generation produced a plain Slide without contentBlocks, invent stable indices. */
export function synthesizeBlockMetaFromSlide(
  slide: Pick<Slide, 'headline' | 'supporting' | 'points' | 'code' | 'quote' | 'imageUrl' | 'bigNumber' | 'beforePoints' | 'afterPoints' | 'animKeys'>,
): BlockRenderMeta[] {
  const meta: BlockRenderMeta[] = [];
  const push = (type: string, animKey?: string) => {
    meta.push({ index: meta.length, type, animKey });
  };
  if (slide.headline) push('headline', slide.animKeys?.includes('title') ? 'title' : undefined);
  if (slide.supporting) push('supporting');
  if (slide.points?.length) push('bullet-list');
  if (slide.code) push('code-block', slide.animKeys?.find((k) => k.startsWith('code:')) ?? 'code:0');
  if (slide.quote) push('quote-text');
  if (slide.imageUrl) push('image-ref');
  if (slide.bigNumber) push('metric');
  if (slide.beforePoints?.length || slide.afterPoints?.length) push('comparison');
  return meta;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function blockRootAttrs(block: ContentBlock, index: number, occurrenceIndex: number): string {
  const animKey = resolveAnimKey(block, occurrenceIndex);
  const parts = [
    `data-block-index="${index}"`,
    `data-block-type="${escapeHtml(block.type)}"`,
  ];
  if (animKey) parts.push(`data-anim-key="${escapeHtml(animKey)}"`);
  return parts.join(' ');
}

/**
 * Pure HTML snapshot of a slide's content blocks for Node/jsdom detect.
 * Mirrors player class names / CSS variables enough for contrast and background rules.
 * Each block root carries data-block-index, data-block-type, and optional data-anim-key.
 */
export function renderSlideToHtml(
  spec: SlideSpec,
  theme?: ThemePreset | string,
): string {
  const preset =
    typeof theme === 'string'
      ? getPresetById(theme) ?? getPresetById(DEFAULT_PRESET_ID)!
      : theme ?? getPresetById(spec.themePresetId) ?? getPresetById(DEFAULT_PRESET_ID)!;

  const tokens = preset.tokens;
  const seen = new Map<string, number>();
  const blocksHtml = spec.contentBlocks
    .map((block, index) => {
      const kind = block.type === 'code-block' ? 'code-block' : block.type;
      const occurrence = seen.get(kind) ?? 0;
      seen.set(kind, occurrence + 1);
      const attrs = blockRootAttrs(block, index, occurrence);
      const content = escapeHtml(block.content);

      switch (block.type) {
        case 'headline':
          return `<h2 ${attrs} class="type-display block-headline" style="color: var(--slide-text-primary); font-size: 3rem; font-weight: 700;">${content}</h2>`;
        case 'supporting':
          return `<p ${attrs} class="block-supporting" style="color: var(--slide-text-muted); font-size: 1.25rem; font-weight: 300;">${content}</p>`;
        case 'bullet-list': {
          const items = block.content
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => `<li style="color: var(--slide-text-secondary); font-size: 1.125rem;">${escapeHtml(l)}</li>`)
            .join('');
          return `<ul ${attrs} class="block-bullet-list" style="list-style: disc; padding-left: 1.5rem;">${items}</ul>`;
        }
        case 'code-block':
          return `<pre ${attrs} class="block-code" style="background: var(--slide-surface-2); color: var(--slide-text-primary); font-family: var(--slide-mono-font); font-size: 0.875rem; padding: 1rem; border-radius: ${tokens.radius};"><code>${content}</code></pre>`;
        case 'quote-text':
          return `<blockquote ${attrs} class="block-quote" style="color: var(--slide-text-primary); font-size: 1.5rem; font-style: italic;">${content}</blockquote>`;
        case 'metric':
          return `<div ${attrs} class="block-metric" style="color: var(--slide-text-primary); font-size: 4rem; font-weight: 700;">${content}</div>`;
        case 'image-ref':
          return `<figure ${attrs} class="block-image" data-image-ref="${content}" style="background: var(--slide-surface-1);"></figure>`;
        case 'comparison':
          return `<div ${attrs} class="block-comparison" style="color: var(--slide-text-secondary); font-size: 1.125rem;">${content}</div>`;
        default:
          return `<div ${attrs} class="block-generic" style="color: var(--slide-text-primary);">${content}</div>`;
      }
    })
    .join('\n');

  // CSS variables used by detect rules (contrast, backgrounds). Subset of player theme tokens.
  const style = [
    `--slide-bg: ${tokens.background}`,
    `--slide-surface-1: ${tokens.surface1}`,
    `--slide-surface-2: ${tokens.surface2}`,
    `--slide-text-primary: ${tokens.textPrimary}`,
    `--slide-text-secondary: ${tokens.textSecondary}`,
    `--slide-text-muted: ${tokens.textMuted}`,
    `--slide-text-faint: ${tokens.textFaint}`,
    `--slide-border: ${tokens.borderColor}`,
    `--slide-mono-font: ${preset.monoFont}`,
    `background: ${tokens.background}`,
    `color: ${tokens.textPrimary}`,
    `font-family: ${preset.bodyFont}, system-ui, sans-serif`,
  ].join('; ');

  return `<article class="slide-root" data-slide-id="${escapeHtml(spec.id)}" data-theme="${escapeHtml(preset.id)}" style="${style}">\n${blocksHtml}\n</article>`;
}

export function specToSlide(spec: SlideSpec): Slide {
  const rp = spec.renderProps ?? {};
  const animKeys = computeAnimKeys(spec);
  const blockMeta = computeBlockMeta(spec);

  return {
    type: intentToType(spec),
    headline: extractHeadline(spec),
    subtitle: spec.contentBlocks.find((b) => b.type === 'supporting' && b.emphasis)?.content,
    label: rp.label,
    color: rp.color,
    supporting: extractSupporting(spec),
    points: extractPoints(spec),
    code: rp.code ?? spec.contentBlocks.find((b) => b.type === 'code-block')?.content,
    iframeUrl: rp.iframeUrl,
    quote: rp.quote ?? spec.contentBlocks.find((b) => b.type === 'quote-text')?.content,
    author: rp.author,
    imageUrl: rp.imageUrl,
    imageLayout: rp.imageLayout,
    agentTree: rp.agentTree,
    linkPreview: rp.linkPreview,
    leftContent: rp.leftContent,
    rightContent: rp.rightContent,
    bigNumber: rp.bigNumber ?? spec.contentBlocks.find((b) => b.type === 'metric')?.content,
    numberLabel: rp.numberLabel,
    beforePoints: rp.beforePoints,
    afterPoints: rp.afterPoints,
    question: rp.question,
    options: rp.options,
    answer: rp.answer,
    explanation: rp.explanation,
    animKeys: animKeys.length > 0 ? animKeys : undefined,
    blockMeta: blockMeta.length > 0 ? blockMeta : undefined,
  };
}

export function presentationToSlides(spec: PresentationSpec): Slide[] {
  return spec.slides.map(specToSlide);
}
