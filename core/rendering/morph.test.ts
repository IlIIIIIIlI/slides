import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAnimKey, flipIdFor, sharedAnimKeys } from '@/core/rendering/morph';
import type { ContentBlock, SlideSpec } from '@/core/schemas/types';

function block(type: ContentBlock['type'], extra?: Partial<ContentBlock>): ContentBlock {
  return { type, content: 'test', ...extra };
}

function slide(blocks: ContentBlock[]): SlideSpec {
  return {
    id: 'test',
    intent: 'statement',
    sectionId: 'sec',
    audienceProfileId: 'aud',
    themePresetId: 'theme',
    evidenceRefs: [],
    assetRefs: [],
    citationPolicy: 'none',
    speakerNotesMode: 'none',
    status: 'draft',
    contentBlocks: blocks,
  };
}

describe('flipIdFor', () => {
  test('prefixes with flip-', () => {
    assert.equal(flipIdFor('title'), 'flip-title');
    assert.equal(flipIdFor('code:0'), 'flip-code:0');
  });
});

describe('resolveAnimKey', () => {
  test('explicit animKey wins', () => {
    assert.equal(resolveAnimKey(block('headline', { animKey: 'custom-key' })), 'custom-key');
  });

  test('headline block → title', () => {
    assert.equal(resolveAnimKey(block('headline')), 'title');
  });

  test('code-block uses occurrence index', () => {
    assert.equal(resolveAnimKey(block('code-block'), 0), 'code:0');
    assert.equal(resolveAnimKey(block('code-block'), 2), 'code:2');
  });

  test('other block types return undefined', () => {
    assert.equal(resolveAnimKey(block('supporting')), undefined);
    assert.equal(resolveAnimKey(block('bullet-list')), undefined);
  });
});

describe('sharedAnimKeys', () => {
  test('returns intersection of resolved keys', () => {
    const prev = slide([block('headline'), block('supporting')]);
    const next = slide([block('headline'), block('bullet-list')]);
    assert.deepEqual(sharedAnimKeys(prev, next), ['title']);
  });

  test('empty intersection when no shared keys', () => {
    const prev = slide([block('supporting')]);
    const next = slide([block('bullet-list')]);
    assert.deepEqual(sharedAnimKeys(prev, next), []);
  });

  test('code blocks keyed by occurrence index', () => {
    const prev = slide([block('code-block'), block('code-block')]);
    const next = slide([block('code-block'), block('code-block')]);
    assert.deepEqual(sharedAnimKeys(prev, next), ['code:0', 'code:1']);
  });

  test('explicit animKey match', () => {
    const prev = slide([block('supporting', { animKey: 'my-chart' })]);
    const next = slide([block('supporting', { animKey: 'my-chart' })]);
    assert.deepEqual(sharedAnimKeys(prev, next), ['my-chart']);
  });

  test('derived title key is shared', () => {
    const prev = slide([block('headline')]);
    const next = slide([block('headline')]);
    assert.deepEqual(sharedAnimKeys(prev, next), ['title']);
  });
});
