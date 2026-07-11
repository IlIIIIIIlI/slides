// Runtime validation for model-generated outline and Slide[] output.
// This runs on the prompt-output schema before generated decks are persisted.

import type { Slide } from "@/app/slides";
import type {
  ContentBlock,
  PresentationSpec,
  SlideIntent,
  SlideSpec,
  TimelineEntry,
  TimelineTween,
} from "@/core/schemas/types";
import type { GenerationAudienceProfile } from "@/lib/generation/audience";
import {
  detectSlideSpec,
  type DetectReport,
  type DetectOptions,
} from "@/core/validation/impeccable";
import { DEFAULT_PRESET_ID } from "@/core/theming/presets";

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

// Whitelisted tween keys — matches TimelineTween in core/schemas/types.ts.
// Anything outside this set could inject layout-breaking or security-sensitive CSS.
const ALLOWED_TWEEN_KEYS = new Set<string>([
  "opacity", "x", "y", "xPercent", "yPercent",
  "scale", "scaleX", "scaleY", "rotation",
  "duration", "ease", "stagger", "delay",
]);

// GSAP position-parameter pattern: number, relative offset, or label.
// Accepts: numbers, "+=N", "-=N", "<", ">", "<+=N", ">-=N", word labels.
const GSAP_AT_PATTERN = /^([<>]([+-]=\d+(?:\.\d+)?)?|[+-]=\d+(?:\.\d+)?|\w[\w-]*)$/;

function validateTimelineEntry(
  entry: unknown,
  slideIndex: number,
  entryIndex: number,
  warnings: SlideWarning[],
): void {
  if (!entry || typeof entry !== "object") {
    warnings.push(issue(slideIndex, `timeline[${entryIndex}]`, "Timeline entry must be an object."));
    return;
  }
  const e = entry as Record<string, unknown>;

  // Validate `at`
  if (typeof e.at === "number") {
    if (!Number.isFinite(e.at) || e.at < 0) {
      warnings.push(issue(slideIndex, `timeline[${entryIndex}].at`, "Timeline at must be a finite non-negative number."));
    }
  } else if (typeof e.at === "string") {
    if (!GSAP_AT_PATTERN.test(e.at)) {
      warnings.push(issue(slideIndex, `timeline[${entryIndex}].at`, `Unrecognised GSAP position string "${e.at}". Use a number, "+=N", "-=N", "<", "<+=N", or a label.`));
    }
  } else {
    warnings.push(issue(slideIndex, `timeline[${entryIndex}].at`, "Timeline entry missing required field 'at' (number or GSAP position string).", "critical"));
  }

  // Validate `target`
  if (typeof e.target !== "string" || !e.target.trim()) {
    warnings.push(issue(slideIndex, `timeline[${entryIndex}].target`, "Timeline entry missing required field 'target' (non-empty data-anim key).", "critical"));
  }

  // Validate `tween`
  if (!e.tween || typeof e.tween !== "object" || Array.isArray(e.tween)) {
    warnings.push(issue(slideIndex, `timeline[${entryIndex}].tween`, "Timeline entry missing required field 'tween' (object).", "critical"));
    return;
  }
  const tween = e.tween as Partial<TimelineTween> & Record<string, unknown>;

  for (const key of Object.keys(tween)) {
    if (!ALLOWED_TWEEN_KEYS.has(key)) {
      warnings.push(issue(
        slideIndex,
        `timeline[${entryIndex}].tween.${key}`,
        `Disallowed tween property "${key}". Only visual transform/opacity and timing properties are permitted.`,
        "critical",
      ));
    }
  }

  if (tween.opacity !== undefined && (typeof tween.opacity !== "number" || tween.opacity < 0 || tween.opacity > 1)) {
    warnings.push(issue(slideIndex, `timeline[${entryIndex}].tween.opacity`, "opacity must be a number between 0 and 1."));
  }
  if (tween.duration !== undefined && (typeof tween.duration !== "number" || tween.duration <= 0)) {
    warnings.push(issue(slideIndex, `timeline[${entryIndex}].tween.duration`, "duration must be a positive number."));
  }
  if (tween.delay !== undefined && (typeof tween.delay !== "number" || tween.delay < 0)) {
    warnings.push(issue(slideIndex, `timeline[${entryIndex}].tween.delay`, "delay must be a non-negative number."));
  }
  if (tween.stagger !== undefined && (typeof tween.stagger !== "number" || tween.stagger < 0)) {
    warnings.push(issue(slideIndex, `timeline[${entryIndex}].tween.stagger`, "stagger must be a non-negative number."));
  }
  if (tween.ease !== undefined && (typeof tween.ease !== "string" || !tween.ease.trim())) {
    warnings.push(issue(slideIndex, `timeline[${entryIndex}].tween.ease`, "ease must be a non-empty string."));
  }
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
          if (s.mockupKind === "file-tree") {
            const hasTree = Array.isArray(s.mockupTree) && s.mockupTree.length > 0
              && s.mockupTree.every((n) => n && typeof n === "object" && typeof n.name === "string" && n.name.trim().length > 0);
            if (!hasTree && !isString(s.mockupContent)) {
              warnings.push(issue(i, "mockupTree", "file-tree mockup requires either a non-empty mockupTree array of { name, comment?, children? } or a non-empty mockupContent fallback.", "critical"));
            }
          } else if (!isString(s.mockupContent)) {
            pushMissing(warnings, i, "mockupContent", s.type);
          }
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

    if (Array.isArray(s.timeline)) {
      (s.timeline as unknown as TimelineEntry[]).forEach((entry, ei) => {
        validateTimelineEntry(entry, i, ei, warnings);
      });
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

// ─── Impeccable detect (player HTML) ─────────────────────────────────

export interface ValidateWithImpeccableResult {
  warnings: SlideWarning[];
  /** Per-slide Impeccable DetectReport (additive; does not replace antislop). */
  impeccable: DetectReport[];
}

const INTENT_FROM_TYPE: Partial<Record<Slide["type"], SlideIntent>> = {
  title: "title",
  goals: "agenda",
  "section-divider": "section-divider",
  statement: "statement",
  code: "code",
  framework: "framework",
  recap: "recap",
  iframe: "demo",
  quote: "quote",
  image: "image",
  "split-visual": "framework",
  "big-number": "data",
  comparison: "comparison",
  quiz: "quiz",
  "agent-tree": "framework",
  chart: "data",
};

/** Best-effort Slide → SlideSpec for detect (generation decks are Slide[], not SlideSpec). */
export function slideToDetectSpec(
  slide: Slide,
  index: number,
  themePresetId = DEFAULT_PRESET_ID,
): SlideSpec {
  const contentBlocks: ContentBlock[] = [];
  if (slide.blockMeta?.length) {
    // Prefer blockMeta order when present; fill content from fields
    for (const meta of slide.blockMeta) {
      let content = "";
      switch (meta.type) {
        case "headline":
          content = slide.headline ?? "";
          break;
        case "supporting":
          content = slide.supporting ?? "";
          break;
        case "bullet-list":
          content = (slide.points ?? []).join("\n");
          break;
        case "code-block":
          content = slide.code ?? "";
          break;
        case "quote-text":
          content = slide.quote ?? "";
          break;
        case "metric":
          content = slide.bigNumber ?? "";
          break;
        case "image-ref":
          content = slide.imageUrl ?? "";
          break;
        case "comparison":
          content = [...(slide.beforePoints ?? []), ...(slide.afterPoints ?? [])].join("\n");
          break;
        default:
          content = "";
      }
      contentBlocks.push({
        type: meta.type as ContentBlock["type"],
        content,
        animKey: meta.animKey,
      });
    }
  } else {
    if (slide.headline) contentBlocks.push({ type: "headline", content: slide.headline, animKey: "title" });
    if (slide.supporting) contentBlocks.push({ type: "supporting", content: slide.supporting });
    if (slide.points?.length) contentBlocks.push({ type: "bullet-list", content: slide.points.join("\n") });
    if (slide.code) contentBlocks.push({ type: "code-block", content: slide.code, animKey: "code:0" });
    if (slide.quote) contentBlocks.push({ type: "quote-text", content: slide.quote });
    if (slide.bigNumber) contentBlocks.push({ type: "metric", content: slide.bigNumber });
    if (slide.imageUrl) contentBlocks.push({ type: "image-ref", content: slide.imageUrl });
  }

  return {
    id: `gen-slide-${index}`,
    intent: INTENT_FROM_TYPE[slide.type] ?? "statement",
    sectionId: "generated",
    audienceProfileId: "generated",
    themePresetId,
    evidenceRefs: slide.evidenceRefs ?? [],
    assetRefs: [],
    citationPolicy: "none",
    speakerNotesMode: slide.notes ? "full" : "none",
    status: "draft",
    contentBlocks,
    speakerNotes: slide.notes,
    renderProps: {
      color: slide.color,
      label: slide.label,
      code: slide.code,
      quote: slide.quote,
      author: slide.author,
      imageUrl: slide.imageUrl,
      imageLayout: slide.imageLayout,
      bigNumber: slide.bigNumber,
      numberLabel: slide.numberLabel,
      beforePoints: slide.beforePoints,
      afterPoints: slide.afterPoints,
      iframeUrl: slide.iframeUrl,
      question: slide.question,
      options: slide.options,
      answer: slide.answer,
      explanation: slide.explanation,
    },
  };
}

/** Run Impeccable detect on each slide of a PresentationSpec (post structural checks). */
export function runImpeccableOnPresentation(
  presentation: PresentationSpec,
  options?: DetectOptions,
): DetectReport[] {
  const themeId = presentation.themePresetId || DEFAULT_PRESET_ID;
  return presentation.slides.map((slide, slideIndex) =>
    detectSlideSpec(slide, themeId, slideIndex, options),
  );
}

/** Run Impeccable detect on generation Slide[] after schema validation. */
export function runImpeccableOnSlides(
  slides: Slide[],
  themePresetId = DEFAULT_PRESET_ID,
  options?: DetectOptions,
): DetectReport[] {
  return slides.map((slide, slideIndex) => {
    const spec = slideToDetectSpec(slide, slideIndex, themePresetId);
    return detectSlideSpec(spec, themePresetId, slideIndex, options);
  });
}

/**
 * Schema validate + Impeccable detect for a generated deck.
 * Structural antislop is separate (`lintPresentation`); this is complementary.
 */
export function validateSlidesWithImpeccable(
  slides: unknown,
  options: ValidateSlidesOptions & { themePresetId?: string } = {},
): ValidateWithImpeccableResult {
  const warnings = validateSlides(slides, options);
  const list = Array.isArray(slides) ? (slides as Slide[]) : [];
  const impeccable = runImpeccableOnSlides(list, options.themePresetId ?? DEFAULT_PRESET_ID);
  return { warnings, impeccable };
}
