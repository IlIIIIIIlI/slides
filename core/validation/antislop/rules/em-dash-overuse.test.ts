import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SlideSpec, PresentationSpec, ContentBlock } from '@/core/schemas/types';
import { emDashOveruseRule } from './em-dash-overuse';

function makeSlide(blocks: ContentBlock[], id = 'slide-1'): SlideSpec {
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
    contentBlocks: blocks,
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

describe('em-dash-overuse rule', () => {
  it('no violations for a clean headline', () => {
    const slide = makeSlide([{ type: 'headline', content: 'A simple headline' }]);
    const deck = makeDeck([slide]);
    assert.equal(emDashOveruseRule.check({ slide, deck }).length, 0);
  });

  it('no violation for single em-dash in headline', () => {
    const slide = makeSlide([{ type: 'headline', content: 'One — em dash' }]);
    const deck = makeDeck([slide]);
    assert.equal(emDashOveruseRule.check({ slide, deck }).length, 0);
  });

  it('flags slide with more than one em-dash across text blocks', () => {
    const slide = makeSlide([
      { type: 'headline', content: 'First — thing' },
      { type: 'supporting', content: 'Second — extra — third' },
    ]);
    const deck = makeDeck([slide]);
    const result = emDashOveruseRule.check({ slide, deck });
    assert.equal(result.length, 1);
    assert.equal(result[0].severity, 'warn');
  });

  it('flags deck-level ratio above threshold (reported on first slide)', () => {
    const makeEmDashSlide = (id: string) =>
      makeSlide([{ type: 'headline', content: `Slide — dash ${id}` }], id);

    const slides = Array.from({ length: 5 }, (_, i) => makeEmDashSlide(`s${i}`));
    const deck = makeDeck(slides);
    // First slide has 1 em dash (at threshold, not over per-slide), but deck ratio should trigger.
    const result = emDashOveruseRule.check({ slide: slides[0], deck });
    // Deck ratio: 5 em-dashes / 5 blocks = 1.0 > 0.4 — should fire.
    assert.ok(result.some((v) => v.message.includes('ratio')));
  });
});
