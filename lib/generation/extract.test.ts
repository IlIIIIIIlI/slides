import test from "node:test";
import assert from "node:assert/strict";

import { extractText, stripFences, stripXmlTags } from "@/lib/generation/extract";
import { preprocessMathXml } from "@/lib/generation/omml/omml";

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

// ---- OMML math preprocessing ----

const OMML_NS = 'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"';
const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

// Minimal DOCX paragraph containing an inline m:oMath for x^2 + 1
const INLINE_MATH_XML = `<w:p ${W_NS} ${OMML_NS}>
  <w:r><w:t>Energy: </w:t></w:r>
  <m:oMath>
    <m:sSup>
      <m:e><m:r><m:t>x</m:t></m:r></m:e>
      <m:sup><m:r><m:t>2</m:t></m:r></m:sup>
    </m:sSup>
    <m:r><m:t>+1</m:t></m:r>
  </m:oMath>
</w:p>`;

// Display math paragraph
const DISPLAY_MATH_XML = `<w:p ${W_NS} ${OMML_NS}>
  <m:oMathPara>
    <m:oMath>
      <m:f>
        <m:num><m:r><m:t>a</m:t></m:r></m:num>
        <m:den><m:r><m:t>b</m:t></m:r></m:den>
      </m:f>
    </m:oMath>
  </m:oMathPara>
</w:p>`;

// Math-free paragraph
const NO_MATH_XML = `<w:p ${W_NS}><w:r><w:t>Hello world</w:t></w:r></w:p>`;

test("inline DOCX equation yields $...$", () => {
  const result = preprocessMathXml(INLINE_MATH_XML);
  // Should contain an inline math delimiter
  assert.ok(result.includes("$"), `expected $ delimiter in: ${result}`);
  // Should NOT contain the original m:oMath tags
  assert.ok(!result.includes("<m:oMath>"), `m:oMath tag should be replaced: ${result}`);
  // The surrounding XML structure is preserved
  assert.ok(result.includes("<w:r>"), "surrounding XML preserved");
});

test("m:oMathPara yields $$...$$", () => {
  const result = preprocessMathXml(DISPLAY_MATH_XML);
  assert.ok(result.includes("$$"), `expected $$ delimiter in: ${result}`);
  assert.ok(!result.includes("<m:oMathPara>"), `oMathPara tag should be replaced: ${result}`);
  // Should contain the LaTeX for the fraction
  assert.ok(result.includes("\\frac"), `expected \\frac in: ${result}`);
});

test("math-free XML is unchanged by preprocessMathXml", () => {
  assert.equal(preprocessMathXml(NO_MATH_XML), NO_MATH_XML);
});

test("stripXmlTags extracts plain text with paragraph breaks", () => {
  const xml = `<doc><w:p><w:t>Hello</w:t></w:p><w:p><w:t>World</w:t></w:p></doc>`;
  const result = stripXmlTags(xml, ["w:p"]);
  assert.ok(result.includes("Hello"), `missing Hello: ${result}`);
  assert.ok(result.includes("World"), `missing World: ${result}`);
  // Paragraph break inserted before </w:p>
  assert.ok(result.includes("\n"), `expected newline: ${result}`);
});

test("math LaTeX survives stripXmlTags", () => {
  const xml = `<doc><w:p>$\\frac{a}{b}$</w:p></doc>`;
  const result = stripXmlTags(xml, ["w:p"]);
  assert.ok(result.includes("$\\frac{a}{b}$"), `LaTeX lost: ${result}`);
});

test("preprocessMathXml + stripXmlTags: inline equation at correct position", () => {
  const processed = preprocessMathXml(INLINE_MATH_XML);
  const text = stripXmlTags(processed, ["w:p"]);
  assert.ok(text.includes("Energy:"), `text before equation missing: ${text}`);
  assert.ok(text.includes("$"), `inline math delimiter missing: ${text}`);
});
