export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), "data", "presentations");

export async function POST(req: NextRequest) {
  let body: { title?: string; audienceType?: string; stylePreset?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  await fs.mkdir(DATA_DIR, { recursive: true });

  const id = randomUUID();
  const deck = {
    id,
    title,
    audienceType: body.audienceType ?? "technical",
    stylePreset: body.stylePreset ?? "minimal",
    slides: [],
    slideCount: 0,
    generatedAt: new Date().toISOString(),
  };

  await fs.writeFile(path.join(DATA_DIR, `${id}.json`), JSON.stringify(deck, null, 2), "utf-8");
  return NextResponse.json(deck, { status: 201 });
}

export async function GET() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    const presentations = await Promise.all(
      jsonFiles.map(async (file) => {
        const raw = await fs.readFile(path.join(DATA_DIR, file), "utf-8");
        const data = JSON.parse(raw);
        // Return metadata only — no slides array
        return {
          id: data.id,
          title: data.title,
          sourceName: data.sourceName,
          sourceType: data.sourceType,
          audienceType: data.audienceType,
          stylePreset: data.stylePreset,
          slideCount: data.slideCount,
          generatedAt: data.generatedAt,
        };
      })
    );

    presentations.sort((a, b) =>
      new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );

    return NextResponse.json({ presentations });
  } catch {
    return NextResponse.json({ presentations: [] });
  }
}
