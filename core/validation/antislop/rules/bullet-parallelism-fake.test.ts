import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SlideSpec, PresentationSpec } from '@/core/schemas/types';
import { bulletParallelismFakeRule } from './bullet-parallelism-fake';

function makeSlide(bullets: string): SlideSpec {
  return {
    id: 'slide-1',
    intent: 'statement',
    sectionId: 's1',
    audienceProfileId: 'a1',
    themePresetId: 'preset_light_minimal_01',
    evidenceRefs: [],
    assetRefs: [],
    citationPolicy: 'none',
    speakerNotesMode: 'none',
    status: 'draft',
    contentBlocks: [{ type: 'bullet-list', content: bullets }],
  };
}

function makeDeck(slide: SlideSpec): PresentationSpec {
  return {
    id: 'deck-1',
    title: 'Test',
    purpose: 'explain_solution',
    audienceProfileId: 'a1',
    themePresetId: 'preset_light_minimal_01',
    slideBudget: 10,
    sectionBudget: {},
    sections: [],
    slides: [slide],
    sources: [],
    evidenceRefs: [],
    images: [],
    audienceProfiles: [],
    status: 'draft_created',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

describe('bullet-parallelism-fake rule', () => {
  it('no violation for varied natural bullets', () => {
    const slide = makeSlide('Increased throughput by 40%\nReduced latency\nSimplified deployment');
    assert.equal(bulletParallelismFakeRule.check({ slide, deck: makeDeck(slide) }).length, 0);
  });

  it('flags bullets all starting with the same verb', () => {
    const slide = makeSlide('Improve performance\nImprove reliability\nImprove scalability');
    const result = bulletParallelismFakeRule.check({ slide, deck: makeDeck(slide) });
    assert.equal(result.length, 1);
    assert.equal(result[0].severity, 'info');
  });

  it('flags bullets all ending with em-dash explanation', () => {
    const slide = makeSlide(
      'Performance — fast and reliable\nSecurity — zero trust model\nScalability — infinite scale—',
    );
    const slide2 = makeSlide(
      'Performance—\nSecurity—\nScalability—',
    );
    const result = bulletParallelismFakeRule.check({ slide: slide2, deck: makeDeck(slide2) });
    assert.equal(result.length, 1);
  });

  it('no violation for fewer than 3 bullets', () => {
    const slide = makeSlide('Build this\nBuild that');
    assert.equal(bulletParallelismFakeRule.check({ slide, deck: makeDeck(slide) }).length, 0);
  });
});
