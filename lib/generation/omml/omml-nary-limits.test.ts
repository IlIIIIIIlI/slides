import test from "node:test";
import assert from "node:assert/strict";
import katex from "katex";

import { ommlToLatex } from "@/lib/generation/omml/omml";

const NS = 'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"';

function wrap(inner: string) {
  return `<m:oMath ${NS}>${inner}</m:oMath>`;
}

function assertKatexValid(latex: string) {
  assert.doesNotThrow(
    () => katex.renderToString(latex, { throwOnError: true }),
    `KaTeX rejected: ${latex}`,
  );
}

// ── n-ary ─────────────────────────────────────────────────────────────────────

const SUMMATION_LIMITS = wrap(`
  <m:nary>
    <m:naryPr><m:chr m:val="∑"/></m:naryPr>
    <m:sub><m:r><m:t>i=1</m:t></m:r></m:sub>
    <m:sup><m:r><m:t>n</m:t></m:r></m:sup>
    <m:e><m:r><m:t>i</m:t></m:r></m:e>
  </m:nary>`);

const INTEGRAL_DEFAULT = wrap(`
  <m:nary>
    <m:e><m:r><m:t>f(x)dx</m:t></m:r></m:e>
  </m:nary>`);

const PRODUCT_UNDOVR = wrap(`
  <m:nary>
    <m:naryPr>
      <m:chr m:val="∏"/>
      <m:limLoc m:val="undOvr"/>
    </m:naryPr>
    <m:sub><m:r><m:t>k=1</m:t></m:r></m:sub>
    <m:sup><m:r><m:t>m</m:t></m:r></m:sup>
    <m:e><m:r><m:t>k</m:t></m:r></m:e>
  </m:nary>`);

const UNKNOWN_GLYPH = wrap(`
  <m:nary>
    <m:naryPr><m:chr m:val="⊞"/></m:naryPr>
    <m:sub><m:r><m:t>i</m:t></m:r></m:sub>
    <m:e><m:r><m:t>x</m:t></m:r></m:e>
  </m:nary>`);

test("nary: summation with sub and sup", () => {
  const result = ommlToLatex(SUMMATION_LIMITS);
  assert.ok(result.includes("\\sum"), `expected \\sum: ${result}`);
  assert.ok(result.includes("_{i=1}"), `expected _{i=1}: ${result}`);
  assert.ok(result.includes("^{n}"), `expected ^{n}: ${result}`);
  assertKatexValid(result);
});

test("nary: default operator is integral when chr absent", () => {
  const result = ommlToLatex(INTEGRAL_DEFAULT);
  assert.ok(result.includes("\\int"), `expected \\int as default: ${result}`);
  assertKatexValid(result);
});

test("nary: product with undOvr emits \\limits", () => {
  const result = ommlToLatex(PRODUCT_UNDOVR);
  assert.ok(result.includes("\\prod"), `expected \\prod: ${result}`);
  assert.ok(result.includes("\\limits"), `expected \\limits for undOvr: ${result}`);
  assertKatexValid(result);
});

test("nary: unknown glyph falls back to raw glyph without throwing", () => {
  let result: string | undefined;
  assert.doesNotThrow(() => { result = ommlToLatex(UNKNOWN_GLYPH); });
  assert.ok(result !== undefined);
  assert.ok((result as string).includes("⊞"), `expected raw glyph ⊞: ${result}`);
});

// ── limLow ────────────────────────────────────────────────────────────────────

const LIMLIM = wrap(`
  <m:limLow>
    <m:e><m:r><m:t>lim</m:t></m:r></m:e>
    <m:lim><m:r><m:t>x→0</m:t></m:r></m:lim>
  </m:limLow>`);

const LIMMAX = wrap(`
  <m:limLow>
    <m:e><m:r><m:t>max</m:t></m:r></m:e>
    <m:lim><m:r><m:t>k</m:t></m:r></m:lim>
  </m:limLow>`);

const LIMINF = wrap(`
  <m:limLow>
    <m:e><m:r><m:t>inf</m:t></m:r></m:e>
    <m:lim><m:r><m:t>n≥1</m:t></m:r></m:lim>
  </m:limLow>`);

const LIMLOW_NONOPR = wrap(`
  <m:limLow>
    <m:e><m:r><m:t>f</m:t></m:r></m:e>
    <m:lim><m:r><m:t>x</m:t></m:r></m:lim>
  </m:limLow>`);

test("limLow: lim operator gets subscript limit", () => {
  const result = ommlToLatex(LIMLIM);
  assert.ok(result.includes("\\lim_{"), `expected \\lim_{}: ${result}`);
  assertKatexValid(result);
});

test("limLow: max operator gets subscript limit", () => {
  const result = ommlToLatex(LIMMAX);
  assert.ok(result.includes("\\max_{"), `expected \\max_{}: ${result}`);
  assertKatexValid(result);
});

test("limLow: inf operator gets subscript limit", () => {
  const result = ommlToLatex(LIMINF);
  assert.ok(result.includes("\\inf_{"), `expected \\inf_{}: ${result}`);
  assertKatexValid(result);
});

test("limLow: non-operator base uses \\underset", () => {
  const result = ommlToLatex(LIMLOW_NONOPR);
  assert.ok(result.includes("\\underset{"), `expected \\underset: ${result}`);
  assertKatexValid(result);
});

// ── limUpp ────────────────────────────────────────────────────────────────────

const LIMUPP_NONOPR = wrap(`
  <m:limUpp>
    <m:e><m:r><m:t>f</m:t></m:r></m:e>
    <m:lim><m:r><m:t>⌢</m:t></m:r></m:lim>
  </m:limUpp>`);

const LIMUPP_OPR = wrap(`
  <m:limUpp>
    <m:e><m:r><m:t>sup</m:t></m:r></m:e>
    <m:lim><m:r><m:t>n</m:t></m:r></m:lim>
  </m:limUpp>`);

test("limUpp: non-operator base uses \\overset", () => {
  const result = ommlToLatex(LIMUPP_NONOPR);
  assert.ok(result.includes("\\overset{"), `expected \\overset: ${result}`);
  assertKatexValid(result);
});

test("limUpp: operator base gets superscript limit", () => {
  const result = ommlToLatex(LIMUPP_OPR);
  assert.ok(result.includes("\\sup^{"), `expected \\sup^{}: ${result}`);
  assertKatexValid(result);
});

// ── groupChr ──────────────────────────────────────────────────────────────────

const OVERBRACE = wrap(`
  <m:groupChr>
    <m:groupChrPr>
      <m:chr m:val="⏞"/>
      <m:pos m:val="top"/>
    </m:groupChrPr>
    <m:e><m:r><m:t>a+b+c</m:t></m:r></m:e>
  </m:groupChr>`);

const UNDERBRACE = wrap(`
  <m:groupChr>
    <m:groupChrPr>
      <m:chr m:val="⏟"/>
      <m:pos m:val="bot"/>
    </m:groupChrPr>
    <m:e><m:r><m:t>x_1 \dots x_n</m:t></m:r></m:e>
  </m:groupChr>`);

const GROUPCHR_OTHER_BOT = wrap(`
  <m:groupChr>
    <m:groupChrPr>
      <m:chr m:val="→"/>
      <m:pos m:val="bot"/>
    </m:groupChrPr>
    <m:e><m:r><m:t>abc</m:t></m:r></m:e>
  </m:groupChr>`);

test("groupChr: overbrace ⏞ emits \\overbrace{...}", () => {
  const result = ommlToLatex(OVERBRACE);
  assert.ok(result.includes("\\overbrace{"), `expected \\overbrace: ${result}`);
  assertKatexValid(result);
});

test("groupChr: underbrace ⏟ emits \\underbrace{...}", () => {
  const result = ommlToLatex(UNDERBRACE);
  assert.ok(result.includes("\\underbrace{"), `expected \\underbrace: ${result}`);
  assertKatexValid(result);
});

test("groupChr: non-brace chr at bot emits \\underset", () => {
  const result = ommlToLatex(GROUPCHR_OTHER_BOT);
  assert.ok(result.includes("\\underset{"), `expected \\underset: ${result}`);
  assert.ok(result.includes("abc"), `expected base abc: ${result}`);
});

// ── nested dispatch ───────────────────────────────────────────────────────────

const FRACTION_WITH_NARY = wrap(`
  <m:f>
    <m:num>
      <m:nary>
        <m:naryPr><m:chr m:val="∑"/></m:naryPr>
        <m:sub><m:r><m:t>i=1</m:t></m:r></m:sub>
        <m:sup><m:r><m:t>n</m:t></m:r></m:sup>
        <m:e><m:r><m:t>i</m:t></m:r></m:e>
      </m:nary>
    </m:num>
    <m:den><m:r><m:t>n</m:t></m:r></m:den>
  </m:f>`);

test("dispatch: nary nested inside fraction is reached", () => {
  const result = ommlToLatex(FRACTION_WITH_NARY);
  assert.ok(result.includes("\\frac{"), `expected \\frac: ${result}`);
  assert.ok(result.includes("\\sum"), `expected \\sum in numerator: ${result}`);
  assertKatexValid(result);
});
