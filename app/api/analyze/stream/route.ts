export const runtime = "nodejs";

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";

import { extractText, stripFences, type ExtractedChunk, type ExtractedImage } from "@/lib/generation/extract";
import { OUTLINE_SYSTEM_PROMPT, SECTION_DRAFT_SYSTEM_PROMPT } from "@/lib/generation/prompts";
import { validateSlides } from "@/lib/generation/validate";
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
  const audienceType = (formData.get("audienceType") as string) || "mixed";
  const stylePreset = (formData.get("stylePreset") as string) || "dark-minimal";

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
        send("extract", {
          sourceName: extracted.sourceName,
          charCount: sourceText.length,
          chunkCount: extracted.chunks.length,
          imageCount: extracted.images.length,
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

        const outlineMsg = await client.messages.create({
          model: MODEL,
          max_tokens: 3072,
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
                {
                  type: "text",
                  text: `Source: ${extracted.sourceName}\nAudience: ${audienceType}\nStyle: ${stylePreset}\n\nProduce the outline JSON. Optionally include "candidateChunkIds" and "candidateImageIds" arrays per section using ONLY ids from the chunk/image indexes above.`,
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
          // Per-section context: full source + this section's candidate chunks (if any).
          const sectionChunkSummary = section.candidateChunkIds && section.candidateChunkIds.length > 0
            ? `\nCandidate chunks for this section:\n${extracted.chunks
                .filter((c) => section.candidateChunkIds!.includes(c.id))
                .map((c) => `${c.id}: ${c.text.slice(0, 300)}`)
                .join("\n")}`
            : "";

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

          const sectionMsg = await client.messages.create({
            model: MODEL,
            max_tokens: 4096,
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
                  {
                    type: "text",
                    text: `Audience: ${audienceType}\nDeck title: ${outline.title}\n\nSection to draft:\n${JSON.stringify({
                      id: section.id,
                      name: section.name,
                      purpose: section.purpose,
                      label: section.label,
                      color: section.color,
                      slideCount: section.slideCount,
                    }, null, 2)}${sectionChunkSummary}${sectionImageSummary}\n\nProduce ${section.slideCount} slide(s) for this section as a JSON array. Use label "${section.label}" and color "${section.color}" on every slide. Do NOT emit a section-divider unless this section follows the opening section in the outline. For any factual claim, quote, or metric, attach the supporting chunk id(s) as "evidenceRefs": ["CHK-..."]. To use a source image, set "imageRef": "IMG-..." (the renderer will resolve it to imageUrl).`,
                  },
                ],
              },
            ],
          });
          const raw = sectionMsg.content[0].type === "text" ? sectionMsg.content[0].text : "";
          let sectionSlides: Slide[];
          try {
            const parsed = JSON.parse(stripFences(raw));
            if (!Array.isArray(parsed)) throw new Error("not an array");
            sectionSlides = parsed as Slide[];
          } catch {
            throw new Error(`Section "${section.id}" JSON parse failed: ${raw.slice(0, 200)}`);
          }

          // Resolve imageRef → imageUrl using our manifest.
          for (const s of sectionSlides) {
            const sx = s as Slide & { imageRef?: string };
            if (sx.imageRef && imagesById.has(sx.imageRef)) {
              const im = imagesById.get(sx.imageRef)!;
              s.imageUrl = im.filepath;
              if (s.type === "image" && !s.imageLayout) s.imageLayout = "side";
            }
            if (sx.imageRef) delete sx.imageRef;
          }

          slidesDone += sectionSlides.length;
          send("draft-progress", { slidesDone, slidesTotal, sectionId: section.id });
          return { sectionId: section.id, slides: sectionSlides };
        });

        let sectionResults: { sectionId: string; slides: Slide[] }[];
        try {
          sectionResults = await Promise.all(sectionPromises);
        } catch (err) {
          return fail(err instanceof Error ? err.message : "Section drafting failed");
        }

        // Re-assemble in outline order
        const slidesById = new Map(sectionResults.map((r) => [r.sectionId, r.slides]));
        const allSlides: Slide[] = outline.sections.flatMap((s) => slidesById.get(s.id) ?? []);

        // ---------- Stage 4: validate ----------
        send("stage", { stage: "validating" });
        const warnings = validateSlides(allSlides);
        send("validate", { warnings });

        // ---------- Stage 5: persist ----------
        const now = new Date().toISOString();
        const record = {
          id: presentationId,
          title: outline.title || extracted.sourceName,
          sourceName: extracted.sourceName,
          sourceType: extracted.sourceType,
          audienceType,
          stylePreset,
          slideCount: allSlides.length,
          generatedAt: now,
          slides: allSlides,
          outline,
          chunks: extracted.chunks,
          images: extracted.images,
          validationWarnings: warnings,
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
