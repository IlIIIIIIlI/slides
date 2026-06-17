import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SlideSpec, PresentationSpec, ContentBlock } from '@/core/schemas/types';
import { nestedCardsRule } from './nested-cards';

function makeSlide(overrides: Partial<SlideSpec>): SlideSpec {
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
    contentBlocks: [],
    ...overrides,
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

function supportingBlocks(n: number): ContentBlock[] {
  return Array.from({ length: n }, (_, i) => ({
    type: 'supporting' as const,
    content: `Block ${i + 1}`,
  }));
}

describe('nested-cards rule', () => {
  it('no violation for a clean statement slide', () => {
    const slide = makeSlide({ intent: 'statement', contentBlocks: supportingBlocks(2) });
    assert.equal(nestedCardsRule.check({ slide, deck: makeDeck(slide) }).length, 0);
  });

  it('flags framework slide with too many structural blocks', () => {
    const slide = makeSlide({ intent: 'framework', contentBlocks: supportingBlocks(5) });
    const result = nestedCardsRule.check({ slide, deck: makeDeck(slide) });
    assert.equal(result.length, 1);
    assert.equal(result[0].severity, 'error');
  });

  it('no violation for framework slide within block threshold', () => {
    const slide = makeSlide({ intent: 'framework', contentBlocks: supportingBlocks(3) });
    assert.equal(nestedCardsRule.check({ slide, deck: makeDeck(slide) }).length, 0);
  });

  it('flags slide with card visualMode', () => {
    const slide = makeSlide({ visualMode: 'card-grid', contentBlocks: supportingBlocks(2) });
    const result = nestedCardsRule.check({ slide, deck: makeDeck(slide) });
    assert.equal(result.length, 1);
    assert.equal(result[0].severity, 'error');
  });

  it('flags comparison slide with too many structural blocks', () => {
    const slide = makeSlide({ intent: 'comparison', contentBlocks: supportingBlocks(5) });
    const result = nestedCardsRule.check({ slide, deck: makeDeck(slide) });
    assert.equal(result.length, 1);
  });
});
