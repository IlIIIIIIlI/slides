## ADDED Requirements

### Requirement: N-ary operator conversion
The OMML converter SHALL convert `m:nary` elements to LaTeX, mapping the n-ary operator glyph to its LaTeX command and placing lower/upper bounds according to the OMML limit location.

#### Scenario: Summation with lower and upper bounds
- **Given** an `m:oMath` containing an `m:nary` whose `m:naryPr/m:chr` is `∑`, with `m:sub` = `i=1`, `m:sup` = `n`, and `m:e` = `i`
- **When** the converter processes the element
- **Then** it produces `\sum_{i=1}^{n}{i}` (or KaTeX-equivalent) without triggering the error fallback

#### Scenario: Integral with default operator
- **Given** an `m:nary` with no `m:naryPr/m:chr` child and `m:e` = `f(x)dx`
- **When** the converter processes the element
- **Then** it emits the integral command `\int` followed by the body

#### Scenario: Product with under-over limit location
- **Given** an `m:nary` with `m:naryPr/m:chr` = `∏`, `m:naryPr/m:limLoc` = `undOvr`, `m:sub` = `k`, `m:sup` = `m`
- **When** the converter processes the element
- **Then** it emits `\prod` with limits attached so KaTeX renders them under/over the operator

#### Scenario: Unknown operator glyph falls back to raw glyph
- **Given** an `m:nary` whose `m:naryPr/m:chr` is a glyph not in the mapping table
- **When** the converter processes the element
- **Then** it emits the raw glyph with its sub/superscripts rather than crashing

### Requirement: Limit (upper/lower) conversion
The OMML converter SHALL convert `m:limUpp` and `m:limLow` elements, attaching the limit to the base as a script for operator-like bases and using `\overset`/`\underset` otherwise.

#### Scenario: Lower limit on the lim operator
- **Given** an `m:limLow` whose `m:e` resolves to `lim` and whose `m:lim` is `x \to 0`
- **When** the converter processes the element
- **Then** it emits `\lim_{x \to 0}` (operator with subscript limit)

#### Scenario: Upper limit on a non-operator base
- **Given** an `m:limUpp` whose `m:e` is `f` and whose `m:lim` is `\frown`
- **When** the converter processes the element
- **Then** it emits `\overset{\frown}{f}`

### Requirement: Grouping character conversion
The OMML converter SHALL convert `m:groupChr` elements using the grouping character and position to choose `\overbrace`/`\underbrace` or an over/under set.

#### Scenario: Overbrace grouping
- **Given** an `m:groupChr` with `m:groupChrPr/m:chr` = `⏞`, `m:groupChrPr/m:pos` = `top`, and `m:e` = `a+b+c`
- **When** the converter processes the element
- **Then** it emits `\overbrace{a+b+c}`

#### Scenario: Underbrace grouping
- **Given** an `m:groupChr` with `m:groupChrPr/m:chr` = `⏟`, `m:groupChrPr/m:pos` = `bot`, and `m:e` = `x_1 \dots x_n`
- **When** the converter processes the element
- **Then** it emits `\underbrace{x_1 \dots x_n}`

#### Scenario: Non-brace grouping character at bottom
- **Given** an `m:groupChr` with a non-brace `m:groupChrPr/m:chr` and `m:pos` = `bot`
- **When** the converter processes the element
- **Then** it emits `\underset{<chr>}{<e>}`

### Requirement: Handler registration in dispatch map
The converter's tag-to-handler dispatch map SHALL register `nary`, `limUpp`, `limLow`, and `groupChr` so the recursive element walk reaches each handler.

#### Scenario: Nested n-ary inside a fraction is reached
- **Given** an `m:oMath` with an `m:f` (fraction) whose numerator contains an `m:nary`
- **When** the converter walks the tree
- **Then** the `nary` handler is invoked for the nested element and contributes its LaTeX to the fraction numerator
