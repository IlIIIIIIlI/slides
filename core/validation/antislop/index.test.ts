import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PresentationSpec, SlideSpec } from '@/core/schemas/types';
import { lintPresentation } from './index';

function makeSlide(id: string, overrides: Partial<SlideSpec> = {}): SlideSpec {
  return {
    id,
    intent: 'statement',
    sectionId: 's1',
    audienceProfileId: 'a1',
    themePresetId: 'preset_light_minimal_01',
    evidenceRefs: [],
    assetRefs: [],
    citationPolicy: 'none',
    speakerNotesMode: 'none',
    status: 'draft',
    contentBlocks: [],
    ...overrides,
  };
}

function makeDeck(slides: SlideSpec[]): PresentationSpec {
  return {
    id: 'deck-1',
    title: 'Test',
    purpose: 'explain_solution',
    audienceProfileId: 'a1',
    themePresetId: 'preset_light_minimal_01',
    slideBudget: 10,
    sectionBudget: {},
    sections: [],
    slides,
    sources: [],
    evidenceRefs: [],
    images: [],
    audienceProfiles: [],
    status: 'draft_created',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

describe('lintPresentation end-to-end', () => {
  it('clean deck has score 100 and no violations', () => {
    const deck = makeDeck([makeSlide('s1'), makeSlide('s2')]);
    const report = lintPresentation(deck);
    assert.equal(report.score, 100);
    assert.deepEqual(report.violations, []);
    assert.ok(typeof report.generatedAt === 'string');
  });

  it('sloppy deck has score < 100', () => {
    const deck = makeDeck([
      makeSlide('s1', {
        renderProps: { color: 'purple' },
        contentBlocks: [
          { type: 'supporting', content: 'We seamlessly leverage AI to revolutionize everything.' },
        ],
      }),
    ]);
    const report = lintPresentation(deck);
    assert.ok(report.score < 100);
    assert.ok(report.violations.length > 0);
  });

  it('report contains generatedAt timestamp', () => {
    const deck = makeDeck([makeSlide('s1')]);
    const report = lintPresentation(deck);
    assert.ok(!isNaN(Date.parse(report.generatedAt)));
  });

  it('slideScores length matches deck slide count', () => {
    const slides = Array.from({ length: 4 }, (_, i) => makeSlide(`s${i}`));
    const deck = makeDeck(slides);
    const report = lintPresentation(deck);
    assert.equal(report.slideScores.length, 4);
  });

  it('violations reference valid slideIds', () => {
    const slide = makeSlide('slide-abc', {
      renderProps: { color: '#8b5cf6' },
    });
    const deck = makeDeck([slide]);
    const report = lintPresentation(deck);
    for (const v of report.violations) {
      assert.equal(v.slideId, 'slide-abc');
    }
  });
});
