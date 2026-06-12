// Source-text + image extraction for the multi-stage pipeline.
//
// Returns `{ fullText, chunks, images }`:
//   - chunks  : { id, page, paragraph, text } — text split per page (PDF) or per paragraph (else)
//   - images  : { id, page?, filepath, captionHint? } — rendered/saved image files under
//               public/extracted/<presentationId>/...

import fs from "fs/promises";
import path from "path";
import { JSDOM } from "jsdom";
import { findFocusedCropBounds } from "@/lib/generation/image-crop";
import { preprocessMathXml } from "@/lib/generation/omml/omml";
import { readZipEntries } from "@/lib/generation/omml/zip";

const PUBLIC_EXTRACTED = path.join(process.cwd(), "public", "extracted");

export interface ChunkRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ChunkBBox {
  pageNumber: number;
  // Coordinates are normalised against the captured viewport (width/height);
  // the PDF viewer rescales when rendering. y origin is the top of the page.
  width: number;
  height: number;
  // boundingRect — union of all line rects, used for scroll-to and layout.
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  // Per-line rectangles. The PDF viewer renders one highlight box per rect,
  // so this avoids painting one giant block over blank space and unrelated
  // text when a chunk spans multiple lines.
  rects?: ChunkRect[];
}

export interface ExtractedChunk {
  id: string;            // CHK-001-p1-2  (sourceIdx-page-paragraph)
  page?: number;
  paragraph?: number;
  text: string;
  bbox?: ChunkBBox;
}

export interface ExtractedImage {
  id: string;            // IMG-001-p3
  page?: number;
  filepath: string;      // public path, e.g. "/extracted/<presId>/page-3.png"
  captionHint?: string;
}

export interface Extracted {
  sourceName: string;
  sourceType: string;
  fullText: string;
  chunks: ExtractedChunk[];
  images: ExtractedImage[];
  // Web-served path of the original source file when we keep it around for
  // preview (PDFs only today). Undefined for URL/code/text sources.
  sourceUrl?: string;
}

export function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

/** Split text into paragraphs by blank lines, trimming and ignoring empties. */
function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 20); // drop trivial fragments
}

/** Build chunks for plain text: one paragraph per chunk. */
function chunkPlainText(text: string): ExtractedChunk[] {
  return paragraphs(text).map((p, i) => ({
    id: `CHK-001-${String(i + 1).padStart(3, "0")}`,
    paragraph: i + 1,
    text: p,
  }));
}

const CODE_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "mjs", "cjs",
  "py", "pyw",
  "java", "kt", "kts", "scala",
  "go", "rs", "rb", "php", "cs",
  "c", "h", "cc", "cpp", "hpp", "cxx",
  "swift", "m", "mm",
  "sh", "bash", "zsh", "fish",
  "sql",
  "json", "yaml", "yml", "toml",
  "html", "css", "scss", "sass", "less",
  "vue", "svelte",
  "lua", "pl", "r", "dart", "ex", "exs", "elm", "clj", "cljs", "hs",
]);

function isCodeExtension(ext: string): boolean {
  return CODE_EXTENSIONS.has(ext.toLowerCase());
}

/**
 * Build chunks for source code. Splits on blank-line boundaries but preserves
 * indentation and newlines inside each block so the model sees real code, not
 * a whitespace-collapsed paragraph.
 */
function chunkCode(text: string): ExtractedChunk[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.replace(/[ \t]+\n/g, "\n").replace(/\s+$/g, "").replace(/^\s*\n+/, ""))
    .filter((b) => b.trim().length >= 8 && /[A-Za-z0-9_]/.test(b));

  return blocks.map((b, i) => ({
    id: `CHK-001-${String(i + 1).padStart(3, "0")}`,
    paragraph: i + 1,
    text: b,
  }));
}

// =============================
// PDF: text per page + page-render images (via @llamaindex/liteparse)
// =============================

// liteparse TextItem coordinates use top-left origin (y=0 at top, y increases
// downward), matching the screen-space convention expected by react-pdf-highlighter.
// PageWidth/height are in PDF points (1 pt = 1/72 inch).

async function extractPdf(buf: Buffer, presentationId: string): Promise<Omit<Extracted, "sourceName" | "sourceType">> {
  const { LiteParse } = await import("@llamaindex/liteparse");

  const outDir = path.join(PUBLIC_EXTRACTED, presentationId);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "source.pdf"), buf);
  const sourceUrl = `/extracted/${presentationId}/source.pdf`;

  // Phase 1: Extract text without OCR to get bounding-box-aware items.
  const parser = new LiteParse({ ocrEnabled: false, quiet: true });
  const result = await parser.parse(buf);

  // Phase 2: Detect scanned pages (very low text coverage) for selective OCR.
  // Coverage = total text-item area / page area. Pages below 2% with < 5
  // items are almost certainly image-only or scanned slides.
  const scannedPageNums: number[] = [];
  for (const page of result.pages) {
    const pageArea = page.width * page.height;
    if (pageArea > 0) {
      const textArea = page.textItems.reduce((sum, it) => sum + it.width * it.height, 0);
      if (textArea / pageArea < 0.02 && page.textItems.length < 5) {
        scannedPageNums.push(page.pageNum);
      }
    }
  }

  // Phase 3: Re-parse scanned pages with OCR (gracefully skip if unavailable).
  const ocrPageMap = new Map<number, (typeof result.pages)[0]>();
  if (scannedPageNums.length > 0) {
    try {
      const ocrParser = new LiteParse({
        ocrEnabled: true,
        quiet: true,
        targetPages: scannedPageNums.join(","),
      });
      const ocrResult = await ocrParser.parse(buf);
      for (const page of ocrResult.pages) {
        ocrPageMap.set(page.pageNum, page);
      }
    } catch {
      // OCR unavailable (e.g. no tesseract) — continue with text-layer results.
    }
  }

  // Phase 4: Process each page into chunks + collect image-sparse pages.
  const chunks: ExtractedChunk[] = [];
  let fullText = "";
  const imagePageNums: number[] = [];   // pages worth screenshotting

  for (const rawPage of result.pages) {
    const page = ocrPageMap.get(rawPage.pageNum) ?? rawPage;
    const p = page.pageNum;
    const pageWidth = page.width;
    const pageHeight = page.height;

    // Sort items top-to-bottom then left-to-right (top-left-origin coords).
    const items = [...page.textItems].sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);

    // Average item height — used as line-grouping tolerance.
    const avgHeight = items.length > 0
      ? items.reduce((sum, it) => sum + it.height, 0) / items.length
      : 12;

    // Group items into visual lines by y-proximity.
    type LineEntry = { text: string; x1: number; y1: number; x2: number; y2: number };
    const lineEntries: LineEntry[] = [];
    let lineItems: typeof items = [];
    let lineMinY = 0;
    let lineMaxY = 0;

    const flushLine = () => {
      if (!lineItems.length) return;
      lineItems.sort((a, b) => a.x - b.x); // left-to-right within line
      const text = lineItems.map((it) => it.text).join(" ").replace(/\s+/g, " ").trim();
      if (text) {
        lineEntries.push({
          text,
          x1: Math.min(...lineItems.map((it) => it.x)),
          y1: lineMinY,
          x2: Math.max(...lineItems.map((it) => it.x + it.width)),
          y2: lineMaxY,
        });
      }
      lineItems = [];
    };

    for (const item of items) {
      if (lineItems.length === 0) {
        lineItems = [item];
        lineMinY = item.y;
        lineMaxY = item.y + item.height;
      } else if (item.y <= lineMaxY + avgHeight * 0.3) {
        // Within 30% of avg height of current line bottom → same line.
        lineItems.push(item);
        lineMinY = Math.min(lineMinY, item.y);
        lineMaxY = Math.max(lineMaxY, item.y + item.height);
      } else {
        flushLine();
        lineItems = [item];
        lineMinY = item.y;
        lineMaxY = item.y + item.height;
      }
    }
    flushLine();

    // Group lines into paragraphs by y-gap (same heuristic as before).
    type ParaAcc = {
      texts: string[];
      lines: ChunkRect[];
      bbox: { x1: number; y1: number; x2: number; y2: number };
    };
    const paras: ParaAcc[] = [];
    let prevLine: LineEntry | null = null;
    let curPara: ParaAcc | null = null;
    const lineHeights = lineEntries.map((l) => l.y2 - l.y1).filter((h) => h > 0);
    const medianLineHeight = lineHeights.length
      ? lineHeights.slice().sort((a, b) => a - b)[Math.floor(lineHeights.length / 2)]
      : 12;

    for (const line of lineEntries) {
      const gap = prevLine && curPara ? line.y1 - prevLine.y2 : 0;
      if (!curPara || gap > medianLineHeight * 0.6) {
        curPara = {
          texts: [],
          lines: [],
          bbox: { x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2 },
        };
        paras.push(curPara);
      } else {
        curPara.bbox.x1 = Math.min(curPara.bbox.x1, line.x1);
        curPara.bbox.y1 = Math.min(curPara.bbox.y1, line.y1);
        curPara.bbox.x2 = Math.max(curPara.bbox.x2, line.x2);
        curPara.bbox.y2 = Math.max(curPara.bbox.y2, line.y2);
      }
      curPara.texts.push(line.text);
      curPara.lines.push({ x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2 });
      prevLine = line;
    }

    const pageText = lineEntries.map((l) => l.text).join("\n").replace(/\s+\n/g, "\n").trim();
    fullText += `\n\n[Page ${p}]\n${pageText}`;

    let paraIdx = 0;
    for (const pp of paras) {
      const text = pp.texts.join(" ").replace(/\s+/g, " ").trim();
      if (text.length < 20) continue;
      paraIdx += 1;
      const isFiniteRect = (r: ChunkRect) =>
        Number.isFinite(r.x1) && Number.isFinite(r.y1)
        && Number.isFinite(r.x2) && Number.isFinite(r.y2)
        && r.x2 > r.x1 && r.y2 > r.y1;
      const cleanRects = pp.lines.filter(isFiniteRect);
      const bbox = pp.bbox;
      if (
        !Number.isFinite(bbox.x1) || !Number.isFinite(bbox.y1)
        || !Number.isFinite(bbox.x2) || !Number.isFinite(bbox.y2)
        || bbox.x2 <= bbox.x1 || bbox.y2 <= bbox.y1
      ) {
        chunks.push({
          id: `CHK-p${p}-${String(paraIdx).padStart(2, "0")}`,
          page: p,
          paragraph: paraIdx,
          text,
        });
        continue;
      }
      chunks.push({
        id: `CHK-p${p}-${String(paraIdx).padStart(2, "0")}`,
        page: p,
        paragraph: paraIdx,
        text,
        bbox: {
          pageNumber: p,
          width: pageWidth,
          height: pageHeight,
          x1: bbox.x1,
          y1: bbox.y1,
          x2: bbox.x2,
          y2: bbox.y2,
          rects: cleanRects.length > 0 ? cleanRects : undefined,
        },
      });
    }

    // Pages with < 150 chars of text likely carry significant visual content
    // (charts, photos, diagrams). Cap total at 8 to avoid over-sending images.
    if (pageText.length < 150 && imagePageNums.length < 8) {
      imagePageNums.push(p);
    }
  }

  // Phase 5: Screenshot image-bearing pages and apply focused-crop logic.
  const images: ExtractedImage[] = [];
  if (imagePageNums.length > 0) {
    try {
      const { createCanvas, loadImage } = await import("@napi-rs/canvas");
      const screenshots = await parser.screenshot(buf, imagePageNums);
      for (const shot of screenshots) {
        try {
          const img = await loadImage(shot.imageBuffer);
          const canvas = createCanvas(shot.width, shot.height);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const pixelData = ctx.getImageData(0, 0, shot.width, shot.height);
          const cropBounds = findFocusedCropBounds(pixelData);
          const outputCanvas = cropBounds
            ? createCanvas(cropBounds.width, cropBounds.height)
            : canvas;
          if (cropBounds) {
            const cropCtx = outputCanvas.getContext("2d");
            cropCtx.drawImage(
              img,
              cropBounds.x, cropBounds.y, cropBounds.width, cropBounds.height,
              0, 0, cropBounds.width, cropBounds.height,
            );
          }
          const pageText = result.pages.find((pg) => pg.pageNum === shot.pageNum)?.text ?? "";
          const filename = cropBounds ? `page-${shot.pageNum}-focus.png` : `page-${shot.pageNum}.png`;
          const pngBuf = await outputCanvas.encode("png");
          await fs.writeFile(path.join(outDir, filename), pngBuf);
          images.push({
            id: `IMG-p${shot.pageNum}`,
            page: shot.pageNum,
            filepath: `/extracted/${presentationId}/${filename}`,
            captionHint: cropBounds
              ? `Focused area from page ${shot.pageNum}. ${pageText.slice(0, 180)}`
              : pageText.slice(0, 200),
          });
        } catch {
          // Per-page screenshot failure is non-fatal.
        }
      }
    } catch {
      // Screenshot failure is non-fatal — images array stays empty.
    }
  }

  return { fullText: fullText.trim(), chunks, images, sourceUrl };
}

// =============================
// HTML / URL: text + img tags
// =============================

async function extractUrl(url: string, presentationId: string): Promise<Omit<Extracted, "sourceName" | "sourceType">> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.startsWith("image/")) {
    // The URL itself is an image.
    const arrayBuf = await res.arrayBuffer();
    const ext = (contentType.split("/")[1] ?? "png").split(";")[0];
    const outDir = path.join(PUBLIC_EXTRACTED, presentationId);
    await fs.mkdir(outDir, { recursive: true });
    const filename = `image-1.${ext}`;
    await fs.writeFile(path.join(outDir, filename), Buffer.from(arrayBuf));
    return {
      fullText: "",
      chunks: [],
      images: [{ id: "IMG-001", filepath: `/extracted/${presentationId}/${filename}` }],
    };
  }

  const raw = await res.text();
  if (!contentType.includes("text/html")) {
    // Plain text/markdown URL.
    return { fullText: raw, chunks: chunkPlainText(raw), images: [] };
  }

  // HTML: parse with jsdom, harvest paragraphs + images.
  const dom = new JSDOM(raw, { url });
  const doc = dom.window.document;

  // Drop noise.
  doc.querySelectorAll("script, style, nav, footer, header, aside").forEach((n) => n.remove());

  const paraEls = Array.from(doc.querySelectorAll("p, li, h1, h2, h3, blockquote"));
  const chunks: ExtractedChunk[] = [];
  paraEls.forEach((el, i) => {
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text.length < 20) return;
    chunks.push({
      id: `CHK-${String(chunks.length + 1).padStart(3, "0")}`,
      paragraph: i + 1,
      text,
    });
  });

  const fullText = chunks.map((c) => c.text).join("\n\n");

  // Images: only download those with reasonable alt or larger sizes.
  const images: ExtractedImage[] = [];
  const imgEls = Array.from(doc.querySelectorAll("img")).slice(0, 12);
  if (imgEls.length > 0) {
    const outDir = path.join(PUBLIC_EXTRACTED, presentationId);
    await fs.mkdir(outDir, { recursive: true });
    let saved = 0;
    for (let i = 0; i < imgEls.length && saved < 8; i++) {
      const img = imgEls[i] as HTMLImageElement;
      const src = img.getAttribute("src");
      if (!src) continue;
      let absUrl: string;
      try { absUrl = new URL(src, url).toString(); } catch { continue; }
      try {
        const imgRes = await fetch(absUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!imgRes.ok) continue;
        const ct = imgRes.headers.get("content-type") ?? "";
        if (!ct.startsWith("image/")) continue;
        const ext = (ct.split("/")[1] ?? "png").split(";")[0].replace("svg+xml", "svg");
        const arrayBuf = await imgRes.arrayBuffer();
        if (arrayBuf.byteLength < 4_000) continue; // likely a tracking pixel / icon
        if (arrayBuf.byteLength > 4_000_000) continue;
        const filename = `image-${saved + 1}.${ext}`;
        await fs.writeFile(path.join(outDir, filename), Buffer.from(arrayBuf));
        images.push({
          id: `IMG-${String(saved + 1).padStart(3, "0")}`,
          filepath: `/extracted/${presentationId}/${filename}`,
          captionHint: img.getAttribute("alt") || undefined,
        });
        saved++;
      } catch {
        /* skip */
      }
    }
  }

  return { fullText, chunks, images };
}

// =============================
// Direct image upload
// =============================

async function extractImageFile(file: File, presentationId: string): Promise<Omit<Extracted, "sourceName" | "sourceType">> {
  const arrayBuf = await file.arrayBuffer();
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const outDir = path.join(PUBLIC_EXTRACTED, presentationId);
  await fs.mkdir(outDir, { recursive: true });
  const filename = `upload-1.${ext}`;
  await fs.writeFile(path.join(outDir, filename), Buffer.from(arrayBuf));
  return {
    fullText: "",
    chunks: [],
    images: [{
      id: "IMG-001",
      filepath: `/extracted/${presentationId}/${filename}`,
      captionHint: file.name,
    }],
  };
}

// =============================
// DOCX / PPTX: XML extraction + math preprocessing
// =============================

/** Strip XML tags and decode common entities, adding paragraph breaks. */
export function stripXmlTags(
  xml: string,
  paraTags: string[] = [],
): string {
  let result = xml;
  for (const tag of paraTags) {
    result = result.replace(new RegExp(`</${tag}>`, "g"), "\n\n");
  }
  return result
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractDocx(
  buf: Buffer,
  _presentationId: string,
): Promise<Omit<Extracted, "sourceName" | "sourceType">> {
  const entries = await readZipEntries(
    buf,
    (name) => name === "word/document.xml",
  );
  const docXml = entries.get("word/document.xml")?.toString("utf8") ?? "";
  const processed = preprocessMathXml(docXml);
  const text = stripXmlTags(processed, ["w:p", "w:tr"]);
  return { fullText: text, chunks: chunkPlainText(text), images: [] };
}

async function extractPptx(
  buf: Buffer,
  _presentationId: string,
): Promise<Omit<Extracted, "sourceName" | "sourceType">> {
  const entries = await readZipEntries(
    buf,
    (name) => /^ppt\/slides\/slide\d+\.xml$/.test(name),
  );
  const slideNames = Array.from(entries.keys()).sort((a, b) => {
    const n = (s: string) => parseInt(s.match(/\d+/)?.[0] ?? "0", 10);
    return n(a) - n(b);
  });
  const parts = slideNames.map((name) => {
    const xml = entries.get(name)!.toString("utf8");
    return stripXmlTags(preprocessMathXml(xml), ["a:p"]);
  });
  const fullText = parts.filter(Boolean).join("\n\n---\n\n");
  return { fullText, chunks: chunkPlainText(fullText), images: [] };
}

// =============================
// Public entry
// =============================

export async function extractText(
  file: File | null,
  url: string | null,
  presentationId: string,
): Promise<Extracted> {
  if (url) {
    const body = await extractUrl(url, presentationId);
    return { ...body, sourceName: url, sourceType: "url" };
  }

  if (!file) throw new Error("No file or URL provided");

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const isImage = file.type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);

  if (isImage) {
    const body = await extractImageFile(file, presentationId);
    return { ...body, sourceName: file.name, sourceType: "image" };
  }

  if (ext === "pdf") {
    const buf = Buffer.from(await file.arrayBuffer());
    const body = await extractPdf(buf, presentationId);
    return { ...body, sourceName: file.name, sourceType: "pdf" };
  }

  if (ext === "docx") {
    const buf = Buffer.from(await file.arrayBuffer());
    const body = await extractDocx(buf, presentationId);
    return { ...body, sourceName: file.name, sourceType: "docx" };
  }

  if (ext === "pptx") {
    const buf = Buffer.from(await file.arrayBuffer());
    const body = await extractPptx(buf, presentationId);
    return { ...body, sourceName: file.name, sourceType: "pptx" };
  }

  // txt / md / code fallback
  const text = await file.text();
  if (isCodeExtension(ext)) {
    return {
      fullText: text,
      chunks: chunkCode(text),
      images: [],
      sourceName: file.name,
      sourceType: "code",
    };
  }
  return {
    fullText: text,
    chunks: chunkPlainText(text),
    images: [],
    sourceName: file.name,
    sourceType: ext || "txt",
  };
}
