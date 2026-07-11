import type { Slide } from "@/app/slides";
import type { ContentBlock, SlideSpec } from "@/core/schemas/types";
import type { ExtractedChunk } from "@/lib/generation/extract";
import type { GenerationAudienceProfile } from "@/lib/generation/audience";
import { buildImpeccableRepairPrompt } from "@/lib/generation/prompts";
import {
  detectSlideSpec,
  type DetectReport,
  type ImpeccableFinding,
} from "@/core/validation/impeccable";
import { DEFAULT_PRESET_ID } from "@/core/theming/presets";

export interface OutlineSectionLike {
  id: string;
  name: string;
  purpose: string;
  label: string;
  color: string;
  slideCount: number;
  candidateChunkIds?: string[];
  candidateImageIds?: string[];
}

export interface OutlineLike<TSection extends OutlineSectionLike = OutlineSectionLike> {
  title: string;
  totalSlideCount: number;
  sections: TSection[];
}

export type GeneratedSlide = Slide & { imageRef?: string };

const SECTION_CHUNK_LIMIT = 18;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 3)
  );
}

export function isQuizSection(section: Pick<OutlineSectionLike, "id" | "name" | "label" | "purpose">): boolean {
  const sectionText = `${section.id} ${section.name} ${section.label} ${section.purpose}`.toLowerCase();
  return sectionText.includes("quiz") || sectionText.includes("checkpoint");
}

function rebalanceSlideCounts<TSection extends OutlineSectionLike>(sections: TSection[], indexes: number[], target: number) {
  if (indexes.length === 0) return;
  const safeTarget = Math.max(indexes.length, target);
  const remaining = safeTarget - indexes.length;
  const weights = indexes.map((index) => Math.max(1, Math.round(sections[index].slideCount)));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0) || indexes.length;
  const allocations = indexes.map((index, i) => {
    const exact = (remaining * weights[i]) / weightTotal;
    const extra = Math.floor(exact);
    return { index, count: 1 + extra, remainder: exact - extra };
  });

  let leftover = safeTarget - allocations.reduce((sum, item) => sum + item.count, 0);
  allocations
    .sort((a, b) => b.remainder - a.remainder)
    .forEach((item) => {
      if (leftover <= 0) return;
      item.count += 1;
      leftover -= 1;
    });

  for (const item of allocations) {
    sections[item.index].slideCount = item.count;
  }
}

export function normalizeOutlineSlideCounts<TSection extends OutlineSectionLike>(
  outline: OutlineLike<TSection>,
  audienceProfile: GenerationAudienceProfile,
): { outline: OutlineLike<TSection>; changed: boolean; message?: string } {
  const originalSum = outline.sections.reduce((sum, section) => sum + (Number.isFinite(section.slideCount) ? section.slideCount : 0), 0);
  const [minSlides, maxSlides] = audienceProfile.slideRange;
  const sectionMinimum = outline.sections.length;
  const requestedTotal = Number.isFinite(outline.totalSlideCount) ? Math.round(outline.totalSlideCount) : originalSum;
  const targetTotal = clamp(Math.max(sectionMinimum, requestedTotal), minSlides, maxSlides);

  const sections = outline.sections.map((section) => ({
    ...section,
    slideCount: Math.max(1, Number.isFinite(section.slideCount) ? Math.round(section.slideCount) : 1),
  })) as TSection[];

  let quizIndex = -1;
  if (audienceProfile.quiz.enabled) {
    for (let index = sections.length - 1; index >= 0; index--) {
      if (isQuizSection(sections[index])) {
        quizIndex = index;
        break;
      }
    }
  }

  if (quizIndex >= 0) {
    const nonQuizIndexes = sections.map((_, index) => index).filter((index) => index !== quizIndex);
    const maxQuizForTarget = Math.max(1, targetTotal - nonQuizIndexes.length);
    sections[quizIndex].slideCount = clamp(
      sections[quizIndex].slideCount,
      audienceProfile.quiz.minQuestions,
      Math.min(audienceProfile.quiz.maxQuestions, maxQuizForTarget),
    );
    rebalanceSlideCounts(sections, nonQuizIndexes, targetTotal - sections[quizIndex].slideCount);
  } else {
    rebalanceSlideCounts(sections, sections.map((_, index) => index), targetTotal);
  }

  const normalizedSum = sections.reduce((sum, section) => sum + section.slideCount, 0);
  const changed = normalizedSum !== originalSum || targetTotal !== outline.totalSlideCount;

  return {
    outline: { ...outline, totalSlideCount: normalizedSum, sections },
    changed,
    message: changed
      ? `Adjusted outline from total ${outline.totalSlideCount} / section sum ${originalSum} to ${normalizedSum}.`
      : undefined,
  };
}

export function selectSectionChunks(
  chunks: ExtractedChunk[],
  section: OutlineSectionLike,
  deckTitle: string,
): ExtractedChunk[] {
  if (chunks.length === 0) return [];

  const candidateIds = new Set(section.candidateChunkIds?.filter(Boolean) ?? []);
  const candidateChunks = candidateIds.size > 0
    ? chunks.filter((chunk) => candidateIds.has(chunk.id))
    : [];
  if (candidateChunks.length > 0) return candidateChunks.slice(0, SECTION_CHUNK_LIMIT);

  const queryTokens = tokenise(`${deckTitle} ${section.name} ${section.purpose} ${section.label}`);
  const scored = chunks
    .map((chunk, index) => {
      const text = chunk.text.toLowerCase();
      let score = 0;
      for (const token of queryTokens) {
        if (text.includes(token)) score += 1;
      }
      return { chunk, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const relevant = scored.filter((item) => item.score > 0).slice(0, SECTION_CHUNK_LIMIT).map((item) => item.chunk);
  return relevant.length > 0 ? relevant : chunks.slice(0, SECTION_CHUNK_LIMIT);
}

export function formatSectionChunks(chunks: ExtractedChunk[], isCandidateList: boolean): string {
  if (chunks.length === 0) return "";
  const label = isCandidateList ? "Candidate chunks for this section" : "Reference chunks for this section";
  return `\n${label}:\n${chunks
    .map((c) => `${c.id}: ${c.text.slice(0, 500)}`)
    .join("\n")}`;
}

function firstChunkRef(sectionChunkIds: string[] | undefined): string[] | undefined {
  const first = sectionChunkIds?.find(Boolean);
  return first ? [first] : undefined;
}

function makeTitleSlide(title: string, color: string): GeneratedSlide {
  return {
    type: "title",
    headline: title,
    subtitle: "Generated from source material",
    color,
  };
}

function makeRecapSlide(title: string, label: string, color: string): GeneratedSlide {
  return {
    type: "recap",
    label,
    color,
    headline: "Recap",
    points: [
      `${title} — the core idea`,
      "Evidence — the source-backed support",
      "Next step — review the key takeaways",
    ],
  };
}

function makeImageSlide(title: string, label: string, color: string, imageUrl: string): GeneratedSlide {
  return {
    type: "image",
    label,
    color,
    headline: "Important source figure",
    supporting: `Use this figure to ground the explanation of ${title}.`,
    imageUrl,
    imageLayout: "side",
  };
}

function makeQuizSlide(
  index: number,
  section: Pick<OutlineSectionLike, "label" | "color" | "name" | "purpose">,
  deckTitle: string,
  evidenceRefs?: string[],
): GeneratedSlide {
  const questions = [
    {
      question: `What is the central idea of ${deckTitle}?`,
      answer: "The core idea explained in the main slides",
      explanation: "The main body of the deck establishes the core idea before supporting it with evidence.",
    },
    {
      question: "Which evidence point best supports the topic?",
      answer: "The source-backed claim cited in the deck",
      explanation: "The correct answer should be traceable to the evidence references shown on the related slide.",
    },
    {
      question: `Why does ${section.name} matter?`,
      answer: "It explains how the topic should be interpreted or applied",
      explanation: section.purpose || "This section connects the source material to the audience's understanding.",
    },
    {
      question: "What should you check before applying this idea?",
      answer: "The assumptions and limitations",
      explanation: "Academic decks should verify understanding of both the claim and its limits.",
    },
  ];
  const picked = questions[index % questions.length];
  return {
    type: "quiz",
    label: section.label,
    color: section.color,
    headline: "Checkpoint",
    question: picked.question,
    options: [
      picked.answer,
      "A detail that was not supported by the source",
      "A visual styling choice only",
      "An unrelated background fact",
    ],
    answer: picked.answer,
    explanation: picked.explanation,
    evidenceRefs,
    notes: [
      "Key point: Confirm the audience can connect the answer back to the source.",
      "- Ask the question before revealing the answer.",
      "- Tie the explanation to the previous section.",
      "Transition: Use the response to identify what needs clarifying.",
    ].join("\n"),
  };
}

function slideNeedsEvidence(slide: GeneratedSlide, audienceProfile: GenerationAudienceProfile): boolean {
  if (["quote", "big-number", "comparison", "code", "chart"].includes(slide.type)) return true;
  if (!audienceProfile.validation.requireEvidenceOnFactualSlides) return false;
  return !["title", "goals", "section-divider", "recap", "quiz"].includes(slide.type);
}

export function repairSectionSlides(
  slides: GeneratedSlide[],
  options: {
    section: OutlineSectionLike;
    deckTitle: string;
    audienceProfile: GenerationAudienceProfile;
    sectionChunkIds?: string[];
  },
): { slides: GeneratedSlide[]; changed: boolean } {
  const { section, deckTitle, audienceProfile, sectionChunkIds } = options;
  const evidenceFallback = firstChunkRef(sectionChunkIds);
  let changed = false;

  if (isQuizSection(section)) {
    const source = slides.filter((slide) => slide.type === "quiz");
    const repaired = Array.from({ length: section.slideCount }, (_, index) => {
      const existing = source[index];
      if (!existing) {
        changed = true;
        return makeQuizSlide(index, section, deckTitle, evidenceFallback);
      }
      const quiz = {
        ...existing,
        type: "quiz" as const,
        label: existing.label || section.label,
        color: existing.color || section.color,
        headline: existing.headline || "Checkpoint",
        question: existing.question || makeQuizSlide(index, section, deckTitle, evidenceFallback).question,
        options: existing.options?.filter(Boolean).length && existing.options.length >= 2
          ? existing.options
          : makeQuizSlide(index, section, deckTitle, evidenceFallback).options,
        answer: existing.answer || makeQuizSlide(index, section, deckTitle, evidenceFallback).answer,
        explanation: existing.explanation || makeQuizSlide(index, section, deckTitle, evidenceFallback).explanation,
        evidenceRefs: existing.evidenceRefs?.length ? existing.evidenceRefs : evidenceFallback,
      };
      changed = changed || quiz !== existing;
      return quiz;
    });
    return { slides: repaired, changed: changed || repaired.length !== slides.length };
  }

  const repaired = slides.map((slide) => {
    const next: GeneratedSlide = {
      ...slide,
      label: slide.type === "title" ? slide.label : slide.label || section.label,
      color: slide.color || section.color,
    };
    if (slideNeedsEvidence(next, audienceProfile) && !next.evidenceRefs?.length && evidenceFallback) {
      next.evidenceRefs = evidenceFallback;
    }
    if (next !== slide && (next.label !== slide.label || next.color !== slide.color || next.evidenceRefs !== slide.evidenceRefs)) {
      changed = true;
    }
    return next;
  });

  return { slides: repaired, changed };
}

function removeOneOverflowSlide(slides: GeneratedSlide[], audienceProfile: GenerationAudienceProfile): boolean {
  const minQuiz = audienceProfile.quiz.enabled ? audienceProfile.quiz.minQuestions : 0;
  const quizCount = slides.filter((slide) => slide.type === "quiz").length;
  const protectImage = audienceProfile.validation.requireImageWhenAvailable && slides.some((slide) => slide.type === "image" && slide.imageUrl);
  const removableIndex = slides.findIndex((slide, index) => index > 0 && slide.type === "section-divider");
  if (removableIndex > 0) {
    slides.splice(removableIndex, 1);
    return true;
  }

  for (let index = slides.length - 1; index > 0; index--) {
    const slide = slides[index];
    if (slide.type === "quiz" && quizCount <= minQuiz) continue;
    if (protectImage && slide.type === "image" && slide.imageUrl) continue;
    if (slide.type !== "recap" && slide.type !== "title") {
      slides.splice(index, 1);
      return true;
    }
  }

  if (slides.length > 1) {
    slides.splice(slides.length - 1, 1);
    return true;
  }
  return false;
}

export function repairGeneratedDeck(
  slides: GeneratedSlide[],
  options: {
    title: string;
    audienceProfile: GenerationAudienceProfile;
    targetSlideCount?: number;
    defaultLabel?: string;
    defaultColor?: string;
    fallbackImageUrl?: string;
  },
): { slides: GeneratedSlide[]; changed: boolean; messages: string[] } {
  const { title, audienceProfile, targetSlideCount, defaultLabel = "RECAP", defaultColor = "#14b8a6", fallbackImageUrl } = options;
  const messages: string[] = [];
  let changed = false;
  let repaired = slides.map((slide) => ({ ...slide }));

  const existingTitleIndex = repaired.findIndex((slide) => slide.type === "title");
  if (existingTitleIndex > 0) {
    const [titleSlide] = repaired.splice(existingTitleIndex, 1);
    repaired.unshift({
      ...titleSlide,
      headline: titleSlide.headline || title,
      color: titleSlide.color || defaultColor,
    });
    changed = true;
    messages.push("Moved existing title slide to the front.");
  } else if (existingTitleIndex === -1) {
    repaired.unshift(makeTitleSlide(title, defaultColor));
    changed = true;
    messages.push("Inserted missing title slide.");
  } else {
    const titleSlide = repaired[0];
    if (!titleSlide.headline || !titleSlide.color) {
      repaired[0] = { ...titleSlide, headline: titleSlide.headline || title, color: titleSlide.color || defaultColor };
      changed = true;
      messages.push("Filled missing title slide fields.");
    }
  }

  if (audienceProfile.quiz.enabled) {
    const quizSlides = repaired.filter((slide) => slide.type === "quiz").slice(0, audienceProfile.quiz.maxQuestions);
    while (quizSlides.length < audienceProfile.quiz.minQuestions) {
      quizSlides.push(makeQuizSlide(quizSlides.length, {
        label: defaultLabel,
        color: defaultColor,
        name: title,
        purpose: "Confirm audience understanding",
      }, title));
      changed = true;
      messages.push("Inserted fallback quiz slide.");
    }
    const nonQuizSlides = repaired.filter((slide) => slide.type !== "quiz");
    if (quizSlides.length !== repaired.filter((slide) => slide.type === "quiz").length) {
      changed = true;
      messages.push("Trimmed excess quiz slides.");
    }
    repaired = [...nonQuizSlides, ...quizSlides];
  } else if (repaired.some((slide) => slide.type === "quiz")) {
    repaired = repaired.filter((slide) => slide.type !== "quiz");
    changed = true;
    messages.push("Removed quiz slides for non-quiz audience.");
  }

  if (
    audienceProfile.validation.requireImageWhenAvailable &&
    fallbackImageUrl &&
    !repaired.some((slide) => slide.type === "image" && slide.imageUrl)
  ) {
    const insertAt = Math.max(1, repaired.findIndex((slide) => slide.type === "quiz"));
    const imageSlide = makeImageSlide(title, defaultLabel, defaultColor, fallbackImageUrl);
    if (insertAt > 0) repaired.splice(insertAt, 0, imageSlide);
    else repaired.splice(Math.min(2, repaired.length), 0, imageSlide);
    changed = true;
    messages.push("Inserted fallback source image slide.");
  }

  if (typeof targetSlideCount === "number") {
    while (repaired.length > targetSlideCount && removeOneOverflowSlide(repaired, audienceProfile)) {
      changed = true;
      messages.push("Removed overflow slide to match outline count.");
    }
    while (repaired.length < targetSlideCount) {
      const insertAt = audienceProfile.quiz.enabled
        ? repaired.findIndex((slide) => slide.type === "quiz")
        : -1;
      const recap = makeRecapSlide(title, defaultLabel, defaultColor);
      if (insertAt >= 0) repaired.splice(insertAt, 0, recap);
      else repaired.push(recap);
      changed = true;
      messages.push("Inserted fallback recap slide to match outline count.");
    }
  }

  if (!audienceProfile.quiz.enabled) {
    const last = repaired[repaired.length - 1];
    if (last && last.type !== "statement" && last.type !== "recap") {
      repaired[repaired.length - 1] = makeRecapSlide(title, defaultLabel, defaultColor);
      changed = true;
      messages.push("Replaced invalid closing slide with recap.");
    }
  }

  return { slides: repaired, changed, messages };
}

// ─── Impeccable-constrained repair ───────────────────────────────────

const DEFAULT_IMPECCABLE_MAX_ITERATIONS = 2;

export type ImpeccableRepairSeverityFloor = "info" | "warn" | "error";

const SEVERITY_RANK: Record<string, number> = { info: 0, warn: 1, error: 2 };

export function groupImpeccableFindingsByBlock(
  findings: ImpeccableFinding[],
  minSeverity: ImpeccableRepairSeverityFloor = "warn",
): Map<number, ImpeccableFinding[]> {
  const floor = SEVERITY_RANK[minSeverity] ?? 1;
  const map = new Map<number, ImpeccableFinding[]>();
  for (const f of findings) {
    if ((SEVERITY_RANK[f.severity] ?? 0) < floor) continue;
    if (f.blockIndex === undefined) continue;
    const list = map.get(f.blockIndex) ?? [];
    list.push(f);
    map.set(f.blockIndex, list);
  }
  return map;
}

/**
 * Build the constrained Impeccable repair user prompt for one slide.
 * Exported for tests and for callers that own the LLM client.
 */
export function buildImpeccableSlideRepairInput(
  slide: SlideSpec,
  report: DetectReport,
  options?: {
    minSeverity?: ImpeccableRepairSeverityFloor;
    maxIterations?: number;
    attempt?: number;
  },
): {
  blockIndices: number[];
  prompt: string;
  findings: ImpeccableFinding[];
} | null {
  const minSeverity = options?.minSeverity ?? "warn";
  const grouped = groupImpeccableFindingsByBlock(report.findings, minSeverity);
  const blockIndices = [...grouped.keys()].sort((a, b) => a - b);
  if (blockIndices.length === 0) return null;

  const relevant = report.findings.filter(
    (f) =>
      (SEVERITY_RANK[f.severity] ?? 0) >= (SEVERITY_RANK[minSeverity] ?? 1) &&
      (f.blockIndex === undefined || blockIndices.includes(f.blockIndex)),
  );

  const prompt = buildImpeccableRepairPrompt({
    slideIndex: report.slideIndex,
    findings: relevant,
    contentBlocks: slide.contentBlocks,
    blockIndices,
    maxIterations: options?.maxIterations ?? DEFAULT_IMPECCABLE_MAX_ITERATIONS,
    attempt: options?.attempt ?? 1,
  });

  return { blockIndices, prompt, findings: relevant };
}

export interface ImpeccableRepairAttemptResult {
  slide: SlideSpec;
  reports: DetectReport[];
  iterations: number;
  changed: boolean;
  prompts: string[];
  /** True when remaining findings still meet the severity floor after the cap. */
  stillDirty: boolean;
}

/**
 * Apply block-scoped replacements and re-detect up to maxIterations.
 * `applyReplacements` is injected so unit tests can run without an LLM.
 */
export async function repairSlideImpeccable(
  slide: SlideSpec,
  options: {
    themePresetId?: string;
    slideIndex?: number;
    maxIterations?: number;
    minSeverity?: ImpeccableRepairSeverityFloor;
    applyReplacements: (input: {
      slide: SlideSpec;
      blockIndices: number[];
      prompt: string;
      findings: ImpeccableFinding[];
      attempt: number;
    }) => Promise<Array<{ blockIndex: number; block: ContentBlock }>> | Array<{ blockIndex: number; block: ContentBlock }>;
  },
): Promise<ImpeccableRepairAttemptResult> {
  const maxIterations = options.maxIterations ?? DEFAULT_IMPECCABLE_MAX_ITERATIONS;
  const theme = options.themePresetId ?? slide.themePresetId ?? DEFAULT_PRESET_ID;
  const slideIndex = options.slideIndex ?? 0;
  const minSeverity = options.minSeverity ?? "warn";

  let current: SlideSpec = {
    ...slide,
    contentBlocks: slide.contentBlocks.map((b) => ({ ...b })),
  };
  const reports: DetectReport[] = [];
  const prompts: string[] = [];
  let changed = false;
  let iterations = 0;

  for (let attempt = 1; attempt <= maxIterations; attempt++) {
    const report = detectSlideSpec(current, theme, slideIndex);
    reports.push(report);
    const repairInput = buildImpeccableSlideRepairInput(current, report, {
      minSeverity,
      maxIterations,
      attempt,
    });
    if (!repairInput) break;

    iterations = attempt;
    prompts.push(repairInput.prompt);
    const replacements = await options.applyReplacements({
      slide: current,
      blockIndices: repairInput.blockIndices,
      prompt: repairInput.prompt,
      findings: repairInput.findings,
      attempt,
    });

    const nextBlocks = current.contentBlocks.map((b) => ({ ...b }));
    for (const rep of replacements) {
      if (!repairInput.blockIndices.includes(rep.blockIndex)) continue;
      if (rep.blockIndex < 0 || rep.blockIndex >= nextBlocks.length) continue;
      // Preserve animKey unless the replacement explicitly sets one
      const prev = nextBlocks[rep.blockIndex];
      nextBlocks[rep.blockIndex] = {
        ...rep.block,
        animKey: rep.block.animKey ?? prev.animKey,
      };
      changed = true;
    }
    current = { ...current, contentBlocks: nextBlocks };
  }

  // Final re-detect after last apply (or when no repair needed, reports already has one)
  if (iterations > 0) {
    reports.push(detectSlideSpec(current, theme, slideIndex));
  } else if (reports.length === 0) {
    reports.push(detectSlideSpec(current, theme, slideIndex));
  }

  const last = reports[reports.length - 1];
  const stillDirty = groupImpeccableFindingsByBlock(last.findings, minSeverity).size > 0;

  return { slide: current, reports, iterations, changed, prompts, stillDirty };
}

