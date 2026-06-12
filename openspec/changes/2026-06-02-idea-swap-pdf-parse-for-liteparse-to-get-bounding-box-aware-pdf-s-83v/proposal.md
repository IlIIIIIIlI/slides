# Swap pdf-parse for liteparse to get bounding-box-aware PDF slide ingestion

## Why

lib/generation/extract.ts currently flattens PDFs via pdf-parse/pdfjs-dist, losing spatial layout that's crucial for reconstructing slide structure from uploaded decks. @llamaindex/liteparse returns text with precise PDFium bounding boxes plus a page-coverage metric to selectively trigger OCR, so you can group text into title/body/columns by geometry and only OCR scanned pages. It's a Node binding, so it drops into your existing TS extraction pipeline without a new runtime.

## Inspired by

- https://github.com/run-llama/liteparse


## Decision

- [ ] **Adopt** — proceed with `tasks.md`
- [ ] **Defer** / **Reject**

_novelty 4/5 · effort 3/5 · promoted from a Project Steward idea you approved._
