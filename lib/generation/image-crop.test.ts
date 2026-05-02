import test from "node:test";
import assert from "node:assert/strict";

import { findFocusedCropBounds } from "@/lib/generation/image-crop";

function makePixels(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  return data;
}

function drawRect(data: Uint8ClampedArray, width: number, x: number, y: number, rectWidth: number, rectHeight: number) {
  for (let yy = y; yy < y + rectHeight; yy++) {
    for (let xx = x; xx < x + rectWidth; xx++) {
      const offset = (yy * width + xx) * 4;
      data[offset] = 20;
      data[offset + 1] = 80;
      data[offset + 2] = 140;
      data[offset + 3] = 255;
    }
  }
}

test("finds a focused visual region instead of returning the whole page", () => {
  const width = 160;
  const height = 120;
  const data = makePixels(width, height);
  drawRect(data, width, 48, 32, 64, 40);

  const bounds = findFocusedCropBounds({ data, width, height }, {
    tileSize: 8,
    margin: 4,
    tileOccupancyThreshold: 0.05,
  });

  assert.ok(bounds);
  assert.ok(bounds.x <= 48);
  assert.ok(bounds.y <= 32);
  assert.ok(bounds.x + bounds.width >= 112);
  assert.ok(bounds.y + bounds.height >= 72);
  assert.ok(bounds.width < width);
  assert.ok(bounds.height < height);
});

test("prefers a dense screenshot-like area over sparse page marks", () => {
  const width = 200;
  const height = 160;
  const data = makePixels(width, height);
  for (let y = 10; y < 150; y += 20) {
    for (let x = 12; x < 180; x += 24) drawRect(data, width, x, y, 2, 2);
  }
  drawRect(data, width, 90, 70, 70, 50);

  const bounds = findFocusedCropBounds({ data, width, height }, {
    tileSize: 10,
    margin: 4,
    tileOccupancyThreshold: 0.05,
  });

  assert.ok(bounds);
  assert.ok(bounds.x >= 80);
  assert.ok(bounds.y >= 60);
  assert.ok(bounds.width <= 90);
  assert.ok(bounds.height <= 70);
});

test("returns null for blank pages", () => {
  const width = 80;
  const height = 80;
  const data = makePixels(width, height);

  assert.equal(findFocusedCropBounds({ data, width, height }), null);
});
