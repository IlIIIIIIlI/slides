import test from "node:test";
import assert from "node:assert/strict";

import { AUDIENCE_PROFILES } from "@/lib/generation/audience";
import {
  normalizeOutlineSlideCounts,
  repairGeneratedDeck,
  repairSectionSlides,
  selectSectionChunks,
  type OutlineLike,
  type OutlineSectionLike,
  type GeneratedSlide,
} from "@/lib/generation/repair";
import { hasCriticalWarnings, validateOutline, validateSlides } from "@/lib/generation/validate";
import type { ExtractedChunk } from "@/lib/generation/extract";

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
