## ADDED Requirements

### Requirement: OMML to LaTeX conversion
The system SHALL convert OOXML Math (OMML) `m:oMath` fragments into LaTeX strings via a self-contained TypeScript converter with no machine-learning or external-process dependencies.

#### Scenario: Convert a fraction
- **Given** an OMML fragment containing `m:f` with `m:num` of `a` and `m:den` of `b`
- **When** `ommlToLatex` is called with that fragment
- **Then** it returns `\frac{a}{b}`

#### Scenario: Convert a radical with degree
- **Given** an OMML `m:rad` with `m:deg` of `3` and `m:e` of `x`
- **When** the converter runs
- **Then** it returns `\sqrt[3]{x}`

#### Scenario: Convert an n-ary summation with limits
- **Given** an OMML `m:nary` with `m:chr` of summation, sub `i=1`, sup `n`, and base `a_i`
- **When** the converter runs
- **Then** it returns `\sum_{i=1}^{n} a_i`

#### Scenario: Convert a matrix
- **Given** an OMML `m:m` with two rows each having two `m:e` cells
- **When** the converter runs
- **Then** it returns a `\begin{matrix} ... \\\\ ... \end{matrix}` expression with cells separated by `&`

#### Scenario: Degrade unknown elements without throwing
- **Given** an OMML fragment containing an element with no mapping rule
- **When** the converter runs
- **Then** it returns the concatenated text content of that element and does not throw

### Requirement: Math-preserving document extraction
The document extraction pipeline SHALL preserve embedded equations from DOCX and PPTX sources as LaTeX delimited spans rather than dropping or garbling them.

#### Scenario: Inline equation in a Word paragraph
- **Given** a DOCX whose `word/document.xml` contains an inline `m:oMath` for `x^2 + 1`
- **When** the document is extracted
- **Then** the resulting text contains `$x^2 + 1$` at the equation's position

#### Scenario: Display equation as math paragraph
- **Given** a DOCX containing an `m:oMathPara`
- **When** the document is extracted
- **Then** the resulting text contains the equation wrapped as `$$...$$`

#### Scenario: Document without math is unchanged
- **Given** a DOCX or PPTX containing no `m:oMath` elements
- **When** the document is extracted
- **Then** the extracted text is identical to the pre-feature behaviour

### Requirement: Client-side LaTeX rendering on slides
The slide rendering layer SHALL render LaTeX math delimited by `$...$` (inline) and `$$...$$` (block) using KaTeX, without crashing on invalid expressions.

#### Scenario: Render inline math in a bullet
- **Given** slide body text containing `Energy is $E = mc^2$`
- **When** the slide is rendered through the inline markdown renderer
- **Then** the `E = mc^2` segment is rendered as KaTeX HTML and the surrounding text renders normally

#### Scenario: Render block math
- **Given** slide body text containing a standalone `$$\int_0^1 x\,dx$$`
- **When** the slide is rendered
- **Then** KaTeX renders it in display mode

#### Scenario: Invalid LaTeX does not crash the slide
- **Given** slide text containing `$\frac{1}{$`
- **When** the slide is rendered
- **Then** KaTeX renders an error-styled fallback and the rest of the slide still renders
