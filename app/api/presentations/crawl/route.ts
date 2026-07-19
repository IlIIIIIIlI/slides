export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  crawlProductPath,
  CrawlValidationError,
  CrawlFetchError,
  DEFAULT_MAX_URLS,
} from "@/lib/generation/product-crawl";
import { saveDeck, type DeckRecord } from "@/lib/generation/deck";

/**
 * POST /api/presentations/crawl
 * Body: { urls: string[], title?: string, options?: { maxUrls?, timeoutMs?, includeScreenshots? } }
 *
 * Crawls an ordered product URL path into a Flip-morphing tour deck and persists it.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }

  const { urls, title, options } = body as {
    urls?: unknown;
    title?: unknown;
    options?: {
      maxUrls?: number;
      timeoutMs?: number;
      includeScreenshots?: boolean;
    };
  };

  if (title !== undefined && typeof title !== "string") {
    return NextResponse.json({ error: "`title` must be a string when provided" }, { status: 400 });
  }

  try {
    const draft = await crawlProductPath({
      urls: urls as string[],
      title: typeof title === "string" ? title : undefined,
      options: {
        maxUrls: options?.maxUrls ?? DEFAULT_MAX_URLS,
        timeoutMs: options?.timeoutMs,
        includeScreenshots: options?.includeScreenshots,
      },
    });

    const record: DeckRecord = {
      id: draft.id,
      title: draft.title,
      sourceName: draft.sourceName,
      sourceType: draft.sourceType,
      audienceType: draft.audienceType,
      stylePreset: draft.stylePreset,
      slideCount: draft.slideCount,
      generatedAt: draft.generatedAt,
      slides: draft.slides,
      autoAnimate: draft.autoAnimate,
      sourceUrls: draft.sourceUrls,
    };

    await saveDeck(record);

    return NextResponse.json({
      id: draft.id,
      title: draft.title,
      slideCount: draft.slideCount,
      sourceUrls: draft.sourceUrls,
    });
  } catch (err) {
    if (err instanceof CrawlValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof CrawlFetchError) {
      return NextResponse.json(
        { error: err.message, url: err.url },
        { status: 502 },
      );
    }
    console.error("[presentations/crawl]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Crawl failed" },
      { status: 500 },
    );
  }
}
