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
// PDF: text per page + page-render images
// =============================

async function extractPdf(buf: Buffer, presentationId: string): Promise<Omit<Extracted, "sourceName" | "sourceType">> {
  // pdfjs-dist legacy build runs in Node without DOM polyfills.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Point pdfjs at the worker file on disk. We build a file:// URL from
  // process.cwd() because under Next.js bundling __filename / require.resolve
  // resolve against the compiled bundle (no node_modules nearby).
  const { pathToFileURL } = await import("url");
  const workerOnDisk = path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "legacy",
    "build",
    "pdf.worker.mjs"
  );
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerOnDisk).href;

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buf),
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;

  const chunks: ExtractedChunk[] = [];
  const images: ExtractedImage[] = [];
  let fullText = "";

  // Lazy-load canvas only if we actually find image-bearing pages.
  let canvasMod: typeof import("@napi-rs/canvas") | null = null;
  const ensureCanvas = async () => {
    if (!canvasMod) canvasMod = await import("@napi-rs/canvas");
    return canvasMod;
  };

  const outDir = path.join(PUBLIC_EXTRACTED, presentationId);
  let outDirCreated = false;
  const ensureOutDir = async () => {
    if (!outDirCreated) {
      await fs.mkdir(outDir, { recursive: true });
      outDirCreated = true;
    }
  };

  // Persist the original PDF so the workspace can render an inline preview
  // with highlight overlays on cited chunks.
  await ensureOutDir();
  await fs.writeFile(path.join(outDir, "source.pdf"), buf);
  const sourceUrl = `/extracted/${presentationId}/source.pdf`;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;

    // ---- text + per-line bboxes ----
    type LineEntry = { text: string; x1: number; y1: number; x2: number; y2: number };
    const lineEntries: LineEntry[] = [];

    const textContent = await page.getTextContent();
    let currentText: string[] = [];
    let curX1 = Infinity, curY1 = Infinity, curX2 = -Infinity, curY2 = -Infinity;
    let lastY: number | null = null;

    const flush = () => {
      if (!currentText.length) return;
      // Convert PDF user-space (origin bottom-left) → top-left origin used by
      // react-pdf-highlighter. curY1 currently holds the top of the line in
      // PDF coords, curY2 the bottom; flip both.
      const topY = pageHeight - curY1;
      const bottomY = pageHeight - curY2;
      lineEntries.push({
        text: currentText.join(" "),
        x1: curX1,
        y1: Math.min(topY, bottomY),
        x2: curX2,
        y2: Math.max(topY, bottomY),
      });
      currentText = [];
      curX1 = Infinity; curY1 = Infinity; curX2 = -Infinity; curY2 = -Infinity;
    };

    for (const item of textContent.items) {
      const it = item as { str: string; transform?: number[]; width?: number; height?: number; hasEOL?: boolean };
      if (!it.str) continue;
      const x = it.transform?.[4] ?? 0;
      const y = it.transform?.[5] ?? 0;
      const w = it.width ?? 0;
      const h = it.height ?? 0;

      if (lastY !== null && Math.abs(y - lastY) > 2) flush();

      currentText.push(it.str);
      // PDF item bbox in PDF user-space: top y is `y + h`, bottom is `y`.
      curX1 = Math.min(curX1, x);
      curX2 = Math.max(curX2, x + w);
      curY1 = Math.max(curY1 === Infinity ? -Infinity : curY1, y + h); // top in PDF coords
      curY2 = Math.min(curY2 === -Infinity ? Infinity : curY2, y);     // bottom in PDF coords

      lastY = y;
      if (it.hasEOL) flush();
    }
    flush();

    // ---- group lines into paragraphs by y-gap ----
    // pdfjs typically reports lines top-to-bottom in top-left coords (after our
    // flip), so consecutive lines with a larger-than-typical y-gap mark a
    // paragraph boundary.
    type ParaAcc = {
      texts: string[];
      lines: ChunkRect[];
      bbox: { x1: number; y1: number; x2: number; y2: number };
    };
    const paras: ParaAcc[] = [];
    let prev: LineEntry | null = null;
    let cur: ParaAcc | null = null;
    const lineHeights = lineEntries.map((l) => l.y2 - l.y1).filter((h) => h > 0);
    const medianLineHeight = lineHeights.length
      ? lineHeights.slice().sort((a, b) => a - b)[Math.floor(lineHeights.length / 2)]
      : 12;
    for (const line of lineEntries) {
      const gap = prev && cur ? line.y1 - prev.y2 : 0;
      // Threshold ~0.6× median line height — paragraph spacing in most PDFs is
      // larger than the inter-line leading, so this catches real paragraph
      // breaks without splitting on the small gap between consecutive lines.
      if (!cur || gap > medianLineHeight * 0.6) {
        cur = {
          texts: [],
          lines: [],
          bbox: { x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2 },
        };
        paras.push(cur);
      } else {
        cur.bbox.x1 = Math.min(cur.bbox.x1, line.x1);
        cur.bbox.y1 = Math.min(cur.bbox.y1, line.y1);
        cur.bbox.x2 = Math.max(cur.bbox.x2, line.x2);
        cur.bbox.y2 = Math.max(cur.bbox.y2, line.y2);
      }
      cur.texts.push(line.text);
      cur.lines.push({ x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2 });
      prev = line;
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
        // Degenerate bbox (no real text dimensions) — store the chunk without
        // bbox metadata so the preview falls back to the text-excerpt UI.
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

    // ---- images: render the page to PNG only if it has image XObjects ----
    let hasImage = false;
    try {
      const ops = await page.getOperatorList();
      // pdfjs OPS.paintImageXObject = 85; paintInlineImageXObject = 86; paintImageXObjectRepeat = 88
      const IMAGE_OPS = new Set([85, 86, 88]);
      for (const fn of ops.fnArray) {
        if (IMAGE_OPS.has(fn)) { hasImage = true; break; }
      }
    } catch {
      // If op list scan fails, just skip rendering.
    }

    if (hasImage) {
      try {
        const { createCanvas } = await ensureCanvas();
        const viewport = page.getViewport({ scale: 2 });
        const canvas = createCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext("2d");
        await page.render({
          canvasContext: ctx as unknown as CanvasRenderingContext2D,
          viewport,
        }).promise;
        const renderedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const cropBounds = findFocusedCropBounds(renderedImageData);
        const outputCanvas = cropBounds
          ? createCanvas(cropBounds.width, cropBounds.height)
          : canvas;
        if (cropBounds) {
          const cropCtx = outputCanvas.getContext("2d");
          cropCtx.drawImage(
            canvas,
            cropBounds.x,
            cropBounds.y,
            cropBounds.width,
            cropBounds.height,
            0,
            0,
            cropBounds.width,
            cropBounds.height,
          );
        }
        await ensureOutDir();
        const filename = cropBounds ? `page-${p}-focus.png` : `page-${p}.png`;
        const buffer = await outputCanvas.encode("png");
        await fs.writeFile(path.join(outDir, filename), buffer);
        images.push({
          id: `IMG-p${p}`,
          page: p,
          filepath: `/extracted/${presentationId}/${filename}`,
          captionHint: cropBounds
            ? `Focused area from page ${p}. ${pageText.slice(0, 180)}`
            : pageText.slice(0, 200),
        });
      } catch {
        // Render failure is non-fatal — skip this page's image.
      }
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
