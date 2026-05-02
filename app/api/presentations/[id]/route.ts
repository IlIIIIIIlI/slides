export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "presentations");

function validId(id: string) {
  return /^[0-9a-f-]{36}$/.test(id);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || !validId(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${id}.json`), "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || !validId(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  const filePath = path.join(DATA_DIR, `${id}.json`);
  try {
    await fs.unlink(filePath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
  // Best-effort: also remove any extracted assets for this deck.
  const extractedDir = path.join(process.cwd(), "public", "extracted", id);
  await fs.rm(extractedDir, { recursive: true, force: true }).catch(() => {});
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || !validId(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  let body: {
    slides?: unknown[];
    stylePreset?: string;
    brand?: { text?: string; gradientFrom?: string; gradientTo?: string };
  };
  try {
    body = await req.json();
    if (body.slides !== undefined && !Array.isArray(body.slides)) throw new Error();
    if (body.slides === undefined && !body.stylePreset && !body.brand) throw new Error();
  } catch {
    return NextResponse.json({ error: "Body must include slides, stylePreset, or brand" }, { status: 400 });
  }

  const filePath = path.join(DATA_DIR, `${id}.json`);
  try {
    const existing = JSON.parse(await fs.readFile(filePath, "utf-8"));
    const patch: Record<string, unknown> = {};
    if (body.slides !== undefined) { patch.slides = body.slides; patch.slideCount = body.slides.length; }
    if (body.stylePreset !== undefined) patch.stylePreset = body.stylePreset;
    if (body.brand !== undefined) {
      const prev = (existing.brand ?? {}) as Record<string, string>;
      patch.brand = { ...prev, ...body.brand };
    }
    const updated = { ...existing, ...patch };
    await fs.writeFile(filePath, JSON.stringify(updated, null, 2), "utf-8");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
