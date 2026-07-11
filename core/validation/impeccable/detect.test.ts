import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { detectSlideHtml } from './detect';
import { mapFindings, resolveBlockPath } from './map-findings';
import { detectSlideSpec, buildSnapshotDocumentHtml } from './render-snapshot';
import { DEFAULT_PRESET_ID } from '@/core/theming/presets';
import type { SlideSpec } from '@/core/schemas/types';

function makeSlide(overrides?: Partial<SlideSpec>): SlideSpec {
  return {
    id: 's1',
    intent: 'statement',
    sectionId: 'sec',
    audienceProfileId: 'aud',
    themePresetId: DEFAULT_PRESET_ID,
    evidenceRefs: [],
    assetRefs: [],
    citationPolicy: 'none',
    speakerNotesMode: 'none',
    status: 'draft',
    contentBlocks: [
      { type: 'headline', content: 'Clean Headline' },
      { type: 'supporting', content: 'Supporting copy that is easy to read.' },
      { type: 'bullet-list', content: 'First point\nSecond point' },
    ],
    ...overrides,
  };
}

describe('detectSlideHtml rules', () => {
  test('reports gradient-text', () => {
    const html = `
      <article class="slide-root" style="background:#fafafa;color:#09090b">
        <h2 data-block-index="0" data-block-type="headline"
          style="background: linear-gradient(90deg,#f59e0b,#3b82f6); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;">
          Fancy Gradient Title
        </h2>
      </article>`;
    const report = detectSlideHtml(html, { slideIndex: 2 });
    const hit = report.findings.find((f) => f.ruleId === 'gradient-text');
    assert.ok(hit, 'expected gradient-text finding');
    assert.equal(hit!.severity, 'warn');
    assert.equal(hit!.path, 'slides[2].contentBlocks[0]');
    assert.equal(hit!.blockIndex, 0);
  });

  test('reports multi-axis-grid-background on slide root', () => {
    const html = `
      <article class="slide-root" style="background-image: linear-gradient(0deg,#eee,#fff), linear-gradient(90deg,#ddd,#fff); background:#fff; color:#111">
        <p data-block-index="0" data-block-type="supporting">Body</p>
      </article>`;
    const report = detectSlideHtml(html, { slideIndex: 0 });
    const hit = report.findings.find((f) => f.ruleId === 'multi-axis-grid-background');
    assert.ok(hit, 'expected multi-axis-grid-background finding');
    assert.ok(hit!.severity === 'warn' || hit!.severity === 'error');
    // Slide-level style → path without blockIndex when target is root
    assert.equal(hit!.path, 'slides[0]');
    assert.equal(hit!.blockIndex, undefined);
  });

  test('reports low-contrast-text', () => {
    const html = `
      <article class="slide-root" style="background:#ffffff; --slide-bg:#ffffff; color:#09090b; --slide-text-primary:#09090b">
        <p data-block-index="1" data-block-type="supporting" style="color:#eeeeee; background:#ffffff">
          Nearly invisible text against white
        </p>
      </article>`;
    const report = detectSlideHtml(html, { slideIndex: 1 });
    const hit = report.findings.find((f) => f.ruleId === 'low-contrast-text');
    assert.ok(hit, 'expected low-contrast-text finding');
    assert.equal(hit!.severity, 'error');
    assert.equal(hit!.blockIndex, 1);
    assert.equal(hit!.path, 'slides[1].contentBlocks[1]');
    assert.ok(hit!.evidence?.snippet || hit!.evidence?.selector);
  });

  test('clean default-theme slide has zero error findings', () => {
    const report = detectSlideSpec(makeSlide(), DEFAULT_PRESET_ID, 0);
    const errors = report.findings.filter((f) => f.severity === 'error');
    assert.equal(errors.length, 0, JSON.stringify(errors, null, 2));
    assert.ok(report.rulesRun.includes('gradient-text'));
    assert.ok(report.rulesRun.includes('low-contrast-text'));
  });
});

describe('map-findings', () => {
  test('nested span maps to parent contentBlocks path', () => {
    const dom = new JSDOM(`
      <article class="slide-root">
        <div data-block-index="1" data-block-type="supporting" data-anim-key="chart-main">
          <span class="inner">nested violation</span>
        </div>
      </article>`);
    const span = dom.window.document.querySelector('span.inner');
    const mapped = resolveBlockPath(span, 3);
    assert.equal(mapped.path, 'slides[3].contentBlocks[1]');
    assert.equal(mapped.blockIndex, 1);
    assert.equal(mapped.animKey, 'chart-main');
    assert.equal(mapped.scope, 'block');
  });

  test('slide-level node has slides[n] path without blockIndex', () => {
    const dom = new JSDOM(`
      <article class="slide-root" style="background:red">
        <p data-block-index="0" data-block-type="headline">Hi</p>
      </article>`);
    const root = dom.window.document.querySelector('.slide-root');
    const mapped = resolveBlockPath(root, 5);
    assert.equal(mapped.path, 'slides[5]');
    assert.equal(mapped.blockIndex, undefined);
    assert.equal(mapped.scope, 'slide');
  });

  test('mapFindings attaches paths to raw findings', () => {
    const dom = new JSDOM(`
      <div data-block-index="2" data-block-type="code-block"><code>x</code></div>`);
    const code = dom.window.document.querySelector('code');
    const findings = mapFindings(
      [{ ruleId: 'gradient-text', severity: 'warn', message: 'x', target: code }],
      0,
    );
    assert.equal(findings[0].path, 'slides[0].contentBlocks[2]');
    assert.equal(findings[0].blockIndex, 2);
  });
});

describe('detectSlideSpec snapshot', () => {
  test('builds jsdom-ready HTML without a browser', () => {
    const html = buildSnapshotDocumentHtml(makeSlide());
    assert.match(html, /data-block-index="0"/);
    assert.match(html, /data-block-type="headline"/);
    assert.match(html, /--slide-text-primary/);
  });

  test('does not mutate animKey on the input slide', () => {
    const slide = makeSlide({
      contentBlocks: [{ type: 'headline', content: 'Keep Me', animKey: 'keep-key' }],
    });
    detectSlideSpec(slide, DEFAULT_PRESET_ID, 0);
    assert.equal(slide.contentBlocks[0].animKey, 'keep-key');
  });
});
