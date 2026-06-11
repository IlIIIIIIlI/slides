// Server-side helpers for reading/writing persisted decks and mapping a slide
// back to the outline section it belongs to (so on-demand regeneration can
// reuse the same section context the deck was generated with).

import fs from "fs/promises";
import path from "path";

import type { Slide } from "@/app/slides";
import type { ExtractedChunk, ExtractedImage } from "@/lib/generation/extract";
import type { OutlineSectionLike } from "@/lib/generation/repair";

export const DATA_DIR = path.join(process.cwd(), "data", "presentations");

export interface DeckRecord {
  id: string;
  title: string;
  audienceType?: string;
  stylePreset?: string;
  slides: Slide[];
  outline?: { title: string; totalSlideCount: number; sections: OutlineSectionLike[] };
  chunks?: ExtractedChunk[];
  images?: ExtractedImage[];
  slideCount?: number;
  [key: string]: unknown;
}

export function isValidDeckId(id: string): boolean {
  return /^[0-9a-f-]{36}$/.test(id);
}

export async function loadDeck(id: string): Promise<DeckRecord | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${id}.json`), "utf-8");
    return JSON.parse(raw) as DeckRecord;
  } catch {
    return null;
  }
}

export async function saveDeck(deck: DeckRecord): Promise<void> {
  deck.slideCount = deck.slides.length;
  await fs.writeFile(path.join(DATA_DIR, `${deck.id}.json`), JSON.stringify(deck, null, 2), "utf-8");
}

/** Find the outline section a slide belongs to, or synthesize one from the slide. */
export function resolveSectionForSlide(deck: DeckRecord, slide: Slide): OutlineSectionLike {
  const sections = deck.outline?.sections ?? [];

  // 1) Match by the slide's label (sections own a label that slides inherit).
  if (slide.label) {
    const byLabel = sections.find((s) => s.label && s.label === slide.label);
    if (byLabel) return byLabel;
  }

  // 2) Match by evidence overlap with a section's candidate chunks.
  if (slide.evidenceRefs?.length) {
    const refs = new Set(slide.evidenceRefs);
    const byEvidence = sections.find((s) => (s.candidateChunkIds ?? []).some((id) => refs.has(id)));
    if (byEvidence) return byEvidence;
  }

  // 3) Synthesize a single-slide section from the slide itself.
  return {
    id: `SEC-${(slide.label || "SLIDE").replace(/\s+/g, "-").toUpperCase()}`,
    name: slide.label || slide.headline || deck.title,
    purpose: `Re-draft of an existing slide in "${deck.title}".`,
    label: slide.label || "",
    color: slide.color || "#14b8a6",
    slideCount: 1,
    candidateChunkIds: slide.evidenceRefs,
  };
}

/** Build an ad-hoc section for generating slides about a free-text knowledge point. */
export function makeTopicSection(deck: DeckRecord, topic: string): OutlineSectionLike {
  const sections = deck.outline?.sections ?? [];
  const lastColor = sections[sections.length - 1]?.color || "#14b8a6";
  return {
    id: "SEC-ADDITIONAL",
    name: topic.slice(0, 60),
    purpose: `Cover this knowledge point that the deck currently omits: ${topic}`,
    label: "ADDITIONAL",
    color: lastColor,
    slideCount: 1,
    // Leave candidateChunkIds undefined so selectSectionChunks scores all chunks
    // against the topic text.
  };
}
