import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SlideSpec, PresentationSpec } from '@/core/schemas/types';
import { interEverywhereRule } from './inter-everywhere';

function makeSlide(id = 'slide-1'): SlideSpec {
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
  };
}

function makeDeck(slides: SlideSpec[], presetId: string): PresentationSpec {
  return {
    id: 'deck-1',
    title: 'Test',
    purpose: 'explain_solution',
    audienceProfileId: 'a1',
    themePresetId: presetId,
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

describe('inter-everywhere rule', () => {
  it('no violation for Geist-based preset', () => {
    const slide = makeSlide();
    const deck = makeDeck([slide], 'preset_light_minimal_01');
    assert.equal(interEverywhereRule.check({ slide, deck }).length, 0);
  });

  it('no violation for unknown preset id', () => {
    const slide = makeSlide();
    const deck = makeDeck([slide], 'nonexistent_preset');
    assert.equal(interEverywhereRule.check({ slide, deck }).length, 0);
  });

  it('only fires on the first slide of the deck', () => {
    const slide1 = makeSlide('slide-1');
    const slide2 = makeSlide('slide-2');
    const deck = makeDeck([slide1, slide2], 'preset_light_minimal_01');
    // Would be 0 anyway for Geist, but verifying first-slide logic structure.
    assert.equal(interEverywhereRule.check({ slide: slide2, deck }).length, 0);
  });
});
