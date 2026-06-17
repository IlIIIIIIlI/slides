import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SlideSpec, PresentationSpec } from '@/core/schemas/types';
import { marketingBuzzwordsRule } from './marketing-buzzwords';

function makeSlide(content: string): SlideSpec {
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
    contentBlocks: [{ type: 'supporting', content }],
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

describe('marketing-buzzwords rule', () => {
  it('no violation for clean copy', () => {
    const slide = makeSlide('This product increases throughput by 40%.');
    assert.equal(marketingBuzzwordsRule.check({ slide, deck: makeDeck(slide) }).length, 0);
  });

  it('no violation for a single buzzword', () => {
    const slide = makeSlide('We seamlessly integrate with your workflow.');
    assert.equal(marketingBuzzwordsRule.check({ slide, deck: makeDeck(slide) }).length, 0);
  });

  it('flags two distinct buzzwords', () => {
    const slide = makeSlide('We seamlessly leverage AI to revolutionize your workflow.');
    const result = marketingBuzzwordsRule.check({ slide, deck: makeDeck(slide) });
    assert.equal(result.length, 1);
    assert.equal(result[0].severity, 'warn');
  });

  it('matches inflected forms (seamlessly, revolutionary)', () => {
    const slide = makeSlide('A revolutionary platform that seamlessly empowers teams.');
    const result = marketingBuzzwordsRule.check({ slide, deck: makeDeck(slide) });
    assert.equal(result.length, 1);
  });

  it('matches synergistic and holistic', () => {
    const slide = makeSlide('A holistic, synergistic approach to disruption.');
    const result = marketingBuzzwordsRule.check({ slide, deck: makeDeck(slide) });
    assert.equal(result.length, 1);
  });

  it('is case-insensitive', () => {
    const slide = makeSlide('SEAMLESSLY LEVERAGE every opportunity.');
    const result = marketingBuzzwordsRule.check({ slide, deck: makeDeck(slide) });
    assert.equal(result.length, 1);
  });
});
