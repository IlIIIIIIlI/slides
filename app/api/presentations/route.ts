export const runtime = "nodejs";

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "presentations");

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
