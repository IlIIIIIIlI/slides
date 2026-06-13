"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useAutoAnimate } from "@/hooks/use-auto-animate";
import { flipIdFor } from "@/core/rendering/morph";
import { useSlideTimeline } from "@/lib/animation/slide-timeline";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Slide, Brand, FileTreeNode, SlideElementOverride } from "../slides";
import { resolveVariant } from "@/lib/slide-variants";
import { inlineMd, stripMd } from "@/lib/markdown-inline";
import { useKeybindings, matchesBinding, formatBinding } from "@/lib/keybindings";
import { SettingsDialog } from "@/components/settings/keybinding-settings";
import { Adjustable } from "@/components/player/adjustable";

const DEFAULT_BRAND: Brand = { text: "SYNOGIZE LAB", gradientFrom: "#f59e0b", gradientTo: "#3b82f6" };

interface DeckChunk {
  id: string;
  page?: number;
  paragraph?: number;
  text: string;
}

// TreeNode component (unchanged — slide design system)
function TreeNode({
  name,
  children,
  isFolder,
  color,
  defaultOpen = false,
}: {
  name: React.ReactNode;
  children?: React.ReactNode;
  isFolder: boolean;
  color?: string;
  level?: number;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 pl-2 hover:bg-gray-50 rounded cursor-pointer"
        onClick={() => isFolder && setIsOpen(!isOpen)}
      >
        {isFolder ? (
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        ) : <span className="w-4" />}
        {isFolder ? (
          <svg className="w-4 h-4" style={{ color: color || "#60a5fa" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
        <span style={{ color: isFolder ? "var(--slide-text-primary)" : "var(--slide-text-secondary)" }}>{name}</span>
      </div>
      {isFolder && isOpen && children && <div className="ml-4 border-l border-gray-200">{children}</div>}
    </div>
  );
}

// FileTreeView — renders structured FileTreeNode[] using TreeNode + a faint trailing comment.
function FileTreeView({ nodes, color, depth = 0 }: { nodes: FileTreeNode[]; color?: string; depth?: number }) {
  return (
    <>
      {nodes.map((node, i) => {
        const hasChildren = !!node.children && node.children.length > 0;
        const label = (
          <>
            <span>{node.name}</span>
            {node.comment && <span className="ml-3 text-gray-400">{node.comment}</span>}
          </>
        );
        return (
          <TreeNode
            key={`${depth}-${i}-${node.name}`}
            name={label}
            isFolder={hasChildren}
            color={color}
            defaultOpen={depth === 0}
          >
            {hasChildren && <FileTreeView nodes={node.children!} color={color} depth={depth + 1} />}
          </TreeNode>
        );
      })}
    </>
  );
}

// Recovery parser for ui-mockup leftContent. The model is told to put bullets
// in `points`, but when it inlines them as ` - x — y - x — y` we split here so
// the slide doesn't render as one wall of text.
function splitLeftContent(raw?: string): { lead?: string; bullets: string[] } {
  if (!raw) return { bullets: [] };
  const parts = raw.split(/(?:\r?\n|\s)+[-*]\s+(?=\S)/g);
  if (parts.length < 3) return { lead: raw, bullets: [] };
  const lead = parts[0].trim();
  const bullets = parts.slice(1).map((s) => s.trim()).filter(Boolean);
  return { lead: lead || undefined, bullets };
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

  // Drive per-slide reveal timeline via GSAP when the slide declares one.
  // Elements are targeted by their data-anim attribute (set on each Adjustable wrapper).
  useSlideTimeline(slideContainerRef, slides[currentSlide]?.timeline, currentSlide);

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
      if (!res.ok) throw new Error(data.error || "Regeneration failed");
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
  const v = resolveVariant(slide);
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
        {/* Brand badge */}
        {brand.text && (
          <div className="absolute top-12 right-16">
            <div className="relative">
              <div className="absolute inset-0 blur-lg opacity-40" style={{ background: brandGradient }} />
              <span className="relative slide-label font-bold" style={{ background: brandGradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                {brand.text}
              </span>
            </div>
          </div>
        )}

        {/* Label */}
        {slide.label && (
          <div className="absolute top-12 left-16 slide-label" style={{ color: slide.color }}>{slide.label}</div>
        )}

        <div className="max-w-7xl w-full mx-auto">
          {slide.type === "title" && v === "centered" && (
            <div className="text-center relative">
              <div className="absolute inset-0 opacity-10 blur-3xl" style={{ background: `radial-gradient(circle at 30% 50%, ${brand.gradientFrom} 0%, transparent 50%), radial-gradient(circle at 70% 50%, ${brand.gradientTo} 0%, transparent 50%)` }} />
              <Adjustable {...adj("headline")}>
                <h1 data-flip-id={headlineFlipId} className="type-display text-9xl font-bold mb-8 tracking-[-0.035em] leading-none relative z-10" style={{ background: brandGradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{stripMd(slide.headline)}</h1>
              </Adjustable>
              {slide.subtitle && <Adjustable {...adj("subtitle")}><p className="text-3xl font-light relative z-10" style={{ color: "var(--slide-text-muted)" }}>{stripMd(slide.subtitle)}</p></Adjustable>}
              <div className="mt-12 flex justify-center relative z-10">
                <div className="h-1 w-32 rounded-full" style={{ background: `linear-gradient(90deg, ${brand.gradientFrom} 0%, ${brand.gradientTo} 100%)` }} />
              </div>
            </div>
          )}

          {slide.type === "title" && v === "left" && (
            <div className="relative w-full">
              <div className="absolute inset-0 opacity-10 blur-3xl" style={{ background: `radial-gradient(circle at 20% 50%, ${brand.gradientFrom} 0%, transparent 60%)` }} />
              <div className="h-1 w-24 rounded-full mb-10 relative z-10" style={{ background: `linear-gradient(90deg, ${brand.gradientFrom} 0%, ${brand.gradientTo} 100%)` }} />
              <Adjustable {...adj("headline")}>
                <h1 data-flip-id={headlineFlipId} className="type-display text-8xl font-bold mb-6 tracking-[-0.035em] leading-none relative z-10" style={{ background: brandGradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{stripMd(slide.headline)}</h1>
              </Adjustable>
              {slide.subtitle && <Adjustable {...adj("subtitle")}><p className="text-2xl font-light relative z-10 max-w-3xl" style={{ color: "var(--slide-text-muted)" }}>{stripMd(slide.subtitle)}</p></Adjustable>}
            </div>
          )}

          {slide.type === "goals" && v === "list" && (
            <div className="mt-20">
              <Adjustable {...adj("headline")}>
                <h2 data-flip-id={headlineFlipId} className="type-display text-7xl font-bold mb-16 tracking-[-0.035em] leading-none" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              </Adjustable>
              <Adjustable {...adj("points")} className="space-y-6">
                {slide.points?.map((point, idx) => (
                  <div key={idx} className="text-2xl leading-relaxed" style={{ color: "var(--slide-text-secondary)" }}>• {inlineMd(point)}</div>
                ))}
              </Adjustable>
            </div>
          )}

          {slide.type === "goals" && v === "grid" && (
            <div className="mt-20">
              <Adjustable {...adj("headline")}>
                <h2 data-flip-id={headlineFlipId} className="type-display text-6xl font-bold mb-12 tracking-[-0.035em] leading-none" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              </Adjustable>
              <Adjustable {...adj("points")} className="grid grid-cols-2 gap-6">
                {slide.points?.map((point, idx) => (
                  <div key={idx} className="rounded-xl border border-gray-200/70 p-6">
                    <div className="text-xs font-mono mb-2" style={{ color: slide.color || "var(--slide-text-muted)" }}>{String(idx + 1).padStart(2, "0")}</div>
                    <p className="text-xl leading-relaxed" style={{ color: "var(--slide-text-secondary)" }}>{inlineMd(point)}</p>
                  </div>
                ))}
              </Adjustable>
            </div>
          )}

          {slide.type === "goals" && v === "numbered" && (
            <div className="mt-20">
              <Adjustable {...adj("headline")}>
                <h2 data-flip-id={headlineFlipId} className="type-display text-7xl font-bold mb-16 tracking-[-0.035em] leading-none" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              </Adjustable>
              <Adjustable {...adj("points")} className="space-y-5">
                {slide.points?.map((point, idx) => (
                  <div key={idx} className="flex items-baseline gap-5">
                    <span className="type-display text-4xl font-bold tabular-nums" style={{ color: slide.color || "var(--slide-text-faint)" }}>{String(idx + 1).padStart(2, "0")}</span>
                    <span className="text-2xl leading-relaxed" style={{ color: "var(--slide-text-secondary)" }}>{inlineMd(point)}</span>
                  </div>
                ))}
              </Adjustable>
            </div>
          )}

          {slide.type === "section-divider" && v === "huge" && (
            <div className="text-center relative">
              <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at center, ${slide.color} 0%, transparent 70%)` }} />
              <Adjustable {...adj("headline")}>
                <h2 data-flip-id={headlineFlipId} className="type-display text-9xl font-bold tracking-[-0.035em] leading-none relative z-10" style={{ color: slide.color }}>{stripMd(slide.headline)}</h2>
              </Adjustable>
            </div>
          )}

          {slide.type === "section-divider" && v === "minimal" && (
            <div className="relative w-full">
              <div className="h-px w-32 mb-8" style={{ background: slide.color || "var(--slide-text-faint)" }} />
              <Adjustable {...adj("headline")}>
                <h2 data-flip-id={headlineFlipId} className="type-display text-7xl font-bold tracking-[-0.035em] leading-none" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              </Adjustable>
            </div>
          )}

          {slide.type === "statement" && v === "large" && (
            <div className="mt-20">
              <Adjustable {...adj("headline")}>
                <h2 data-flip-id={headlineFlipId} className="type-display text-7xl font-bold mb-10 leading-tight tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              </Adjustable>
              {slide.supporting && <Adjustable {...adj("supporting")}><p className="text-2xl leading-relaxed max-w-4xl font-light" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p></Adjustable>}
            </div>
          )}

          {slide.type === "statement" && v === "tight" && (
            <div className="max-w-4xl">
              <div className="h-1 w-12 mb-8 rounded-full" style={{ background: slide.color || "var(--slide-text-primary)" }} />
              <Adjustable {...adj("headline")}>
                <h2 data-flip-id={headlineFlipId} className="type-display text-5xl font-bold mb-6 leading-tight tracking-[-0.025em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              </Adjustable>
              {slide.supporting && <Adjustable {...adj("supporting")}><p className="text-xl leading-relaxed font-light" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p></Adjustable>}
            </div>
          )}

          {slide.type === "code" && v === "split" && (
            <div className="flex gap-16 items-start mt-20">
              <div className="flex-1">
                <Adjustable {...adj("headline")}>
                  <h2 data-flip-id={headlineFlipId} className="type-display text-5xl font-bold leading-tight tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
                </Adjustable>
              </div>
              <Adjustable {...adj("code")} className="flex-1">
                <div data-flip-id={codeFlipId} className="rounded-lg overflow-hidden shadow-lg border border-gray-200/50">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-[#f6f6f6] border-b border-gray-200/50">
                    <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-[#ff5f57]" /><div className="w-3 h-3 rounded-full bg-[#febc2e]" /><div className="w-3 h-3 rounded-full bg-[#28c840]" /></div>
                    <div className="flex-1 text-center text-[11px] font-medium" style={{ color: "var(--slide-text-muted)" }}>code</div>
                  </div>
                  <div className="bg-[#1e1e1e]">
                    <SyntaxHighlighter language="python" style={vscDarkPlus} customStyle={{ margin: 0, padding: "1.5rem", background: "#1e1e1e", fontSize: "13px", lineHeight: "1.6" }} showLineNumbers={false}>{slide.code || ""}</SyntaxHighlighter>
                  </div>
                </div>
              </Adjustable>
            </div>
          )}

          {slide.type === "code" && v === "full" && (
            <div className="mt-12 w-full">
              <Adjustable {...adj("headline")}>
                <h2 data-flip-id={headlineFlipId} className="type-display text-4xl font-bold leading-tight tracking-[-0.025em] mb-6" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              </Adjustable>
              <Adjustable {...adj("code")}>
              <div data-flip-id={codeFlipId} className="rounded-lg overflow-hidden shadow-lg border border-gray-200/50">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-[#f6f6f6] border-b border-gray-200/50">
                  <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-[#ff5f57]" /><div className="w-3 h-3 rounded-full bg-[#febc2e]" /><div className="w-3 h-3 rounded-full bg-[#28c840]" /></div>
                  <div className="flex-1 text-center text-[11px] font-medium" style={{ color: "var(--slide-text-muted)" }}>code</div>
                </div>
                <div className="bg-[#1e1e1e]">
                  <SyntaxHighlighter language={slide.codeLanguage || "python"} style={vscDarkPlus} customStyle={{ margin: 0, padding: "1.5rem", background: "#1e1e1e", fontSize: "14px", lineHeight: "1.6" }} showLineNumbers={false}>{slide.code || ""}</SyntaxHighlighter>
                </div>
              </div>
              </Adjustable>
            </div>
          )}

          {slide.type === "code" && v === "terminal" && (
            <div className="mt-10 w-full">
              <Adjustable {...adj("headline")}>
                <h2 data-flip-id={headlineFlipId} className="type-display text-5xl font-bold leading-tight tracking-[-0.035em] mb-3" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              </Adjustable>
              {slide.supporting && <Adjustable {...adj("supporting")}><p className="text-lg font-light mb-8 max-w-3xl" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p></Adjustable>}
              <Adjustable {...adj("code")}>
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                <div className="px-5 py-3 bg-[#f6f6f7] border-b border-gray-200 text-[11px] font-semibold tracking-[0.2em] uppercase text-gray-500">{slide.terminalTitle ?? "TERMINAL"}</div>
                <SyntaxHighlighter
                  language={slide.codeLanguage || "shell"}
                  style={oneLight}
                  customStyle={{ margin: 0, padding: "1.75rem 2rem", background: "transparent", fontSize: "15px", lineHeight: "1.55" }}
                  showLineNumbers={false}
                >{slide.code || ""}</SyntaxHighlighter>
              </div>
              </Adjustable>
            </div>
          )}

          {slide.type === "framework" && v === "lead-in" && (
            <div className="mt-20">
              <Adjustable {...adj("headline")}>
                <h2 data-flip-id={headlineFlipId} className="type-display text-6xl font-bold mb-16 tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              </Adjustable>
              <Adjustable {...adj("points")} className="space-y-7">
                {slide.points?.map((point, idx) => {
                  const [leadRaw, ...restParts] = point.split("—");
                  const lead = stripMd(leadRaw.trim());
                  const rest = restParts.join("—").trim();
                  return (
                    <div key={idx} className="text-2xl leading-relaxed">
                      <span className="type-display font-semibold tracking-tight" style={{ color: slide.color }}>{lead}</span>
                      {rest && <span className="font-light" style={{ color: "var(--slide-text-muted)" }}> — {inlineMd(rest)}</span>}
                    </div>
                  );
                })}
              </Adjustable>
              {slide.supporting && <Adjustable {...adj("supporting")}><p className="text-xl mt-10 leading-relaxed font-light max-w-3xl" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p></Adjustable>}
            </div>
          )}

          {slide.type === "framework" && v === "cards" && (
            <div className="mt-16">
              <Adjustable {...adj("headline")}>
                <h2 data-flip-id={headlineFlipId} className="type-display text-5xl font-bold mb-10 tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              </Adjustable>
              <Adjustable {...adj("points")} className="grid grid-cols-2 gap-5">
                {slide.points?.map((point, idx) => {
                  const [leadRaw, ...restParts] = point.split("—");
                  const lead = stripMd(leadRaw.trim());
                  const rest = restParts.join("—").trim();
                  return (
                    <div key={idx} className="rounded-xl border border-gray-200/70 p-5">
                      <p className="text-base font-semibold tracking-tight mb-2" style={{ color: slide.color }}>{lead}</p>
                      {rest && <p className="text-base font-light leading-relaxed" style={{ color: "var(--slide-text-secondary)" }}>{inlineMd(rest)}</p>}
                    </div>
                  );
                })}
              </Adjustable>
              {slide.supporting && <Adjustable {...adj("supporting")}><p className="text-base mt-8 leading-relaxed font-light max-w-3xl" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p></Adjustable>}
            </div>
          )}

          {slide.type === "recap" && v !== "resources" && (
            <div className="mt-20">
              <Adjustable {...adj("headline")}>
                <h2 data-flip-id={headlineFlipId} className="type-display text-7xl font-bold mb-16 tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              </Adjustable>
              <Adjustable {...adj("points")} className="space-y-6">
                {slide.points?.map((point, idx) => (
                  <div key={idx} className="text-2xl leading-relaxed flex items-start">
                    <span className="mr-4 font-light" style={{ color: "var(--slide-text-faint)" }}>•</span>
                    <span className="font-light" style={{ color: "var(--slide-text-secondary)" }}>{inlineMd(point)}</span>
                  </div>
                ))}
              </Adjustable>
            </div>
          )}

          {slide.type === "recap" && v === "resources" && (
            <div className="mt-12 w-full">
              <Adjustable {...adj("headline")}>
                <h2 data-flip-id={headlineFlipId} className="type-display text-6xl font-bold mb-12 tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              </Adjustable>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,0.45fr)] gap-12">
                <div className="space-y-8">
                  {(slide.resources ?? []).map((group, gi) => (
                    <div key={gi}>
                      {group.group && (
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em]" style={{ color: slide.color || "var(--slide-text-muted)" }}>{group.group}</p>
                      )}
                      <ul className="space-y-2">
                        {group.items.map((it, ii) => (
                          <li key={ii} className="leading-relaxed">
                            <div className="text-lg font-medium" style={{ color: "var(--slide-text-primary)" }}>{stripMd(it.title)}</div>
                            {(it.url || it.description) && (
                              <div className="text-sm font-light" style={{ color: "var(--slide-text-muted)" }}>
                                {it.description ? inlineMd(it.description) : null}
                                {it.url && (
                                  <span className="ml-1 font-mono text-xs">{it.url}</span>
                                )}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="w-px self-stretch" style={{ background: "var(--slide-text-faint, #DADCE1)" }} />
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em]" style={{ color: slide.color || "var(--slide-text-muted)" }}>Built with</p>
                  <ul className="space-y-3">
                    {(slide.tools ?? []).map((t, ti) => (
                      <li key={ti}>
                        <div className="text-base font-medium" style={{ color: "var(--slide-text-primary)" }}>{stripMd(t.name)}</div>
                        {t.description && <div className="text-sm font-light" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(t.description)}</div>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {slide.type === "split-visual" && v !== "ui-mockup" && (
            <div className="mt-20">
              <Adjustable {...adj("headline")}>
                <h2 data-flip-id={headlineFlipId} className="type-display text-6xl font-bold mb-16 tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              </Adjustable>
              <div className="grid grid-cols-2 gap-16">
                <Adjustable {...adj("left")} className="relative">
                  <div className="absolute -left-8 top-0 w-1 h-full rounded-full" style={{ backgroundColor: slide.color }} />
                  <p className="text-3xl font-light leading-relaxed" style={{ color: "var(--slide-text-secondary)" }}>{inlineMd(slide.leftContent)}</p>
                </Adjustable>
                <Adjustable {...adj("right")} className="relative">
                  <div className="absolute -left-8 top-0 w-1 h-full rounded-full opacity-30" style={{ backgroundColor: slide.color }} />
                  <p className="text-3xl font-light leading-relaxed" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.rightContent)}</p>
                </Adjustable>
              </div>
            </div>
          )}

          {slide.type === "split-visual" && v === "ui-mockup" && (() => {
            const recovered = splitLeftContent(slide.leftContent);
            const bullets = [...(slide.points ?? []), ...recovered.bullets];
            return (
            <div className="mt-16 w-full">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-12 items-start">
                <div>
                  <Adjustable {...adj("headline")}>
                    <h2 data-flip-id={headlineFlipId} className="type-display text-6xl font-bold mb-6 leading-tight tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
                  </Adjustable>
                  {recovered.lead && (
                    <Adjustable {...adj("lead")}><p className="text-2xl font-light leading-relaxed whitespace-pre-line" style={{ color: "var(--slide-text-secondary)" }}>{inlineMd(recovered.lead)}</p></Adjustable>
                  )}
                  {bullets.length > 0 && (
                    <Adjustable {...adj("points")}>
                    <ul className="mt-6 space-y-3">
                      {bullets.map((p, i) => {
                        const [leadRaw, ...rest] = p.split("—");
                        const lead = stripMd(leadRaw.trim());
                        const tail = rest.join("—").trim();
                        return (
                          <li key={i} className="text-lg leading-relaxed flex items-start gap-3">
                            <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: slide.color }} />
                            <span>
                              <span className="font-semibold" style={{ color: "var(--slide-text-primary)" }}>{lead}</span>
                              {tail && <span className="font-light" style={{ color: "var(--slide-text-muted)" }}> — {inlineMd(tail)}</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    </Adjustable>
                  )}
                </div>
                <Adjustable {...adj("mockup")} className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
                  {slide.mockupKind === "browser" && (
                    <>
                      <div className="flex items-center gap-2 px-4 py-3 bg-[#f6f6f7] border-b border-gray-200">
                        <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-[#ff5f57]" /><div className="w-3 h-3 rounded-full bg-[#febc2e]" /><div className="w-3 h-3 rounded-full bg-[#28c840]" /></div>
                        <div className="flex-1 mx-2"><div className="rounded bg-white border border-gray-200 px-3 py-1 text-xs text-gray-500 truncate font-mono">{slide.mockupUrl ?? slide.iframeUrl ?? "https://..."}</div></div>
                      </div>
                      <pre className="p-6 font-mono text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">{slide.mockupContent}</pre>
                    </>
                  )}
                  {slide.mockupKind === "terminal" && (
                    <>
                      <div className="px-4 py-2.5 bg-[#f6f6f7] border-b border-gray-200 text-[11px] font-semibold tracking-[0.2em] uppercase text-gray-500">{slide.terminalTitle ?? "TERMINAL"}</div>
                      <pre className="p-6 font-mono text-sm leading-relaxed text-gray-900 whitespace-pre-wrap">{slide.mockupContent}</pre>
                    </>
                  )}
                  {slide.mockupKind === "file-tree" && (
                    <div className="p-5 font-mono text-sm leading-relaxed text-gray-800">
                      {slide.mockupTree && slide.mockupTree.length > 0 ? (
                        <FileTreeView nodes={slide.mockupTree} color={slide.color} />
                      ) : (
                        <pre className="whitespace-pre">{slide.mockupContent}</pre>
                      )}
                    </div>
                  )}
                  {(slide.mockupKind === "card" || !slide.mockupKind) && (
                    <pre className="p-6 font-mono text-sm leading-relaxed whitespace-pre overflow-x-auto" style={{ color: "var(--slide-text-secondary)" }}>{slide.mockupContent}</pre>
                  )}
                </Adjustable>
              </div>
            </div>
            );
          })()}

          {slide.type === "comparison" && v !== "stats" && (
            <div className="mt-20">
              <Adjustable {...adj("headline")}>
                <h2 data-flip-id={headlineFlipId} className="type-display text-6xl font-bold mb-16 tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              </Adjustable>
              <div className="grid grid-cols-2 gap-16">
                <Adjustable {...adj("before")}>
                  <div className="mb-8"><span className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#ef4444" }}>Before</span></div>
                  <div className="space-y-4">
                    {slide.beforePoints?.map((point, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-xl leading-relaxed">
                        <span className="mt-1.5 text-2xl" style={{ color: "#ef4444" }}>✕</span>
                        <span className="font-light" style={{ color: "var(--slide-text-secondary)" }}>{inlineMd(point)}</span>
                      </div>
                    ))}
                  </div>
                </Adjustable>
                <Adjustable {...adj("after")}>
                  <div className="mb-8"><span className="text-sm font-semibold uppercase tracking-wider" style={{ color: slide.color }}>After</span></div>
                  <div className="space-y-4">
                    {slide.afterPoints?.map((point, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-xl leading-relaxed">
                        <span className="mt-1.5 text-2xl" style={{ color: slide.color }}>✓</span>
                        <span className="font-light" style={{ color: "var(--slide-text-secondary)" }}>{inlineMd(point)}</span>
                      </div>
                    ))}
                  </div>
                </Adjustable>
              </div>
            </div>
          )}

          {slide.type === "comparison" && v === "stats" && (
            <div className="mt-12 w-full">
              <Adjustable {...adj("headline")}>
                <h2 data-flip-id={headlineFlipId} className="type-display text-6xl font-bold mb-4 tracking-[-0.035em] leading-tight" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              </Adjustable>
              {slide.supporting && <Adjustable {...adj("supporting")}><p className="text-xl font-light mb-12 max-w-3xl" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p></Adjustable>}
              <div className="grid grid-cols-2 gap-8">
                {([
                  { num: slide.beforeNumber, label: slide.beforeLabel, isWinner: slide.winner === "before", side: "before" as const },
                  { num: slide.afterNumber, label: slide.afterLabel, isWinner: slide.winner === "after", side: "after" as const },
                ]).map((card, i) => {
                  const winnerColor = slide.color || "#22C55E";
                  const loserColor = "#D97706";
                  const accent = card.isWinner ? winnerColor : (slide.winner ? loserColor : "var(--slide-text-primary)");
                  return (
                    <div
                      key={i}
                      className="rounded-2xl bg-white p-10 transition-all"
                      style={{
                        border: `1px solid ${card.isWinner ? winnerColor : "rgba(218,220,225,0.9)"}`,
                        boxShadow: card.isWinner ? `0 0 0 1px ${winnerColor}33, 0 4px 32px ${winnerColor}1a` : "none",
                      }}
                    >
                      <div className="type-display text-8xl font-bold leading-none mb-6 tabular-nums" style={{ color: accent as string }}>{stripMd(card.num)}</div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.25em]" style={{ color: "var(--slide-text-muted)" }}>{stripMd(card.label)}</div>
                    </div>
                  );
                })}
              </div>
              {(slide.beforePoints || slide.afterPoints) && (
                <div className="mt-10 grid grid-cols-2 gap-8 text-base font-light" style={{ color: "var(--slide-text-muted)" }}>
                  <ul className="space-y-2">{slide.beforePoints?.map((p, i) => <li key={i}>— {inlineMd(p)}</li>)}</ul>
                  <ul className="space-y-2">{slide.afterPoints?.map((p, i) => <li key={i}>— {inlineMd(p)}</li>)}</ul>
                </div>
              )}
            </div>
          )}

          {slide.type === "big-number" && v === "hero" && (
            <div className="mt-20 text-center">
              <Adjustable {...adj("bigNumber")}>
                <div className="type-display text-[12rem] font-bold leading-none mb-8" style={{ background: `linear-gradient(135deg, ${slide.color} 0%, ${slide.color}99 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{stripMd(slide.bigNumber)}</div>
              </Adjustable>
              {slide.numberLabel && <p className="text-3xl font-light mb-12" style={{ color: "var(--slide-text-muted)" }}>{stripMd(slide.numberLabel)}</p>}
              <Adjustable {...adj("headline")}>
                <h2 data-flip-id={headlineFlipId} className="type-display text-5xl font-bold tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              </Adjustable>
              {slide.supporting && <Adjustable {...adj("supporting")}><p className="text-2xl font-light mt-6 max-w-3xl mx-auto" style={{ color: "var(--slide-text-secondary)" }}>{inlineMd(slide.supporting)}</p></Adjustable>}
            </div>
          )}

          {slide.type === "big-number" && v === "metrics-row" && (
            <div className="mt-16 w-full">
              <Adjustable {...adj("headline")}>
                <h2 data-flip-id={headlineFlipId} className="type-display text-5xl font-bold mb-12 tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              </Adjustable>
              <div className={`grid gap-8`} style={{ gridTemplateColumns: `repeat(${Math.min(slide.metrics?.length ?? 1, 4)}, minmax(0, 1fr))` }}>
                {(slide.metrics ?? []).map((m, i) => (
                  <div key={i} className="rounded-2xl bg-white border border-gray-200 p-8">
                    <div className="type-display text-6xl font-bold leading-none mb-4 tabular-nums" style={{ color: slide.color || "var(--slide-text-primary)" }}>{stripMd(m.value)}</div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.25em]" style={{ color: "var(--slide-text-muted)" }}>{stripMd(m.label)}</div>
                  </div>
                ))}
              </div>
              {slide.supporting && <Adjustable {...adj("supporting")}><p className="text-lg font-light mt-10 max-w-3xl" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p></Adjustable>}
            </div>
          )}

          {slide.type === "big-number" && v === "badge" && (
            <div className="mt-20 flex items-center gap-12">
              <Adjustable {...adj("bigNumber")} className="flex-shrink-0">
                <div className="rounded-3xl px-10 py-8" style={{ background: `${slide.color}1a` }}>
                  <div className="type-display text-7xl font-bold leading-none" style={{ color: slide.color }}>{stripMd(slide.bigNumber)}</div>
                  {slide.numberLabel && <p className="text-xs font-medium uppercase tracking-wider mt-3 max-w-[180px]" style={{ color: slide.color }}>{stripMd(slide.numberLabel)}</p>}
                </div>
              </Adjustable>
              <div className="flex-1">
                <Adjustable {...adj("headline")}>
                  <h2 data-flip-id={headlineFlipId} className="type-display text-5xl font-bold tracking-[-0.025em] leading-tight" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
                </Adjustable>
                {slide.supporting && <Adjustable {...adj("supporting")}><p className="text-xl font-light mt-4" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p></Adjustable>}
              </div>
            </div>
          )}

          {slide.type === "iframe" && (
            <div className="flex gap-12 items-start mt-20">
              <div className="flex-[0.8]">
                <Adjustable {...adj("headline")}>
                  <h2 data-flip-id={headlineFlipId} className="type-display text-5xl font-bold leading-tight tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
                </Adjustable>
              </div>
              <div className="flex-[1.5]">
                <div className="h-[600px] rounded-xl shadow-2xl overflow-hidden border border-gray-200/50">
                  <div className="flex items-center justify-between px-4 py-2 bg-[#f6f6f6] border-b border-gray-200/50">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5"><div className="h-3 w-3 rounded-full bg-[#ff5f57]/80" /><div className="h-3 w-3 rounded-full bg-[#febc2e]/80" /><div className="h-3 w-3 rounded-full bg-[#28c840]/80" /></div>
                    </div>
                    <div className="flex flex-1 items-center justify-center px-4">
                      <div className="flex max-w-md flex-1 items-center gap-2 rounded-md px-3 py-1.5 text-sm bg-white border border-gray-200">
                        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
                        <span className="truncate text-gray-600 text-xs">{slide.iframeUrl ? new URL(slide.iframeUrl).hostname : ""}</span>
                      </div>
                    </div>
                    <button onClick={() => setIsIframeExpanded(true)} className="rounded-md p-1.5 transition-colors hover:bg-gray-200 text-gray-500">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    </button>
                  </div>
                  <div className="relative h-[calc(100%-48px)] bg-white">
                    <iframe src={slide.iframeUrl} title="Web Preview" className="h-full w-full border-0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" style={{ minHeight: "100%" }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {slide.type === "quote" && v === "centered" && (
            <div className="mt-20 max-w-5xl mx-auto">
              <Adjustable {...adj("quote")}>
              <div className="relative mb-16">
                <div className="absolute -left-16 -top-8 text-[200px] leading-none opacity-10 font-serif">&quot;</div>
                <blockquote className="relative text-5xl font-normal leading-tight tracking-tight mb-8" style={{ color: "var(--slide-text-primary)" }}>{inlineMd(slide.quote)}</blockquote>
                {slide.author && <div className="text-sm font-medium tracking-wider uppercase" style={{ color: "var(--slide-text-muted)" }}>— {stripMd(slide.author)}</div>}
              </div>
              </Adjustable>
            </div>
          )}

          {slide.type === "quote" && v === "card" && (
            <div className="mt-20 max-w-4xl mx-auto">
              <Adjustable {...adj("quote")}>
              <div className="rounded-2xl border-l-4 bg-white p-10 shadow-sm" style={{ borderLeftColor: slide.color || "var(--slide-text-primary)" }}>
                <blockquote className="text-3xl font-normal leading-snug tracking-tight mb-6" style={{ color: "var(--slide-text-primary)" }}>{inlineMd(slide.quote)}</blockquote>
                {slide.author && <div className="text-xs font-medium tracking-wider uppercase" style={{ color: slide.color || "var(--slide-text-muted)" }}>— {stripMd(slide.author)}</div>}
              </div>
              </Adjustable>
            </div>
          )}

          {slide.type === "image" && (() => {
            const layout = slide.variant ?? slide.imageLayout ?? "side";
            const cleanHeadline = stripMd(slide.headline);
            return (
              <div className="mt-20">
                {layout === "side" ? (
                  <div className="flex gap-16 items-center">
                    <div className="flex-1">
                      <Adjustable {...adj("headline")}>
                        <h2 data-flip-id={headlineFlipId} className="type-display text-6xl font-bold mb-6 tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{cleanHeadline}</h2>
                      </Adjustable>
                      {slide.supporting && <Adjustable {...adj("supporting")}><p className="text-2xl font-light" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p></Adjustable>}
                    </div>
                    {slide.imageUrl && <Adjustable {...adj("image")} className="flex-shrink-0 w-80"><div className="rounded-2xl overflow-hidden shadow-xl border border-gray-200/50"><Image src={slide.imageUrl} alt={cleanHeadline} width={640} height={480} className="w-full h-auto object-contain" unoptimized /></div></Adjustable>}
                  </div>
                ) : (
                  <>
                    <div className="mb-12">
                      <Adjustable {...adj("headline")}>
                        <h2 data-flip-id={headlineFlipId} className="type-display text-6xl font-bold mb-6 tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{cleanHeadline}</h2>
                      </Adjustable>
                      {slide.supporting && <Adjustable {...adj("supporting")}><p className="text-2xl font-light" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p></Adjustable>}
                    </div>
                    {slide.imageUrl && <Adjustable {...adj("image")} className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200/50 max-w-5xl mx-auto"><Image src={slide.imageUrl} alt={cleanHeadline} width={1200} height={800} className="w-full h-auto object-contain" style={{ maxHeight: "600px" }} unoptimized /></Adjustable>}
                  </>
                )}
              </div>
            );
          })()}

          {slide.type === "quiz" && (() => {
            const selected = quizAnswers[currentSlide];
            const cleanAnswer = stripMd(slide.answer).trim().toLowerCase();
            const isRevealed = !!selected;
            return (
              <div className="mx-auto flex h-[calc(100vh-11rem)] max-h-[720px] w-full max-w-5xl flex-col justify-center overflow-hidden">
                {slide.headline && (
                  <p className="mb-4 text-xs font-semibold uppercase tracking-wider" style={{ color: slide.color || "var(--slide-text-muted)" }}>
                    {stripMd(slide.headline)}
                  </p>
                )}
                <Adjustable {...adj("question")}>
                  <h2 className="type-display mb-7 text-4xl font-semibold leading-tight" style={{ color: "var(--slide-text-primary)" }}>
                    {inlineMd(slide.question)}
                  </h2>
                </Adjustable>
                <div className="grid grid-cols-2 gap-3">
                  {slide.options?.slice(0, 5).map((option, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    const cleanOption = stripMd(option).trim().toLowerCase();
                    const isSelected = selected === option;
                    const isAnswer = cleanOption === cleanAnswer;
                    const showCorrect = isRevealed && isAnswer;
                    const showWrong = isRevealed && isSelected && !isAnswer;
                    return (
                      <button
                        key={`${letter}-${option}`}
                        type="button"
                        onClick={() => setQuizAnswers((prev) => ({ ...prev, [currentSlide]: option }))}
                        className="min-h-[96px] rounded-xl border bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2"
                        style={{
                          borderColor: showCorrect ? (slide.color || "#14b8a6") : showWrong ? "#ef4444" : isSelected ? "rgba(17, 24, 39, 0.35)" : "rgba(229, 231, 235, 0.95)",
                          boxShadow: showCorrect ? `0 0 0 1px ${slide.color || "#14b8a6"}33` : "none",
                          outlineColor: slide.color || "#14b8a6",
                        }}
                        aria-pressed={isSelected}
                      >
                        <div className="flex gap-3">
                          <span
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                            style={{
                              backgroundColor: showCorrect ? `${slide.color || "#14b8a6"}1a` : showWrong ? "rgba(239,68,68,0.12)" : "rgba(0,0,0,0.04)",
                              color: showCorrect ? (slide.color || "#14b8a6") : showWrong ? "#ef4444" : "var(--slide-text-muted)",
                            }}
                          >
                            {letter}
                          </span>
                          <span className="text-lg leading-snug" style={{ color: "var(--slide-text-secondary)" }}>{inlineMd(option)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-6 min-h-[132px]">
                  {isRevealed ? (
                    <div className="max-h-[132px] overflow-y-auto rounded-xl border-l-4 bg-white px-5 py-4" style={{ borderLeftColor: slide.color || "#14b8a6" }}>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: slide.color || "var(--slide-text-muted)" }}>
                        {selected.trim().toLowerCase() === cleanAnswer ? "Correct" : "Review"}
                      </p>
                      <p className="mb-2 text-xl font-semibold" style={{ color: "var(--slide-text-primary)" }}>{inlineMd(slide.answer)}</p>
                      {slide.explanation && <p className="text-base leading-relaxed" style={{ color: "var(--slide-text-secondary)" }}>{inlineMd(slide.explanation)}</p>}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-white/60 px-5 py-4 text-sm" style={{ color: "var(--slide-text-muted)" }}>
                      Select an answer to reveal the explanation.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {slide.type === "chart" && (() => {
            const data = slide.chartData ?? { xLabels: [], series: [] };
            const W = 1100, H = 420, PAD_L = 80, PAD_R = 40, PAD_T = 30, PAD_B = 60;
            const innerW = W - PAD_L - PAD_R;
            const innerH = H - PAD_T - PAD_B;
            const allValues = data.series.flatMap((s) => s.points);
            const yMin = Math.min(0, ...allValues);
            const yMax = Math.max(...allValues, 1);
            const yRange = yMax - yMin || 1;
            const palette = ["#2563EB", "#06B6D4", "#7C3CFF", "#D97706", "#22C55E", "#FF2A2A"];
            const xCount = data.xLabels.length || 1;
            const yToPx = (y: number) => PAD_T + innerH - ((y - yMin) / yRange) * innerH;
            const xToPx = (i: number) => PAD_L + (xCount === 1 ? innerW / 2 : (i * innerW) / (xCount - 1));
            const ticks = 5;
            return (
              <div className="mt-10 w-full">
                <Adjustable {...adj("headline")}>
                  <h2 data-flip-id={headlineFlipId} className="type-display text-5xl font-bold mb-3 tracking-[-0.035em] text-center" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
                </Adjustable>
                {slide.supporting && <Adjustable {...adj("supporting")}><p className="text-lg font-light mb-8 max-w-3xl mx-auto text-center" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p></Adjustable>}
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-5xl mx-auto" role="img" aria-label={stripMd(slide.headline)}>
                  {Array.from({ length: ticks + 1 }).map((_, i) => {
                    const value = yMin + (yRange * i) / ticks;
                    const y = yToPx(value);
                    return (
                      <g key={i}>
                        <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="#E7E8EC" strokeDasharray="4 6" strokeWidth={1} />
                        <text x={PAD_L - 12} y={y + 4} fontSize={14} textAnchor="end" fill="#8A8C96">{Math.round(value * 100) / 100}</text>
                      </g>
                    );
                  })}
                  {data.xLabels.map((lbl, i) => (
                    <text key={i} x={xToPx(i)} y={H - PAD_B + 22} fontSize={14} textAnchor="middle" fill="#8A8C96">{lbl}</text>
                  ))}
                  <line x1={PAD_L} x2={W - PAD_R} y1={yToPx(yMin)} y2={yToPx(yMin)} stroke="#DADCE1" strokeWidth={1} />
                  {(slide.chartKind === "bar" ? data.series : []).map((ser, si) => {
                    const color = ser.color || palette[si % palette.length];
                    const barW = innerW / xCount * 0.6 / data.series.length;
                    return ser.points.map((p, i) => {
                      const groupX = xToPx(i) - (data.series.length * barW) / 2 + si * barW;
                      const y = yToPx(p);
                      return <rect key={`${si}-${i}`} x={groupX} y={y} width={barW} height={yToPx(yMin) - y} fill={color} />;
                    });
                  })}
                  {(slide.chartKind !== "bar" ? data.series : []).map((ser, si) => {
                    const color = ser.color || palette[si % palette.length];
                    const d = ser.points.map((p, i) => `${i === 0 ? "M" : "L"} ${xToPx(i)} ${yToPx(p)}`).join(" ");
                    return <path key={si} d={d} fill="none" stroke={color} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />;
                  })}
                </svg>
                <div className="mt-6 flex flex-wrap justify-center gap-6">
                  {data.series.map((ser, si) => (
                    <div key={si} className="flex items-center gap-2 text-sm" style={{ color: "var(--slide-text-secondary)" }}>
                      <span className="inline-block w-4 h-1 rounded" style={{ backgroundColor: ser.color || palette[si % palette.length] }} />
                      <span>{stripMd(ser.label)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {slide.type === "agent-tree" && (
            <div className="flex gap-12 items-start mt-20">
              <div className="flex-1">
                <Adjustable {...adj("headline")}>
                  <h2 data-flip-id={headlineFlipId} className="type-display text-5xl font-bold leading-tight tracking-[-0.035em] mb-4" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
                </Adjustable>
                {slide.supporting && <Adjustable {...adj("supporting")}><p className="text-xl font-light" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p></Adjustable>}
              </div>
              <div className="flex-1">
                <div className="rounded-lg overflow-hidden shadow-lg border border-gray-200/50">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-[#f6f6f6] border-b border-gray-200/50">
                    <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-[#ff5f57]" /><div className="w-3 h-3 rounded-full bg-[#febc2e]" /><div className="w-3 h-3 rounded-full bg-[#28c840]" /></div>
                    <div className="flex-1 text-center text-[11px] font-medium" style={{ color: "var(--slide-text-muted)" }}>agent-execution.tree</div>
                  </div>
                  <div className="bg-white p-4 font-mono text-sm max-h-[600px] overflow-y-auto">
                    <TreeNode name="Orchestrator Agent" isFolder={true} color={slide.color} defaultOpen={true}>
                      <TreeNode name="Table Understanding Agent" isFolder={true} color={slide.color}>
                        <TreeNode name="Schema Analyzer" isFolder={false} />
                        <TreeNode name="Data Generation Mechanism Detector" isFolder={false} />
                      </TreeNode>
                      <TreeNode name="Column Classification Agent" isFolder={true} color={slide.color}>
                        <TreeNode name="Numeric Analyzer" isFolder={false} />
                        <TreeNode name="Categorical Analyzer" isFolder={false} />
                        <TreeNode name="Temporal Analyzer" isFolder={false} />
                        <TreeNode name="Text/Image Analyzer" isFolder={false} />
                      </TreeNode>
                      <TreeNode name="Relationship Mining Agent" isFolder={true} color={slide.color}>
                        <TreeNode name="Correlation Detector" isFolder={false} />
                        <TreeNode name="Dependency Mapper" isFolder={false} />
                      </TreeNode>
                      <TreeNode name="Quality Check Agent" isFolder={true} color={slide.color}>
                        <TreeNode name="Completeness Checker" isFolder={false} />
                        <TreeNode name="Validity Checker" isFolder={false} />
                        <TreeNode name="Consistency Checker" isFolder={false} />
                        <TreeNode name="Uniqueness Checker" isFolder={false} />
                      </TreeNode>
                      <TreeNode name="Repair Planning Agent" isFolder={true} color={slide.color}>
                        <TreeNode name="Conflict Detector" isFolder={false} />
                        <TreeNode name="Strategy Generator" isFolder={false} />
                        <TreeNode name="SQL Builder" isFolder={false} />
                      </TreeNode>
                    </TreeNode>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
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
              <iframe src={slide.iframeUrl} title="Web Preview (Expanded)" className="h-full w-full border-0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" style={{ minHeight: "100%" }} />
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
