export type AudienceProfileId = "academic" | "technical";

export interface GenerationAudienceProfile {
  id: AudienceProfileId;
  label: string;
  aliases: string[];
  slideRange: [number, number];
  evidenceStrictness: "strict" | "balanced" | "lenient";
  noteDepth: "brief" | "standard" | "detailed";
  quiz: {
    enabled: boolean;
    minQuestions: number;
    maxQuestions: number;
  };
  validation: {
    requireEvidenceOnFactualSlides: boolean;
    requireImageWhenAvailable: boolean;
  };
  outlineGuidance: string;
  sectionGuidance: string;
}

const COMMON_FACT_RULE =
  "Use the source document as the authority. Do not invent claims, metrics, citations, examples, or terminology that are not supported by the source.";

export const AUDIENCE_PROFILES: Record<AudienceProfileId, GenerationAudienceProfile> = {
  academic: {
    id: "academic",
    label: "Academic",
    aliases: ["academic", "research", "researcher", "professor", "student", "university", "paper", "journal"],
    slideRange: [12, 18],
    evidenceStrictness: "strict",
    noteDepth: "detailed",
    quiz: { enabled: true, minQuestions: 2, maxQuestions: 4 },
    validation: {
      requireEvidenceOnFactualSlides: true,
      requireImageWhenAvailable: true,
    },
    outlineGuidance: [
      "Use an academic teaching/research style: precise, source-grounded, and explanatory.",
      "Structure the deck around research question, background, core idea, mechanism or method, evidence, key citation(s), important figure/image, implications, limitations, recap, then quiz/checkpoint slides.",
      "Extract the core idea explicitly and allocate at least one slide to it.",
      "Allocate at least one slide to important citations or source-backed evidence.",
      "If source images/figures exist, allocate at least one image/figure interpretation slide.",
      "Append a final quiz/checkpoint section with 2-4 quiz slides. Quiz slides are part of totalSlideCount.",
    ].join("\n"),
    sectionGuidance: [
      COMMON_FACT_RULE,
      "Prefer detailed explanation over punchline-only phrasing. Keep slide text readable, then put the fuller explanation in notes.",
      "Every factual slide must include evidenceRefs when text chunks exist.",
      "For citation-focused slides, use quote or framework slides with exact source-backed claims.",
      "For figure/image slides, explain what the audience should notice and why it matters.",
      "For quiz sections, produce quiz slides that test the core idea, a key citation/evidence point, and interpretation of an important figure when available.",
      "Academic notes must include a clear teaching explanation, caveat/limitation, and transition.",
    ].join("\n"),
  },
  technical: {
    id: "technical",
    label: "Technical",
    aliases: [
      "technical",
      "engineer",
      "engineering",
      "developer",
      "architecture",
      "implementation",
      "dev",
      "code",
      "codebase",
      "source",
      "repo",
      "library",
      "api",
      "sdk",
    ],
    slideRange: [10, 15],
    evidenceStrictness: "balanced",
    noteDepth: "standard",
    quiz: { enabled: false, minQuestions: 0, maxQuestions: 0 },
    validation: {
      requireEvidenceOnFactualSlides: false,
      requireImageWhenAvailable: false,
    },
    outlineGuidance: [
      "Use a technical narrative: problem, constraints, architecture, implementation details, trade-offs, demo/proof, and next steps.",
      "When the source is a code file or repository, anchor the outline in the actual code: entry points, core modules/classes/functions, key data structures, control flow, external dependencies, and notable trade-offs you can see in the source.",
    ].join("\n"),
    sectionGuidance: [
      COMMON_FACT_RULE,
      "Prefer architecture, code, framework, comparison, and proof slides when supported by the source.",
      "Attach evidenceRefs for metrics, quotes, and concrete claims.",
      "When the source is code, use code slides to show real snippets (functions, types, configs) drawn directly from the source — do not invent APIs, signatures, or behavior the code does not actually contain.",
    ].join("\n"),
  },
};

export function getAudienceProfile(rawAudience: string | null | undefined): GenerationAudienceProfile {
  const normalized = (rawAudience ?? "").trim().toLowerCase();
  if (!normalized) return AUDIENCE_PROFILES.technical;

  for (const profile of Object.values(AUDIENCE_PROFILES)) {
    if (profile.aliases.some((alias) => normalized.includes(alias))) {
      return profile;
    }
  }

  return AUDIENCE_PROFILES.technical;
}

export function formatAudienceProfileForPrompt(profile: GenerationAudienceProfile): string {
  const quizLine = profile.quiz.enabled
    ? `Quiz: append ${profile.quiz.minQuestions}-${profile.quiz.maxQuestions} quiz/checkpoint slides after the main content.`
    : "Quiz: do not add quiz slides unless the source explicitly requires them.";

  return [
    `Audience profile: ${profile.label}`,
    `Slide range: ${profile.slideRange[0]}-${profile.slideRange[1]} total slides.`,
    `Evidence strictness: ${profile.evidenceStrictness}.`,
    `Speaker notes depth: ${profile.noteDepth}.`,
    quizLine,
    "",
    "Outline guidance:",
    profile.outlineGuidance,
    "",
    "Section drafting guidance:",
    profile.sectionGuidance,
  ].join("\n");
}
