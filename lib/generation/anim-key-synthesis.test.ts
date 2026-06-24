import test from "node:test";
import assert from "node:assert/strict";

import {
  synthesizeAnimKeys,
  stripInternal,
  normalizeText,
  fnv1a32,
  quantizeBBox,
  iou,
  type ExtractedBlock,
  type ExtractedSlide,
} from "@/lib/generation/anim-key-synthesis";

// ---- pure helpers ----

test("normalizeText: lowercases, collapses whitespace, strips non-alphanumeric, truncates", () => {
  assert.equal(normalizeText("Hello, World!"), "hello world");
  assert.equal(normalizeText("  foo   bar  "), "foo bar");
  // Non-alphanumeric characters are stripped (not replaced with spaces)
  assert.equal(normalizeText("A-B_C"), "abc");
  const long = "a".repeat(200);
  assert.equal(normalizeText(long).length, 120);
});

test("fnv1a32: same string yields same hash, different strings differ", () => {
  assert.equal(fnv1a32("hello"), fnv1a32("hello"));
  assert.notEqual(fnv1a32("hello"), fnv1a32("world"));
  assert.equal(typeof fnv1a32(""), "number");
});

test("quantizeBBox: maps bbox to grid cells correctly", () => {
  // 12-col x 9-row grid, page 720x540
  // x=0, y=0, w=720, h=540 → [0, 0, 12, 9]
  assert.deepEqual(quantizeBBox([0, 0, 720, 540], 720, 540), [0, 0, 12, 9]);
  // x=360, y=270, w=180, h=135 → [6, 5, 3, 2] (half-page position)
  assert.deepEqual(quantizeBBox([360, 270, 180, 135], 720, 540), [6, 5, 3, 2]);
});

test("iou: identical boxes = 1, no overlap = 0, partial overlap is correct", () => {
  assert.equal(iou([0, 0, 4, 4], [0, 0, 4, 4]), 1);
  assert.equal(iou([0, 0, 2, 2], [4, 4, 2, 2]), 0);
  // [0,0,6,5] vs [1,1,6,5]: inter=5*4=20, union=30+30-20=40 → 0.5
  assert.ok(Math.abs(iou([0, 0, 6, 5], [1, 1, 6, 5]) - 0.5) < 1e-9);
});

// ---- shared test utilities ----

function makeSlide(
  pageNum: number,
  blocks: ExtractedBlock[],
  pageW = 720,
  pageH = 540,
): ExtractedSlide {
  return {
    id: `slide-${pageNum}`,
    intent: "statement",
    sectionId: "test",
    audienceProfileId: "test",
    themePresetId: "test",
    evidenceRefs: [],
    assetRefs: [],
    citationPolicy: "none",
    speakerNotesMode: "none",
    status: "draft",
    contentBlocks: blocks,
    _pageW: pageW,
    _pageH: pageH,
  };
}

function titleBlock(content: string, bbox: [number, number, number, number]): ExtractedBlock {
  return { type: "headline", content, _bbox: bbox, _role: "title" };
}

function bodyBlock(content: string, bbox: [number, number, number, number]): ExtractedBlock {
  return { type: "supporting", content, _bbox: bbox, _role: "body" };
}

function figureBlock(content: string, bbox: [number, number, number, number]): ExtractedBlock {
  return { type: "image-ref", content, _bbox: bbox, _role: "figure" };
}

// ---- synthesizeAnimKeys tests ----

test("title block at same bbox+text across three slides gets shared lp:title: key", () => {
  const titleBbox: [number, number, number, number] = [100, 50, 400, 40];
  const slides = [
    makeSlide(1, [titleBlock("Quarterly Review", titleBbox)]),
    makeSlide(2, [titleBlock("Quarterly Review", titleBbox)]),
    makeSlide(3, [titleBlock("Quarterly Review", titleBbox)]),
  ];

  synthesizeAnimKeys(slides);

  const k1 = slides[0].contentBlocks[0].animKey;
  const k2 = slides[1].contentBlocks[0].animKey;
  const k3 = slides[2].contentBlocks[0].animKey;

  assert.ok(k1, "slide 1 title should have animKey");
  assert.ok(k1!.startsWith("lp:title:"), `key should start with lp:title: (got ${k1})`);
  assert.equal(k1, k2, "slides 1 and 2 share the same key");
  assert.equal(k2, k3, "slides 2 and 3 share the same key");
});

test("figure bbox shifted by ~8% of page dims still matches (IoU ≥ 0.5)", () => {
  // Page 4: figure at [0, 0, 360, 270] → quantized [0,0,6,5]
  // Page 5: shifted by ~8% (57.6px, 43.2px) → [58, 43, 360, 270] → quantized [1,1,6,5]
  // IoU([0,0,6,5],[1,1,6,5]) = 20/40 = 0.5 — matches at threshold
  const fig4: [number, number, number, number] = [0, 0, 360, 270];
  const fig5: [number, number, number, number] = [58, 43, 360, 270];

  const slides = [
    makeSlide(4, [figureBlock("chart.png", fig4)]),
    makeSlide(5, [figureBlock("chart.png", fig5)]),
  ];

  synthesizeAnimKeys(slides);

  const k4 = slides[0].contentBlocks[0].animKey;
  const k5 = slides[1].contentBlocks[0].animKey;

  assert.ok(k4, "page 4 figure should have animKey");
  assert.equal(k4, k5, "page 5 figure with small shift should share the same key");
});

test("figure bbox shifted by ~40% of page dims does NOT match (IoU < 0.5)", () => {
  // Page 4: [0, 0, 360, 270] → quantized [0,0,6,5]
  // Page 5: shifted 40% → [288, 216, 360, 270] → quantized [5,4,6,5]
  // IoU([0,0,6,5],[5,4,6,5]) = 1/59 ≈ 0.017 — does not match
  const fig4: [number, number, number, number] = [0, 0, 360, 270];
  const fig5: [number, number, number, number] = [288, 216, 360, 270];

  const slides = [
    makeSlide(4, [figureBlock("chart.png", fig4)]),
    makeSlide(5, [figureBlock("chart.png", fig5)]),
  ];

  synthesizeAnimKeys(slides);

  const k4 = slides[0].contentBlocks[0].animKey;
  const k5 = slides[1].contentBlocks[0].animKey;

  // Neither gets a key because page 4 title only creates a key when matched forward
  assert.equal(k5, undefined, "page 5 figure with 40% shift should NOT get an animKey");
});

test("block with pre-existing animKey is left untouched and key is not reused", () => {
  const heroBlock: ExtractedBlock = {
    type: "headline",
    content: "Hero Title",
    animKey: "hero-title",
    _bbox: [100, 50, 400, 40],
    _role: "title",
  };
  // Same content+position on slide 2, but no pre-existing animKey.
  // Because heroBlock is excluded from the prev matching pool (it has an explicit key),
  // otherBlock finds no match and gets no synthesized key.
  const otherBlock: ExtractedBlock = {
    type: "headline",
    content: "Hero Title",
    _bbox: [100, 50, 400, 40],
    _role: "title",
  };

  const slides = [
    makeSlide(1, [heroBlock]),
    makeSlide(2, [otherBlock]),
  ];

  synthesizeAnimKeys(slides);

  assert.equal(slides[0].contentBlocks[0].animKey, "hero-title", "explicit key is preserved verbatim");
  // heroBlock is excluded from the matching pool, so otherBlock gets no propagated key.
  assert.equal(slides[1].contentBlocks[0].animKey, undefined, "no key propagated when prev block has explicit animKey");
});

test("DOCX-style input (no _bbox) leaves animKey undefined", () => {
  const nobbox: ExtractedBlock = { type: "supporting", content: "Some body text here." };
  const slides = [
    makeSlide(1, [nobbox]),
    makeSlide(2, [{ type: "supporting", content: "Some body text here." }]),
  ];

  synthesizeAnimKeys(slides);

  assert.equal(slides[0].contentBlocks[0].animKey, undefined);
  assert.equal(slides[1].contentBlocks[0].animKey, undefined);
});

test("synthesizeAnimKeys is deterministic: two runs on cloned input yield identical keys", () => {
  const titleBbox: [number, number, number, number] = [100, 50, 400, 40];
  const mkSlides = (): ExtractedSlide[] => [
    makeSlide(1, [titleBlock("My Title", titleBbox), bodyBlock("Some body content here.", [100, 150, 400, 12])]),
    makeSlide(2, [titleBlock("My Title", titleBbox), bodyBlock("Different body content.", [100, 150, 400, 12])]),
  ];

  const runA = mkSlides();
  const runB = mkSlides();

  synthesizeAnimKeys(runA);
  synthesizeAnimKeys(runB);

  const keysA = runA.flatMap((s) => s.contentBlocks.map((b) => b.animKey));
  const keysB = runB.flatMap((s) => s.contentBlocks.map((b) => b.animKey));

  assert.deepEqual(keysA, keysB, "animKey assignments must be deterministic");
});

// ---- stripInternal tests ----

test("stripInternal removes _bbox, _role, _pageW, _pageH from all blocks and slides", () => {
  const slides: ExtractedSlide[] = [
    {
      ...makeSlide(1, [
        titleBlock("Hello", [0, 0, 100, 20]),
        bodyBlock("World", [0, 30, 100, 12]),
      ]),
    },
  ];

  const stripped = stripInternal(slides);
  const serialized = JSON.stringify(stripped);

  assert.ok(!serialized.includes('"_bbox"'), "_bbox should be stripped");
  assert.ok(!serialized.includes('"_role"'), "_role should be stripped");
  assert.ok(!serialized.includes('"_pageW"'), "_pageW should be stripped");
  assert.ok(!serialized.includes('"_pageH"'), "_pageH should be stripped");
  assert.equal(stripped[0].contentBlocks.length, 2, "blocks are preserved");
  assert.equal(stripped[0].contentBlocks[0].content, "Hello", "content is preserved");
});
