export const runtime = "nodejs";

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";

import { extractText, stripFences, type ExtractedChunk, type ExtractedImage } from "@/lib/generation/extract";
import { OUTLINE_SYSTEM_PROMPT, SECTION_DRAFT_SYSTEM_PROMPT } from "@/lib/generation/prompts";
import { formatAudienceProfileForPrompt, getAudienceProfile } from "@/lib/generation/audience";
import {
  formatSectionChunks,
  normalizeOutlineSlideCounts,
  repairGeneratedDeck,
  repairSectionSlides,
  selectSectionChunks,
  type GeneratedSlide,
} from "@/lib/generation/repair";
import { formatCriticalWarnings, hasCriticalWarnings, validateOutline, validateSlides } from "@/lib/generation/validate";
import { buildVisionImageBlocks, orderImagesForSection } from "@/lib/generation/vision";
import { generateFidelityReport } from "@/lib/generation/fidelity";
import type { Slide } from "@/app/slides";

const DATA_DIR = path.join(process.cwd(), "data", "presentations");
const MODEL = "claude-sonnet-4-6";
const SOURCE_TRUNCATE = 80_000;

interface OutlineSection {
  id: string;
  name: string;
  purpose: string;
  label: string;
  color: string;
  slideCount: number;
  candidateChunkIds?: string[];
  candidateImageIds?: string[];
}

interface OutlinePlanResponse {
  title: string;
  totalSlideCount: number;
  sections: OutlineSection[];
}

function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function summariseChunks(chunks: ExtractedChunk[]): string {
  return chunks
    .map((c) => {
      const where = c.page !== undefined ? `p${c.page}¶${c.paragraph}` : `¶${c.paragraph}`;
      const excerpt = c.text.slice(0, 220);
      return `${c.id} (${where}): ${excerpt}${c.text.length > 220 ? "…" : ""}`;
    })
    .join("\n");
}

function summariseImages(images: ExtractedImage[]): string {
  if (images.length === 0) return "(none)";
  return images
    .map((im) => {
      const where = im.page !== undefined ? `p${im.page}` : "";
      const cap = im.captionHint ? ` — ${im.captionHint.slice(0, 120)}` : "";
      return `${im.id}${where ? ` (${where})` : ""}${cap}`;
    })
    .join("\n");
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid form data" }), { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const url = (formData.get("url") as string | null)?.trim() || null;
  const audienceType = (formData.get("audienceType") as string) || "technical";
  const stylePreset = (formData.get("stylePreset") as string) || "dark-minimal";
  const audienceProfile = getAudienceProfile(audienceType);
  const audienceProfilePrompt = formatAudienceProfileForPrompt(audienceProfile);

  if (!file && !url) {
    return new Response(JSON.stringify({ error: "Provide a file or URL" }), { status: 400 });
  }
  if (file && file.size > 25 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: "File too large (max 25 MB)" }), { status: 400 });
  }

  const presentationId = uuidv4();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(sse(event, data));
      const fail = (message: string) => {
        send("error", { message });
        controller.close();
      };

      try {
        // ---------- Stage 1: extract ----------
        send("stage", { stage: "extracting" });
        const extracted = await extractText(file, url, presentationId);
        const sourceText = extracted.fullText.slice(0, SOURCE_TRUNCATE);
        const validChunkIds = new Set(extracted.chunks.map((chunk) => chunk.id));
        const validImageIds = new Set(extracted.images.map((image) => image.id));
        send("extract", {
          sourceName: extracted.sourceName,
          charCount: sourceText.length,
          chunkCount: extracted.chunks.length,
          imageCount: extracted.images.length,
          audienceProfile: audienceProfile.label,
        });

        // If we have NO text and NO images, fail early.
        if (!sourceText && extracted.images.length === 0) {
          return fail("Source had no extractable text or images.");
        }

        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        // ---------- Stage 2: outline ----------
        send("stage", { stage: "outlining" });

        const chunkSummary = extracted.chunks.length > 0
          ? `\n--- CHUNK INDEX ---\n${summariseChunks(extracted.chunks)}\n--- END CHUNK INDEX ---`
          : "";
        const imageSummary = `\n--- IMAGE INDEX ---\n${summariseImages(extracted.images)}\n--- END IMAGE INDEX ---`;
        const outlineVisionBlocks = await buildVisionImageBlocks(orderImagesForSection(extracted.images, [], 6));
        if (outlineVisionBlocks.length > 0) {
          send("vision", {
            imageBlockCount: outlineVisionBlocks.filter((block) => block.type === "image").length,
            message: "Focused source images attached for LLM visual inspection.",
          });
        }

        const outlineMsg = await client.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: OUTLINE_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `--- SOURCE START ---\n${sourceText || "(image-only source — see image index below)"}\n--- SOURCE END ---${chunkSummary}${imageSummary}`,
                  cache_control: { type: "ephemeral" },
                },
                ...outlineVisionBlocks,
                {
                  type: "text",
                  text: `Source: ${extracted.sourceName}\nAudience: ${audienceType}\nNormalized audience profile: ${audienceProfile.label}\nStyle: ${stylePreset}\n\n--- AUDIENCE PROFILE ---\n${audienceProfilePrompt}\n--- END AUDIENCE PROFILE ---\n\nIf actual source image blocks are attached above, inspect them visually. Use what you can see in those focused regions, not just the caption text, when assigning "candidateImageIds".\n\nProduce the outline JSON. Include "candidateChunkIds" and "candidateImageIds" arrays per section when useful, using ONLY ids from the chunk/image indexes above. For quiz-enabled profiles, include a final quiz/checkpoint section and count those slides in totalSlideCount.`,
                },
              ],
            },
          ],
        });
        const outlineRaw = outlineMsg.content[0].type === "text" ? outlineMsg.content[0].text : "";
        let outline: OutlinePlanResponse;
        try {
          outline = JSON.parse(stripFences(outlineRaw));
          if (!Array.isArray(outline.sections) || outline.sections.length === 0) throw new Error("no sections");
        } catch {
          return fail(`Outline JSON parse failed: ${outlineRaw.slice(0, 200)}`);
        }
        const outlineNormalization = normalizeOutlineSlideCounts(outline, audienceProfile);
        outline = outlineNormalization.outline;
        if (outlineNormalization.changed) {
          send("outline-repair", { message: outlineNormalization.message });
        }
        const outlineWarnings = validateOutline(outline, { audienceProfile, validChunkIds, validImageIds });
        if (hasCriticalWarnings(outlineWarnings)) {
          return fail(formatCriticalWarnings(outlineWarnings, "Outline validation failed"));
        }
        send("outline", {
          title: outline.title,
          sectionCount: outline.sections.length,
          totalSlides: outline.totalSlideCount,
        });

        // ---------- Stage 3: drafting (parallel per section) ----------
        send("stage", { stage: "drafting" });
        let slidesDone = 0;
        const slidesTotal = outline.totalSlideCount;
        send("draft-progress", { slidesDone, slidesTotal });

        const imagesById = new Map(extracted.images.map((im) => [im.id, im]));

        const sectionPromises = outline.sections.map(async (section) => {
          // Per-section context: bounded chunk set that the model may cite.
          const hasCandidateChunks = !!section.candidateChunkIds?.length;
          const sectionChunks = selectSectionChunks(extracted.chunks, section, outline.title);
          const sectionChunkSummary = formatSectionChunks(sectionChunks, hasCandidateChunks);

          // Images: always show every available source image to every section draft
          // — the outline's per-section binding is optional, so we'd rather over-show
          // than have the model "forget" that figures exist.
          const sectionImageSummary = extracted.images.length > 0
            ? `\nAvailable source images (use any that strengthen a slide; emit them as type "image" with imageRef):\n${extracted.images
                .map((im) => {
                  const tag = section.candidateImageIds?.includes(im.id) ? " ★preferred" : "";
                  return `${im.id}${im.page ? ` (p${im.page})` : ""}${tag}${im.captionHint ? `: ${im.captionHint.slice(0, 140)}` : ""}`;
                })
                .join("\n")}`
            : "";
          const sectionVisionImages = orderImagesForSection(extracted.images, section.candidateImageIds, 6);
          const sectionVisionBlocks = await buildVisionImageBlocks(sectionVisionImages);

          const sectionMsg = await client.messages.create({
            model: MODEL,
            max_tokens: 16384,
            system: SECTION_DRAFT_SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `--- SOURCE START ---\n${sourceText}\n--- SOURCE END ---`,
                    cache_control: { type: "ephemeral" },
                  },
                  ...sectionVisionBlocks,
                  {
                    type: "text",
                    text: `Audience: ${audienceType}\nNormalized audience profile: ${audienceProfile.label}\nDeck title: ${outline.title}\n\n--- AUDIENCE PROFILE ---\n${audienceProfilePrompt}\n--- END AUDIENCE PROFILE ---\n\nSection to draft:\n${JSON.stringify({
                      id: section.id,
                      name: section.name,
                      purpose: section.purpose,
                      label: section.label,
                      color: section.color,
                      slideCount: section.slideCount,
                    }, null, 2)}${sectionChunkSummary}${sectionImageSummary}\n\nIf actual source image blocks are attached above, inspect them visually before deciding whether this section needs a figure, screenshot, diagram, chart, or visual explanation slide. Use "imageRef" only for images you can explain from the visual content.\n\nProduce exactly ${section.slideCount} slide(s) for this section as a JSON array. Use label "${section.label}" and color "${section.color}" on every slide. Do NOT emit a section-divider unless this section follows the opening section in the outline. For any factual claim, quote, metric, methodology statement, or code claim, attach supporting chunk id(s) from the provided section chunk list as "evidenceRefs": ["CHK-..."]. To use a source image, set "imageRef": "IMG-..." (the renderer will resolve it to imageUrl). If this is a quiz/checkpoint section, produce quiz slides only and place them after the content slides in the final deck.`,
                  },
                ],
              },
            ],
          });
          const raw = sectionMsg.content[0].type === "text" ? sectionMsg.content[0].text : "";
          let sectionSlides: GeneratedSlide[];

          const tryParse = (text: string): GeneratedSlide[] | null => {
            try {
              const parsed = JSON.parse(stripFences(text));
              return Array.isArray(parsed) ? (parsed as GeneratedSlide[]) : null;
            } catch {
              return null;
            }
          };

          const firstParse = tryParse(raw);
          if (firstParse) {
            sectionSlides = firstParse;
          } else if (sectionMsg.stop_reason === "max_tokens") {
            // Truncated output is unrecoverable via repair — fail fast with a clear hint.
            const head = raw.slice(0, 200);
            const tail = raw.length > 400 ? ` … ${raw.slice(-200)}` : "";
            throw new Error(
              `Section "${section.id}" JSON parse failed (response truncated at max_tokens — increase max_tokens or shrink slideCount): ${head}${tail}`,
            );
          } else {
            // One-shot LLM repair pass: hand the broken text back to the model and
            // ask only for the corrected JSON array. Common cause is an unescaped
            // double-quote inside a long string field.
            send("section-repair", { sectionId: section.id, message: "Section JSON malformed; attempting one-shot repair." });
            let repaired: GeneratedSlide[] | null = null;
            try {
              const repairMsg = await client.messages.create({
                model: MODEL,
                max_tokens: 16384,
                system: "You are a JSON repair tool. The user will give you a string that was supposed to be a JSON array of slide objects but failed to parse. Return ONLY the corrected JSON array — no markdown fences, no commentary, no explanation. Preserve all field values verbatim; only fix syntax (unescaped quotes inside strings, missing commas, trailing commas, mismatched brackets). Output starts with [ and ends with ].",
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: `Fix this broken JSON. Output starts with [ and ends with ].\n\n${raw}` },
                    ],
                  },
                ],
              });
              const repairedRaw = repairMsg.content[0]?.type === "text" ? repairMsg.content[0].text : "";
              repaired = tryParse(repairedRaw);
            } catch {
              // network or model error — fall through to fail
            }
            if (!repaired) {
              const head = raw.slice(0, 200);
              const tail = raw.length > 400 ? ` … ${raw.slice(-200)}` : "";
              throw new Error(`Section "${section.id}" JSON parse failed (repair attempt also failed): ${head}${tail}`);
            }
            sectionSlides = repaired;
          }

          const sectionRepair = repairSectionSlides(sectionSlides, {
            section,
            deckTitle: outline.title,
            audienceProfile,
            sectionChunkIds: sectionChunks.map((chunk) => chunk.id),
          });
          sectionSlides = sectionRepair.slides;

          const sectionWarnings = validateSlides(sectionSlides, {
            audienceProfile,
            expectedSlideCount: section.slideCount,
            scope: "section",
            validChunkIds,
            validImageIds,
            imageCount: extracted.images.length,
          });
          if (hasCriticalWarnings(sectionWarnings)) {
            throw new Error(formatCriticalWarnings(sectionWarnings, `Section "${section.id}" validation failed`));
          }

          // Resolve imageRef → imageUrl using our manifest.
          for (const s of sectionSlides) {
            if (s.imageRef && imagesById.has(s.imageRef)) {
              const im = imagesById.get(s.imageRef)!;
              s.imageUrl = im.filepath;
              if (s.type === "image" && !s.imageLayout) s.imageLayout = "side";
            }
            if (s.imageRef) delete s.imageRef;
          }

          slidesDone += sectionSlides.length;
          send("draft-progress", { slidesDone, slidesTotal, sectionId: section.id });
          return { sectionId: section.id, slides: sectionSlides as Slide[] };
        });

        let sectionResults: { sectionId: string; slides: Slide[] }[];
        try {
          sectionResults = await Promise.all(sectionPromises);
        } catch (err) {
          return fail(err instanceof Error ? err.message : "Section drafting failed");
        }

        // Re-assemble in outline order
        const slidesById = new Map(sectionResults.map((r) => [r.sectionId, r.slides]));
        let allSlides: Slide[] = outline.sections.flatMap((s) => slidesById.get(s.id) ?? []);
        const firstSection = outline.sections[0];
        const deckRepair = repairGeneratedDeck(allSlides, {
          title: outline.title || extracted.sourceName,
          audienceProfile,
          targetSlideCount: outline.totalSlideCount,
          defaultLabel: firstSection?.label,
          defaultColor: firstSection?.color,
          fallbackImageUrl: extracted.images[0]?.filepath,
        });
        allSlides = deckRepair.slides;
        if (deckRepair.changed) {
          send("deck-repair", { messages: Array.from(new Set(deckRepair.messages)) });
        }

        // ---------- Stage 4: validate ----------
        send("stage", { stage: "validating" });
        const warnings = validateSlides(allSlides, {
          audienceProfile,
          outlineTotalSlideCount: outline.totalSlideCount,
          scope: "deck",
          validChunkIds,
          validImageIds,
          imageCount: extracted.images.length,
        });
        if (hasCriticalWarnings(warnings)) {
          return fail(formatCriticalWarnings(warnings, "Slide validation failed"));
        }
        send("validate", { warnings });

        // ---------- Stage 5: fidelity report ----------
        send("stage", { stage: "fidelity" });
        const fidelityReport = await generateFidelityReport({
          client,
          model: MODEL,
          sourceText,
          chunks: extracted.chunks,
          outline,
          slides: allSlides,
          imageCount: extracted.images.length,
        });
        send("fidelity", { report: fidelityReport });

        // ---------- Stage 6: persist ----------
        const now = new Date().toISOString();
        const record = {
          id: presentationId,
          title: outline.title || extracted.sourceName,
          sourceName: extracted.sourceName,
          sourceType: extracted.sourceType,
          audienceType,
          audienceProfile: audienceProfile.id,
          audienceProfileLabel: audienceProfile.label,
          stylePreset,
          slideCount: allSlides.length,
          generatedAt: now,
          slides: allSlides,
          outline,
          chunks: extracted.chunks,
          images: extracted.images,
          validationWarnings: warnings,
          fidelityReport,
        };

        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(path.join(DATA_DIR, `${presentationId}.json`), JSON.stringify(record, null, 2), "utf-8");

        send("done", { id: presentationId, title: record.title, slideCount: allSlides.length });
        controller.close();
      } catch (err) {
        fail(err instanceof Error ? err.message : "Pipeline failed");
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
