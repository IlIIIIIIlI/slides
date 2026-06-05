import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { specToSlide } from '@/core/rendering/adapter';
import type { SlideSpec } from '@/core/schemas/types';

function makeSpec(overrides?: Partial<SlideSpec>): SlideSpec {
  return {
    id: 'test',
    intent: 'statement',
    sectionId: 'sec',
    audienceProfileId: 'aud',
    themePresetId: 'theme',
    evidenceRefs: [],
    assetRefs: [],
    citationPolicy: 'none',
    speakerNotesMode: 'none',
    status: 'draft',
    contentBlocks: [],
    ...overrides,
  };
}

describe('specToSlide animKeys', () => {
  test('stamps animKeys for headline block', () => {
    const spec = makeSpec({
      contentBlocks: [{ type: 'headline', content: 'Hello' }],
    });
    const slide = specToSlide(spec);
    assert.deepEqual(slide.animKeys, ['title']);
  });

  test('stamps animKeys for code-block', () => {
    const spec = makeSpec({
      intent: 'code',
      contentBlocks: [{ type: 'code-block', content: 'console.log(1)', codeLanguage: 'js' }],
      renderProps: { code: 'console.log(1)' },
    });
    const slide = specToSlide(spec);
    assert.deepEqual(slide.animKeys, ['code:0']);
  });

  test('omits animKeys when no keyed blocks', () => {
    const spec = makeSpec({
      contentBlocks: [{ type: 'supporting', content: 'details' }],
    });
    const slide = specToSlide(spec);
    assert.equal(slide.animKeys, undefined);
  });

  test('explicit animKey on block is used', () => {
    const spec = makeSpec({
      contentBlocks: [{ type: 'supporting', content: 'custom', animKey: 'chart-main' }],
    });
    const slide = specToSlide(spec);
    assert.deepEqual(slide.animKeys, ['chart-main']);
  });
});
