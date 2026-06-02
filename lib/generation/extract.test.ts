import test from "node:test";
import assert from "node:assert/strict";

import { extractText, stripFences } from "@/lib/generation/extract";

// ---- stripFences ----

test("stripFences removes markdown code fences", () => {
  assert.equal(stripFences("```json\n{}\n```"), "{}");
  assert.equal(stripFences("```\nhello\n```"), "hello");
  assert.equal(stripFences("no fences"), "no fences");
});

// ---- plain-text extraction (no PDF involved) ----

function makeTxtFile(content: string, name = "doc.txt"): File {
  return new File([content], name, { type: "text/plain" });
}

test("extractText plain text: splits into paragraph chunks", async () => {
  const body = [
    "First paragraph with some text to ensure minimum length is met here.",
    "",
    "Second paragraph that is also long enough to not be filtered out.",
    "",
    "Third paragraph: even more content to keep things interesting overall.",
  ].join("\n");

  const result = await extractText(makeTxtFile(body), null, "test-01");

  assert.equal(result.sourceType, "txt");
  assert.ok(result.chunks.length >= 3, "at least 3 chunks");
  assert.ok(result.chunks.every((c) => c.text.length >= 20), "no trivial chunks");
  assert.ok(result.chunks.every((c) => c.id.startsWith("CHK-")), "chunk ids");
  assert.equal(result.images.length, 0);
});

test("extractText plain text: fullText matches original content", async () => {
  const content = "Alpha paragraph spanning some words.\n\nBeta paragraph with additional words.";
  const result = await extractText(makeTxtFile(content), null, "test-02");
  assert.ok(result.fullText.includes("Alpha paragraph"));
  assert.ok(result.fullText.includes("Beta paragraph"));
});

// ---- code extraction ----

test("extractText code: detects TS extension and uses code chunking", async () => {
  const code = [
    "function greet(name: string) {",
    "  console.log(`Hello, ${name}!`);",
    "}",
    "",
    "function add(a: number, b: number): number {",
    "  return a + b;",
    "}",
  ].join("\n");

  const result = await extractText(makeTxtFile(code, "utils.ts"), null, "test-03");

  assert.equal(result.sourceType, "code");
  assert.ok(result.chunks.length >= 1, "at least one code chunk");
  assert.equal(result.images.length, 0);
});

// ---- image file extraction ----

test("extractText image: stores upload and returns single image entry", async () => {
  // Minimal 1×1 white PNG (26 bytes)
  const pngBytes = Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108020000009001" +
    "2e00000000c4944415478016360f8cfc000000002000168e0fb490000000049454e44ae426082",
    "hex",
  );
  const file = new File([pngBytes], "photo.png", { type: "image/png" });
  const result = await extractText(file, null, "test-04");

  assert.equal(result.sourceType, "image");
  assert.equal(result.chunks.length, 0);
  assert.equal(result.images.length, 1);
  assert.ok(result.images[0].filepath.includes("test-04"), "filepath contains presentationId");
});
