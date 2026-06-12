// JSON Schema definitions for the Slide type system.
// Derived from app/slides.ts and core/schemas/types.ts.
// Exported as plain JSON Schema objects so MCP tools can include them in
// tool descriptions, letting AI agents generate correctly-typed SlideSpec JSON.

export const SLIDE_TYPES = [
  "title",
  "goals",
  "section-divider",
  "statement",
  "code",
  "framework",
  "recap",
  "iframe",
  "quote",
  "image",
  "split-visual",
  "big-number",
  "comparison",
  "quiz",
  "agent-tree",
  "chart",
] as const;

export type SlideType = (typeof SLIDE_TYPES)[number];

export const AUDIENCE_TYPES = ["academic", "technical", "winston"] as const;

export const STYLE_PRESETS = [
  "minimal",
  "bold",
  "corporate",
  "academic",
] as const;

// Per-type field guidance for AI agents.
export const SLIDE_TYPE_DESCRIPTIONS: Record<SlideType, string> = {
  title: "Opening title slide. Required: headline. Optional: subtitle, supporting.",
  goals: "Agenda / key-takeaways slide. Required: headline, points (3 max).",
  "section-divider": "Visual break between major sections. Required: headline, label, color.",
  statement: "Bold assertion slide with a single big idea. Required: headline. Optional: supporting.",
  code: "Code snippet slide. Required: headline, code, codeLanguage. Optional: terminalTitle.",
  framework: "Conceptual model or steps. Required: headline, points (3–5 items).",
  recap: "Summary / resources slide. Required: headline. Optional: points, resources, tools.",
  iframe: "Embed an external URL. Required: headline, iframeUrl.",
  quote: "Pull-quote slide. Required: quote, author. Optional: headline.",
  image: "Full or side image. Required: headline, imageUrl. Optional: imageLayout (full|side), supporting.",
  "split-visual": "Two-column content. Required: headline, leftContent, rightContent. Optional: mockupKind.",
  "big-number": "Hero metric. Required: headline, bigNumber. Optional: numberLabel, metrics[].",
  comparison: "Before/after or stats compare. Required: headline. Optional: beforePoints[], afterPoints[], winner.",
  quiz: "Checkpoint quiz. Required: question, options[], answer. Optional: explanation.",
  "agent-tree": "Agent / architecture diagram encoded as text. Required: headline, agentTree.",
  chart: "Line or bar chart. Required: headline, chartKind, chartData. Optional: xAxisLabel, yAxisLabel.",
};

// Full JSON Schema for a single Slide object.
export const SLIDE_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://slides.local/schema/slide",
  title: "Slide",
  description:
    "A single presentation slide. The `type` field determines which optional fields are relevant.",
  type: "object",
  required: ["type"],
  properties: {
    type: {
      type: "string",
      enum: [...SLIDE_TYPES],
      description: "Slide layout type.",
    },
    headline: {
      type: "string",
      maxLength: 80,
      description: "Primary headline — ≤80 chars, bold statement, no full stop.",
    },
    subtitle: { type: "string", description: "Secondary line below the headline (title slides)." },
    label: {
      type: "string",
      description: "Section label rendered as a badge (e.g. 'PROBLEM', 'SOLUTION').",
    },
    color: {
      type: "string",
      description: "Hex accent color inherited from the section (e.g. '#14b8a6').",
    },
    supporting: {
      type: "string",
      maxLength: 200,
      description: "Supporting sentence below the headline — ≤200 chars.",
    },
    points: {
      type: "array",
      items: { type: "string" },
      maxItems: 5,
      description: "Bullet points — ≤5 items, each ≤120 chars.",
    },
    code: { type: "string", description: "Code snippet content (for `code` type)." },
    codeLanguage: {
      type: "string",
      description: "Language identifier (e.g. 'typescript', 'python').",
    },
    terminalTitle: { type: "string", description: "Optional terminal window title bar text." },
    iframeUrl: { type: "string", format: "uri", description: "URL to embed (for `iframe` type)." },
    quote: { type: "string", description: "Pull quote text (for `quote` type)." },
    author: { type: "string", description: "Quote attribution." },
    imageUrl: { type: "string", description: "Image URL or /extracted/... path." },
    imageLayout: {
      type: "string",
      enum: ["full", "side"],
      description: "Image fills slide (`full`) or is placed beside text (`side`).",
    },
    agentTree: {
      type: "string",
      description: "ASCII or text diagram of an agent/system architecture.",
    },
    leftContent: { type: "string", description: "Left column markdown (for `split-visual`)." },
    rightContent: { type: "string", description: "Right column markdown (for `split-visual`)." },
    mockupKind: {
      type: "string",
      enum: ["browser", "terminal", "file-tree", "card"],
      description: "UI mockup variant for `split-visual`.",
    },
    mockupContent: { type: "string", description: "Text/code content inside the mockup." },
    mockupUrl: { type: "string", description: "URL shown in a browser mockup." },
    bigNumber: { type: "string", description: "Hero metric value (e.g. '3.2×', '$4.5B')." },
    numberLabel: { type: "string", description: "Label beneath the big number." },
    metrics: {
      type: "array",
      description: "Row of metrics for `big-number` metrics-row variant.",
      items: {
        type: "object",
        required: ["value", "label"],
        properties: {
          value: { type: "string" },
          label: { type: "string" },
        },
      },
    },
    beforePoints: { type: "array", items: { type: "string" }, description: "Before-state bullets." },
    afterPoints: { type: "array", items: { type: "string" }, description: "After-state bullets." },
    beforeNumber: { type: "string" },
    beforeLabel: { type: "string" },
    afterNumber: { type: "string" },
    afterLabel: { type: "string" },
    winner: { type: "string", enum: ["before", "after"], description: "Which side wins the comparison." },
    chartKind: { type: "string", enum: ["line", "bar"] },
    chartData: {
      type: "object",
      required: ["xLabels", "series"],
      properties: {
        xLabels: { type: "array", items: { type: "string" } },
        series: {
          type: "array",
          items: {
            type: "object",
            required: ["label", "points"],
            properties: {
              label: { type: "string" },
              color: { type: "string" },
              points: { type: "array", items: { type: "number" } },
            },
          },
        },
      },
    },
    xAxisLabel: { type: "string" },
    yAxisLabel: { type: "string" },
    resources: {
      type: "array",
      description: "Resource groups for `recap` type.",
      items: {
        type: "object",
        properties: {
          group: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              required: ["title"],
              properties: {
                title: { type: "string" },
                url: { type: "string" },
                description: { type: "string" },
              },
            },
          },
        },
      },
    },
    question: { type: "string", description: "Quiz question text." },
    options: { type: "array", items: { type: "string" }, description: "Quiz answer choices." },
    answer: { type: "string", description: "Correct answer (must match one of `options`)." },
    explanation: { type: "string", description: "Why the answer is correct." },
    notes: { type: "string", description: "Speaker notes (not shown on slide)." },
    variant: {
      type: "string",
      description:
        "Optional layout variant. See slide-variants.ts for valid values per type.",
    },
    evidenceRefs: {
      type: "array",
      items: { type: "string" },
      description: "Chunk IDs that back this slide's claims.",
    },
  },
  additionalProperties: false,
} as const;

// JSON Schema for a full presentation (array of slides + metadata).
export const PRESENTATION_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://slides.local/schema/presentation",
  title: "Presentation",
  type: "object",
  required: ["id", "title", "slides"],
  properties: {
    id: { type: "string", format: "uuid" },
    title: { type: "string" },
    audienceType: { type: "string", enum: [...AUDIENCE_TYPES] },
    stylePreset: { type: "string", enum: [...STYLE_PRESETS] },
    slides: { type: "array", items: SLIDE_JSON_SCHEMA },
    slideCount: { type: "integer" },
    generatedAt: { type: "string", format: "date-time" },
  },
} as const;
