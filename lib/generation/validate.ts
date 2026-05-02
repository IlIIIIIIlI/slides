// Runtime validation for model-generated outline and Slide[] output.
// This runs on the prompt-output schema before generated decks are persisted.

import type { Slide } from "@/app/slides";
import type { GenerationAudienceProfile } from "@/lib/generation/audience";

const HEADLINE_MAX = 80;
const SUPPORTING_MAX = 200;
const POINTS_MAX = 5;

type GeneratedSlide = Slide & { imageRef?: string };

export type SlideWarningSeverity = "warning" | "critical";

export interface SlideWarning {
  slideIndex: number;
  field: string;
  message: string;
  severity: SlideWarningSeverity;
}

export interface OutlineValidationSection {
  id?: unknown;
  name?: unknown;
  purpose?: unknown;
  label?: unknown;
  color?: unknown;
  slideCount?: unknown;
  candidateChunkIds?: unknown;
  candidateImageIds?: unknown;
}

export interface OutlineValidationInput {
  title?: unknown;
  totalSlideCount?: unknown;
  sections?: OutlineValidationSection[];
}

export interface ValidateOutlineOptions {
  audienceProfile: GenerationAudienceProfile;
  validChunkIds?: Set<string>;
  validImageIds?: Set<string>;
}

export interface ValidateSlidesOptions {
  audienceProfile?: GenerationAudienceProfile;
  outlineTotalSlideCount?: number;
  expectedSlideCount?: number;
  scope?: "deck" | "section";
  validChunkIds?: Set<string>;
  validImageIds?: Set<string>;
  imageCount?: number;
}

const ALLOWED_SLIDE_TYPES = new Set<Slide["type"]>([
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
  "agent-tree",
  "quiz",
  "chart",
]);

const ALWAYS_EVIDENCE_TYPES = new Set<Slide["type"]>([
  "quote",
  "big-number",
  "comparison",
  "code",
  "chart",
]);

const FRAMING_TYPES = new Set<Slide["type"]>([
  "title",
  "goals",
  "section-divider",
  "recap",
  "quiz",
]);

function issue(
  slideIndex: number,
  field: string,
  message: string,
  severity: SlideWarningSeverity = "warning",
): SlideWarning {
  return { slideIndex, field, message, severity };
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function hasItems(value: unknown): value is string[] {
  return isStringArray(value) && value.filter((item) => item.trim()).length > 0;
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function joinRefList(value: unknown): string[] {
  return isStringArray(value) ? value : [];
}

function pushMissing(warnings: SlideWarning[], index: number, field: string, type: string) {
  warnings.push(issue(index, field, `${type} slide is missing required field "${field}".`, "critical"));
}

export function validateOutline(
  outline: OutlineValidationInput,
  options: ValidateOutlineOptions,
): SlideWarning[] {
  const warnings: SlideWarning[] = [];
  const { audienceProfile, validChunkIds, validImageIds } = options;

  if (!isString(outline.title)) {
    warnings.push(issue(-1, "outline.title", "Outline is missing a title.", "critical"));
  }

  if (!Array.isArray(outline.sections) || outline.sections.length === 0) {
    warnings.push(issue(-1, "outline.sections", "Outline must include at least one section.", "critical"));
    return warnings;
  }

  if (typeof outline.totalSlideCount !== "number" || !Number.isFinite(outline.totalSlideCount)) {
    warnings.push(issue(-1, "outline.totalSlideCount", "Outline totalSlideCount must be a number.", "critical"));
  } else {
    const [minSlides, maxSlides] = audienceProfile.slideRange;
    if (outline.totalSlideCount < minSlides || outline.totalSlideCount > maxSlides) {
      warnings.push(issue(
        -1,
        "outline.totalSlideCount",
        `Outline totalSlideCount ${outline.totalSlideCount} is outside ${audienceProfile.label} range ${minSlides}-${maxSlides}.`,
        "critical",
      ));
    }
  }

  let sum = 0;
  let quizSections = 0;
  outline.sections.forEach((section, i) => {
    const prefix = `outline.sections[${i}]`;
    if (!isString(section.id)) warnings.push(issue(-1, `${prefix}.id`, "Section is missing id.", "critical"));
    if (!isString(section.name)) warnings.push(issue(-1, `${prefix}.name`, "Section is missing name.", "critical"));
    if (!isString(section.purpose)) warnings.push(issue(-1, `${prefix}.purpose`, "Section is missing purpose.", "critical"));
    if (!isString(section.label)) warnings.push(issue(-1, `${prefix}.label`, "Section is missing label.", "critical"));
    if (!isHexColor(section.color)) warnings.push(issue(-1, `${prefix}.color`, "Section color must be a hex color.", "critical"));

    if (typeof section.slideCount !== "number" || !Number.isInteger(section.slideCount) || section.slideCount < 1) {
      warnings.push(issue(-1, `${prefix}.slideCount`, "Section slideCount must be a positive integer.", "critical"));
    } else {
      sum += section.slideCount;
    }

    const idText = `${section.id ?? ""} ${section.name ?? ""} ${section.label ?? ""} ${section.purpose ?? ""}`.toLowerCase();
    if (idText.includes("quiz") || idText.includes("checkpoint")) quizSections++;

    for (const ref of joinRefList(section.candidateChunkIds)) {
      if (validChunkIds && !validChunkIds.has(ref)) {
        warnings.push(issue(-1, `${prefix}.candidateChunkIds`, `Unknown chunk id "${ref}".`, "critical"));
      }
    }
    for (const ref of joinRefList(section.candidateImageIds)) {
      if (validImageIds && !validImageIds.has(ref)) {
        warnings.push(issue(-1, `${prefix}.candidateImageIds`, `Unknown image id "${ref}".`, "critical"));
      }
    }
  });

  if (typeof outline.totalSlideCount === "number" && Number.isFinite(outline.totalSlideCount) && sum !== outline.totalSlideCount) {
    warnings.push(issue(
      -1,
      "outline.totalSlideCount",
      `Outline totalSlideCount ${outline.totalSlideCount} does not equal section slideCount sum ${sum}.`,
      "critical",
    ));
  }

  if (audienceProfile.quiz.enabled && quizSections === 0) {
    warnings.push(issue(
      -1,
      "outline.sections",
      `${audienceProfile.label} decks must include a final quiz/checkpoint section.`,
      "critical",
    ));
  }
  if (audienceProfile.quiz.enabled && quizSections > 0) {
    const lastSection = outline.sections[outline.sections.length - 1];
    const lastText = `${lastSection?.id ?? ""} ${lastSection?.name ?? ""} ${lastSection?.label ?? ""} ${lastSection?.purpose ?? ""}`.toLowerCase();
    if (!lastText.includes("quiz") && !lastText.includes("checkpoint")) {
      warnings.push(issue(
        -1,
        "outline.sections",
        `${audienceProfile.label} quiz/checkpoint section must be the final section.`,
        "critical",
      ));
    }
  }
  if (!audienceProfile.quiz.enabled && quizSections > 0) {
    warnings.push(issue(
      -1,
      "outline.sections",
      `Quiz/checkpoint sections are not enabled for ${audienceProfile.label} decks.`,
      "critical",
    ));
  }

  return warnings;
}

export function validateSlides(slides: GeneratedSlide[], options: ValidateSlidesOptions = {}): SlideWarning[] {
  const warnings: SlideWarning[] = [];
  const {
    audienceProfile,
    outlineTotalSlideCount,
    expectedSlideCount,
    scope = "deck",
    validChunkIds,
    validImageIds,
    imageCount = 0,
  } = options;

  if (slides.length === 0) {
    warnings.push(issue(-1, "slides", "No slides produced.", "critical"));
    return warnings;
  }

  const targetSlideCount = expectedSlideCount ?? outlineTotalSlideCount;
  if (typeof targetSlideCount === "number" && slides.length !== targetSlideCount) {
    warnings.push(issue(
      -1,
      "slides",
      `Generated ${slides.length} slides, but expected ${targetSlideCount}.`,
      "critical",
    ));
  }

  if (scope === "deck" && slides[0].type !== "title") {
    warnings.push(issue(0, "type", "First slide should be type 'title'.", "critical"));
  }

  const quizEnabled = audienceProfile?.quiz.enabled ?? false;
  const last = slides[slides.length - 1];
  if (scope === "deck" && quizEnabled) {
    const quizSlides = slides.filter((s) => s.type === "quiz").length;
    const minQuestions = audienceProfile?.quiz.minQuestions ?? 0;
    const maxQuestions = audienceProfile?.quiz.maxQuestions ?? Number.POSITIVE_INFINITY;
    if (quizSlides < minQuestions || quizSlides > maxQuestions) {
      warnings.push(issue(
        -1,
        "slides.quiz",
        `Expected ${minQuestions}-${maxQuestions} quiz slides, received ${quizSlides}.`,
        "critical",
      ));
    }
    const firstQuizIndex = slides.findIndex((s) => s.type === "quiz");
    if (firstQuizIndex !== -1 && slides.slice(firstQuizIndex).some((s) => s.type !== "quiz")) {
      warnings.push(issue(firstQuizIndex, "type", "Quiz slides must appear after the main content slides.", "critical"));
    }
  } else if (scope === "deck" && last.type !== "statement" && last.type !== "recap") {
    warnings.push(issue(slides.length - 1, "type", "Last slide should be 'statement' or 'recap'."));
  }

  if (scope === "deck" && audienceProfile?.validation.requireImageWhenAvailable && imageCount > 0) {
    const hasImageSlide = slides.some((s) => s.type === "image" && (isString(s.imageUrl) || isString(s.imageRef)));
    if (!hasImageSlide) {
      warnings.push(issue(-1, "slides.image", `${audienceProfile.label} decks should include at least one source image or figure slide.`, "critical"));
    }
  }

  slides.forEach((s, i) => {
    if (!ALLOWED_SLIDE_TYPES.has(s.type)) {
      warnings.push(issue(i, "type", `Unsupported slide type "${String(s.type)}".`, "critical"));
      return;
    }

    if (s.headline && s.headline.length > HEADLINE_MAX) {
      warnings.push(issue(i, "headline", `Headline ${s.headline.length} chars (max ${HEADLINE_MAX}).`));
    }
    if (s.supporting && s.supporting.length > SUPPORTING_MAX) {
      warnings.push(issue(i, "supporting", `Supporting ${s.supporting.length} chars (max ${SUPPORTING_MAX}).`));
    }
    if (s.points && s.points.length > POINTS_MAX) {
      warnings.push(issue(i, "points", `${s.points.length} points (max ${POINTS_MAX}).`));
    }
    if (!isHexColor(s.color)) {
      warnings.push(issue(i, "color", "Slide missing valid hex color.", "critical"));
    }
    if (!isString(s.label) && s.type !== "title") {
      warnings.push(issue(i, "label", "Slide missing section label."));
    }

    switch (s.type) {
      case "title":
      case "section-divider":
      case "statement":
        if (!isString(s.headline)) pushMissing(warnings, i, "headline", s.type);
        break;
      case "goals":
      case "framework":
        if (!isString(s.headline)) pushMissing(warnings, i, "headline", s.type);
        if (!hasItems(s.points)) pushMissing(warnings, i, "points", s.type);
        break;
      case "recap":
        if (!isString(s.headline)) pushMissing(warnings, i, "headline", s.type);
        if (s.variant === "resources") {
          const hasResources = Array.isArray(s.resources) && s.resources.some((g) => Array.isArray(g.items) && g.items.length > 0);
          if (!hasResources) pushMissing(warnings, i, "resources", s.type);
        } else if (!hasItems(s.points)) {
          pushMissing(warnings, i, "points", s.type);
        }
        break;
      case "quote":
        if (!isString(s.quote)) pushMissing(warnings, i, "quote", s.type);
        if (!isString(s.author)) pushMissing(warnings, i, "author", s.type);
        break;
      case "big-number":
        if (!isString(s.headline)) pushMissing(warnings, i, "headline", s.type);
        if (s.variant === "metrics-row") {
          const hasMetrics = Array.isArray(s.metrics)
            && s.metrics.length >= 2
            && s.metrics.every((m) => isString(m.value) && isString(m.label));
          if (!hasMetrics) pushMissing(warnings, i, "metrics", s.type);
        } else if (!isString(s.bigNumber)) {
          pushMissing(warnings, i, "bigNumber", s.type);
        }
        break;
      case "code":
        if (!isString(s.headline)) pushMissing(warnings, i, "headline", s.type);
        if (!isString(s.code)) pushMissing(warnings, i, "code", s.type);
        break;
      case "image":
        if (!isString(s.headline)) pushMissing(warnings, i, "headline", s.type);
        if (!isString(s.imageUrl) && !isString(s.imageRef)) pushMissing(warnings, i, "imageUrl", s.type);
        break;
      case "split-visual":
        if (!isString(s.headline)) pushMissing(warnings, i, "headline", s.type);
        if (s.variant === "ui-mockup") {
          if (!isString(s.leftContent)) pushMissing(warnings, i, "leftContent", s.type);
          if (s.mockupKind !== "browser" && s.mockupKind !== "terminal" && s.mockupKind !== "file-tree" && s.mockupKind !== "card") {
            warnings.push(issue(i, "mockupKind", "ui-mockup variant requires mockupKind ('browser' | 'terminal' | 'file-tree' | 'card').", "critical"));
          }
          if (!isString(s.mockupContent)) pushMissing(warnings, i, "mockupContent", s.type);
        } else {
          if (!isString(s.leftContent)) pushMissing(warnings, i, "leftContent", s.type);
          if (!isString(s.rightContent)) pushMissing(warnings, i, "rightContent", s.type);
        }
        break;
      case "comparison":
        if (!isString(s.headline)) pushMissing(warnings, i, "headline", s.type);
        if (s.variant === "stats") {
          if (!isString(s.beforeNumber)) pushMissing(warnings, i, "beforeNumber", s.type);
          if (!isString(s.afterNumber)) pushMissing(warnings, i, "afterNumber", s.type);
          if (!isString(s.beforeLabel)) pushMissing(warnings, i, "beforeLabel", s.type);
          if (!isString(s.afterLabel)) pushMissing(warnings, i, "afterLabel", s.type);
        } else {
          if (!hasItems(s.beforePoints)) pushMissing(warnings, i, "beforePoints", s.type);
          if (!hasItems(s.afterPoints)) pushMissing(warnings, i, "afterPoints", s.type);
        }
        break;
      case "chart":
        if (!isString(s.headline)) pushMissing(warnings, i, "headline", s.type);
        if (s.chartKind !== "line" && s.chartKind !== "bar") {
          warnings.push(issue(i, "chartKind", "Chart slide must specify chartKind 'line' or 'bar'.", "critical"));
        }
        if (!s.chartData || !Array.isArray(s.chartData.xLabels) || s.chartData.xLabels.length === 0) {
          warnings.push(issue(i, "chartData.xLabels", "Chart slide is missing xLabels.", "critical"));
        }
        if (!s.chartData || !Array.isArray(s.chartData.series) || s.chartData.series.length === 0) {
          warnings.push(issue(i, "chartData.series", "Chart slide is missing series.", "critical"));
        } else {
          s.chartData.series.forEach((ser, sj) => {
            if (!isString(ser.label)) {
              warnings.push(issue(i, `chartData.series[${sj}].label`, "Series missing label.", "critical"));
            }
            if (!Array.isArray(ser.points) || ser.points.length === 0 || !ser.points.every((p) => typeof p === "number" && Number.isFinite(p))) {
              warnings.push(issue(i, `chartData.series[${sj}].points`, "Series points must be a non-empty number array.", "critical"));
            }
          });
        }
        break;
      case "iframe":
        if (!isString(s.iframeUrl)) pushMissing(warnings, i, "iframeUrl", s.type);
        break;
      case "agent-tree":
        if (!isString(s.headline)) pushMissing(warnings, i, "headline", s.type);
        break;
      case "quiz":
        if (!quizEnabled) {
          warnings.push(issue(i, "type", "Quiz slides are only enabled for this audience when requested by the profile.", "critical"));
        }
        if (!isString(s.question)) pushMissing(warnings, i, "question", s.type);
        if (!isStringArray(s.options) || s.options.filter((opt) => opt.trim()).length < 2) {
          warnings.push(issue(i, "options", "Quiz slide must include at least two options.", "critical"));
        }
        if (!isString(s.answer)) pushMissing(warnings, i, "answer", s.type);
        if (!isString(s.explanation)) pushMissing(warnings, i, "explanation", s.type);
        break;
    }

    const evidenceRefs = joinRefList(s.evidenceRefs);
    for (const ref of evidenceRefs) {
      if (validChunkIds && !validChunkIds.has(ref)) {
        warnings.push(issue(i, "evidenceRefs", `Unknown evidence ref "${ref}".`, "critical"));
      }
    }

    if (s.imageRef && validImageIds && !validImageIds.has(s.imageRef)) {
      warnings.push(issue(i, "imageRef", `Unknown image ref "${s.imageRef}".`, "critical"));
    }

    const shouldRequireEvidence =
      validChunkIds &&
      validChunkIds.size > 0 &&
      (
        ALWAYS_EVIDENCE_TYPES.has(s.type) ||
        (audienceProfile?.validation.requireEvidenceOnFactualSlides && !FRAMING_TYPES.has(s.type))
      ) &&
      !(s.type === "image" && (isString(s.imageUrl) || isString(s.imageRef)));

    if (shouldRequireEvidence && evidenceRefs.length === 0) {
      warnings.push(issue(i, "evidenceRefs", `${s.type} slide requires evidenceRefs for this audience/profile.`, "critical"));
    }
  });

  return warnings;
}

export function hasCriticalWarnings(warnings: SlideWarning[]): boolean {
  return warnings.some((warning) => warning.severity === "critical");
}

export function formatCriticalWarnings(warnings: SlideWarning[], prefix: string): string {
  const critical = warnings.filter((warning) => warning.severity === "critical").slice(0, 5);
  const details = critical
    .map((warning) => {
      const where = warning.slideIndex >= 0 ? `slide ${warning.slideIndex + 1}` : "deck";
      return `${where} ${warning.field}: ${warning.message}`;
    })
    .join("; ");
  return `${prefix}: ${details}`;
}
