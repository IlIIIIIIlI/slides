import type { SlideSpec, PresentationSpec } from '@/core/schemas/types';
import type { Slide } from '@/app/slides';

type SlideType = Slide['type'];

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

export function specToSlide(spec: SlideSpec): Slide {
  const rp = spec.renderProps ?? {};

  return {
    type: intentToType(spec),
    headline: extractHeadline(spec),
    subtitle: spec.contentBlocks.find((b) => b.type === 'supporting' && b.emphasis)?.content,
    label: rp.label,
    color: rp.color,
    supporting: extractSupporting(spec),
    points: extractPoints(spec),
    code: rp.code,
    iframeUrl: rp.iframeUrl,
    quote: rp.quote,
    author: rp.author,
    imageUrl: rp.imageUrl,
    imageLayout: rp.imageLayout,
    agentTree: rp.agentTree,
    linkPreview: rp.linkPreview,
    leftContent: rp.leftContent,
    rightContent: rp.rightContent,
    bigNumber: rp.bigNumber,
    numberLabel: rp.numberLabel,
    beforePoints: rp.beforePoints,
    afterPoints: rp.afterPoints,
    question: rp.question,
    options: rp.options,
    answer: rp.answer,
    explanation: rp.explanation,
  };
}

export function presentationToSlides(spec: PresentationSpec): Slide[] {
  return spec.slides.map(specToSlide);
}
