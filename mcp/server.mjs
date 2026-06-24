#!/usr/bin/env node
/**
 * Slides MCP Server — exposes the slide generation pipeline as typed MCP tools.
 *
 * Runs via stdio (compatible with Claude Code, Claude Desktop, Cursor).
 * Requires the Next.js app to be running (default: http://localhost:3000).
 * Override with SLIDES_BASE_URL env var.
 *
 * Tools:
 *   get_slide_schema         — JSON Schema for all slide types
 *   list_presentations       — List saved presentations
 *   get_presentation         — Get a full presentation with slides
 *   create_presentation      — Create an empty presentation
 *   update_slides            — Replace a presentation's slides
 *   add_slides_from_topic    — AI-generate slides about a new topic
 *   regenerate_slide         — Regenerate a single slide with instructions
 *   delete_presentation      — Delete a presentation
 *   get_player_url           — Get the preview URL for a presentation
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.SLIDES_BASE_URL ?? "http://localhost:3000";

// ── Inline schema (derived from mcp/schema.ts — kept as plain JS so this
//    file runs without TypeScript compilation) ────────────────────────────

const SLIDE_TYPES = [
  "title", "goals", "section-divider", "statement", "code",
  "framework", "recap", "iframe", "quote", "image", "split-visual",
  "big-number", "comparison", "quiz", "agent-tree", "chart",
];

const SLIDE_TYPE_DESCRIPTIONS = {
  title: "Opening title slide. Required: headline. Optional: subtitle, supporting.",
  goals: "Agenda / key-takeaways slide. Required: headline, points (3 max).",
  "section-divider": "Visual break between major sections. Required: headline, label, color.",
  statement: "Bold assertion slide with a single big idea. Required: headline. Optional: supporting.",
  code: "Code snippet slide. Required: headline, code, codeLanguage. Optional: terminalTitle.",
  framework: "Conceptual model or steps. Required: headline, points (3–5 items).",
  recap: "Summary / resources slide. Required: headline. Optional: points, resources, tools.",
  iframe: "Embed an external URL. Required: headline, iframeUrl.",
  quote: "Pull-quote slide. Required: quote, author. Optional: headline.",
  image: "Full or side image. Required: headline, imageUrl. Optional: imageLayout (full|side).",
  "split-visual": "Two-column content. Required: headline, leftContent, rightContent.",
  "big-number": "Hero metric. Required: headline, bigNumber. Optional: numberLabel, metrics[].",
  comparison: "Before/after compare. Required: headline. Optional: beforePoints[], afterPoints[], winner.",
  quiz: "Checkpoint quiz. Required: question, options[], answer. Optional: explanation.",
  "agent-tree": "Agent / architecture diagram. Required: headline, agentTree.",
  chart: "Line or bar chart. Required: headline, chartKind, chartData.",
};

const SLIDE_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Slide",
  description: "A single slide. The `type` field determines which optional fields are relevant.",
  type: "object",
  required: ["type"],
  properties: {
    type: { type: "string", enum: SLIDE_TYPES, description: "Slide layout type." },
    headline: { type: "string", maxLength: 80, description: "Primary headline — ≤80 chars." },
    subtitle: { type: "string" },
    label: { type: "string", description: "Section badge label (e.g. 'PROBLEM')." },
    color: { type: "string", description: "Hex accent color (e.g. '#14b8a6')." },
    supporting: { type: "string", maxLength: 200, description: "Supporting sentence — ≤200 chars." },
    points: { type: "array", items: { type: "string" }, maxItems: 5 },
    code: { type: "string" },
    codeLanguage: { type: "string" },
    terminalTitle: { type: "string" },
    iframeUrl: { type: "string" },
    quote: { type: "string" },
    author: { type: "string" },
    imageUrl: { type: "string" },
    imageLayout: { type: "string", enum: ["full", "side"] },
    agentTree: { type: "string" },
    leftContent: { type: "string" },
    rightContent: { type: "string" },
    mockupKind: { type: "string", enum: ["browser", "terminal", "file-tree", "card"] },
    mockupContent: { type: "string" },
    mockupUrl: { type: "string" },
    bigNumber: { type: "string" },
    numberLabel: { type: "string" },
    metrics: { type: "array", items: { type: "object", properties: { value: { type: "string" }, label: { type: "string" } } } },
    beforePoints: { type: "array", items: { type: "string" } },
    afterPoints: { type: "array", items: { type: "string" } },
    beforeNumber: { type: "string" },
    beforeLabel: { type: "string" },
    afterNumber: { type: "string" },
    afterLabel: { type: "string" },
    winner: { type: "string", enum: ["before", "after"] },
    chartKind: { type: "string", enum: ["line", "bar"] },
    chartData: {
      type: "object",
      properties: {
        xLabels: { type: "array", items: { type: "string" } },
        series: { type: "array", items: { type: "object", properties: { label: { type: "string" }, color: { type: "string" }, points: { type: "array", items: { type: "number" } } } } },
      },
    },
    xAxisLabel: { type: "string" },
    yAxisLabel: { type: "string" },
    question: { type: "string" },
    options: { type: "array", items: { type: "string" } },
    answer: { type: "string" },
    explanation: { type: "string" },
    notes: { type: "string", description: "Speaker notes (not shown on slide)." },
    variant: { type: "string" },
    evidenceRefs: { type: "array", items: { type: "string" } },
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Thin HTTP wrapper — throws on non-2xx with the response body in the message. */
async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function text(value) {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

function err(message) {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

// ── MCP Server ─────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "slides",
  version: "0.1.0",
});

// ── Tool: get_slide_schema ──────────────────────────────────────────────

server.tool(
  "get_slide_schema",
  [
    "Returns the JSON Schema for all slide types in this presentation system.",
    "Use this FIRST before generating any slide JSON so you know exactly which",
    "fields each slide type requires and what constraints apply.",
  ].join(" "),
  {},
  async () =>
    text({
      slideSchema: SLIDE_JSON_SCHEMA,
      slideTypes: Object.entries(SLIDE_TYPE_DESCRIPTIONS).map(([type, description]) => ({
        type,
        description,
      })),
      rules: [
        "headline ≤ 80 chars — bold statement, no full stop",
        "supporting ≤ 200 chars",
        "points ≤ 5 items",
        "Every section-divider must have a label and hex color",
        "quote slides must have author",
        "chart slides must have chartKind + chartData",
      ],
    }),
);

// ── Tool: list_presentations ────────────────────────────────────────────

server.tool(
  "list_presentations",
  "List all saved presentations with metadata (id, title, slideCount, audienceType, generatedAt). Use the returned `id` with other tools.",
  {},
  async () => {
    try {
      const data = await api("GET", "/api/presentations");
      return text(data);
    } catch (e) {
      return err(e.message);
    }
  },
);

// ── Tool: get_presentation ──────────────────────────────────────────────

server.tool(
  "get_presentation",
  "Get the full presentation including all slide data and outline.",
  { id: z.string().describe("Presentation UUID from list_presentations") },
  async ({ id }) => {
    try {
      const data = await api("GET", `/api/presentations/${id}`);
      return text(data);
    } catch (e) {
      return err(e.message);
    }
  },
);

// ── Tool: create_presentation ───────────────────────────────────────────

server.tool(
  "create_presentation",
  [
    "Create a new empty presentation that you can populate with slides.",
    "Returns the new presentation id. Then use update_slides to set the slide content,",
    "or use add_slides_from_topic to have the AI generate slides.",
  ].join(" "),
  {
    title: z.string().describe("Presentation title"),
    audienceType: z
      .enum(["academic", "technical", "winston"])
      .optional()
      .describe("Audience profile (default: technical)"),
    stylePreset: z.string().optional().describe("Visual style preset"),
  },
  async ({ title, audienceType, stylePreset }) => {
    try {
      const data = await api("POST", "/api/presentations", {
        title,
        audienceType: audienceType ?? "technical",
        stylePreset: stylePreset ?? "minimal",
      });
      return text(data);
    } catch (e) {
      return err(e.message);
    }
  },
);

// ── Tool: update_slides ─────────────────────────────────────────────────

server.tool(
  "update_slides",
  [
    "Replace all slides in a presentation with the provided array.",
    "Each slide must conform to the Slide schema — call get_slide_schema first.",
    "Useful when you want to author the full deck as typed JSON.",
  ].join(" "),
  {
    id: z.string().describe("Presentation UUID"),
    slides: z
      .array(z.record(z.unknown()))
      .describe("Array of slide objects matching the Slide schema"),
  },
  async ({ id, slides }) => {
    try {
      await api("PATCH", `/api/presentations/${id}`, { slides });
      return text({ ok: true, slideCount: slides.length });
    } catch (e) {
      return err(e.message);
    }
  },
);

// ── Tool: add_slides_from_topic ─────────────────────────────────────────

server.tool(
  "add_slides_from_topic",
  [
    "Ask the AI to generate 1–4 new slides about a specific topic and append them",
    "to an existing presentation. Great for filling gaps or adding new sections",
    "without regenerating the whole deck.",
  ].join(" "),
  {
    id: z.string().describe("Presentation UUID to append slides to"),
    topic: z
      .string()
      .describe("Knowledge point to cover, e.g. 'deployment strategies for microservices'"),
    count: z
      .number()
      .int()
      .min(1)
      .max(4)
      .optional()
      .describe("Number of slides to generate (default: 1)"),
  },
  async ({ id, topic, count }) => {
    try {
      const data = await api("POST", `/api/presentations/${id}/generate-from-topic`, {
        topic,
        count: count ?? 1,
      });
      return text(data);
    } catch (e) {
      return err(e.message);
    }
  },
);

// ── Tool: regenerate_slide ──────────────────────────────────────────────

server.tool(
  "regenerate_slide",
  [
    "Ask the AI to rewrite a single slide given a natural-language instruction.",
    "The slide is updated in-place; the rest of the deck is unchanged.",
  ].join(" "),
  {
    id: z.string().describe("Presentation UUID"),
    slideIndex: z.number().int().min(0).describe("0-based index of the slide to regenerate"),
    instruction: z
      .string()
      .describe(
        "What to change, e.g. 'make the headline shorter' or 'add a code example in Python'",
      ),
  },
  async ({ id, slideIndex, instruction }) => {
    try {
      const data = await api("POST", `/api/presentations/${id}/regenerate-slide`, {
        slideIndex,
        instruction,
      });
      return text(data);
    } catch (e) {
      return err(e.message);
    }
  },
);

// ── Tool: delete_presentation ───────────────────────────────────────────

server.tool(
  "delete_presentation",
  "Permanently delete a presentation and all its extracted assets.",
  { id: z.string().describe("Presentation UUID to delete") },
  async ({ id }) => {
    try {
      await api("DELETE", `/api/presentations/${id}`);
      return text({ ok: true, deleted: id });
    } catch (e) {
      return err(e.message);
    }
  },
);

// ── Tool: get_player_url ────────────────────────────────────────────────

server.tool(
  "get_player_url",
  "Return the browser URL where a presentation can be previewed in the slide player.",
  { id: z.string().describe("Presentation UUID") },
  async ({ id }) =>
    text({
      playerUrl: `${BASE_URL}/player/${id}`,
      workspaceUrl: `${BASE_URL}/workspace/${id}`,
    }),
);

// ── Start ──────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
