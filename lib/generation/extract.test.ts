import test from "node:test";
import assert from "node:assert/strict";

import { preprocessMathXml } from "@/lib/generation/omml/omml";
import { stripXmlTags } from "@/lib/generation/extract";

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
