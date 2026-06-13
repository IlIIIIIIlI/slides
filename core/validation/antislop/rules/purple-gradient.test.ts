import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SlideSpec, PresentationSpec } from '@/core/schemas/types';
import { purpleGradientRule } from './purple-gradient';

function makeSlide(overrides: Partial<SlideSpec> = {}): SlideSpec {
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

function makeDeck(slide: SlideSpec, presetId = 'preset_light_minimal_01'): PresentationSpec {
  return {
    id: 'deck-1',
    title: 'Test',
    purpose: 'explain_solution',
    audienceProfileId: 'a1',
    themePresetId: presetId,
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

describe('purple-gradient rule', () => {
  it('returns no violations for a clean slide', () => {
    const slide = makeSlide();
    const deck = makeDeck(slide);
    const result = purpleGradientRule.check({ slide, deck });
    assert.equal(result.length, 0);
  });

  it('flags purple in renderProps.color as error', () => {
    const slide = makeSlide({ renderProps: { color: 'purple' } });
    const deck = makeDeck(slide);
    const result = purpleGradientRule.check({ slide, deck });
    assert.equal(result.length, 1);
    assert.equal(result[0].severity, 'error');
    assert.equal(result[0].ruleId, 'purple-gradient');
  });

  it('flags violet gradient in visualMode', () => {
    const slide = makeSlide({ visualMode: 'linear-gradient(violet, white)' });
    const deck = makeDeck(slide);
    const result = purpleGradientRule.check({ slide, deck });
    assert.equal(result.length, 1);
    assert.equal(result[0].severity, 'error');
  });

  it('flags #7c3aed hex color', () => {
    const slide = makeSlide({ renderProps: { color: '#7c3aed' } });
    const deck = makeDeck(slide);
    const result = purpleGradientRule.check({ slide, deck });
    assert.equal(result.length, 1);
  });

  it('returns no violations for non-purple colors', () => {
    const slide = makeSlide({ renderProps: { color: '#14b8a6' } });
    const deck = makeDeck(slide);
    const result = purpleGradientRule.check({ slide, deck });
    assert.equal(result.length, 0);
  });
});
