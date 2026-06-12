export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { isValidDeckId, loadDeck, saveDeck } from "@/lib/generation/deck";
import type { Slide } from "@/app/slides";

// Appends a slide (sent in the body) to THIS deck. Used to copy/move a slide
// from another deck — the caller targets the destination deck id in the URL.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || !isValidDeckId(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  let body: { slide?: Slide };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slide = body.slide;
  if (!slide || typeof slide !== "object" || typeof slide.type !== "string") {
    return NextResponse.json({ error: "A slide object is required" }, { status: 400 });
  }

  const deck = await loadDeck(id);
  if (!deck) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Evidence chunk ids belong to the source deck and won't resolve here — drop
  // them so the destination doesn't show dangling source references.
  const { evidenceRefs: _evidenceRefs, ...rest } = slide;
  deck.slides = [...deck.slides, rest as Slide];
  await saveDeck(deck);

  return NextResponse.json({ ok: true, slideCount: deck.slides.length });
}
