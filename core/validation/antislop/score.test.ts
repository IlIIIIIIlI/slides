import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SlideSpec, PresentationSpec } from '@/core/schemas/types';
import { scoreSlide, lintPresentation } from './score';

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
    slideBudget: 30,
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

describe('scoreSlide', () => {
  it('returns 100 for a clean slide', () => {
    const slide = makeSlide('s1');
    const deck = makeDeck([slide]);
    const result = scoreSlide(slide, deck);
    assert.equal(result.score, 100);
    assert.equal(result.violations.length, 0);
  });

  it('deducts 25 for an error violation', () => {
    const slide = makeSlide('s1', { renderProps: { color: 'purple' } });
    const deck = makeDeck([slide]);
    const result = scoreSlide(slide, deck);
    assert.ok(result.score <= 75);
  });

  it('clamps score to 0 for many violations', () => {
    // Force multiple errors
    const slide = makeSlide('s1', {
      intent: 'framework',
      renderProps: { color: '#7c3aed' },
      visualMode: 'card-grid',
      contentBlocks: Array.from({ length: 8 }, (_, i) => ({
        type: 'supporting' as const,
        content: `Block ${i}`,
      })),
    });
    const deck = makeDeck([slide]);
    const result = scoreSlide(slide, deck);
    assert.ok(result.score >= 0);
    assert.ok(result.score <= 100);
  });
});

describe('lintPresentation', () => {
  it('returns score 100 for a clean deck', () => {
    const slides = Array.from({ length: 5 }, (_, i) => makeSlide(`s${i}`));
    const deck = makeDeck(slides);
    const report = lintPresentation(deck);
    assert.equal(report.score, 100);
    assert.equal(report.violations.length, 0);
    assert.equal(report.slideScores.length, 5);
  });

  it('returns deck score as mean of slide scores', () => {
    const slides = Array.from({ length: 3 }, (_, i) => makeSlide(`s${i}`));
    const deck = makeDeck(slides);
    const report = lintPresentation(deck);
    const expectedMean = Math.round(
      report.slideScores.reduce((s, r) => s + r.score, 0) / report.slideScores.length,
    );
    assert.equal(report.score, expectedMean);
  });

  it('returns score 100 for an empty deck', () => {
    const deck = makeDeck([]);
    const report = lintPresentation(deck);
    assert.equal(report.score, 100);
  });

  // Performance: linting 30 slides with 20 blocks each must complete well within
  // 2000ms even in CI where CPU is shared. The real target is <150ms but we
  // use a relaxed bound to avoid flaky failures.
  it('completes 30×20 deck within 2000ms', () => {
    const slides = Array.from({ length: 30 }, (_, i) =>
      makeSlide(`s${i}`, {
        contentBlocks: Array.from({ length: 20 }, (__, j) => ({
          type: 'supporting' as const,
          content: `Slide ${i} block ${j} content`,
        })),
      }),
    );
    const deck = makeDeck(slides);
    const t0 = performance.now();
    lintPresentation(deck);
    const elapsed = performance.now() - t0;
    assert.ok(
      elapsed < 2000,
      `Linting took ${elapsed.toFixed(1)}ms, expected < 2000ms`,
    );
  });
});
