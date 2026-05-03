#!/usr/bin/env node
// Copies the installed pdfjs worker into public/ so the client-side PDF viewer
// (react-pdf-highlighter) can load it from a same-origin URL without needing
// bundler ?url support. Re-run automatically via `predev` / `prebuild`.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SRC = path.join(ROOT, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const DEST_DIR = path.join(ROOT, "public/pdfjs");
const DEST = path.join(DEST_DIR, "pdf.worker.min.mjs");

try {
  await fs.access(SRC);
} catch {
  console.error(`[copy-pdfjs-worker] source not found: ${SRC}`);
  console.error("[copy-pdfjs-worker] is pdfjs-dist installed?");
  process.exit(0); // non-fatal — let the build continue
}

await fs.mkdir(DEST_DIR, { recursive: true });
await fs.copyFile(SRC, DEST);
console.log(`[copy-pdfjs-worker] copied ${path.relative(ROOT, SRC)} → ${path.relative(ROOT, DEST)}`);
