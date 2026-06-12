export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { getAudienceProfile } from "@/lib/generation/audience";
import { draftSlides } from "@/lib/generation/single-draft";
import { isValidDeckId, loadDeck, makeTopicSection, saveDeck } from "@/lib/generation/deck";

const MAX_SLIDES = 4;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || !isValidDeckId(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  let body: { topic?: string; count?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const topic = body.topic?.trim();
  if (!topic) return NextResponse.json({ error: "topic is required" }, { status: 400 });
  const count = Math.min(Math.max(Math.round(body.count ?? 1), 1), MAX_SLIDES);

  const deck = await loadDeck(id);
  if (!deck) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const section = makeTopicSection(deck, topic);
  const audienceProfile = getAudienceProfile(deck.audienceType);

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
      count,
      instruction: `Generate ${count} slide(s) covering this knowledge point that the deck is missing: ${topic}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 502 },
    );
  }

  if (newSlides.length === 0) {
    return NextResponse.json({ error: "Model returned no slides" }, { status: 502 });
  }

  // Append the new slides to the end of the deck.
  deck.slides = [...deck.slides, ...newSlides];
  await saveDeck(deck);

  return NextResponse.json({ ok: true, slides: newSlides, slideCount: deck.slides.length });
}
