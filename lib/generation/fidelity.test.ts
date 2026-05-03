import test from "node:test";
import assert from "node:assert/strict";

import { generateFidelityReport } from "@/lib/generation/fidelity";
import type { Slide } from "@/app/slides";
import type { ExtractedChunk } from "@/lib/generation/extract";

const chunks: ExtractedChunk[] = [
  { id: "CHK-1", page: 1, paragraph: 1, text: "FastAPI automatically generates OpenAPI documentation and Swagger UI." },
  { id: "CHK-2", page: 1, paragraph: 2, text: "The generated docs make manual endpoint testing faster during iteration." },
];

const slides: Slide[] = [
  { type: "title", headline: "FastAPI" },
  { type: "statement", headline: "FastAPI ships interactive docs", evidenceRefs: ["CHK-1"] },
];

const outline = {
  title: "FastAPI",
  sections: [
    { id: "SEC-1", name: "Docs", purpose: "Explain generated docs" },
  ],
};

function makeClient(texts: string[]) {
  const calls: { max_tokens: number; text: string }[] = [];
  return {
    calls,
    messages: {
      create: async (input: { max_tokens: number; messages: { content: { text: string }[] }[] }) => {
        calls.push({ max_tokens: input.max_tokens, text: input.messages[0].content[0].text });
        const text = texts.shift() ?? "";
        return {
          id: "msg-test",
          type: "message",
          role: "assistant",
          model: "test",
          stop_reason: text.endsWith("}") ? "end_turn" : "max_tokens",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
          content: [{ type: "text", text }],
        };
      },
    },
  };
}

test("retries fidelity grading with compact instructions when the first JSON response is truncated", async () => {
  const validJson = JSON.stringify({
    overallGrade: "high",
    summary: "The deck captures the generated docs workflow.",
    coverage: [
      {
        sectionId: "SEC-1",
        sectionName: "Docs",
        capturedKeyPoints: [{ text: "Generated docs are covered.", evidenceChunkIds: ["CHK-1"] }],
        missedKeyPoints: [],
      },
    ],
    unsupportedClaims: [],
  });
  const client = makeClient(['{"overallGrade":"medium","summary":"truncated"', validJson]);

  const report = await generateFidelityReport({
    client: client as never,
    model: "test-model",
    sourceText: chunks.map((chunk) => chunk.text).join("\n"),
    chunks,
    outline,
    slides,
    imageCount: 0,
  });

  assert.equal(client.calls.length, 2);
  assert.equal(client.calls[0].max_tokens, 4096);
  assert.equal(client.calls[1].max_tokens, 8192);
  assert.match(client.calls[1].text, /at most 2 capturedKeyPoints/);
  assert.equal(report.overallGrade, "high");
  assert.equal(report.coverage.length, 1);
  assert.equal(report.summary, "The deck captures the generated docs workflow.");
  assert.equal("recommendations" in report, false);
});

test("falls back to deterministic fidelity when both narrative JSON responses are invalid", async () => {
  const client = makeClient(['{"overallGrade":"medium"', ""]);

  const report = await generateFidelityReport({
    client: client as never,
    model: "test-model",
    sourceText: chunks.map((chunk) => chunk.text).join("\n"),
    chunks,
    outline,
    slides,
    imageCount: 0,
  });

  assert.equal(client.calls.length, 2);
  assert.equal(report.overallGrade, "medium");
  assert.match(report.summary, /deterministic checks only/);
  assert.doesNotMatch(report.summary, /Fidelity grading failed/);
  assert.equal(report.deterministic.factualSlidesWithEvidence, 1);
});
