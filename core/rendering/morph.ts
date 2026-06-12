import type { ContentBlock, SlideSpec } from '@/core/schemas/types';

export function resolveAnimKey(block: ContentBlock, occurrenceIndex = 0): string | undefined {
  if (block.animKey) return block.animKey;
  if (block.type === 'headline') return 'title';
  if (block.type === 'code-block') return `code:${occurrenceIndex}`;
  return undefined;
}

export function flipIdFor(animKey: string): string {
  return `flip-${animKey}`;
}

export function sharedAnimKeys(prev: SlideSpec, next: SlideSpec): string[] {
  const keysOf = (spec: SlideSpec): string[] => {
    const seen = new Map<string, number>();
    const result: string[] = [];
    for (const block of spec.contentBlocks) {
      const kind = block.type === 'code-block' ? 'code-block' : block.type;
      const idx = seen.get(kind) ?? 0;
      seen.set(kind, idx + 1);
      const key = resolveAnimKey(block, idx);
      if (key) result.push(key);
    }
    return result;
  };

  const prevKeys = new Set(keysOf(prev));
  return keysOf(next).filter((k) => prevKeys.has(k));
}
