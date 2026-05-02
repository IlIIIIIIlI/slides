import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import os from "os";
import path from "path";

import type { ExtractedImage } from "@/lib/generation/extract";
import {
  buildVisionImageBlocks,
  mediaTypeForImagePath,
  orderImagesForSection,
  publicImagePathToDiskPath,
} from "@/lib/generation/vision";

test("maps only Anthropic-supported image extensions to media types", () => {
  assert.equal(mediaTypeForImagePath("/extracted/deck/focus.PNG"), "image/png");
  assert.equal(mediaTypeForImagePath("/extracted/deck/figure.jpeg"), "image/jpeg");
  assert.equal(mediaTypeForImagePath("/extracted/deck/figure.webp"), "image/webp");
  assert.equal(mediaTypeForImagePath("/extracted/deck/anim.gif"), "image/gif");
  assert.equal(mediaTypeForImagePath("/extracted/deck/vector.svg"), null);
});

test("resolves public image paths without allowing traversal outside public", () => {
  const publicRoot = path.join(os.tmpdir(), "slides-public");

  assert.equal(
    publicImagePathToDiskPath("/extracted/deck/focus.png", publicRoot),
    path.join(publicRoot, "extracted", "deck", "focus.png"),
  );
  assert.equal(publicImagePathToDiskPath("../secret.png", publicRoot), null);
  assert.equal(publicImagePathToDiskPath("/../secret.png", publicRoot), null);
});

test("orders candidate images first for section-specific vision context", () => {
  const images = [
    { id: "IMG-001", filepath: "/extracted/deck/one.png" },
    { id: "IMG-002", filepath: "/extracted/deck/two.png" },
    { id: "IMG-003", filepath: "/extracted/deck/three.png" },
  ] satisfies ExtractedImage[];

  assert.deepEqual(
    orderImagesForSection(images, ["IMG-003", "IMG-missing", "IMG-001"], 3).map((image) => image.id),
    ["IMG-003", "IMG-001", "IMG-002"],
  );
});

test("builds text plus base64 image blocks from saved focused crops", async () => {
  const publicRoot = await fs.mkdtemp(path.join(os.tmpdir(), "slides-vision-"));
  const imageDir = path.join(publicRoot, "extracted", "deck");
  await fs.mkdir(imageDir, { recursive: true });
  await fs.writeFile(path.join(imageDir, "focus.png"), Buffer.from("focused image"));
  await fs.writeFile(path.join(imageDir, "vector.svg"), Buffer.from("<svg />"));

  const blocks = await buildVisionImageBlocks(
    [
      { id: "IMG-p4", page: 4, filepath: "/extracted/deck/focus.png", captionHint: "Focused area from page 4" },
      { id: "IMG-svg", filepath: "/extracted/deck/vector.svg" },
      { id: "IMG-missing", filepath: "/extracted/deck/missing.png" },
    ],
    { publicRoot, maxBytes: 128 },
  );

  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, "text");
  assert.match(blocks[0].type === "text" ? blocks[0].text : "", /IMG-p4/);
  assert.equal(blocks[1].type, "image");
  if (blocks[1].type === "image") {
    assert.equal(blocks[1].source.type, "base64");
    if (blocks[1].source.type === "base64") {
      assert.equal(blocks[1].source.media_type, "image/png");
      assert.equal(blocks[1].source.data, Buffer.from("focused image").toString("base64"));
    }
  }
});
