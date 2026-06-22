import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

import type { PageArtifact } from "@/lib/generation/extract";
import { toBase64ImageBlock } from "@/lib/generation/vision";

export interface BuildExtractionContentOpts {
  maxPages?: number;
  maxTotalImageBytes?: number;
  instructionText: string;
}

/**
 * Convert a PageArtifact[] into an Anthropic MessageParam content array.
 *
 * Layout per page (in order):
 *   1. text block — "=== Page N ===\n<markdown>\n\n```json\n<bbox>\n```"
 *   2. image block — base64 PNG (omitted when screenshotPng is absent/empty)
 *
 * Then a final text block with the instructionText.
 *
 * Image blocks are pruned to satisfy maxPages and maxTotalImageBytes caps.
 * Text blocks are always preserved.
 */
export function buildExtractionContent(
  pages: PageArtifact[],
  opts: BuildExtractionContentOpts,
): MessageParam["content"] {
  const maxPages = opts.maxPages ?? 60;
  const maxTotalImageBytes = opts.maxTotalImageBytes ?? 25 * 1024 * 1024;

  // Determine which pages keep their image blocks.
  // Always keep all text blocks; only image blocks may be dropped.
  const pagesWithImages = pages.filter(
    (p) => p.screenshotPng && p.screenshotPng.length > 0,
  );

  // Page-cap eviction: keep the N pages with the longest markdown (most information).
  let keptImagePages = new Set(pagesWithImages.map((p) => p.index));
  if (keptImagePages.size > maxPages) {
    const sorted = [...pagesWithImages].sort(
      (a, b) => b.markdown.length - a.markdown.length,
    );
    keptImagePages = new Set(sorted.slice(0, maxPages).map((p) => p.index));
  }

  // Byte-cap eviction: drop largest images first until under budget.
  while (keptImagePages.size > 0) {
    const kept = pages.filter(
      (p) => keptImagePages.has(p.index) && p.screenshotPng && p.screenshotPng.length > 0,
    );
    const total = kept.reduce((sum, p) => sum + p.screenshotPng!.length, 0);
    if (total <= maxTotalImageBytes) break;

    // Drop the largest; break ties by lowest index.
    const largest = kept.reduce((a, b) => {
      if (b.screenshotPng!.length > a.screenshotPng!.length) return b;
      if (b.screenshotPng!.length === a.screenshotPng!.length && b.index < a.index) return b;
      return a;
    });
    keptImagePages.delete(largest.index);
  }

  const imagesKept = keptImagePages.size;
  const imagesDropped = pagesWithImages.length - imagesKept;
  const keptPages = pages.filter(
    (p) => keptImagePages.has(p.index) && p.screenshotPng && p.screenshotPng.length > 0,
  );
  const totalBytes = keptPages.reduce((sum, p) => sum + p.screenshotPng!.length, 0);

  console.info("[extract-vision]", {
    pages: pages.length,
    imagesKept,
    imagesDropped,
    totalBytes,
  });

  const content: MessageParam["content"] = [];

  for (const page of pages) {
    const bboxJson = JSON.stringify(page.bbox, null, 2);
    const textBlock = [
      `=== Page ${page.index} ===`,
      page.markdown,
      "",
      "```json",
      bboxJson,
      "```",
    ].join("\n");

    content.push({ type: "text", text: textBlock });

    if (keptImagePages.has(page.index) && page.screenshotPng && page.screenshotPng.length > 0) {
      content.push(toBase64ImageBlock(page.screenshotPng));
    }
  }

  content.push({ type: "text", text: opts.instructionText });

  return content;
}
