// System prompts for the multi-stage generation pipeline.
//
// The four .agents/skills/presentation-{outline,content,design,notes}/SKILL.md
// files are embedded VERBATIM via lib/generation/skills.generated.ts (built by
// scripts/inline-skills.mjs at predev/prebuild time). Edit the SKILL.md files
// to change generation guidance — never edit skills.generated.ts by hand.
//
// The LAYOUT VARIANTS block is generated programmatically from
// lib/slide-variants.ts so the prompt can never drift from what the renderer
// supports.

import { SLIDE_VARIANTS } from "@/lib/slide-variants";
import { SKILL_OUTLINE, SKILL_CONTENT, SKILL_DESIGN, SKILL_NOTES } from "@/lib/generation/skills.generated";

function variantsBlock(): string {
  const lines = (Object.keys(SLIDE_VARIANTS) as (keyof typeof SLIDE_VARIANTS)[])
    .sort()
    .map((type) => {
      const opts = SLIDE_VARIANTS[type].map((v) => `"${v.value}"`).join(" | ");
      return `  ${type}: ${opts}`;
    });
  return [
    "LAYOUT VARIANTS (set \"variant\" only when an alternate fits better):",
    ...lines,
  ].join("\n");
}

const ALLOWED_TYPES = (Object.keys(SLIDE_VARIANTS) as string[]).sort().join("|");

const GROUNDING_RULES = `
═══════════════════════════════════════════════
GROUNDING (chunks + images)
═══════════════════════════════════════════════

If the input includes "Candidate chunks for this section" or "Reference chunks for this section":
- For any factual claim, metric, or quote, include "evidenceRefs": ["CHK-..."] with the supporting chunk id(s).
- Never invent a CHK- id that isn't in the provided chunk list.

If the input includes "Available source images":
- If actual image blocks are attached, inspect them directly. Treat the caption as context, not a substitute for looking at the visual content.
- Whenever the source has a relevant figure / diagram / screenshot for a slide, emit a slide of type "image" with "imageRef": "IMG-..." (the renderer resolves it to imageUrl).
- A typical 8–15 slide deck SHOULD include at least one image slide if any ★preferred image exists.
- Never invent an IMG- id that isn't in the list.
`.trim();

const OUTLINE_OUTPUT_SCHEMA = `
═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════

ONLY a JSON object matching this schema. No markdown, no commentary.

{
  "title": string,                  // 1–6 words, the deck title
  "totalSlideCount": number,        // honour the audience profile slide range when given
  "sections": [
    {
      "id": string,                 // SEC-OPENING, SEC-PROBLEM, SEC-SOLUTION, …
      "name": string,               // human-readable section name
      "purpose": string,            // 1 sentence describing what this section does
      "label": string,              // ALL-CAPS section tag for slide chrome ("THE PROBLEM")
      "color": string,              // hex from the design palette (#FF2A2A red, #7C3CFF purple, #D97706 orange, #2563EB blue, #009B8F teal, #22C55E green, #06B6D4 cyan)
      "slideCount": number,         // recommended slides in this section
      "candidateChunkIds"?: string[], // optional, ids from chunk index
      "candidateImageIds"?: string[]  // optional, ids from image index
    }
  ]
}

The sum of slideCount across sections must equal totalSlideCount.
Output starts with { and ends with }.
`.trim();

export const OUTLINE_SYSTEM_PROMPT = [
  "You are the OUTLINE stage of a presentation generator.",
  "",
  "Read the source document and propose the deck structure as JSON.",
  "",
  "The full presentation-outline and presentation-design SKILL files are reproduced verbatim below — apply them strictly.",
  "",
  "═══════════════════════════════════════════════",
  "OUTLINE SKILL (verbatim)",
  "═══════════════════════════════════════════════",
  "",
  SKILL_OUTLINE,
  "",
  "═══════════════════════════════════════════════",
  "DESIGN SKILL (verbatim — section colors and palette guide section choices)",
  "═══════════════════════════════════════════════",
  "",
  SKILL_DESIGN,
  "",
  GROUNDING_RULES,
  "",
  OUTLINE_OUTPUT_SCHEMA,
].join("\n");

const SECTION_OUTPUT_SCHEMA = `
═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════

ONLY a JSON array of slide objects. No markdown, no preamble.

Allowed slide types: ${ALLOWED_TYPES}

${variantsBlock()}

Slide object fields (only emit fields relevant to the chosen type/variant):
  type:           string (one of the allowed types above)
  variant?:       string (one of the variants for that type)
  headline?:      string (max 80 chars)
  subtitle?:      string (title/section-divider only)
  label:          string (use the section's label)
  color:          string (use the section's color, hex)
  supporting?:    string (max 200 chars)
  points?:        string[] (max 5 items)
  code?:          string (code type only)
  codeLanguage?:  string (e.g. "python", "shell", "ts" — terminal variant should use "shell")
  terminalTitle?: string (code/terminal variant only — defaults to "TERMINAL")
  quote?:         string (quote type only)
  author?:        string (quote type only)
  bigNumber?:     string (big-number default variants — e.g. "70%")
  numberLabel?:   string (big-number default variants)
  metrics?:       { value: string; label: string }[]   (big-number variant "metrics-row" only, ≥2 items)
  leftContent?:   string (split-visual)
  rightContent?:  string (split-visual default variant only)
  mockupKind?:    "browser" | "terminal" | "file-tree" | "card"   (split-visual variant "ui-mockup" only)
  mockupContent?: string (the multiline body for browser/terminal/card mockups; for file-tree this is only a fallback — prefer mockupTree)
  mockupTree?:    { name: string; comment?: string; children?: FileTreeNode[] }[]   (file-tree mockup ONLY; structured tree, never ASCII art)
  mockupUrl?:     string (browser mockup address bar)
  beforePoints?:  string[] (comparison default variant)
  afterPoints?:   string[] (comparison default variant)
  beforeNumber?:  string   (comparison variant "stats")
  beforeLabel?:   string   (comparison variant "stats")
  afterNumber?:   string   (comparison variant "stats")
  afterLabel?:    string   (comparison variant "stats")
  winner?:        "before" | "after" (comparison variant "stats", optional)
  chartKind?:     "line" | "bar" (chart type only — must match variant)
  chartData?:     { xLabels: string[]; series: { label: string; color?: string; points: number[] }[] }
  xAxisLabel?:    string (chart type only)
  yAxisLabel?:    string (chart type only)
  resources?:     { group?: string; items: { title: string; url?: string; description?: string }[] }[]   (recap variant "resources")
  tools?:         { name: string; description?: string }[]   (recap variant "resources")
  imageRef?:      string (IMG-… id from the candidate images, image type only)
  question?:      string (quiz type only)
  options?:       string[] (quiz type only, 2-5 options)
  answer?:        string (quiz type only)
  explanation?:   string (quiz type only)
  evidenceRefs?:  string[] (CHK-… ids from the candidate chunks)
  notes?:         string (multi-line speaker notes per the notes skill)

Output starts with [ and ends with ].
`.trim();

/** Instruction text appended at the end of the multimodal extraction content block. */
export function buildExtractionPrompt(opts: { withVision: boolean }): string {
  const base = [
    "You are reading a structured representation of a presentation deck.",
    "Each page is preceded by its slide number, markdown text, and bounding-box JSON.",
    "Extract the slide content faithfully — titles, body text, bullet points, and data.",
  ].join(" ");

  if (!opts.withVision) return base;

  return [
    base,
    "You will also receive a page screenshot for each slide.",
    "Use these images to derive accent/brand colors, chart descriptions, and figure-text alignment when the markdown is ambiguous.",
  ].join(" ");
}

export const SECTION_DRAFT_SYSTEM_PROMPT = [
  "You are the CONTENT + DESIGN + NOTES stage of a presentation generator.",
  "",
  "Given the full source document and ONE section spec, produce that section's slides as a JSON array.",
  "",
  "The three SKILL files below are reproduced verbatim — apply them strictly.",
  "",
  "═══════════════════════════════════════════════",
  "CONTENT SKILL (verbatim)",
  "═══════════════════════════════════════════════",
  "",
  SKILL_CONTENT,
  "",
  "═══════════════════════════════════════════════",
  "DESIGN SKILL (verbatim)",
  "═══════════════════════════════════════════════",
  "",
  SKILL_DESIGN,
  "",
  "═══════════════════════════════════════════════",
  "NOTES SKILL (verbatim)",
  "═══════════════════════════════════════════════",
  "",
  SKILL_NOTES,
  "",
  GROUNDING_RULES,
  "",
  SECTION_OUTPUT_SCHEMA,
].join("\n");
