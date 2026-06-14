"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useAutoAnimate } from "@/hooks/use-auto-animate";
import { flipIdFor } from "@/core/rendering/morph";
import { useSearchParams, useRouter } from "next/navigation";
import type { Slide, Brand, SlideElementOverride } from "../slides";
import { inlineMd, stripMd } from "@/lib/markdown-inline";
import { useKeybindings, matchesBinding, formatBinding } from "@/lib/keybindings";
import { SettingsDialog } from "@/components/settings/keybinding-settings";
import { SlideView, embedSrc } from "@/components/player/slide-view";

const DEFAULT_BRAND: Brand = { text: "SYNOGIZE LAB", gradientFrom: "#f59e0b", gradientTo: "#3b82f6" };

interface DeckChunk {
  id: string;
  page?: number;
  paragraph?: number;
  text: string;
}



// Presentation view
function PresentationView({ id }: { id: string }) {
  const router = useRouter();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND);
  const [chunks, setChunks] = useState<DeckChunk[]>([]);
  const [loadingSlides, setLoadingSlides] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isIframeExpanded, setIsIframeExpanded] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"forward" | "backward">("forward");
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [autoAnimateEnabled, setAutoAnimateEnabled] = useState(true);
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const { captureFlipState } = useAutoAnimate({
    containerRef: slideContainerRef,
    currentIndex: currentSlide,
    enabled: autoAnimateEnabled,
  });

  // Custom shortcuts + the two interactive modes they trigger.
  const { bindings } = useKeybindings();
  const [showSettings, setShowSettings] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedEl, setSelectedEl] = useState<string | null>(null);
  const editSnapshot = useRef<Slide[] | null>(null);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenInstruction, setRegenInstruction] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState("");
  const [regenImageId, setRegenImageId] = useState<string | null>(null);
  const [regenImageUrl, setRegenImageUrl] = useState<string | null>(null);
  const [regenUploading, setRegenUploading] = useState(false);
  const regenFileRef = useRef<HTMLInputElement>(null);
  const [savingLayout, setSavingLayout] = useState(false);

  // Refs so the keydown handler can stay stable while reading live values.
  const currentSlideRef = useRef(currentSlide);
  currentSlideRef.current = currentSlide;
  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  const selectedElRef = useRef(selectedEl);
  selectedElRef.current = selectedEl;

  const applyOverride = useCallback((key: string, patch: SlideElementOverride) => {
    const idx = currentSlideRef.current;
    setSlides((prev) =>
      prev.map((s, i) =>
        i === idx ? { ...s, overrides: { ...s.overrides, [key]: { ...s.overrides?.[key], ...patch } } } : s,
      ),
    );
  }, []);

  const nudgeSelected = useCallback((dx: number, dy: number) => {
    const key = selectedElRef.current;
    if (!key) return;
    const cur = slidesRef.current[currentSlideRef.current]?.overrides?.[key] ?? {};
    applyOverride(key, { dx: (cur.dx ?? 0) + dx, dy: (cur.dy ?? 0) + dy });
  }, [applyOverride]);

  const scaleSelected = useCallback((d: number) => {
    const key = selectedElRef.current;
    if (!key) return;
    const cur = slidesRef.current[currentSlideRef.current]?.overrides?.[key] ?? {};
    const next = Math.max(0.3, Math.min(3, (cur.scale ?? 1) + d));
    applyOverride(key, { scale: Math.round(next * 100) / 100 });
  }, [applyOverride]);

  const resetSelected = useCallback(() => {
    const key = selectedElRef.current;
    if (!key) return;
    const idx = currentSlideRef.current;
    setSlides((prev) =>
      prev.map((s, i) => {
        if (i !== idx || !s.overrides) return s;
        const rest = { ...s.overrides };
        delete rest[key];
        return { ...s, overrides: rest };
      }),
    );
  }, []);

  const enterEditMode = useCallback(() => {
    editSnapshot.current = JSON.parse(JSON.stringify(slidesRef.current));
    setSelectedEl(null);
    setEditMode(true);
  }, []);

  const cancelEdit = useCallback(() => {
    if (editSnapshot.current) setSlides(editSnapshot.current);
    editSnapshot.current = null;
    setSelectedEl(null);
    setEditMode(false);
  }, []);

  const saveEdit = useCallback(async () => {
    setSavingLayout(true);
    try {
      await fetch(`/api/presentations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides: slidesRef.current }),
      });
      editSnapshot.current = null;
      setSelectedEl(null);
      setEditMode(false);
    } finally {
      setSavingLayout(false);
    }
  }, [id]);

  const resetRegen = useCallback(() => {
    setRegenOpen(false);
    setRegenInstruction("");
    setRegenImageId(null);
    setRegenImageUrl(null);
    setRegenError("");
  }, []);

  const handleRegenUpload = useCallback(async (file: File) => {
    setRegenUploading(true);
    setRegenError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/presentations/${id}/upload-image`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setRegenImageId(data.id);
      setRegenImageUrl(data.filepath);
    } catch (e) {
      setRegenError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setRegenUploading(false);
      if (regenFileRef.current) regenFileRef.current.value = "";
    }
  }, [id]);

  const handleRegenerate = useCallback(async () => {
    setRegenLoading(true);
    setRegenError("");
    try {
      const res = await fetch(`/api/presentations/${id}/regenerate-slide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slideIndex: currentSlideRef.current, instruction: regenInstruction, attachImageId: regenImageId }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Deck changed under us (edited/regenerated elsewhere) so our positional
        // slideIndex is stale. The route hands back the real slide count — resync
        // the player and clamp the cursor so a retry targets a real slide.
        if (typeof data.slideCount === "number") {
          const fresh = await fetch(`/api/presentations/${id}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null);
          if (Array.isArray(fresh?.slides)) {
            setSlides(fresh.slides);
            setCurrentSlide((c) => Math.min(c, Math.max(0, fresh.slides.length - 1)));
          }
        }
        throw new Error(data.error || "Regeneration failed");
      }
      const idx = currentSlideRef.current;
      setSlides((prev) => prev.map((s, i) => (i === idx ? (data.slide as Slide) : s)));
      resetRegen();
    } catch (e) {
      setRegenError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setRegenLoading(false);
    }
  }, [id, regenInstruction, regenImageId, resetRegen]);

  useEffect(() => {
    fetch(`/api/presentations/${id}`)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then((d) => {
        setSlides(d.slides ?? []);
        setChunks(d.chunks ?? []);
        if (d.brand) setBrand({
          text: d.brand.text ?? DEFAULT_BRAND.text,
          gradientFrom: d.brand.gradientFrom ?? DEFAULT_BRAND.gradientFrom,
          gradientTo: d.brand.gradientTo ?? DEFAULT_BRAND.gradientTo,
        });
        if (d.autoAnimate === false) setAutoAnimateEnabled(false);
      })
      .catch(() => setFetchError("Presentation not found"))
      .finally(() => setLoadingSlides(false));
  }, [id]);

  const brandGradient = `linear-gradient(135deg, ${brand.gradientFrom} 0%, ${brand.gradientTo} 100%)`;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (slides.length === 0) return;

      // Custom combo shortcuts fire regardless of focus.
      if (matchesBinding(e, bindings["regenerate-slide"])) {
        e.preventDefault();
        if (!editMode) { setRegenError(""); setRegenOpen(true); }
        return;
      }
      if (matchesBinding(e, bindings["adjust-layout"])) {
        e.preventDefault();
        if (editMode) cancelEdit(); else enterEditMode();
        return;
      }

      // Don't navigate while a modal/settings is open.
      if (regenOpen || showSettings) return;

      // In adjust mode arrows nudge / +- scale / Esc cancels.
      if (editMode) {
        const step = e.shiftKey ? 20 : 4;
        if (e.key === "ArrowRight") { e.preventDefault(); nudgeSelected(step, 0); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); nudgeSelected(-step, 0); }
        else if (e.key === "ArrowUp") { e.preventDefault(); nudgeSelected(0, -step); }
        else if (e.key === "ArrowDown") { e.preventDefault(); nudgeSelected(0, step); }
        else if (e.key === "+" || e.key === "=") { e.preventDefault(); scaleSelected(0.05); }
        else if (e.key === "-" || e.key === "_") { e.preventDefault(); scaleSelected(-0.05); }
        else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
        return;
      }

      const target = e.target as HTMLElement | null;
      const isInteractiveTarget = !!target?.closest("button, input, textarea, select, a");
      if (isInteractiveTarget && (e.key === " " || e.key === "Enter")) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        captureFlipState();
        setSlideDirection("forward");
        setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        captureFlipState();
        setSlideDirection("backward");
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Home") {
        e.preventDefault(); captureFlipState(); setSlideDirection("backward"); setCurrentSlide(0);
      } else if (e.key === "End") {
        e.preventDefault(); captureFlipState(); setSlideDirection("forward"); setCurrentSlide(slides.length - 1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (showEvidence) setShowEvidence(false);
        else if (isIframeExpanded) setIsIframeExpanded(false);
        else router.push("/library");
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        setShowEvidence((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isIframeExpanded, showEvidence, slides.length, router, captureFlipState, bindings, editMode, regenOpen, showSettings, enterEditMode, cancelEdit, nudgeSelected, scaleSelected]);

  if (loadingSlides) {
    return (
      <main className="h-screen w-screen flex items-center justify-center bg-[#fafafa]">
        <div className="w-8 h-8 rounded-full border-2 border-[#14b8a6] border-t-transparent animate-spin" />
      </main>
    );
  }

  if (fetchError || slides.length === 0) {
    return (
      <main className="h-screen w-screen flex flex-col items-center justify-center bg-[#fafafa] gap-4">
        <p className="text-gray-500">{fetchError || "No slides found"}</p>
        <a href="/library" className="text-sm text-[#14b8a6] hover:underline">← Back to library</a>
      </main>
    );
  }

  const slide = slides[currentSlide];
  const progress = ((currentSlide + 1) / slides.length) * 100;

  // Derive the set of animKeys for this slide: prefer adapter-computed, else auto-derive from content
  const slideAnimKeys = new Set<string>(
    slide.animKeys ?? [
      ...(slide.headline ? ['title'] : []),
      ...(slide.code ? ['code:0'] : []),
    ]
  );
  const headlineFlipId = slideAnimKeys.has('title') ? flipIdFor('title') : undefined;
  const codeFlipId = slideAnimKeys.has('code:0') ? flipIdFor('code:0') : undefined;

  // Resolve evidence refs → chunks for the current slide
  const chunksById = new Map(chunks.map((c) => [c.id, c]));
  const slideEvidence: DeckChunk[] = (slide.evidenceRefs ?? [])
    .map((id) => chunksById.get(id))
    .filter((c): c is DeckChunk => !!c);
  const evidencePages = Array.from(new Set(slideEvidence.map((c) => c.page).filter((p): p is number => typeof p === "number"))).sort((a, b) => a - b);

  // Props for an Adjustable element wrapper on the current slide.
  const adj = (key: string) => ({
    elKey: key,
    override: slide.overrides?.[key],
    editMode,
    selected: selectedEl === key,
    onSelect: setSelectedEl,
    onChange: applyOverride,
  });

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#fafafa] text-gray-900 relative">
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 z-50">
        <div className="h-full transition-all duration-300 ease-out" style={{ width: `${progress}%`, backgroundColor: slide.color || "#14b8a6" }} />
      </div>

      {/* Bottom-left brand glyph */}
      <div className="absolute bottom-3 left-8 z-50 text-[#D1D5DB] opacity-70 select-none pointer-events-none">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M11 7a4 4 0 1 1-3-3.87" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>

      {/* Floating page indicator (keyboard nav: ←/→/Space/Home/End/Esc, i for sources) */}
      <div className="absolute bottom-4 right-6 flex items-center gap-3 z-50">
        {slideEvidence.length > 0 && (
          <button
            onClick={() => setShowEvidence((v) => !v)}
            className="pointer-events-auto text-[10px] text-gray-400 hover:text-gray-700 font-medium tracking-wider uppercase transition-colors"
            title="Press i to toggle sources"
          >
            {evidencePages.length > 0
              ? `Sources · p${evidencePages.join(", p")}`
              : `Sources · ${slideEvidence.length}`}
          </button>
        )}
        <div className="text-xs text-gray-400 font-medium tabular-nums pointer-events-none">
          {currentSlide + 1} / {slides.length}
        </div>
        <button
          onClick={() => window.open(`/player/export?id=${id}`, "_blank")}
          className="pointer-events-auto text-gray-400 hover:text-gray-700 transition-colors"
          title="Export to PDF / PowerPoint"
          aria-label="Export to PDF or PowerPoint"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="pointer-events-auto text-gray-400 hover:text-gray-700 transition-colors"
          title={`Shortcuts — Regenerate: ${formatBinding(bindings["regenerate-slide"])} · Adjust layout: ${formatBinding(bindings["adjust-layout"])}`}
          aria-label="Keyboard shortcuts"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Evidence panel (toggle with `i`) */}
      {showEvidence && slideEvidence.length > 0 && (
        <div className="absolute bottom-12 right-6 z-50 w-[420px] max-h-[60vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-gray-500">Sources for this slide</span>
            <button onClick={() => setShowEvidence(false)} className="text-gray-400 hover:text-gray-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {slideEvidence.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="text-[10px] font-mono text-gray-400 mb-1">
                  {c.id}{c.page !== undefined ? ` · p${c.page}` : ""}{c.paragraph !== undefined ? `¶${c.paragraph}` : ""}
                </div>
                <p className="text-xs leading-relaxed text-gray-700">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Slide content */}
      <div
        ref={slideContainerRef}
        key={currentSlide}
        className={`h-full flex items-center p-16 relative ${slideDirection === "forward" ? "animate-slide-in-down" : "animate-slide-in-up"}`}
        style={editMode ? { userSelect: "none" } : undefined}
      >
        <SlideView
          slide={slide}
          brand={brand}
          adj={adj}
          headlineFlipId={headlineFlipId}
          codeFlipId={codeFlipId}
          quizAnswer={quizAnswers[currentSlide]}
          onQuizSelect={(option) => setQuizAnswers((prev) => ({ ...prev, [currentSlide]: option }))}
          onExpandIframe={() => setIsIframeExpanded(true)}
          interactiveImages={!editMode}
        />
      </div>

      {/* Expanded iframe modal */}
      {isIframeExpanded && slide.type === "iframe" && (
        <div className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-300" onClick={() => setIsIframeExpanded(false)}>
          <div className="w-full h-full rounded-xl shadow-2xl overflow-hidden border border-gray-200/50 bg-white animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 bg-[#f6f6f6] border-b border-gray-200/50">
              <div className="flex gap-1.5"><div className="h-3 w-3 rounded-full bg-[#ff5f57]/80" /><div className="h-3 w-3 rounded-full bg-[#febc2e]/80" /><div className="h-3 w-3 rounded-full bg-[#28c840]/80" /></div>
              <div className="flex flex-1 items-center justify-center px-4">
                <div className="flex max-w-md flex-1 items-center gap-2 rounded-md px-3 py-1.5 text-sm bg-white border border-gray-200">
                  <span className="truncate text-gray-600 text-xs">{slide.iframeUrl}</span>
                </div>
              </div>
              <button onClick={() => setIsIframeExpanded(false)} className="rounded-md p-1.5 transition-colors hover:bg-gray-200 text-gray-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="relative h-[calc(100%-48px)] bg-white">
              <iframe src={embedSrc(slide.iframeUrl)} title="Web Preview (Expanded)" className="h-full w-full border-0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" style={{ minHeight: "100%" }} />
            </div>
          </div>
        </div>
      )}

      {/* Adjust-mode toolbar */}
      {editMode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-3 rounded-full border border-gray-200 bg-white/95 backdrop-blur px-4 py-2 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="text-xs font-semibold text-gray-700">Adjust layout</span>
          <span className="text-[11px] text-gray-400">
            {selectedEl ? `Selected: ${selectedEl} · drag, ↑↓←→ to nudge, +/− to scale` : "Click an element to select"}
          </span>
          {selectedEl && (
            <button onClick={resetSelected} className="text-[11px] font-medium text-gray-500 hover:text-gray-800">
              Reset element
            </button>
          )}
          <span className="w-px h-4 bg-gray-200" />
          <button onClick={cancelEdit} className="text-xs font-medium text-gray-500 hover:text-gray-800">
            Cancel
          </button>
          <button
            onClick={saveEdit}
            disabled={savingLayout}
            className="rounded-full bg-teal-500 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-600 disabled:opacity-60"
          >
            {savingLayout ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {/* Regenerate-slide modal */}
      {regenOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 backdrop-blur-sm p-6 animate-in fade-in duration-150"
          onClick={() => !regenLoading && resetRegen()}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900">Regenerate this slide?</h3>
            <p className="mt-1 text-sm text-gray-500">
              Slide {currentSlide + 1} of {slides.length} will be re-drafted with the original prompt for its section. Add
              anything specific you want changed (optional).
            </p>
            <textarea
              autoFocus
              value={regenInstruction}
              onChange={(e) => setRegenInstruction(e.target.value)}
              placeholder="e.g. This slide is missing a concrete example. Add a code snippet and tighten the headline."
              rows={4}
              className="mt-4 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            />

            {/* Optional: attach your own image to this slide */}
            <div className="mt-3">
              <input
                ref={regenFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRegenUpload(f); }}
              />
              {regenImageUrl ? (
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={regenImageUrl} alt="attached" className="h-12 w-16 rounded object-contain bg-gray-50" />
                  <span className="flex-1 text-xs text-gray-500">Image attached — it will be placed on this slide.</span>
                  <button
                    onClick={() => { setRegenImageId(null); setRegenImageUrl(null); }}
                    className="text-xs font-medium text-red-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => regenFileRef.current?.click()}
                  disabled={regenUploading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 px-3 py-2.5 text-xs text-gray-500 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-60"
                >
                  {regenUploading ? "Uploading…" : "📎 Attach an image for this slide (optional)"}
                </button>
              )}
            </div>

            {regenError && <p className="mt-2 text-sm text-red-500">{regenError}</p>}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={resetRegen}
                disabled={regenLoading}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerate}
                disabled={regenLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60"
              >
                {regenLoading && <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {regenLoading ? "Regenerating…" : "Regenerate"}
              </button>
            </div>
          </div>
        </div>
      )}

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </main>
  );
}

function PlayerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");

  useEffect(() => {
    if (!id) router.replace("/library");
  }, [id, router]);

  if (!id) return <div className="fixed inset-0 z-[60] bg-background" />;
  return <PresentationView id={id} />;
}

export default function Player() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[60] bg-[#fafafa]" />}>
      <PlayerInner />
    </Suspense>
  );
}
