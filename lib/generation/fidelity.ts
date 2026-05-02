// Fidelity report — runs after validate to grade how well the generated deck
// captured the source document. Mixed deterministic + LLM:
//
//   - Deterministic stats are computed from the slides/chunks directly.
//   - The LLM call returns a coarse overallGrade ("high" | "medium" | "low"),
//     per-section captured/missed key points, and unsupported claims.
//
// All chunk ids returned by the LLM are validated against validChunkIds; an
// unknown id rejects the response (same allow-list pattern as section-drafting).

import Anthropic from "@anthropic-ai/sdk";

import type { Slide } from "@/app/slides";
import type { ExtractedChunk } from "@/lib/generation/extract";
import { stripFences } from "@/lib/generation/extract";

export type FidelityGrade = "high" | "medium" | "low";

export interface FidelitySectionCoverage {
  sectionId: string;
  sectionName: string;
  capturedKeyPoints: { text: string; evidenceChunkIds: string[] }[];
  missedKeyPoints: { text: string; sourceChunkIds: string[] }[];
}

export interface FidelityUnsupportedClaim {
  slideIndex: number;
  claim: string;
  closestSourceSpan?: string;
  sourceChunkIds: string[];
}

export interface FidelityDeterministic {
  totalSlides: number;
  factualSlides: number;
  factualSlidesWithEvidence: number;
  evidenceUsageRatio: number; // 0..1
  imageSlides: number;
  imageUsageRatio: number; // 0..1; 0 when source has no images
  slideTypeMix: Record<string, number>;
  uniqueChunkIdsCited: number;
  totalChunkIds: number;
  chunkCoverageRatio: number; // 0..1
}

export interface FidelityReport {
  generatedAt: string;
  overallGrade: FidelityGrade;
  summary: string;
  deterministic: FidelityDeterministic;
  coverage: FidelitySectionCoverage[];
  unsupportedClaims: FidelityUnsupportedClaim[];
  recommendations: string[];
}

interface OutlineSectionLike {
  id: string;
  name: string;
  purpose?: string;
  label?: string;
  slideCount?: number;
  candidateChunkIds?: string[];
}

interface OutlineLike {
  title: string;
  totalSlideCount?: number;
  sections: OutlineSectionLike[];
}

const FRAMING_TYPES = new Set<Slide["type"]>([
  "title",
  "goals",
  "section-divider",
  "recap",
  "quiz",
]);

export function computeDeterministic(
  slides: Slide[],
  chunks: ExtractedChunk[],
  imageCount: number,
): FidelityDeterministic {
  const factual = slides.filter((s) => !FRAMING_TYPES.has(s.type));
  const withEvidence = factual.filter((s) => Array.isArray(s.evidenceRefs) && s.evidenceRefs.length > 0);
  const imageSlides = slides.filter((s) => s.type === "image" && (typeof s.imageUrl === "string")).length;
  const slideTypeMix: Record<string, number> = {};
  for (const s of slides) slideTypeMix[s.type] = (slideTypeMix[s.type] ?? 0) + 1;

  const cited = new Set<string>();
  for (const s of slides) for (const id of s.evidenceRefs ?? []) cited.add(id);

  const totalChunkIds = chunks.length;
  const factualCount = factual.length;
  const evidenceUsageRatio = factualCount === 0 ? 1 : withEvidence.length / factualCount;
  const imageUsageRatio = imageCount === 0 ? 0 : imageSlides / imageCount;
  const chunkCoverageRatio = totalChunkIds === 0 ? 0 : cited.size / totalChunkIds;

  return {
    totalSlides: slides.length,
    factualSlides: factualCount,
    factualSlidesWithEvidence: withEvidence.length,
    evidenceUsageRatio,
    imageSlides,
    imageUsageRatio,
    slideTypeMix,
    uniqueChunkIdsCited: cited.size,
    totalChunkIds,
    chunkCoverageRatio,
  };
}

const FIDELITY_SYSTEM_PROMPT = `You are the FIDELITY-REPORT stage of a presentation pipeline.

You will receive:
  - the source document (verbatim)
  - the chunk index used by the deck (CHK-… ids with their text)
  - the deck outline (sections + intent)
  - the final generated slides (JSON)

Your job: judge how faithfully the deck represents the source.

Return STRICT JSON. Be coarse, not falsely precise. The score must be one of "high" | "medium" | "low":
  - "high":   the deck captures the source's central thesis, key evidence, and major sections; nothing important is missing; no unsupported claims.
  - "medium": some key points are missing OR there are minor unsupported framings.
  - "low":    the deck misses central ideas, fabricates claims, or ignores the source structure.

For coverage[] — one entry per section in the outline (preserve sectionId).
  capturedKeyPoints: ideas from this section's part of the source that DID make it into the deck. evidenceChunkIds must be CHK- ids from the chunk index.
  missedKeyPoints:   ideas from the source that SHOULD have made it in but didn't. sourceChunkIds must point to where in the source the missed idea is.

For unsupportedClaims[]:
  Slides whose text makes a factual claim you cannot trace to the source.
  Quote the slide text in "claim". Provide the closest source phrase you found in "closestSourceSpan" (or omit if you found nothing). sourceChunkIds is the closest chunk(s).

For recommendations[]: 1–4 short, actionable strings (e.g. "Add a slide for X", "Drop unsupported claim on slide 7").

Constraints:
- Every chunk id you emit MUST appear in the chunk index.
- Do not output markdown fences. JSON only.
- Output starts with { and ends with }.

Schema:
{
  "overallGrade": "high" | "medium" | "low",
  "summary": string,
  "coverage": [
    {
      "sectionId": string,
      "sectionName": string,
      "capturedKeyPoints": [{ "text": string, "evidenceChunkIds": [string] }],
      "missedKeyPoints":   [{ "text": string, "sourceChunkIds":   [string] }]
    }
  ],
  "unsupportedClaims": [
    { "slideIndex": number, "claim": string, "closestSourceSpan"?: string, "sourceChunkIds": [string] }
  ],
  "recommendations": [string]
}`;

function summariseChunks(chunks: ExtractedChunk[]): string {
  return chunks
    .map((c) => {
      const where = c.page !== undefined ? `p${c.page}¶${c.paragraph}` : `¶${c.paragraph}`;
      const excerpt = c.text.slice(0, 220);
      return `${c.id} (${where}): ${excerpt}${c.text.length > 220 ? "…" : ""}`;
    })
    .join("\n");
}

function summariseSlides(slides: Slide[]): string {
  return slides
    .map((s, i) => {
      const head = s.headline ? ` "${s.headline.slice(0, 80)}"` : "";
      const evid = (s.evidenceRefs ?? []).join(",");
      const refs = evid ? `  refs:[${evid}]` : "";
      return `#${i + 1} ${s.type}${s.variant ? `/${s.variant}` : ""}${head}${refs}`;
    })
    .join("\n");
}

function summariseOutline(outline: OutlineLike): string {
  return outline.sections
    .map((s) => `- ${s.id} ${s.name}: ${s.purpose ?? ""}`)
    .join("\n");
}

function dropUnknownIds(ids: unknown, allowed: Set<string>): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === "string" && allowed.has(id));
}

interface RawCoverage {
  sectionId?: unknown;
  sectionName?: unknown;
  capturedKeyPoints?: unknown[];
  missedKeyPoints?: unknown[];
}

interface RawClaim {
  slideIndex?: unknown;
  claim?: unknown;
  closestSourceSpan?: unknown;
  sourceChunkIds?: unknown;
}

function coerceLLM(parsed: unknown, validChunkIds: Set<string>, slidesLen: number): {
  overallGrade: FidelityGrade;
  summary: string;
  coverage: FidelitySectionCoverage[];
  unsupportedClaims: FidelityUnsupportedClaim[];
  recommendations: string[];
} {
  const obj = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  const grade = obj.overallGrade === "high" || obj.overallGrade === "medium" || obj.overallGrade === "low"
    ? (obj.overallGrade as FidelityGrade)
    : "medium";
  const summary = typeof obj.summary === "string" ? obj.summary : "";
  const coverageRaw = Array.isArray(obj.coverage) ? (obj.coverage as RawCoverage[]) : [];
  const coverage: FidelitySectionCoverage[] = coverageRaw.map((c) => ({
    sectionId: typeof c.sectionId === "string" ? c.sectionId : "",
    sectionName: typeof c.sectionName === "string" ? c.sectionName : "",
    capturedKeyPoints: Array.isArray(c.capturedKeyPoints)
      ? c.capturedKeyPoints
          .map((p): { text: string; evidenceChunkIds: string[] } | null => {
            if (!p || typeof p !== "object") return null;
            const pp = p as Record<string, unknown>;
            const text = typeof pp.text === "string" ? pp.text : "";
            if (!text) return null;
            return { text, evidenceChunkIds: dropUnknownIds(pp.evidenceChunkIds, validChunkIds) };
          })
          .filter((p): p is { text: string; evidenceChunkIds: string[] } => p !== null)
      : [],
    missedKeyPoints: Array.isArray(c.missedKeyPoints)
      ? c.missedKeyPoints
          .map((p): { text: string; sourceChunkIds: string[] } | null => {
            if (!p || typeof p !== "object") return null;
            const pp = p as Record<string, unknown>;
            const text = typeof pp.text === "string" ? pp.text : "";
            if (!text) return null;
            return { text, sourceChunkIds: dropUnknownIds(pp.sourceChunkIds, validChunkIds) };
          })
          .filter((p): p is { text: string; sourceChunkIds: string[] } => p !== null)
      : [],
  }));
  const claimsRaw = Array.isArray(obj.unsupportedClaims) ? (obj.unsupportedClaims as RawClaim[]) : [];
  const unsupportedClaims: FidelityUnsupportedClaim[] = claimsRaw
    .map((c): FidelityUnsupportedClaim | null => {
      const claim = typeof c.claim === "string" ? c.claim : "";
      if (!claim) return null;
      const idxRaw = typeof c.slideIndex === "number" ? c.slideIndex : -1;
      const slideIndex = Number.isInteger(idxRaw) && idxRaw >= 0 && idxRaw < slidesLen ? idxRaw : -1;
      return {
        slideIndex,
        claim,
        closestSourceSpan: typeof c.closestSourceSpan === "string" ? c.closestSourceSpan : undefined,
        sourceChunkIds: dropUnknownIds(c.sourceChunkIds, validChunkIds),
      };
    })
    .filter((c): c is FidelityUnsupportedClaim => c !== null);
  const recommendations = Array.isArray(obj.recommendations)
    ? (obj.recommendations as unknown[]).filter((r): r is string => typeof r === "string" && r.trim().length > 0)
    : [];

  return { overallGrade: grade, summary, coverage, unsupportedClaims, recommendations };
}

export interface GenerateFidelityArgs {
  client: Anthropic;
  model: string;
  sourceText: string;
  chunks: ExtractedChunk[];
  outline: OutlineLike;
  slides: Slide[];
  imageCount: number;
}

export async function generateFidelityReport(args: GenerateFidelityArgs): Promise<FidelityReport> {
  const { client, model, sourceText, chunks, outline, slides, imageCount } = args;
  const validChunkIds = new Set(chunks.map((c) => c.id));
  const deterministic = computeDeterministic(slides, chunks, imageCount);

  // Skip the LLM call entirely if there's nothing to grade against.
  if (chunks.length === 0 || slides.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      overallGrade: "medium",
      summary: chunks.length === 0
        ? "Source had no extractable text chunks; deck cannot be fidelity-graded."
        : "Deck is empty.",
      deterministic,
      coverage: [],
      unsupportedClaims: [],
      recommendations: [],
    };
  }

  const userText = [
    `--- SOURCE START ---\n${sourceText.slice(0, 80_000)}\n--- SOURCE END ---`,
    "",
    `--- CHUNK INDEX ---\n${summariseChunks(chunks)}\n--- END CHUNK INDEX ---`,
    "",
    `--- OUTLINE ---\n${summariseOutline(outline)}\n--- END OUTLINE ---`,
    "",
    `--- DECK SUMMARY (${slides.length} slides) ---\n${summariseSlides(slides)}\n--- END DECK SUMMARY ---`,
    "",
    `--- DECK SLIDES JSON ---\n${JSON.stringify(slides, null, 2).slice(0, 60_000)}\n--- END DECK SLIDES JSON ---`,
    "",
    "Produce the fidelity report JSON.",
  ].join("\n");

  let parsed: unknown;
  try {
    const msg = await client.messages.create({
      model,
      max_tokens: 4096,
      system: FIDELITY_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: userText, cache_control: { type: "ephemeral" } },
          ],
        },
      ],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    parsed = JSON.parse(stripFences(raw));
  } catch (err) {
    const message = err instanceof Error ? err.message : "fidelity call failed";
    return {
      generatedAt: new Date().toISOString(),
      overallGrade: "medium",
      summary: `Fidelity grading failed: ${message}`,
      deterministic,
      coverage: [],
      unsupportedClaims: [],
      recommendations: [],
    };
  }

  const llm = coerceLLM(parsed, validChunkIds, slides.length);

  return {
    generatedAt: new Date().toISOString(),
    ...llm,
    deterministic,
  };
}
