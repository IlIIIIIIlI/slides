import type {
  PresentationSpec,
  SlideSpec,
  SlideValidationResult,
  ValidationIssue,
  QAReport,
} from '@/core/schemas/types';

const HEADLINE_MAX_CHARS = 80;
const POINTS_MAX_COUNT = 5;
const SUPPORTING_MAX_CHARS = 200;

// Slides whose intents require at least one evidence ref
const EVIDENCE_REQUIRED_INTENTS = new Set([
  'data', 'proof', 'quote', 'comparison',
]);

function computeDensityScore(slide: SlideSpec): number {
  let score = 0;
  let weight = 0;

  const headline = slide.contentBlocks.find((b) => b.type === 'headline')?.content ?? '';
  const headlineScore = Math.max(0, 1 - headline.length / HEADLINE_MAX_CHARS);
  score += headlineScore;
  weight += 1;

  const supporting = slide.contentBlocks.find((b) => b.type === 'supporting')?.content ?? '';
  if (supporting) {
    const supportingScore = Math.max(0, 1 - supporting.length / SUPPORTING_MAX_CHARS);
    score += supportingScore;
    weight += 1;
  }

  const bulletBlock = slide.contentBlocks.find((b) => b.type === 'bullet-list');
  if (bulletBlock) {
    const count = bulletBlock.content.split('\n').filter(Boolean).length;
    const bulletScore = Math.max(0, 1 - count / POINTS_MAX_COUNT);
    score += bulletScore;
    weight += 1;
  }

  return weight > 0 ? score / weight : 1;
}

function validateCitations(
  slide: SlideSpec,
  allEvidenceIds: Set<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (EVIDENCE_REQUIRED_INTENTS.has(slide.intent) && slide.evidenceRefs.length === 0) {
    issues.push({
      code: 'citation_missing',
      severity: 'high',
      message: `Slide with intent "${slide.intent}" has no evidence refs attached.`,
      slideId: slide.id,
      field: 'evidenceRefs',
    });
  }

  for (const refId of slide.evidenceRefs) {
    if (!allEvidenceIds.has(refId)) {
      issues.push({
        code: 'evidence_gap',
        severity: 'medium',
        message: `Evidence ref "${refId}" is referenced but not defined in the presentation.`,
        slideId: slide.id,
        field: 'evidenceRefs',
      });
    }
  }

  const imageRefs = slide.assetRefs;
  if (imageRefs.length > 0 && slide.citationPolicy === 'none') {
    issues.push({
      code: 'image_source_missing',
      severity: 'medium',
      message: 'Slide uses image assets but citation policy is set to none.',
      slideId: slide.id,
      field: 'assetRefs',
    });
  }

  return issues;
}

function validateDensity(slide: SlideSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const headline = slide.contentBlocks.find((b) => b.type === 'headline')?.content ?? '';
  if (headline.length > HEADLINE_MAX_CHARS) {
    issues.push({
      code: 'headline_too_long',
      severity: 'medium',
      message: `Headline is ${headline.length} chars (max ${HEADLINE_MAX_CHARS}). Consider shortening.`,
      slideId: slide.id,
      field: 'headline',
    });
  }

  const bulletBlock = slide.contentBlocks.find((b) => b.type === 'bullet-list');
  if (bulletBlock) {
    const count = bulletBlock.content.split('\n').filter(Boolean).length;
    if (count > POINTS_MAX_COUNT) {
      issues.push({
        code: 'density_too_high',
        severity: 'medium',
        message: `${count} bullet points on one slide exceeds the maximum of ${POINTS_MAX_COUNT}.`,
        slideId: slide.id,
        field: 'points',
      });
    }
  }

  const supporting = slide.contentBlocks.find((b) => b.type === 'supporting')?.content ?? '';
  if (supporting.length > SUPPORTING_MAX_CHARS) {
    issues.push({
      code: 'overflow_risk',
      severity: 'low',
      message: `Supporting text is ${supporting.length} chars. May overflow at presentation scale.`,
      slideId: slide.id,
      field: 'supporting',
    });
  }

  return issues;
}

function validateThemeConsistency(
  slide: SlideSpec,
  expectedPresetId: string,
): ValidationIssue[] {
  if (slide.themePresetId !== expectedPresetId) {
    return [
      {
        code: 'theme_inconsistency',
        severity: 'low',
        message: `Slide uses preset "${slide.themePresetId}" but presentation uses "${expectedPresetId}".`,
        slideId: slide.id,
        field: 'themePresetId',
      },
    ];
  }
  return [];
}

export function validateSlide(
  slide: SlideSpec,
  presentation: PresentationSpec,
): SlideValidationResult {
  const allEvidenceIds = new Set(presentation.evidenceRefs.map((e) => e.id));

  const issues: ValidationIssue[] = [
    ...validateCitations(slide, allEvidenceIds),
    ...validateDensity(slide),
    ...validateThemeConsistency(slide, presentation.themePresetId),
  ];

  const density = computeDensityScore(slide);

  const hasFail = issues.some((i) => i.severity === 'critical' || i.severity === 'high');
  const hasWarn = issues.some((i) => i.severity === 'medium');

  return {
    slideId: slide.id,
    status: hasFail ? 'fail' : hasWarn ? 'warning' : 'pass',
    issues,
    densityScore: density,
  };
}

export function validatePresentation(presentation: PresentationSpec): QAReport {
  const slideResults = presentation.slides.map((s) => validateSlide(s, presentation));

  const totalSlides = presentation.slides.length;
  const slidesWithEvidence = presentation.slides.filter((s) => s.evidenceRefs.length > 0).length;
  const citationCoverage = totalSlides > 0 ? slidesWithEvidence / totalSlides : 0;

  const requiredSlides = presentation.slides.filter((s) =>
    EVIDENCE_REQUIRED_INTENTS.has(s.intent),
  );
  const coveredRequired = requiredSlides.filter((s) => s.evidenceRefs.length > 0).length;
  const evidenceCoverage = requiredSlides.length > 0 ? coveredRequired / requiredSlides.length : 1;

  const avgDensityScore =
    slideResults.reduce((sum, r) => sum + r.densityScore, 0) / (slideResults.length || 1);

  const themeIds = new Set(presentation.slides.map((s) => s.themePresetId));
  const themeConsistency = themeIds.size === 1 ? 1 : 1 - (themeIds.size - 1) / presentation.slides.length;

  const allIssues = slideResults.flatMap((r) => r.issues);
  const issueCount = {
    low: allIssues.filter((i) => i.severity === 'low').length,
    medium: allIssues.filter((i) => i.severity === 'medium').length,
    high: allIssues.filter((i) => i.severity === 'high').length,
    critical: allIssues.filter((i) => i.severity === 'critical').length,
  };

  const hasFail = slideResults.some((r) => r.status === 'fail');
  const hasWarn = slideResults.some((r) => r.status === 'warning');

  return {
    presentationId: presentation.id,
    overallStatus: hasFail ? 'fail' : hasWarn ? 'warning' : 'pass',
    slideResults,
    citationCoverage,
    evidenceCoverage,
    avgDensityScore,
    themeConsistency,
    issueCount,
    generatedAt: new Date().toISOString(),
  };
}
