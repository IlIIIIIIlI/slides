import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SlideSpec, PresentationSpec } from '@/core/schemas/types';
import { headlineTitleCaseOverkillRule } from './headline-titlecase-overkill';

function makeSlide(headlineContent: string): SlideSpec {
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
    contentBlocks: [{ type: 'headline', content: headlineContent }],
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

describe('headline-titlecase-overkill rule', () => {
  it('no violation for a short sentence-case headline', () => {
    const slide = makeSlide('Building better products');
    assert.equal(headlineTitleCaseOverkillRule.check({ slide, deck: makeDeck(slide) }).length, 0);
  });

  it('no violation for a short title-case headline (≤8 words)', () => {
    const slide = makeSlide('Building Better Products With Modern Tools');
    assert.equal(headlineTitleCaseOverkillRule.check({ slide, deck: makeDeck(slide) }).length, 0);
  });

  it('flags a long title-case headline (>8 words)', () => {
    const slide = makeSlide(
      'How Artificial Intelligence Is Transforming Modern Software Development Practices',
    );
    const result = headlineTitleCaseOverkillRule.check({ slide, deck: makeDeck(slide) });
    assert.equal(result.length, 1);
    assert.equal(result[0].severity, 'info');
  });

  it('no violation for a long sentence-case headline', () => {
    const slide = makeSlide(
      'How artificial intelligence is transforming modern software development practices',
    );
    assert.equal(headlineTitleCaseOverkillRule.check({ slide, deck: makeDeck(slide) }).length, 0);
  });
});
