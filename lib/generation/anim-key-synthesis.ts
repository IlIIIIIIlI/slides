import type { ContentBlock, SlideSpec } from '@/core/schemas/types';

export type LpRole = 'title' | 'body' | 'figure' | 'code' | 'other';

export interface ExtractedBlock extends ContentBlock {
  _bbox?: [number, number, number, number]; // [x, y, w, h] in page coordinates
  _role?: LpRole;
}

export interface ExtractedSlide extends Omit<SlideSpec, 'contentBlocks'> {
  contentBlocks: ExtractedBlock[];
  _pageW?: number;
  _pageH?: number;
}

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .slice(0, 120)
    .trim();
}

export function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (Math.imul(h, 0x01000193) >>> 0);
  }
  return h;
}

export function quantizeBBox(
  bbox: [number, number, number, number],
  pageW: number,
  pageH: number,
  cols = 12,
  rows = 9,
): [number, number, number, number] {
  const [x, y, w, h] = bbox;
  return [
    Math.round((x / pageW) * cols),
    Math.round((y / pageH) * rows),
    Math.round((w / pageW) * cols),
    Math.round((h / pageH) * rows),
  ];
}

export function iou(
  a: [number, number, number, number],
  b: [number, number, number, number],
): number {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;
  const interX = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
  const interY = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
  const inter = interX * interY;
  if (inter === 0) return 0;
  const union = aw * ah + bw * bh - inter;
  return union > 0 ? inter / union : 0;
}

export function contentKeyFor(block: ExtractedBlock): number {
  if (block._role === 'code') {
    const firstLine = block.content.split('\n').find((l) => l.trim()) ?? block.content;
    return fnv1a32(normalizeText(firstLine));
  }
  return fnv1a32(normalizeText(block.content));
}

export function synthesizeAnimKeys(
  slides: ExtractedSlide[],
  opts?: { gridCols?: number; gridRows?: number; iouThreshold?: number },
): ExtractedSlide[] {
  const { gridCols = 12, gridRows = 9, iouThreshold = 0.5 } = opts ?? {};
  let counter = 0;

  // Record blocks that had explicit animKey before synthesis started.
  // Only those are excluded from the matching pool; synthesized keys propagate freely.
  const preExisting = new Set<ExtractedBlock>();
  for (const slide of slides) {
    for (const block of slide.contentBlocks) {
      if (block.animKey) preExisting.add(block);
    }
  }

  for (let i = 0; i < slides.length - 1; i++) {
    const prev = slides[i];
    const next = slides[i + 1];

    type Candidate = { block: ExtractedBlock; sqKey: [number, number, number, number] };
    const index = new Map<string, Candidate[]>();

    for (const block of prev.contentBlocks) {
      if (!block._bbox || !block._role || block._role === 'other') continue;
      // Exclude only pre-existing explicit keys; synthesized keys from earlier passes propagate.
      if (preExisting.has(block)) continue;
      const sqKey = (prev._pageW && prev._pageH)
        ? quantizeBBox(block._bbox, prev._pageW, prev._pageH, gridCols, gridRows)
        : (block._bbox as [number, number, number, number]);
      const mapKey = `${block._role}:${contentKeyFor(block)}`;
      if (!index.has(mapKey)) index.set(mapKey, []);
      index.get(mapKey)!.push({ block, sqKey });
    }

    for (const block of next.contentBlocks) {
      if (!block._bbox || !block._role || block._role === 'other') continue;
      if (block.animKey) continue; // never overwrite

      const sqKey = (next._pageW && next._pageH)
        ? quantizeBBox(block._bbox, next._pageW, next._pageH, gridCols, gridRows)
        : (block._bbox as [number, number, number, number]);
      const mapKey = `${block._role}:${contentKeyFor(block)}`;
      const candidates = index.get(mapKey);
      if (!candidates || candidates.length === 0) continue;

      let best: Candidate | null = null;
      let bestScore = iouThreshold;
      for (const cand of candidates) {
        const score = iou(cand.sqKey, sqKey);
        if (score >= bestScore) {
          bestScore = score;
          best = cand;
        }
      }

      if (best) {
        if (!best.block.animKey) {
          counter++;
          best.block.animKey = `lp:${block._role}:${counter}`;
        }
        block.animKey = best.block.animKey;
      }
    }
  }

  return slides;
}

export function stripInternal(slides: ExtractedSlide[]): SlideSpec[] {
  return slides.map(({ _pageW: _pw, _pageH: _ph, contentBlocks, ...rest }) => ({
    ...rest,
    contentBlocks: contentBlocks.map(({ _bbox: _b, _role: _r, ...block }) => block),
  }));
}
