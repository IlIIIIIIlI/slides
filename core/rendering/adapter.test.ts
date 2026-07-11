import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { specToSlide, renderSlideToHtml, computeBlockMeta, blockAttrsForElKey } from '@/core/rendering/adapter';
import type { SlideSpec } from '@/core/schemas/types';
import { DEFAULT_PRESET_ID } from '@/core/theming/presets';

function makeSpec(overrides?: Partial<SlideSpec>): SlideSpec {
  return {
    id: 'test',
    intent: 'statement',
    sectionId: 'sec',
    audienceProfileId: 'aud',
    themePresetId: DEFAULT_PRESET_ID,
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

describe('renderSlideToHtml block attribution', () => {
  test('emits data-block-index, data-block-type, data-anim-key for headline, supporting, bullet-list, code-block', () => {
    const spec = makeSpec({
      contentBlocks: [
        { type: 'headline', content: 'Title Here' },
        { type: 'supporting', content: 'Some support text' },
        { type: 'bullet-list', content: 'One\nTwo' },
        { type: 'code-block', content: 'const x = 1', codeLanguage: 'ts' },
      ],
    });

    const html = renderSlideToHtml(spec);
    assert.match(html, /data-block-index="0"/);
    assert.match(html, /data-block-type="headline"/);
    assert.match(html, /data-anim-key="title"/);

    assert.match(html, /data-block-index="1"/);
    assert.match(html, /data-block-type="supporting"/);

    assert.match(html, /data-block-index="2"/);
    assert.match(html, /data-block-type="bullet-list"/);

    assert.match(html, /data-block-index="3"/);
    assert.match(html, /data-block-type="code-block"/);
    assert.match(html, /data-anim-key="code:0"/);
  });

  test('preserves explicit animKey', () => {
    const spec = makeSpec({
      contentBlocks: [{ type: 'headline', content: 'Hi', animKey: 'main-title' }],
    });
    const html = renderSlideToHtml(spec);
    assert.match(html, /data-anim-key="main-title"/);
  });

  test('computeBlockMeta and blockAttrsForElKey align', () => {
    const spec = makeSpec({
      contentBlocks: [
        { type: 'headline', content: 'H' },
        { type: 'supporting', content: 'S' },
      ],
    });
    const slide = specToSlide(spec);
    assert.deepEqual(computeBlockMeta(spec).map((m) => m.type), ['headline', 'supporting']);
    const h = blockAttrsForElKey('headline', slide);
    assert.equal(h.dataBlockIndex, 0);
    assert.equal(h.dataBlockType, 'headline');
    assert.equal(h.dataAnimKey, 'title');
  });
});
