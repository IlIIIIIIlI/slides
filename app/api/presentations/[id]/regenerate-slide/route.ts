export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { getAudienceProfile } from "@/lib/generation/audience";
import { draftSlides } from "@/lib/generation/single-draft";
import { isValidDeckId, loadDeck, resolveSectionForSlide, saveDeck } from "@/lib/generation/deck";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || !isValidDeckId(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  let body: { slideIndex?: number; instruction?: string; attachImageId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slideIndex = body.slideIndex;
  if (typeof slideIndex !== "number" || !Number.isInteger(slideIndex)) {
    return NextResponse.json({ error: "slideIndex (integer) is required" }, { status: 400 });
  }

  const deck = await loadDeck(id);
  if (!deck) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (slideIndex < 0 || slideIndex >= deck.slides.length) {
    // The client referenced a slide by position that no longer exists on disk
    // (slides have no stable id, so a deck edited/regenerated in another tab
    // leaves an open player pointing past the end). Hand back the real count so
    // the client can resync rather than dead-ending. 409 = state conflict.
    return NextResponse.json(
      {
        error: `Slide ${slideIndex + 1} no longer exists — this deck now has ${deck.slides.length} slide(s). It may have changed in another tab; it has been reloaded, please try again.`,
        slideCount: deck.slides.length,
      },
      { status: 409 },
    );
  }

  const baseSlide = deck.slides[slideIndex];
  // Clone so we don't mutate the shared outline section when prioritizing an image.
  const section = { ...resolveSectionForSlide(deck, baseSlide) };
  const audienceProfile = getAudienceProfile(deck.audienceType);

  // Optional user-attached image (uploaded just before regenerating) that must appear.
  const attachImageId = typeof body.attachImageId === "string" ? body.attachImageId : undefined;
  const attachImage = attachImageId ? (deck.images ?? []).find((im) => im.id === attachImageId) : undefined;
  let instruction = body.instruction ?? "";
  if (attachImage) {
    section.candidateImageIds = [attachImage.id, ...(section.candidateImageIds ?? [])];
    instruction = `${instruction}\n\nThe user attached an image (id: ${attachImage.id}) that MUST appear on this slide. Use an "image" or "split-visual" layout and reference it with imageRef: "${attachImage.id}".`.trim();
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let newSlides;
  try {
    newSlides = await draftSlides({
      client,
      deckTitle: deck.title,
      audienceType: deck.audienceType || "technical",
      audienceProfile,
      section,
      chunks: deck.chunks ?? [],
      images: deck.images ?? [],
      count: 1,
      instruction,
      baseSlide,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Regeneration failed" },
      { status: 502 },
    );
  }

  const regenerated = newSlides[0];
  if (!regenerated) return NextResponse.json({ error: "Model returned no slide" }, { status: 502 });

  // Guarantee the user-attached image actually shows, even if the model didn't reference it.
  if (attachImage && regenerated.imageUrl !== attachImage.filepath) {
    regenerated.imageUrl = attachImage.filepath;
    if (regenerated.type !== "image" && regenerated.type !== "split-visual") {
      regenerated.type = "image";
      regenerated.imageLayout = regenerated.imageLayout ?? "side";
      regenerated.variant = regenerated.variant ?? "side";
    }
  }

  // Preserve any manual layout overrides the user had applied to this slide.
  if (baseSlide.overrides) regenerated.overrides = baseSlide.overrides;

  deck.slides[slideIndex] = regenerated;
  await saveDeck(deck);

  return NextResponse.json({ ok: true, slide: regenerated, slideIndex });
}
