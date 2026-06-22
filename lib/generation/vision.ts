import fs from "fs/promises";
import path from "path";
import type { ContentBlockParam, ImageBlockParam } from "@anthropic-ai/sdk/resources/messages";

import type { ExtractedImage } from "@/lib/generation/extract";

export const VISION_IMAGE_LIMIT = 6;
export const VISION_IMAGE_MAX_BYTES = 4_000_000;
// Anthropic's recommended long-edge max; images larger than this are downscaled
// server-side anyway (and the hard cap is 8000px, beyond which the request 400s).
// Resizing to this fixes oversized screenshots/diagrams and trims token cost.
export const VISION_IMAGE_MAX_EDGE = 1568;

type SupportedImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/** Wrap a raw PNG Buffer into an Anthropic base64 image block. */
export function toBase64ImageBlock(png: Buffer): ImageBlockParam {
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: "image/png",
      data: png.toString("base64"),
    },
  };
}

/**
 * Ensure an image fits Anthropic's pixel limits. Returns the original bytes when
 * already within {@link VISION_IMAGE_MAX_EDGE}; otherwise decodes, downscales to
 * that long edge, and re-encodes as PNG. If the image can't be decoded to measure
 * it, the original bytes are forwarded unchanged (preserving prior behaviour).
 */
export async function prepareImageForVision(
  file: Buffer,
  mediaType: SupportedImageMediaType,
  maxEdge = VISION_IMAGE_MAX_EDGE,
): Promise<{ data: string; mediaType: SupportedImageMediaType }> {
  try {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const img = await loadImage(file);
    const longest = Math.max(img.width, img.height);
    if (longest <= maxEdge) {
      return { data: file.toString("base64"), mediaType };
    }
    const scale = maxEdge / longest;
    const targetW = Math.max(1, Math.round(img.width * scale));
    const targetH = Math.max(1, Math.round(img.height * scale));
    const canvas = createCanvas(targetW, targetH);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, targetW, targetH);
    const out = await canvas.encode("png");
    return { data: Buffer.from(out).toString("base64"), mediaType: "image/png" };
  } catch {
    // Can't decode to measure dimensions — forward as-is rather than dropping it.
    return { data: file.toString("base64"), mediaType };
  }
}

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

    // Downscale oversized images so we never exceed Anthropic's 8000px hard cap.
    const prepared = await prepareImageForVision(file, mediaType);

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
        media_type: prepared.mediaType,
        data: prepared.data,
      },
    });
  }

  return blocks;
}
