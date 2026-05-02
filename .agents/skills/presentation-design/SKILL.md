---
name: presentation-design
description: Visual design system for a minimal technical keynote. Defines canvas, typography, color, layout archetypes, components, and proportions. Use when translating content into visual structure.
---

# Minimal Technical Keynote Slide System

Use this as the source of truth for generating new slides with the same visual identity, even when content changes.

---

## 1. Core Style

Create a **minimal technical keynote deck** with a developer-native aesthetic.

The deck should feel like a polished engineering talk from a company like Vercel, Linear, Anthropic, or OpenAI: sparse, precise, product-like, and typography-led.

The visual identity is built from:

```text
Huge black typography
Extreme whitespace
Tiny uppercase section labels
Code-like inline chips
Product UI cards
Minimal charts
Thin bottom progress bars
```

The deck should not feel like a corporate PowerPoint template. It should feel like a high-end technical presentation for engineers, AI builders, and founders.

---

## 2. Canvas

Use a 16:9 widescreen canvas.

```text
Canvas size: 1536 × 864 px
Background: #FAFAFA or #FBFBFB
```

The background should be nearly white but slightly soft, no pure bright white.

All slide dimensions below assume `1536 × 864 px`. Scale proportionally for other sizes.

---

## 3. Global Layout

Use consistent margins.

```text
Left margin: 78 px
Right margin: 78 px
Top section label y: 64 px
Bottom reserved area: 40–56 px
```

Relative proportions:

```text
Side margin ≈ 5% of slide width
Top label margin ≈ 7.5% of slide height
```

Most slides should be spacious.

```text
Normal slide content area: 35–65% of canvas
Whitespace: 35–60% of canvas
Dense resource slide content area: up to 80%
```

Do not fill the slide just because space exists. Empty space is part of the design.

---

## 4. Typography

Use a modern neutral sans-serif.

```text
Primary font: Inter, SF Pro Display, Helvetica Neue, or Arial
Code font: SF Mono, JetBrains Mono, Menlo, or Roboto Mono
```

### Hero Title

Used for cover slides and strong statement slides.

```text
Font size: 120–150 px
Weight: 700–800
Line height: 0.9–1.0
Letter spacing: -0.04em to -0.07em
Color: #050505
```

```text
Hero title size ≈ 14–17% of slide height
```

### Large Content Title

Used for normal main slides.

```text
Font size: 88–120 px
Weight: 700–800
Line height: 1.0–1.08
Letter spacing: -0.04em
Color: #050505
```

Ratio:

```text
Large title size ≈ 10–14% of slide height
```

### Quote Text

Used for cinematic quote slides.

```text
Font size: 60–76 px
Weight: 500–650
Line height: 1.12–1.2
Letter spacing: -0.035em
Color: #050505
Text align: center
```

Ratio:

```text
Quote font size ≈ 7–9% of slide height
```

### Body Text

```text
Font size: 28–34 px
Weight: 400–500
Line height: 1.4–1.55
Color: #555762
```

Body text should usually be:

```text
22–30% of title size
```

Example:

```text
Title: 110 px
Body: 30 px
```

### Emphasized Body Text

Use black bold text for key phrases inside body copy.

```text
Weight: 700
Color: #111111
```

### Metadata Text

Used for URLs, page numbers, attributions, labels, and captions.

```text
Font size: 14–18 px
Weight: 400–600
Color: #8A8C96
```

---

## 5. Section Labels

Most slides have a small section label in the top-left corner.

Examples:

```text
THE PROBLEM
SKILLS
REALITY
NEXT.JS
RECAP
```

Style:

```text
Position: x = 78 px, y = 64 px
Font size: 14–18 px
Weight: 600
Text transform: uppercase
Letter spacing: 0.22em–0.32em
```

The label should feel like metadata, not a heading.

Ratio:

```text
Section label size ≈ 13–18% of title size
```

---

## 6. Color System

Use a restrained color palette.

### Base Colors

```text
Background:        #FAFAFA / #FBFBFB
Main black:        #050505
Dark text:         #111111
Body gray:         #555762
Muted gray:        #8A8C96
Light metadata:    #C8C9CE
Border gray:       #DADCE1
Grid gray:         #E7E8EC
Card background:   #FFFFFF or #F4F4F5
Code chip bg:      #F2F2F5
```

### Accent Colors

Use one accent color per section.

```text
Problem / Risk / Friction:     Red     #FF2A2A
Solution / System / Skills:    Purple  #7C3CFF
Reality / Warning / Result:    Orange  #D97706
Framework / Code / Product:    Blue    #2563EB
Recap / Resources / Summary:   Teal    #009B8F
Success / Passing State:       Green   #22C55E
Chart Secondary:               Cyan    #06B6D4
```

Accent colors are used for:

```text
Section label
Bottom progress bar
Bullets
Code chips
Chart lines
Stat-card borders
Important visual highlights
```

Avoid using many accent colors on one slide. Most slides should use one accent color, plus black and gray.

---

## 7. Required Bottom System

Every slide must include:

### Bottom Progress Bar

```text
Position: bottom edge
x = 0
height = 4 px
Color: current section accent color
Length: proportional to slide progress through deck
```

### Page Number

```text
Position: bottom-right
Right offset: 56–70 px
Bottom offset: 22–30 px
Font size: 14–16 px
Color: #C8C9CE
Format: "7 / 46"
```

### Bottom-left Glyph

A tiny faint abstract glyph, crescent, or subtle brand mark.

```text
Position: x = 32–40 px, bottom = 24–32 px
Size: 12–18 px
Color: #D1D5DB
Opacity: low
```

This bottom system is part of the deck identity and should appear on all slides.

---

## 8. Core Layout Archetypes

Each archetype maps to one or more slide types in the schema. Always emit the correct `type` and `variant`. **Do not invent new types**; pick the closest archetype below.

### A. Big Statement Slide → `statement` (variant `large` or `tight`)

Use for strong claims.

Structure:

```text
Huge left-aligned title
Optional short gray subtitle
Large empty area
No unnecessary image
```

Proportions:

```text
Title block width: 50–65% of slide width
Title block height: 25–45% of slide height
Subtitle width: 45–60% of slide width
```

Example content style:

```text
Context is not memory.
It is a budget.
```

---

### B. Quote Slide → `quote` (variant `centered` or `card`)

Use for framing a problem or key belief.

Structure:

```text
Small section label top-left
Huge centered quote
Optional oversized pale quotation mark
Small centered attribution
Optional source card below
```

Proportions:

```text
Quote block width: 70–80% of slide width
Quote block height: 45–60% of slide height
Quote max width: 1050–1220 px
```

---

### C. Left Text + Right UI Slide → `split-visual` (variant `ui-mockup`)

Use for explaining a concept with a product-like visual. **Set `mockupKind` to one of `browser | terminal | file-tree | card`** and put the rendered text in `mockupContent`. The left column uses `headline` + `leftContent` (and optional `points` for short bullet lead-ins).

`mockupContent` is rendered inside a `<pre>` — newlines and indentation are preserved. Use real shell prompts, real-looking URLs, real file paths. **Do NOT** stuff ASCII-art architecture diagrams, before/after comparisons, or pipeline arrows into a mockup. If the visual you want to show is a comparison of two states, use `comparison/stats`. If it's a benchmark or trend, use `chart`. If it's an architecture diagram, prefer an actual `image` slide referencing a source figure.

Structure:

```text
Left: section label, large title, body copy, bullets
Right: terminal, browser, file tree, app mockup, or UI card
```

Proportions:

```text
Left text column: 44–48% of slide width
Gap: 4–6% of slide width
Right UI card: 42–46% of slide width
```

The right UI element must look like real software, not a generic illustration.

---

### D. Chart Slide → `chart` (variant `line` or `bar`)

Use for explaining a trend, benchmark, or conceptual result. Always supply real data via `chartData = { xLabels, series: [{ label, color?, points }] }`. Do not invent data; ground every series in source numbers (cite via `evidenceRefs`).

Structure:

```text
Small section label top-left
Centered large title
Large minimalist chart below
Small legend on the bottom
```

Chart styling:

```text
No chart background box
Dashed light-gray grid
Gray axes
Large readable labels
Thick colored lines (line variant) or solid bars (bar variant)
No point markers
Minimal legend
```

The chart should feel presentation-grade, not like a spreadsheet export.

---

### E. Comparison / Results Slide → `comparison` (variant `stats`)

Use for A/B outcomes, pass rates, or decisive conclusions. Set `beforeNumber/beforeLabel/afterNumber/afterLabel` and optional `winner: "before" | "after"`. The renderer highlights the winner with the section accent color.

Use emotional mapping:

```text
Lower / failed / weaker result: orange
Higher / passed / stronger result: green
```

If you have ≥2 KPIs that are NOT comparing two states, prefer `big-number` variant `metrics-row` with `metrics: [{ value, label }, …]` instead of forcing a comparison.

---

### F. Terminal Command Slide → `code` (variant `terminal`)

Use for implementation instructions, install scripts, CLI output. Put the commands in `code`, an optional title in `terminalTitle` (defaults to "TERMINAL"), and prefer `codeLanguage: "shell"`.

Terminal styling:

```text
Background: #FFFFFF
Border: 1 px solid #DADCE1
Border radius: 10–12 px
Top bar: 42–50 px, label uppercase tracked wide
Code area: monospace 24–30 px, line height 1.45–1.65
Commands: blue (#2563EB)
Comments: black (#111111)
```

The terminal should be oversized and readable, not a tiny screenshot.

---

### G. Resources / Recap Slide → `recap` (variant `resources`)

Use for final references, links, and tools.

Structure:

```text
Small section label
Large title
Left column: grouped resources via `resources: [{ group?, items: [{ title, url?, description? }] }]`
Right column: tools / built-with list via `tools: [{ name, description? }]`
Vertical divider between columns
```

Column proportions:

```text
Left resources column: 58–62% of slide width
Divider area: 4–6% of slide width
Right tools column: 22–26% of slide width
Outer margins: 5–7% of slide width
```

For a plain bullet recap (no links), use `recap` variant `bullets` with `points`.

---

## 9. Components

### Inline Code Chip

Used for filenames, commands, routes, concepts, and technical tokens. Embed inside text with backticks (the renderer styles `like_this` automatically).

Examples:

```text
AGENTS.md
SKILL.md
/scripts
/skills
context.json
```

Style:

```text
Font: monospace
Background: #F2F2F5
Border: 1 px solid #DADCE1
Border radius: 8–12 px
Padding: 3–5 px vertical, 8–10 px horizontal
Color: section accent color
```

Inline code chips should feel embedded into text, not like buttons.

---

### UI Card

Generic UI cards should look like product surfaces.

```text
Background: #FFFFFF or #F4F4F5
Border: 1 px solid #DADCE1
Border radius: 12–16 px
Padding: 24–36 px
Shadow: none or extremely subtle
```

Avoid heavy shadows. Avoid glossy or marketing-card styling.

---

### Browser Card

```text
Background: #FFFFFF
Border: 1 px solid #DADCE1
Border radius: 12 px
Overflow: hidden

Top bar: 48–56 px, #F6F6F7, red/yellow/green dots, rounded address bar with monospace URL.
```

---

### File Tree Card

Use for showing system structure.

```text
Background: #FFFFFF
Border: 1 px solid #DADCE1
Border radius: 10–12 px
Padding: 20–28 px
Font: monospace
Font size: 20–24 px
Line height: 1.45
```

Use subtle folder icons, tree lines, and indentation. Keep it simple and readable.

---

## 10. Bullet Style

Bullets are sparse and large.

```text
Bullet color: section accent color
Bullet size: small dot
Text size: 28–34 px
Line height: 1.4–1.55
Bullet spacing: 22–32 px between items
```

Bullet text often starts with a bold black phrase, followed by gray explanation.

Example:

```text
- Front matter defines triggers, globs, and always-on rules
- /skills lists installed skills and their descriptions
- On-demand loading only loads when the pattern matches
```

Three bullets is ideal. Four is acceptable. More than five should be avoided.

---

## 11. Voice

The content can change, but the writing should stay sharp and technical.

Good tone:

```text
Precise
Direct
Developer-native
Slightly opinionated
Concrete
Low-marketing
```

Good sentence style:

```text
Context is not memory.
It is a budget.

Agents do not fail randomly.
They fail where instructions are missing.

The model can write code.
It cannot infer your evolving conventions.
```

Avoid generic business language:

```text
Unlock productivity
Streamline workflows
Leverage synergies
Empower teams
Transform your organization
```

Each slide should do one clear job:

```text
Make a strong claim
Name a problem
Explain a constraint
Show a mechanism
Show a result
Give an implementation path
Summarize references
```

---

## 12. Visual Tone

The deck should feel:

```text
Minimal
Technical
Editorial
Precise
Developer-native
Confident
Slightly austere
Product-like
```

It should not feel:

```text
Corporate
Playful
Cartoonish
Busy
Template-like
Gradient-heavy
Icon-heavy
Stock-photo-heavy
```

Avoid:

```text
Stock photos
Cartoon illustrations
Emoji
3D icons
Gradient blobs
Decorative waves
Excessive shadows
Busy backgrounds
Tiny unreadable text
PowerPoint-style dense bullets
```

---

## 13. Size Relationship Summary

The key proportion system:

```text
Hero title : body text : label text
≈ 8 : 2 : 1
```

Typical values:

```text
Hero title: 120–150 px
Body text: 28–34 px
Label text: 14–18 px
```

For normal content slides:

```text
Title : body : metadata
≈ 6 : 2 : 1
```

Example:

```text
Title: 96 px
Body: 30 px
Metadata: 15 px
```

For statistic cards:

```text
Stat number : card label
≈ 8 : 1
```

Example:

```text
Number: 132 px
Label: 16 px
```

Never shrink typography to fit more content. Reduce the content instead.

---

## One-line Essence

A sparse developer keynote system built from oversized black typography, tiny colored section labels, code-like chips, product UI cards, minimal charts, and disciplined whitespace.
