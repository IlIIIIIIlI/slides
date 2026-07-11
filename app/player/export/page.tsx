"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SlideView } from "@/components/player/slide-view";
import type { Slide, Brand } from "@/app/slides";
import { blockAttrsForElKey } from "@/core/rendering/adapter";

const DEFAULT_BRAND: Brand = { text: "SYNOGIZE LAB", gradientFrom: "#f59e0b", gradientTo: "#3b82f6" };

// The slide design is tuned for a full 16:9 viewport, so we render every slide
// into a fixed 1920×1080 "stage" (identical proportions to the player on a large
// screen) and scale that down to a 1280×720 page (= 13.333in × 7.5in widescreen,
// the PPTX/Keynote default). PDF prints the scaled vector page; PPTX rasterizes
// the unscaled stage at high resolution.
const STAGE_W = 1920;
const STAGE_H = 1080;
const PAGE_W = 1280;
const PAGE_H = 720;
const SCALE = PAGE_W / STAGE_W; // 0.6667
const RASTER_SCALE = 2; // 2× → ~288dpi images in the deck

function sanitizeFileName(name: string): string {
  return (name || "presentation").replace(/[^\w一-龥 .-]+/g, "_").slice(0, 80).trim() || "presentation";
}

// A non-interactive Adjustable wrapper: still applies the user's saved layout
// overrides, but no drag/select/edit affordances.
function staticAdj(slide: Slide) {
  return (key: string) => ({
    elKey: key,
    override: slide.overrides?.[key],
    editMode: false,
    selected: false,
    onSelect: () => {},
    onChange: () => {},
    ...blockAttrsForElKey(key, slide),
  });
}

function ExportInner() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND);
  const [title, setTitle] = useState("presentation");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const stageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!id) { setStatus("error"); return; }
    fetch(`/api/presentations/${id}`)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then((d) => {
        setSlides(d.slides ?? []);
        if (d.title) setTitle(d.title);
        if (d.brand) setBrand({
          text: d.brand.text ?? DEFAULT_BRAND.text,
          gradientFrom: d.brand.gradientFrom ?? DEFAULT_BRAND.gradientFrom,
          gradientTo: d.brand.gradientTo ?? DEFAULT_BRAND.gradientTo,
        });
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [id]);

  const exportPdf = useCallback(() => {
    // Browser print-to-PDF: vector text, selectable, perfect gradients. The
    // @media print rules below lay one slide per widescreen page.
    window.print();
  }, []);

  const exportPptx = useCallback(async () => {
    if (slides.length === 0) return;
    try {
      setBusy("Preparing…");
      await document.fonts.ready;
      const { domToPng } = await import("modern-screenshot");
      const PptxGen = (await import("pptxgenjs")).default;

      const pptx = new PptxGen();
      pptx.defineLayout({ name: "K2S_16x9", width: 13.333, height: 7.5 });
      pptx.layout = "K2S_16x9";

      for (let i = 0; i < slides.length; i++) {
        const node = stageRefs.current[i];
        if (!node) continue;
        setBusy(`Rendering slide ${i + 1} / ${slides.length}…`);
        // Two passes the first time warms font/image inlining; one is enough here.
        const dataUrl = await domToPng(node, {
          width: STAGE_W,
          height: STAGE_H,
          scale: RASTER_SCALE,
          backgroundColor: "#fafafa",
        });
        const s = pptx.addSlide();
        s.addImage({ data: dataUrl, x: 0, y: 0, w: 13.333, h: 7.5 });
      }

      setBusy("Saving .pptx…");
      await pptx.writeFile({ fileName: `${sanitizeFileName(title)}.pptx` });
    } catch (err) {
      console.error("[export] pptx failed", err);
      alert(`Export to PPTX failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setBusy(null);
    }
  }, [slides, title]);

  return (
    <main className="export-root">
      <style>{`
        .export-root { min-height: 100vh; background: #18181b; display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 88px 24px 48px; }
        .export-page { width: ${PAGE_W}px; height: ${PAGE_H}px; background: #fafafa; overflow: hidden; position: relative; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.45); }
        .export-scaler { width: ${STAGE_W}px; height: ${STAGE_H}px; transform: scale(${SCALE}); transform-origin: top left; }
        .export-stage { width: ${STAGE_W}px; height: ${STAGE_H}px; background: #fafafa; overflow: hidden; }
        .export-toolbar { position: fixed; top: 0; left: 0; right: 0; z-index: 50; display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: rgba(24,24,27,0.92); backdrop-filter: blur(8px); border-bottom: 1px solid rgba(255,255,255,0.08); }
        .export-pagenum { position: absolute; bottom: 10px; right: 14px; font-size: 11px; color: #9ca3af; font-variant-numeric: tabular-nums; }
        @media print {
          @page { size: 13.333in 7.5in; margin: 0; }
          html, body { background: #fff !important; }
          .export-root { background: #fff; padding: 0; gap: 0; }
          .export-toolbar { display: none !important; }
          .export-page { border-radius: 0; box-shadow: none; break-after: page; page-break-after: always; }
          .export-page:last-child { break-after: auto; page-break-after: auto; }
          .export-pagenum { display: none; }
        }
      `}</style>

      <div className="export-toolbar">
        <button
          onClick={() => router.push(id ? `/player?id=${id}` : "/library")}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          ← Back
        </button>
        <span className="text-sm font-semibold text-white truncate max-w-[40vw]">{title}</span>
        <span className="text-xs text-gray-400">{slides.length} slides</span>
        <div className="flex-1" />
        {busy && <span className="text-xs text-teal-300 animate-pulse">{busy}</span>}
        <button
          onClick={exportPdf}
          disabled={!!busy || status !== "ready"}
          className="rounded-md bg-white/10 px-4 py-1.5 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50 transition-colors"
        >
          Download PDF
        </button>
        <button
          onClick={exportPptx}
          disabled={!!busy || status !== "ready"}
          className="rounded-md bg-teal-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50 transition-colors"
        >
          {busy ? "Exporting…" : "Export PPTX"}
        </button>
      </div>

      {status === "loading" && <p className="mt-24 text-sm text-gray-400">Loading deck…</p>}
      {status === "error" && <p className="mt-24 text-sm text-red-400">Couldn’t load this presentation.</p>}

      {status === "ready" && slides.map((slide, i) => (
        <div className="export-page" key={i}>
          <div className="export-scaler">
            <div className="export-stage" ref={(el) => { stageRefs.current[i] = el; }}>
              <div className="h-full flex items-center p-16 relative" style={{ color: "#09090b" }}>
                <SlideView
                  slide={slide}
                  brand={brand}
                  adj={staticAdj(slide)}
                  interactiveImages={false}
                />
              </div>
            </div>
          </div>
          <span className="export-pagenum">{i + 1} / {slides.length}</span>
        </div>
      ))}
    </main>
  );
}

export default function ExportPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-[#18181b]" />}>
      <ExportInner />
    </Suspense>
  );
}
