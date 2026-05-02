import fs from "fs/promises";
import path from "path";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";

import type { ExtractedImage } from "@/lib/generation/extract";

export const VISION_IMAGE_LIMIT = 6;
export const VISION_IMAGE_MAX_BYTES = 4_000_000;

type SupportedImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export function mediaTypeForImagePath(filePath: string): SupportedImageMediaType | null {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return null;
}

export function publicImagePathToDiskPath(publicPath: string, publicRoot = path.join(process.cwd(), "public")): string | null {
  if (!publicPath.startsWith("/")) return null;

  const resolvedRoot = path.resolve(publicRoot);
  const resolvedPath = path.resolve(resolvedRoot, publicPath.replace(/^\/+/, ""));
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    return null;
  }

  return resolvedPath;
}

export function orderImagesForSection(
  images: ExtractedImage[],
  candidateImageIds: string[] = [],
  limit = VISION_IMAGE_LIMIT,
): ExtractedImage[] {
  const selected: ExtractedImage[] = [];
  const seen = new Set<string>();
  const byId = new Map(images.map((image) => [image.id, image]));

  for (const id of candidateImageIds) {
    const image = byId.get(id);
    if (!image || seen.has(image.id)) continue;
    selected.push(image);
    seen.add(image.id);
  }

  for (const image of images) {
    if (seen.has(image.id)) continue;
    selected.push(image);
    seen.add(image.id);
  }

  return selected.slice(0, limit);
}

export async function buildVisionImageBlocks(
  images: ExtractedImage[],
  options: {
    limit?: number;
    maxBytes?: number;
    publicRoot?: string;
  } = {},
): Promise<ContentBlockParam[]> {
  const limit = options.limit ?? VISION_IMAGE_LIMIT;
  const maxBytes = options.maxBytes ?? VISION_IMAGE_MAX_BYTES;
  const blocks: ContentBlockParam[] = [];

  for (const image of images.slice(0, limit)) {
    const mediaType = mediaTypeForImagePath(image.filepath);
    if (!mediaType) continue;

    const diskPath = publicImagePathToDiskPath(image.filepath, options.publicRoot);
    if (!diskPath) continue;

    let file: Buffer;
    try {
      const stat = await fs.stat(diskPath);
      if (!stat.isFile() || stat.size === 0 || stat.size > maxBytes) continue;
      file = await fs.readFile(diskPath);
    } catch {
      continue;
    }

    const page = image.page !== undefined ? ` page ${image.page}` : "";
    const caption = image.captionHint ? ` Caption/context: ${image.captionHint.slice(0, 220)}` : "";
    blocks.push({
      type: "text",
      text: `Actual source image ${image.id}${page}.${caption}`,
    });
    blocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: file.toString("base64"),
      },
    });
  }

  return blocks;
}
