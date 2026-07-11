import test from "node:test";
import assert from "node:assert/strict";

import { AUDIENCE_PROFILES } from "@/lib/generation/audience";
import {
  buildImpeccableSlideRepairInput,
  groupImpeccableFindingsByBlock,
  normalizeOutlineSlideCounts,
  repairGeneratedDeck,
  repairSectionSlides,
  repairSlideImpeccable,
  selectSectionChunks,
  type OutlineLike,
  type OutlineSectionLike,
  type GeneratedSlide,
} from "@/lib/generation/repair";
import { hasCriticalWarnings, validateOutline, validateSlides } from "@/lib/generation/validate";
import type { ExtractedChunk } from "@/lib/generation/extract";
import type { SlideSpec } from "@/core/schemas/types";
import type { DetectReport, ImpeccableFinding } from "@/core/validation/impeccable";
import { DEFAULT_PRESET_ID } from "@/core/theming/presets";

function section(patch: Partial<OutlineSectionLike>): OutlineSectionLike {
  return {
    id: "SEC-OPENING",
    name: "Opening",
    purpose: "Frame the topic",
    label: "OPENING",
    color: "#14b8a6",
    slideCount: 2,
    ...patch,
  };
}

test("normalizes model outline total/section-count mismatch before validation", () => {
  const outline: OutlineLike = {
    title: "Research Topic",
    totalSlideCount: 18,
    sections: [
      section({ id: "SEC-OPENING", slideCount: 3 }),
      section({ id: "SEC-BACKGROUND", name: "Background", label: "BACKGROUND", color: "#60a5fa", slideCount: 4 }),
      section({ id: "SEC-CORE", name: "Core Idea", label: "CORE IDEA", color: "#a78bfa", slideCount: 4 }),
      section({ id: "SEC-EVIDENCE", name: "Evidence", label: "EVIDENCE", color: "#fbbf24", slideCount: 4 }),
      section({ id: "SEC-LIMITS", name: "Limitations", label: "LIMITS", color: "#f87171", slideCount: 3 }),
      section({ id: "SEC-QUIZ", name: "Quiz", label: "CHECKPOINT", color: "#34d399", slideCount: 4 }),
    ],
  };

  const repaired = normalizeOutlineSlideCounts(outline, AUDIENCE_PROFILES.academic);
  const sum = repaired.outline.sections.reduce((total, item) => total + item.slideCount, 0);
  const quiz = repaired.outline.sections.at(-1);

  assert.equal(repaired.changed, true);
  assert.equal(repaired.outline.totalSlideCount, 18);
  assert.equal(sum, 18);
  assert.ok(quiz);
  assert.equal(quiz?.id, "SEC-QUIZ");
  assert.ok((quiz?.slideCount ?? 0) >= AUDIENCE_PROFILES.academic.quiz.minQuestions);
  assert.ok((quiz?.slideCount ?? 0) <= AUDIENCE_PROFILES.academic.quiz.maxQuestions);
  assert.equal(hasCriticalWarnings(validateOutline(repaired.outline, { audienceProfile: AUDIENCE_PROFILES.academic })), false);
});

test("repairs missing first title while preserving target slide count", () => {
  const slides: GeneratedSlide[] = [
    { type: "section-divider", label: "OPENING", color: "#14b8a6", headline: "OPENING" },
    { type: "statement", label: "CORE", color: "#a78bfa", headline: "Core idea", evidenceRefs: ["CHK-1"] },
    {
      type: "quiz",
      label: "CHECKPOINT",
      color: "#34d399",
      question: "What matters?",
      options: ["Core idea", "Nothing"],
      answer: "Core idea",
      explanation: "It is the source-backed idea.",
    },
    {
      type: "quiz",
      label: "CHECKPOINT",
      color: "#34d399",
      question: "What supports it?",
      options: ["Evidence", "Decoration"],
      answer: "Evidence",
      explanation: "The main slide cites evidence.",
    },
  ];

  const repaired = repairGeneratedDeck(slides, {
    title: "Research Topic",
    audienceProfile: AUDIENCE_PROFILES.academic,
    targetSlideCount: 4,
    defaultLabel: "OPENING",
    defaultColor: "#14b8a6",
  });

  assert.equal(repaired.changed, true);
  assert.equal(repaired.slides.length, 4);
  assert.equal(repaired.slides[0].type, "title");
  assert.deepEqual(repaired.slides.slice(-2).map((slide) => slide.type), ["quiz", "quiz"]);
  assert.equal(
    hasCriticalWarnings(validateSlides(repaired.slides, {
      audienceProfile: AUDIENCE_PROFILES.academic,
      outlineTotalSlideCount: 4,
      validChunkIds: new Set(["CHK-1"]),
    })),
    false,
  );
});

test("moves an existing title to the front instead of failing deck validation", () => {
  const slides: GeneratedSlide[] = [
    { type: "statement", label: "CORE", color: "#a78bfa", headline: "Core idea" },
    { type: "title", color: "#14b8a6", headline: "Late Title" },
    { type: "recap", label: "RECAP", color: "#14b8a6", headline: "Recap", points: ["One thing"] },
  ];

  const repaired = repairGeneratedDeck(slides, {
    title: "Fallback Title",
    audienceProfile: AUDIENCE_PROFILES.technical,
    targetSlideCount: 3,
    defaultColor: "#14b8a6",
  });

  assert.equal(repaired.slides[0].type, "title");
  assert.equal(repaired.slides[0].headline, "Late Title");
  assert.equal(hasCriticalWarnings(validateSlides(repaired.slides, {
    audienceProfile: AUDIENCE_PROFILES.technical,
    outlineTotalSlideCount: 3,
  })), false);
});

test("inserts fallback image slide for academic decks when source images exist", () => {
  const slides: GeneratedSlide[] = [
    { type: "title", color: "#14b8a6", headline: "Research Topic" },
    { type: "statement", label: "CORE", color: "#a78bfa", headline: "Core idea", evidenceRefs: ["CHK-1"] },
    {
      type: "quiz",
      label: "CHECKPOINT",
      color: "#34d399",
      question: "What matters?",
      options: ["Core idea", "Nothing"],
      answer: "Core idea",
      explanation: "It is the source-backed idea.",
    },
    {
      type: "quiz",
      label: "CHECKPOINT",
      color: "#34d399",
      question: "What supports it?",
      options: ["Evidence", "Decoration"],
      answer: "Evidence",
      explanation: "The main slide cites evidence.",
    },
  ];

  const repaired = repairGeneratedDeck(slides, {
    title: "Research Topic",
    audienceProfile: AUDIENCE_PROFILES.academic,
    targetSlideCount: 4,
    defaultLabel: "FIGURE",
    defaultColor: "#60a5fa",
    fallbackImageUrl: "/extracted/deck/page-1.png",
  });

  assert.equal(repaired.slides.length, 4);
  assert.ok(repaired.slides.some((slide) => slide.type === "image" && slide.imageUrl === "/extracted/deck/page-1.png"));
  assert.equal(
    hasCriticalWarnings(validateSlides(repaired.slides, {
      audienceProfile: AUDIENCE_PROFILES.academic,
      outlineTotalSlideCount: 4,
      validChunkIds: new Set(["CHK-1"]),
      imageCount: 1,
    })),
    false,
  );
});

test("synthesizes quiz section slides when the model returns the wrong type", () => {
  const quizSection = section({
    id: "SEC-QUIZ",
    name: "Quiz",
    purpose: "Confirm understanding",
    label: "CHECKPOINT",
    color: "#34d399",
    slideCount: 2,
  });

  const repaired = repairSectionSlides(
    [{ type: "statement", label: "CHECKPOINT", color: "#34d399", headline: "Not a quiz" }],
    {
      section: quizSection,
      deckTitle: "Research Topic",
      audienceProfile: AUDIENCE_PROFILES.academic,
      sectionChunkIds: ["CHK-1"],
    },
  );

  assert.equal(repaired.changed, true);
  assert.equal(repaired.slides.length, 2);
  assert.deepEqual(repaired.slides.map((slide) => slide.type), ["quiz", "quiz"]);
  assert.equal(
    hasCriticalWarnings(validateSlides(repaired.slides, {
      audienceProfile: AUDIENCE_PROFILES.academic,
      expectedSlideCount: 2,
      scope: "section",
      validChunkIds: new Set(["CHK-1"]),
    })),
    false,
  );
});

test("adds fallback evidence refs to academic factual slides in a bounded section", () => {
  const repaired = repairSectionSlides(
    [{ type: "statement", label: "CORE", color: "#a78bfa", headline: "Core claim" }],
    {
      section: section({ id: "SEC-CORE", name: "Core", label: "CORE", color: "#a78bfa", slideCount: 1 }),
      deckTitle: "Research Topic",
      audienceProfile: AUDIENCE_PROFILES.academic,
      sectionChunkIds: ["CHK-1"],
    },
  );

  assert.deepEqual(repaired.slides[0].evidenceRefs, ["CHK-1"]);
  assert.equal(
    hasCriticalWarnings(validateSlides(repaired.slides, {
      audienceProfile: AUDIENCE_PROFILES.academic,
      expectedSlideCount: 1,
      scope: "section",
      validChunkIds: new Set(["CHK-1"]),
    })),
    false,
  );
});

test("selects explicit candidate chunks before scoring by section text", () => {
  const chunks: ExtractedChunk[] = [
    { id: "CHK-1", text: "general background paragraph" },
    { id: "CHK-2", text: "specific methods and academic evidence paragraph" },
  ];

  const selected = selectSectionChunks(chunks, section({ candidateChunkIds: ["CHK-2"] }), "Research Topic");

  assert.deepEqual(selected.map((chunk) => chunk.id), ["CHK-2"]);
});

function makeSpec(blocks: SlideSpec["contentBlocks"]): SlideSpec {
  return {
    id: "s",
    intent: "statement",
    sectionId: "sec",
    audienceProfileId: "aud",
    themePresetId: DEFAULT_PRESET_ID,
    evidenceRefs: [],
    assetRefs: [],
    citationPolicy: "none",
    speakerNotesMode: "none",
    status: "draft",
    contentBlocks: blocks,
  };
}

test("buildImpeccableSlideRepairInput scopes prompt to offending block indices only", () => {
  const slide = makeSpec([
    { type: "headline", content: "🚀", animKey: "title" },
    { type: "supporting", content: "ok" },
    { type: "bullet-list", content: "a\nb" },
    { type: "code-block", content: "x", animKey: "code:0" },
  ]);

  const findings: ImpeccableFinding[] = [
    {
      ruleId: "emoji-as-heading",
      severity: "warn",
      message: "emoji heading",
      slideIndex: 0,
      path: "slides[0].contentBlocks[0]",
      blockIndex: 0,
    },
    {
      ruleId: "gradient-text",
      severity: "warn",
      message: "gradient on code",
      slideIndex: 0,
      path: "slides[0].contentBlocks[3]",
      blockIndex: 3,
    },
  ];

  const report: DetectReport = {
    slideIndex: 0,
    findings,
    rulesRun: ["emoji-as-heading", "gradient-text"],
    rulesSkipped: [],
    durationMs: 1,
  };

  const input = buildImpeccableSlideRepairInput(slide, report);
  assert.ok(input);
  assert.deepEqual(input!.blockIndices, [0, 3]);
  assert.match(input!.prompt, /block indices: \[0,3\]/);
  assert.match(input!.prompt, /emoji-as-heading/);
  assert.match(input!.prompt, /gradient-text/);
  // Must not ask to rewrite the clean supporting / bullet blocks as required replacements
  assert.ok(!input!.prompt.includes('"blockIndex": 1') || input!.prompt.includes("ONLY for these block indices"));
  assert.match(input!.prompt, /ONLY for these block indices/);
});

test("groupImpeccableFindingsByBlock respects severity floor", () => {
  const findings: ImpeccableFinding[] = [
    { ruleId: "a", severity: "info", message: "i", slideIndex: 0, path: "slides[0].contentBlocks[0]", blockIndex: 0 },
    { ruleId: "b", severity: "warn", message: "w", slideIndex: 0, path: "slides[0].contentBlocks[1]", blockIndex: 1 },
    { ruleId: "c", severity: "error", message: "e", slideIndex: 0, path: "slides[0].contentBlocks[2]", blockIndex: 2 },
  ];
  const map = groupImpeccableFindingsByBlock(findings, "warn");
  assert.equal(map.has(0), false);
  assert.equal(map.has(1), true);
  assert.equal(map.has(2), true);
});

test("repairSlideImpeccable caps iterations and only patches listed indices", async () => {
  const slide = makeSpec([
    { type: "headline", content: "🔥", animKey: "title" },
    { type: "supporting", content: "leave me alone" },
  ]);

  let calls = 0;
  const result = await repairSlideImpeccable(slide, {
    maxIterations: 2,
    minSeverity: "warn",
    applyReplacements: async ({ blockIndices, prompt }) => {
      calls += 1;
      assert.ok(blockIndices.includes(0));
      assert.ok(!blockIndices.includes(1));
      assert.match(prompt, /ONLY for these block indices/);
      return [{ blockIndex: 0, block: { type: "headline", content: "Fixed Headline", animKey: "title" } }];
    },
  });

  assert.ok(calls <= 2);
  assert.equal(result.iterations <= 2, true);
  assert.equal(result.slide.contentBlocks[0].content, "Fixed Headline");
  assert.equal(result.slide.contentBlocks[0].animKey, "title");
  assert.equal(result.slide.contentBlocks[1].content, "leave me alone");
  assert.ok(result.prompts.every((p) => p.includes("ONLY for these block indices")));
});
