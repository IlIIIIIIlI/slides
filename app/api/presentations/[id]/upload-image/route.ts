export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

import { isValidDeckId, loadDeck, saveDeck } from "@/lib/generation/deck";

const MAX_BYTES = 10 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || !isValidDeckId(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image too large (max 10 MB)" }, { status: 400 });

  const ext = EXT_BY_MIME[file.type];
  if (!ext) return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });

  const deck = await loadDeck(id);
  if (!deck) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const uploadsDir = path.join(process.cwd(), "public", "extracted", id, "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const fileName = `${uuidv4()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(uploadsDir, fileName), buffer);

  const filepath = `/extracted/${id}/uploads/${fileName}`;
  const imageId = `IMG-UP-${uuidv4().slice(0, 8)}`;
  const caption = (file.name || "Uploaded image").slice(0, 120);

  deck.images = [...(deck.images ?? []), { id: imageId, filepath, captionHint: caption }];
  await saveDeck(deck);

  return NextResponse.json({ ok: true, id: imageId, filepath });
}
