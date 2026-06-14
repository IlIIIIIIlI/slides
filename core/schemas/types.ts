// ========================
// Source & Evidence
// ========================

export type SourceKind =
  | 'pdf' | 'docx' | 'pptx' | 'md' | 'txt'
  | 'html' | 'url' | 'csv' | 'xlsx' | 'image' | 'video_transcript';

export type LicenseStatus =
  | 'user_provided' | 'public_domain' | 'creative_commons'
  | 'proprietary' | 'unknown';

export type ParseStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface SourceAsset {
  id: string;
  kind: SourceKind;
  title: string;
  origin: 'user_upload' | 'url_fetch' | 'api';
  filepath?: string;
  url?: string;
  language: string;
  pageCount?: number;
  mimeType?: string;
  licenseStatus: LicenseStatus;
  fetchedAt?: string;
  createdAt: string;
  parseStatus: ParseStatus;
  chunkCount?: number;
}

export type ChunkType =
  | 'paragraph' | 'metric' | 'quote' | 'table'
  | 'code' | 'image_note' | 'heading';

export interface SourceChunk {
  id: string;
  sourceId: string;
  pageStart?: number;
  pageEnd?: number;
  sectionPath?: string[];
  chunkType: ChunkType;
  text: string;
  keywords?: string[];
  embeddingRef?: string;
  canStandAlone: boolean;
}

export type EvidenceKind =
  | 'fact' | 'quote' | 'metric' | 'claim' | 'image'
  | 'table' | 'code' | 'timeline_event' | 'comparison_item';

export type UsageMode = 'verbatim' | 'paraphrase' | 'derived';

export interface EvidenceRef {
  id: string;
  sourceId: string;
  chunkId: string;
  evidenceKind: EvidenceKind;
  locator: {
    page?: number;
    paragraph?: number;
    section?: string;
  };
  excerpt: string;
  usageMode: UsageMode;
  requiredOnSlide: boolean;
  confidence: number;
  evidenceStrength: 'primary' | 'secondary' | 'derived';
}

export interface ImageAsset {
  id: string;
  origin: 'user_upload' | 'url_fetch' | 'generated';
  sourceId?: string;
  caption?: string;
  licenseStatus: LicenseStatus;
  attributionRequired: boolean;
  dominantColors?: string[];
  suggestedSubject?: string;
  filepath?: string;
  url?: string;
}

// ========================
// Audience
// ========================

export type AudienceType =
  | 'executive' | 'investor' | 'customer' | 'technical'
  | 'academic' | 'internal' | 'mixed' | 'training';

export interface AudienceProfile {
  id: string;
  type: AudienceType;
  seniority: 'junior' | 'mid' | 'senior' | 'mixed';
  deliveryMode: 'live' | 'async' | 'recorded';
  formality: 'low' | 'medium' | 'high';
  evidenceDensity: 'low' | 'medium' | 'high';
  jargonTolerance: 'low' | 'medium' | 'high';
  decisionGoal: string;
}

// ========================
// Theme
// ========================

export type ThemeFamily =
  | 'dark-minimal' | 'light-editorial' | 'technical-terminal'
  | 'energetic-modern' | 'premium-artistic';

export type SemanticColorKey =
  | 'opening' | 'problem' | 'solution' | 'data'
  | 'success' | 'technical' | 'highlight';

export interface ThemeTokens {
  background: string;
  surface1: string;
  surface2: string;
  surface3: string;
  foreground: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  borderColor: string;
  radius: string;
  motionLevel: 'none' | 'subtle' | 'expressive';
  citationDisplayMode: 'footer' | 'appendix' | 'inline' | 'hidden';
}

export interface ThemePreset {
  id: string;
  family: ThemeFamily;
  name: string;
  description: string;
  backgroundMode: 'dark' | 'light';
  displayFont: string;
  bodyFont: string;
  monoFont: string;
  semanticColors: Record<SemanticColorKey, string>;
  tokens: ThemeTokens;
}

// ========================
// Slide Spec
// ========================

export type SlideIntent =
  | 'title' | 'agenda' | 'section-divider' | 'statement'
  | 'big-statement' | 'data' | 'proof' | 'framework'
  | 'comparison' | 'quote' | 'code' | 'image' | 'demo'
  | 'recap' | 'appendix' | 'quiz';

export type CitationPolicy =
  | 'footer_required' | 'appendix_required' | 'optional' | 'none';

export type SlideStatus =
  | 'draft' | 'needs_review' | 'validated' | 'approved';

export type ContentBlockType =
  | 'headline' | 'supporting' | 'bullet-list' | 'code-block'
  | 'quote-text' | 'image-ref' | 'metric' | 'comparison';

export interface ContentBlock {
  type: ContentBlockType;
  // MAY contain inline LaTeX delimited by $...$ (inline) or $$...$$ (block).
  // These are produced when DOCX/PPTX sources contain OMML math equations.
  content: string;
  emphasis?: boolean;
  codeLanguage?: string;
  imageRef?: string;
  animKey?: string;
  // Hint for renderers: true when content contains KaTeX-renderable math.
  hasMath?: boolean;
}

export interface SlideRenderProps {
  color?: string;
  label?: string;
  imageUrl?: string;
  imageLayout?: 'full' | 'side';
  iframeUrl?: string;
  code?: string;
  quote?: string;
  author?: string;
  bigNumber?: string;
  numberLabel?: string;
  agentTree?: string;
  linkPreview?: { url: string; title: string; author: string; thumbnail?: string };
  leftContent?: string;
  rightContent?: string;
  beforePoints?: string[];
  afterPoints?: string[];
  question?: string;
  options?: string[];
  answer?: string;
  explanation?: string;
}

export interface SlideSpec {
  id: string;
  intent: SlideIntent;
  sectionId: string;
  audienceProfileId: string;
  themePresetId: string;
  evidenceRefs: string[];
  assetRefs: string[];
  citationPolicy: CitationPolicy;
  speakerNotesMode: 'prompt' | 'full' | 'none';
  densityScore?: number;
  status: SlideStatus;
  contentBlocks: ContentBlock[];
  visualMode?: string;
  speakerNotes?: string;
  renderProps?: SlideRenderProps;
  timeline?: TimelineEntry[];
}

// ========================
// Presentation
// ========================

export interface PresentationSection {
  id: string;
  name: string;
  purpose: string;
  slideCount: number;
  candidateEvidenceIds: string[];
  semanticColor: SemanticColorKey;
  slides: string[];
}

export type PresentationPurpose =
  | 'explain_solution' | 'tool_pitch' | 'investor_pitch'
  | 'customer_demo' | 'internal_review' | 'educational'
  | 'research_report';

export type PresentationStatus =
  | 'draft_created' | 'sources_parsed' | 'evidence_indexed'
  | 'outline_locked' | 'theme_locked' | 'slides_drafted'
  | 'qa_passed' | 'approved' | 'exported';

export interface PresentationSpec {
  id: string;
  title: string;
  purpose: PresentationPurpose;
  audienceProfileId: string;
  themePresetId: string;
  slideBudget: number;
  sectionBudget: Record<string, number>;
  sections: PresentationSection[];
  slides: SlideSpec[];
  sources: SourceAsset[];
  evidenceRefs: EvidenceRef[];
  images: ImageAsset[];
  audienceProfiles: AudienceProfile[];
  status: PresentationStatus;
  createdAt: string;
  updatedAt: string;
  autoAnimate?: boolean;
}

// ========================
// Timeline / Reveal DSL
// ========================

// Strictly whitelisted GSAP tween properties.
// Only transform/opacity/timing properties are allowed to prevent layout-breaking
// or security-sensitive property injections from the LLM generation side.
export interface TimelineTween {
  // Visual
  opacity?: number;    // 0–1
  x?: number;          // px (transform, not layout)
  y?: number;          // px (transform, not layout)
  xPercent?: number;
  yPercent?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;   // degrees
  // Timing
  duration?: number;   // seconds (must be > 0)
  ease?: string;       // GSAP ease string e.g. "power2.out", "back.out(1.7)"
  stagger?: number;    // seconds between child elements (for multi-target tweens)
  delay?: number;      // additional seconds before this tween starts (must be >= 0)
}

// A single step in a slide's reveal timeline.
// `at` places the tween in the GSAP timeline:
//   - number  → absolute seconds from the start of the timeline (e.g. 0, 0.3, 1.5)
//   - string  → GSAP position parameter for relative offsets:
//       "<"       align with the start of the previous tween
//       ">"       align with the end of the previous tween (default)
//       "+=0.2"   0.2 s after the end of the previous tween
//       "-=0.1"   0.1 s before the end of the previous tween (overlap)
//       "<+=0.3"  0.3 s after the start of the previous tween
// `target` is a data-anim attribute value identifying the element to animate.
// `tween`  describes the FROM state; the element animates TO its natural CSS state.
export interface TimelineEntry {
  at: number | string;
  target: string;
  tween: TimelineTween;
}

// ========================
// Validation
// ========================

export type ValidationSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ValidationCode =
  | 'citation_missing' | 'image_source_missing' | 'density_too_high'
  | 'density_too_low' | 'headline_too_long' | 'overflow_risk'
  | 'theme_inconsistency' | 'evidence_gap' | 'paraphrase_not_marked'
  | 'verbatim_not_marked' | 'unsupported_claim';

export interface ValidationIssue {
  code: ValidationCode;
  severity: ValidationSeverity;
  message: string;
  slideId?: string;
  field?: string;
}

export interface SlideValidationResult {
  slideId: string;
  status: 'pass' | 'warning' | 'fail';
  issues: ValidationIssue[];
  densityScore: number;
}

export interface QAReport {
  presentationId: string;
  overallStatus: 'pass' | 'warning' | 'fail';
  slideResults: SlideValidationResult[];
  citationCoverage: number;
  evidenceCoverage: number;
  avgDensityScore: number;
  themeConsistency: number;
  issueCount: Record<ValidationSeverity, number>;
  generatedAt: string;
}

// ========================
// Planning
// ========================

export interface OutlineSection {
  id: string;
  name: string;
  purpose: string;
  recommendedSlideCount: number;
  candidateEvidenceIds: string[];
  semanticColor: SemanticColorKey;
}

export interface OutlinePlan {
  presentationId: string;
  sections: OutlineSection[];
  totalSlideCount: number;
  appendixCandidateIds: string[];
  status: 'draft' | 'locked';
}

export interface SlidePlan {
  slideId: string;
  intent: SlideIntent;
  message: string;
  sectionId: string;
  evidenceIds: string[];
  visualMode: string;
  citationPolicy: CitationPolicy;
  expectedDensity: 'low' | 'medium' | 'high';
}

// ========================
// Brief Intake
// ========================

export interface PresentationBrief {
  purpose: PresentationPurpose;
  audienceType: AudienceType;
  deliveryMode: 'live' | 'async' | 'recorded';
  targetSlideCount?: number;
  slideRange?: [number, number];
  themeFamily: ThemeFamily;
  evidenceStrictness: 'strict' | 'balanced' | 'lenient';
  citationVisibility: 'footer' | 'appendix' | 'hidden';
  language: string;
  title?: string;
}
