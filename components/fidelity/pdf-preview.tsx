"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import {
  PdfLoader,
  PdfHighlighter,
  Highlight,
  type IHighlight,
} from "react-pdf-highlighter";
import "react-pdf-highlighter/dist/style/PdfHighlighter.css";
import "react-pdf-highlighter/dist/style/Highlight.css";
import "react-pdf-highlighter/dist/style/pdf_viewer.css";
import "pdfjs-dist/web/pdf_viewer.css";

import type { ChunkBBox } from "@/lib/generation/extract";

// The pdfjs worker is copied to public/pdfjs/ by scripts/copy-pdfjs-worker.mjs
// at predev/prebuild time. Pinning a same-origin path avoids the version
// mismatch that PdfLoader's default unpkg URL otherwise causes (the lib's
// default points at pdfjs-dist 4.4.168 which silently fails against our 4.10.x).
const WORKER_SRC = "/pdfjs/pdf.worker.min.mjs";

export interface PdfHighlightInput {
  id: string;            // chunk id
  bbox: ChunkBBox;
  text: string;
  comment?: string;      // shown on hover
  color?: "captured" | "missed" | "unsupported";
}

function bboxToPosition(bbox: ChunkBBox): IHighlight["position"] {
  const boundingRect = {
    x1: bbox.x1,
    y1: bbox.y1,
    x2: bbox.x2,
    y2: bbox.y2,
    width: bbox.width,
    height: bbox.height,
    pageNumber: bbox.pageNumber,
  };
  // Prefer per-line rects: the viewer paints one box per rect, so blank gaps
  // and unrelated text between lines stay un-highlighted. Fall back to a
  // single union rect for legacy decks that lack `rects`.
  const rects = (bbox.rects && bbox.rects.length > 0)
    ? bbox.rects.map((r) => ({
        x1: r.x1,
        y1: r.y1,
        x2: r.x2,
        y2: r.y2,
        width: bbox.width,
        height: bbox.height,
        pageNumber: bbox.pageNumber,
      }))
    : [boundingRect];
  return {
    boundingRect,
    rects,
    pageNumber: bbox.pageNumber,
  };
}

const COLOR_CLASS: Record<NonNullable<PdfHighlightInput["color"]>, string> = {
  captured: "k2s-hl-captured",
  missed: "k2s-hl-missed",
  unsupported: "k2s-hl-unsupported",
};

interface Props {
  pdfUrl: string;
  highlights: PdfHighlightInput[];
  scrollToId: string | null;
  onScrolled?: () => void;
  onHighlightClick?: (id: string) => void;
}

export default function PdfPreview({ pdfUrl, highlights, scrollToId, onScrolled, onHighlightClick }: Props) {
  // The library hands us a `scrollTo` function via scrollRef; we keep it in a
  // ref so we can call it imperatively whenever scrollToId changes.
  const scrollToFnRef = useRef<((highlight: IHighlight) => void) | null>(null);
  const scrolledToIdRef = useRef<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);

  const transformed: IHighlight[] = useMemo(() => highlights.map((h) => ({
    id: h.id,
    position: bboxToPosition(h.bbox),
    content: { text: h.text },
    comment: { text: h.comment ?? "", emoji: "" },
  })), [highlights]);

  useEffect(() => {
    if (!scrollToId) return;
    scrolledToIdRef.current = scrollToId;
    const target = transformed.find((h) => h.id === scrollToId);
    if (target && scrollToFnRef.current) {
      scrollToFnRef.current(target);
    }
  }, [scrollToId, transformed]);

  const colorById = useMemo(
    () => new Map(highlights.map((h) => [h.id, h.color ?? "captured"] as const)),
    [highlights],
  );

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    const check = () => {
      const rect = node.getBoundingClientRect();
      setLayoutReady(node.offsetParent !== null && rect.width > 0 && rect.height > 0);
    };

    check();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(check);
    observer?.observe(node);
    return () => observer?.disconnect();
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-white">
      <style>{`
        .k2s-pdf-wrapper .Highlight__part { background: rgba(34, 197, 94, 0.28); }
        .k2s-pdf-wrapper .Highlight { cursor: pointer; }
        .k2s-pdf-wrapper .k2s-hl-captured .Highlight__part { background: rgba(34, 197, 94, 0.32); }
        .k2s-pdf-wrapper .k2s-hl-missed .Highlight__part { background: rgba(245, 158, 11, 0.32); }
        .k2s-pdf-wrapper .k2s-hl-unsupported .Highlight__part { background: rgba(239, 68, 68, 0.30); }
        .k2s-pdf-wrapper .Highlight--scrolledTo .Highlight__part { background: rgba(59, 130, 246, 0.45); outline: 2px solid #2563EB; outline-offset: -2px; }
      `}</style>
      <div ref={wrapperRef} className="k2s-pdf-wrapper h-full w-full">
        {!layoutReady ? (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            Loading PDF…
          </div>
        ) : (
          <PdfLoader
          url={pdfUrl}
          workerSrc={WORKER_SRC}
          beforeLoad={
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              Loading PDF…
            </div>
          }
          errorMessage={
            <div className="flex h-full w-full items-center justify-center text-sm text-red-500">
              Failed to load PDF preview.
            </div>
          }
          onError={(err) => {
            console.error("[PdfPreview] failed to load PDF", err);
          }}
        >
          {(pdfDocument) => (
            <PdfHighlighterContent
              pdfDocument={pdfDocument}
              transformed={transformed}
              colorById={colorById}
              scrollToId={scrollToId}
              onScrolled={onScrolled}
              onHighlightClick={onHighlightClick}
              scrollToFnRef={scrollToFnRef}
              scrolledToIdRef={scrolledToIdRef}
            />
          )}
          </PdfLoader>
        )}
      </div>
    </div>
  );
}

interface PdfDocumentLike {
  numPages: number;
}

function PdfHighlighterContent({
  pdfDocument,
  transformed,
  colorById,
  scrollToId,
  onScrolled,
  onHighlightClick,
  scrollToFnRef,
  scrolledToIdRef,
}: {
  pdfDocument: PdfDocumentLike;
  transformed: IHighlight[];
  colorById: Map<string, NonNullable<PdfHighlightInput["color"]>>;
  scrollToId: string | null;
  onScrolled?: () => void;
  onHighlightClick?: (id: string) => void;
  scrollToFnRef: MutableRefObject<((highlight: IHighlight) => void) | null>;
  scrolledToIdRef: MutableRefObject<string | null>;
}) {
  // Drop highlights whose page is outside the actual PDF or whose bbox is
  // degenerate. Keep the resulting array referentially stable; PdfHighlighter
  // redraws on every `highlights !== prevHighlights`, and doing that before
  // its async PDFViewer init completes can crash inside `viewer.getPageView`.
  const safeHighlights = useMemo(() => transformed.filter((h) => {
    const p = h.position.pageNumber;
    if (!Number.isInteger(p) || p < 1 || p > pdfDocument.numPages) return false;
    const br = h.position.boundingRect;
    if (!Number.isFinite(br.x1) || !Number.isFinite(br.y1)) return false;
    if (!Number.isFinite(br.x2) || !Number.isFinite(br.y2)) return false;
    if (br.x2 <= br.x1 || br.y2 <= br.y1) return false;
    return true;
  }), [pdfDocument.numPages, transformed]);

  return (
    <PdfHighlighter
      pdfDocument={pdfDocument as never}
      enableAreaSelection={() => false}
      onScrollChange={() => {
        onScrolled?.();
      }}
      scrollRef={(scrollTo) => {
        scrollToFnRef.current = scrollTo;
        if (scrollToId) {
          const target = safeHighlights.find((h) => h.id === scrollToId);
          if (target) scrollTo(target);
        }
      }}
      pdfScaleValue="page-width"
      onSelectionFinished={() => null}
      highlightTransform={(highlight) => {
        const klass = COLOR_CLASS[colorById.get(highlight.id) ?? "captured"];
        const isScrolledTo = scrolledToIdRef.current === highlight.id;
        return (
          <div
            key={highlight.id}
            role="button"
            tabIndex={0}
            className={klass}
            onClick={() => {
              scrolledToIdRef.current = highlight.id;
              onHighlightClick?.(highlight.id);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              scrolledToIdRef.current = highlight.id;
              onHighlightClick?.(highlight.id);
            }}
            aria-label={`Select source chunk ${highlight.id}`}
          >
            <Highlight
              isScrolledTo={isScrolledTo}
              position={highlight.position}
              comment={highlight.comment}
            />
          </div>
        );
      }}
      highlights={safeHighlights}
    />
  );
}
