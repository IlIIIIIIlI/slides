// Server-side helper to draft a small number of slides on demand — used by the
// single-slide regeneration route and the "generate from a knowledge gap" route.
//
// Both flows reuse the same SECTION_DRAFT_SYSTEM_PROMPT and repair/validate
// machinery as the main pipeline, but ground on the deck's persisted chunks
// (the raw source text isn't stored after generation).

import Anthropic from "@anthropic-ai/sdk";

import { SECTION_DRAFT_SYSTEM_PROMPT } from "./prompts";
import { formatAudienceProfileForPrompt, type GenerationAudienceProfile } from "./audience";
import {
  formatSectionChunks,
  repairSectionSlides,
  selectSectionChunks,
  type GeneratedSlide,
  type OutlineSectionLike,
} from "./repair";
import { stripFences, type ExtractedChunk, type ExtractedImage } from "./extract";
import { buildVisionImageBlocks, orderImagesForSection } from "./vision";
import { runImpeccableOnSlides } from "./validate";
import type { DetectReport } from "@/core/validation/impeccable";
import type { Slide } from "@/app/slides";
import { DEFAULT_PRESET_ID } from "@/core/theming/presets";

const MODEL = "claude-sonnet-4-6";
const SOURCE_TRUNCATE = 60_000;

export interface DraftSlidesInput {
  client: Anthropic;
  deckTitle: string;
  audienceType: string;
  audienceProfile: GenerationAudienceProfile;
  section: OutlineSectionLike;
  chunks: ExtractedChunk[];
  images?: ExtractedImage[];
  count: number;
  /** Extra free-text requirement from the user. */
  instruction?: string;
  /** Existing slide to improve in place (regeneration case). */
  baseSlide?: Slide;
}

function tryParse(text: string): GeneratedSlide[] | null {
  try {
    const parsed = JSON.parse(stripFences(text));
    return Array.isArray(parsed) ? (parsed as GeneratedSlide[]) : null;
  } catch {
    return null;
  }
}

async function parseWithRepair(
  client: Anthropic,
  raw: string,
  stopReason: string | null | undefined,
): Promise<GeneratedSlide[]> {
  const first = tryParse(raw);
  if (first) return first;
  if (stopReason === "max_tokens") {
    throw new Error("Model response was truncated (max_tokens). Try fewer slides or a shorter instruction.");
  }
  // One-shot JSON repair, same approach as the streaming pipeline.
  const repairMsg = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system:
      "You are a JSON repair tool. The user gives you a string that should be a JSON array of slide objects but failed to parse. Return ONLY the corrected JSON array — no markdown, no commentary. Preserve all field values verbatim; only fix syntax. Output starts with [ and ends with ].",
    messages: [{ role: "user", content: [{ type: "text", text: `Fix this broken JSON.\n\n${raw}` }] }],
  });
  const repairedRaw = repairMsg.content[0]?.type === "text" ? repairMsg.content[0].text : "";
  const repaired = tryParse(repairedRaw);
  if (!repaired) throw new Error(`Could not parse model output as a slide array: ${raw.slice(0, 200)}`);
  return repaired;
}

export interface DraftSlidesResult {
  slides: Slide[];
  /** Impeccable detect reports after structural repair (read-only; does not mutate animKeys). */
  impeccable: DetectReport[];
}

export async function draftSlides(input: DraftSlidesInput): Promise<Slide[]> {
  const result = await draftSlidesWithDetect(input);
  return result.slides;
}

/** Same as draftSlides but also returns Impeccable detect reports for clients. */
export async function draftSlidesWithDetect(input: DraftSlidesInput): Promise<DraftSlidesResult> {
  const { client, deckTitle, audienceType, audienceProfile, section, chunks, images = [], count, instruction, baseSlide } = input;

  // Reconstruct a grounding "source" from the stored chunks.
  const sourceText = chunks.map((c) => `${c.id}: ${c.text}`).join("\n\n").slice(0, SOURCE_TRUNCATE);
  const hasCandidateChunks = !!section.candidateChunkIds?.length;
  const sectionChunks = selectSectionChunks(chunks, section, deckTitle);
  const sectionChunkSummary = formatSectionChunks(sectionChunks, hasCandidateChunks);

  const imageSummary = images.length > 0
    ? `\nAvailable source images (use any that strengthen a slide; emit type "image" with "imageRef", or set "imageRef" on a slide that supports a figure):\n${images
        .map((im) => `${im.id}${im.page ? ` (p${im.page})` : ""}${im.captionHint ? `: ${im.captionHint.slice(0, 140)}` : ""}`)
        .join("\n")}`
    : "\n(No source images are available for this deck.)";

  // Attach the actual image bytes so the model can visually pick the right one
  // when the user asks for "the image from the PDF for this slide".
  const visionImages = orderImagesForSection(images, section.candidateImageIds, 6);
  const visionBlocks = await buildVisionImageBlocks(visionImages);

  const audiencePrompt = formatAudienceProfileForPrompt(audienceProfile);

  const baseBlock = baseSlide
    ? `\n\n--- CURRENT SLIDE (re-draft this one) ---\n${JSON.stringify(baseSlide, null, 2)}\n--- END CURRENT SLIDE ---\nKeep its "type"/intent, "label", and "color" unless the user instruction below clearly requires a change. Improve clarity, fix gaps, and address the instruction.`
    : "";

  const instructionBlock = instruction?.trim()
    ? `\n\n--- USER INSTRUCTION (highest priority) ---\n${instruction.trim()}\n--- END USER INSTRUCTION ---`
    : "";

  const task = baseSlide
    ? `Produce exactly ${count} slide(s) as a JSON array — a re-drafted version of the current slide above.`
    : `Produce exactly ${count} slide(s) as a JSON array that cover the requested knowledge point for this deck. Ground every factual claim in the provided chunks via "evidenceRefs".`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: SECTION_DRAFT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `--- SOURCE START ---\n${sourceText}\n--- SOURCE END ---`, cache_control: { type: "ephemeral" } },
          ...visionBlocks,
          {
            type: "text",
            text: `Audience: ${audienceType}\nNormalized audience profile: ${audienceProfile.label}\nDeck title: ${deckTitle}\n\n--- AUDIENCE PROFILE ---\n${audiencePrompt}\n--- END AUDIENCE PROFILE ---\n\nSection context:\n${JSON.stringify(
              { id: section.id, name: section.name, purpose: section.purpose, label: section.label, color: section.color },
              null,
              2,
            )}${sectionChunkSummary}${imageSummary}${baseBlock}${instructionBlock}\n\nIf actual source image blocks are attached above, inspect them visually. When the user's instruction asks for an image / figure / screenshot from the source, choose the most relevant available image and reference it with "imageRef": "IMG-..." (use a type "image" slide unless the slide already supports a figure). Only use an "imageRef" id that appears in the list above — never invent one. If no available image fits, do not fabricate one.\n\n${task} Use label "${section.label}" and color "${section.color}" on every slide unless told otherwise. Do NOT emit a section-divider. Attach supporting chunk id(s) as "evidenceRefs": ["CHK-..."] for factual claims. Output starts with [ and ends with ].`,
          },
        ],
      },
    ],
  });

  const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
  let slides = await parseWithRepair(client, raw, msg.stop_reason);

  const repaired = repairSectionSlides(slides, {
    section: { ...section, slideCount: count },
    deckTitle,
    audienceProfile,
    sectionChunkIds: sectionChunks.map((c) => c.id),
  });
  slides = repaired.slides;

  // Resolve imageRef → imageUrl using the deck's image manifest.
  const imagesById = new Map(images.map((im) => [im.id, im]));
  for (const s of slides) {
    const ref = (s as GeneratedSlide).imageRef;
    if (ref && imagesById.has(ref)) {
      const im = imagesById.get(ref)!;
      s.imageUrl = im.filepath;
      if (s.type === "image" && !s.imageLayout) s.imageLayout = "side";
    }
    if (ref) delete (s as GeneratedSlide).imageRef;
  }

  // Post-generation detect (read-only analysis — never overwrites animKey).
  const impeccable = runImpeccableOnSlides(slides as Slide[], DEFAULT_PRESET_ID);

  return { slides: slides as Slide[], impeccable };
}
