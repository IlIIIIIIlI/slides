import test from "node:test";
import assert from "node:assert/strict";

import { ommlToLatex } from "@/lib/generation/omml/omml";

const NS = 'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"';

function wrap(inner: string) {
  return `<m:oMath ${NS}>${inner}</m:oMath>`;
}

const FRACTION = wrap(`
  <m:f>
    <m:num><m:r><m:t>a</m:t></m:r></m:num>
    <m:den><m:r><m:t>b</m:t></m:r></m:den>
  </m:f>`);

const RADICAL_WITH_DEGREE = wrap(`
  <m:rad>
    <m:deg><m:r><m:t>3</m:t></m:r></m:deg>
    <m:e><m:r><m:t>x</m:t></m:r></m:e>
  </m:rad>`);

const RADICAL_NO_DEGREE = wrap(`
  <m:rad>
    <m:radPr><m:degHide m:val="1"/></m:radPr>
    <m:deg/>
    <m:e><m:r><m:t>x</m:t></m:r></m:e>
  </m:rad>`);

const SUMMATION = wrap(`
  <m:nary>
    <m:naryPr><m:chr m:val="∑"/></m:naryPr>
    <m:sub><m:r><m:t>i=1</m:t></m:r></m:sub>
    <m:sup><m:r><m:t>n</m:t></m:r></m:sup>
    <m:e>
      <m:sSub>
        <m:e><m:r><m:t>a</m:t></m:r></m:e>
        <m:sub><m:r><m:t>i</m:t></m:r></m:sub>
      </m:sSub>
    </m:e>
  </m:nary>`);

const MATRIX = wrap(`
  <m:m>
    <m:mr>
      <m:e><m:r><m:t>a</m:t></m:r></m:e>
      <m:e><m:r><m:t>b</m:t></m:r></m:e>
    </m:mr>
    <m:mr>
      <m:e><m:r><m:t>c</m:t></m:r></m:e>
      <m:e><m:r><m:t>d</m:t></m:r></m:e>
    </m:mr>
  </m:m>`);

const ACCENT = wrap(`
  <m:acc>
    <m:accPr><m:chr m:val="̂"/></m:accPr>
    <m:e><m:r><m:t>v</m:t></m:r></m:e>
  </m:acc>`);

const DELIMITER = wrap(`
  <m:d>
    <m:dPr>
      <m:begChr m:val="("/>
      <m:endChr m:val=")"/>
    </m:dPr>
    <m:e><m:r><m:t>x+y</m:t></m:r></m:e>
  </m:d>`);

const UNKNOWN_ELEMENT = wrap(`<m:mystery>text content</m:mystery>`);

test("convert fraction → \\frac{a}{b}", () => {
  assert.equal(ommlToLatex(FRACTION), "\\frac{a}{b}");
});

test("convert radical with degree → \\sqrt[3]{x}", () => {
  assert.equal(ommlToLatex(RADICAL_WITH_DEGREE), "\\sqrt[3]{x}");
});

test("convert radical with hidden degree → \\sqrt{x}", () => {
  assert.equal(ommlToLatex(RADICAL_NO_DEGREE), "\\sqrt{x}");
});

test("convert n-ary summation with limits", () => {
  const result = ommlToLatex(SUMMATION);
  assert.ok(result.includes("\\sum"), `expected \\sum in: ${result}`);
  assert.ok(result.includes("_{i=1}"), `expected _{i=1} in: ${result}`);
  assert.ok(result.includes("^{n}"), `expected ^{n} in: ${result}`);
  // base expression a_i
  assert.ok(result.includes("{a}"), `expected {a} in: ${result}`);
});

test("convert matrix → \\begin{matrix}...\\end{matrix}", () => {
  const result = ommlToLatex(MATRIX);
  assert.ok(result.includes("\\begin{matrix}"), `missing \\begin{matrix}: ${result}`);
  assert.ok(result.includes("\\end{matrix}"), `missing \\end{matrix}: ${result}`);
  assert.ok(result.includes("a & b"), `missing row 1: ${result}`);
  assert.ok(result.includes("c & d"), `missing row 2: ${result}`);
});

test("convert accent → \\hat{v}", () => {
  const result = ommlToLatex(ACCENT);
  assert.ok(result.includes("\\hat{v}"), `expected \\hat{v}: ${result}`);
});

test("convert delimiter → \\left(x+y\\right)", () => {
  const result = ommlToLatex(DELIMITER);
  assert.ok(result.includes("\\left("), `expected \\left(: ${result}`);
  assert.ok(result.includes("\\right)"), `expected \\right): ${result}`);
  assert.ok(result.includes("x+y"), `expected x+y: ${result}`);
});

test("degrade unknown element without throwing", () => {
  let result: string | undefined;
  assert.doesNotThrow(() => {
    result = ommlToLatex(UNKNOWN_ELEMENT);
  });
  assert.ok(result !== undefined);
  assert.ok((result as string).includes("text content"), `expected text content: ${result}`);
});

test("oMathPara wrapper is handled", () => {
  const para = `<m:oMathPara ${NS}><m:oMath><m:f>
    <m:num><m:r><m:t>1</m:t></m:r></m:num>
    <m:den><m:r><m:t>2</m:t></m:r></m:den>
  </m:f></m:oMath></m:oMathPara>`;
  const result = ommlToLatex(para);
  assert.equal(result, "\\frac{1}{2}");
});
