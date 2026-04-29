"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Slide, Brand } from "../slides";
import { resolveVariant } from "@/lib/slide-variants";
import { inlineMd, stripMd } from "@/lib/markdown-inline";

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
  name: string;
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
      })
      .catch(() => setFetchError("Presentation not found"))
      .finally(() => setLoadingSlides(false));
  }, [id]);

  const brandGradient = `linear-gradient(135deg, ${brand.gradientFrom} 0%, ${brand.gradientTo} 100%)`;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (slides.length === 0) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setSlideDirection("forward");
        setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSlideDirection("backward");
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Home") {
        e.preventDefault(); setSlideDirection("backward"); setCurrentSlide(0);
      } else if (e.key === "End") {
        e.preventDefault(); setSlideDirection("forward"); setCurrentSlide(slides.length - 1);
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
  }, [isIframeExpanded, showEvidence, slides.length, router]);

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

  // Resolve evidence refs → chunks for the current slide
  const chunksById = new Map(chunks.map((c) => [c.id, c]));
  const slideEvidence: DeckChunk[] = (slide.evidenceRefs ?? [])
    .map((id) => chunksById.get(id))
    .filter((c): c is DeckChunk => !!c);
  const evidencePages = Array.from(new Set(slideEvidence.map((c) => c.page).filter((p): p is number => typeof p === "number"))).sort((a, b) => a - b);

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#fafafa] text-gray-900 relative">
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 z-50">
        <div className="h-full transition-all duration-300 ease-out" style={{ width: `${progress}%`, backgroundColor: slide.color || "#14b8a6" }} />
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
        key={currentSlide}
        className={`h-full flex items-center p-16 relative ${slideDirection === "forward" ? "animate-slide-in-down" : "animate-slide-in-up"}`}
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
              <h1 className="type-display text-9xl font-bold mb-8 tracking-[-0.035em] leading-none relative z-10" style={{ background: brandGradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{stripMd(slide.headline)}</h1>
              {slide.subtitle && <p className="text-3xl font-light relative z-10" style={{ color: "var(--slide-text-muted)" }}>{stripMd(slide.subtitle)}</p>}
              <div className="mt-12 flex justify-center relative z-10">
                <div className="h-1 w-32 rounded-full" style={{ background: `linear-gradient(90deg, ${brand.gradientFrom} 0%, ${brand.gradientTo} 100%)` }} />
              </div>
            </div>
          )}

          {slide.type === "title" && v === "left" && (
            <div className="relative w-full">
              <div className="absolute inset-0 opacity-10 blur-3xl" style={{ background: `radial-gradient(circle at 20% 50%, ${brand.gradientFrom} 0%, transparent 60%)` }} />
              <div className="h-1 w-24 rounded-full mb-10 relative z-10" style={{ background: `linear-gradient(90deg, ${brand.gradientFrom} 0%, ${brand.gradientTo} 100%)` }} />
              <h1 className="type-display text-8xl font-bold mb-6 tracking-[-0.035em] leading-none relative z-10" style={{ background: brandGradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{stripMd(slide.headline)}</h1>
              {slide.subtitle && <p className="text-2xl font-light relative z-10 max-w-3xl" style={{ color: "var(--slide-text-muted)" }}>{stripMd(slide.subtitle)}</p>}
            </div>
          )}

          {slide.type === "goals" && v === "list" && (
            <div className="mt-20">
              <h2 className="type-display text-7xl font-bold mb-16 tracking-[-0.035em] leading-none" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              <div className="space-y-6">
                {slide.points?.map((point, idx) => (
                  <div key={idx} className="text-2xl leading-relaxed" style={{ color: "var(--slide-text-secondary)" }}>• {inlineMd(point)}</div>
                ))}
              </div>
            </div>
          )}

          {slide.type === "goals" && v === "grid" && (
            <div className="mt-20">
              <h2 className="type-display text-6xl font-bold mb-12 tracking-[-0.035em] leading-none" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              <div className="grid grid-cols-2 gap-6">
                {slide.points?.map((point, idx) => (
                  <div key={idx} className="rounded-xl border border-gray-200/70 p-6">
                    <div className="text-xs font-mono mb-2" style={{ color: slide.color || "var(--slide-text-muted)" }}>{String(idx + 1).padStart(2, "0")}</div>
                    <p className="text-xl leading-relaxed" style={{ color: "var(--slide-text-secondary)" }}>{inlineMd(point)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {slide.type === "goals" && v === "numbered" && (
            <div className="mt-20">
              <h2 className="type-display text-7xl font-bold mb-16 tracking-[-0.035em] leading-none" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              <div className="space-y-5">
                {slide.points?.map((point, idx) => (
                  <div key={idx} className="flex items-baseline gap-5">
                    <span className="type-display text-4xl font-bold tabular-nums" style={{ color: slide.color || "var(--slide-text-faint)" }}>{String(idx + 1).padStart(2, "0")}</span>
                    <span className="text-2xl leading-relaxed" style={{ color: "var(--slide-text-secondary)" }}>{inlineMd(point)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {slide.type === "section-divider" && v === "huge" && (
            <div className="text-center relative">
              <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at center, ${slide.color} 0%, transparent 70%)` }} />
              <h2 className="type-display text-9xl font-bold tracking-[-0.035em] leading-none relative z-10" style={{ color: slide.color }}>{stripMd(slide.headline)}</h2>
            </div>
          )}

          {slide.type === "section-divider" && v === "minimal" && (
            <div className="relative w-full">
              <div className="h-px w-32 mb-8" style={{ background: slide.color || "var(--slide-text-faint)" }} />
              <h2 className="type-display text-7xl font-bold tracking-[-0.035em] leading-none" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
            </div>
          )}

          {slide.type === "statement" && v === "large" && (
            <div className="mt-20">
              <h2 className="type-display text-7xl font-bold mb-10 leading-tight tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              {slide.supporting && <p className="text-2xl leading-relaxed max-w-4xl font-light" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p>}
            </div>
          )}

          {slide.type === "statement" && v === "tight" && (
            <div className="max-w-4xl">
              <div className="h-1 w-12 mb-8 rounded-full" style={{ background: slide.color || "var(--slide-text-primary)" }} />
              <h2 className="type-display text-5xl font-bold mb-6 leading-tight tracking-[-0.025em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              {slide.supporting && <p className="text-xl leading-relaxed font-light" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p>}
            </div>
          )}

          {slide.type === "code" && v === "split" && (
            <div className="flex gap-16 items-start mt-20">
              <div className="flex-1">
                <h2 className="type-display text-5xl font-bold leading-tight tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              </div>
              <div className="flex-1">
                <div className="rounded-lg overflow-hidden shadow-lg border border-gray-200/50">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-[#f6f6f6] border-b border-gray-200/50">
                    <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-[#ff5f57]" /><div className="w-3 h-3 rounded-full bg-[#febc2e]" /><div className="w-3 h-3 rounded-full bg-[#28c840]" /></div>
                    <div className="flex-1 text-center text-[11px] font-medium" style={{ color: "var(--slide-text-muted)" }}>code</div>
                  </div>
                  <div className="bg-[#1e1e1e]">
                    <SyntaxHighlighter language="python" style={vscDarkPlus} customStyle={{ margin: 0, padding: "1.5rem", background: "#1e1e1e", fontSize: "13px", lineHeight: "1.6" }} showLineNumbers={false}>{slide.code || ""}</SyntaxHighlighter>
                  </div>
                </div>
              </div>
            </div>
          )}

          {slide.type === "code" && v === "full" && (
            <div className="mt-12 w-full">
              <h2 className="type-display text-4xl font-bold leading-tight tracking-[-0.025em] mb-6" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              <div className="rounded-lg overflow-hidden shadow-lg border border-gray-200/50">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-[#f6f6f6] border-b border-gray-200/50">
                  <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-[#ff5f57]" /><div className="w-3 h-3 rounded-full bg-[#febc2e]" /><div className="w-3 h-3 rounded-full bg-[#28c840]" /></div>
                  <div className="flex-1 text-center text-[11px] font-medium" style={{ color: "var(--slide-text-muted)" }}>code</div>
                </div>
                <div className="bg-[#1e1e1e]">
                  <SyntaxHighlighter language="python" style={vscDarkPlus} customStyle={{ margin: 0, padding: "1.5rem", background: "#1e1e1e", fontSize: "14px", lineHeight: "1.6" }} showLineNumbers={false}>{slide.code || ""}</SyntaxHighlighter>
                </div>
              </div>
            </div>
          )}

          {slide.type === "framework" && v === "lead-in" && (
            <div className="mt-20">
              <h2 className="type-display text-6xl font-bold mb-16 tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              <div className="space-y-7">
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
              </div>
              {slide.supporting && <p className="text-xl mt-10 leading-relaxed font-light max-w-3xl" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p>}
            </div>
          )}

          {slide.type === "framework" && v === "cards" && (
            <div className="mt-16">
              <h2 className="type-display text-5xl font-bold mb-10 tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              <div className="grid grid-cols-2 gap-5">
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
              </div>
              {slide.supporting && <p className="text-base mt-8 leading-relaxed font-light max-w-3xl" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p>}
            </div>
          )}

          {slide.type === "recap" && (
            <div className="mt-20">
              <h2 className="type-display text-7xl font-bold mb-16 tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              <div className="space-y-6">
                {slide.points?.map((point, idx) => (
                  <div key={idx} className="text-2xl leading-relaxed flex items-start">
                    <span className="mr-4 font-light" style={{ color: "var(--slide-text-faint)" }}>•</span>
                    <span className="font-light" style={{ color: "var(--slide-text-secondary)" }}>{inlineMd(point)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {slide.type === "split-visual" && (
            <div className="mt-20">
              <h2 className="type-display text-6xl font-bold mb-16 tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              <div className="grid grid-cols-2 gap-16">
                <div className="relative">
                  <div className="absolute -left-8 top-0 w-1 h-full rounded-full" style={{ backgroundColor: slide.color }} />
                  <p className="text-3xl font-light leading-relaxed" style={{ color: "var(--slide-text-secondary)" }}>{inlineMd(slide.leftContent)}</p>
                </div>
                <div className="relative">
                  <div className="absolute -left-8 top-0 w-1 h-full rounded-full opacity-30" style={{ backgroundColor: slide.color }} />
                  <p className="text-3xl font-light leading-relaxed" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.rightContent)}</p>
                </div>
              </div>
            </div>
          )}

          {slide.type === "comparison" && (
            <div className="mt-20">
              <h2 className="type-display text-6xl font-bold mb-16 tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              <div className="grid grid-cols-2 gap-16">
                <div>
                  <div className="mb-8"><span className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#ef4444" }}>Before</span></div>
                  <div className="space-y-4">
                    {slide.beforePoints?.map((point, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-xl leading-relaxed">
                        <span className="mt-1.5 text-2xl" style={{ color: "#ef4444" }}>✕</span>
                        <span className="font-light" style={{ color: "var(--slide-text-secondary)" }}>{inlineMd(point)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-8"><span className="text-sm font-semibold uppercase tracking-wider" style={{ color: slide.color }}>After</span></div>
                  <div className="space-y-4">
                    {slide.afterPoints?.map((point, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-xl leading-relaxed">
                        <span className="mt-1.5 text-2xl" style={{ color: slide.color }}>✓</span>
                        <span className="font-light" style={{ color: "var(--slide-text-secondary)" }}>{inlineMd(point)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {slide.type === "big-number" && v === "hero" && (
            <div className="mt-20 text-center">
              <div className="type-display text-[12rem] font-bold leading-none mb-8" style={{ background: `linear-gradient(135deg, ${slide.color} 0%, ${slide.color}99 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{stripMd(slide.bigNumber)}</div>
              {slide.numberLabel && <p className="text-3xl font-light mb-12" style={{ color: "var(--slide-text-muted)" }}>{stripMd(slide.numberLabel)}</p>}
              <h2 className="type-display text-5xl font-bold tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
              {slide.supporting && <p className="text-2xl font-light mt-6 max-w-3xl mx-auto" style={{ color: "var(--slide-text-secondary)" }}>{inlineMd(slide.supporting)}</p>}
            </div>
          )}

          {slide.type === "big-number" && v === "badge" && (
            <div className="mt-20 flex items-center gap-12">
              <div className="rounded-3xl px-10 py-8 flex-shrink-0" style={{ background: `${slide.color}1a` }}>
                <div className="type-display text-7xl font-bold leading-none" style={{ color: slide.color }}>{stripMd(slide.bigNumber)}</div>
                {slide.numberLabel && <p className="text-xs font-medium uppercase tracking-wider mt-3 max-w-[180px]" style={{ color: slide.color }}>{stripMd(slide.numberLabel)}</p>}
              </div>
              <div className="flex-1">
                <h2 className="type-display text-5xl font-bold tracking-[-0.025em] leading-tight" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
                {slide.supporting && <p className="text-xl font-light mt-4" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p>}
              </div>
            </div>
          )}

          {slide.type === "iframe" && (
            <div className="flex gap-12 items-start mt-20">
              <div className="flex-[0.8]">
                <h2 className="type-display text-5xl font-bold leading-tight tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
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
              <div className="relative mb-16">
                <div className="absolute -left-16 -top-8 text-[200px] leading-none opacity-10 font-serif">&quot;</div>
                <blockquote className="relative text-5xl font-normal leading-tight tracking-tight mb-8" style={{ color: "var(--slide-text-primary)" }}>{inlineMd(slide.quote)}</blockquote>
                {slide.author && <div className="text-sm font-medium tracking-wider uppercase" style={{ color: "var(--slide-text-muted)" }}>— {stripMd(slide.author)}</div>}
              </div>
            </div>
          )}

          {slide.type === "quote" && v === "card" && (
            <div className="mt-20 max-w-4xl mx-auto">
              <div className="rounded-2xl border-l-4 bg-white p-10 shadow-sm" style={{ borderLeftColor: slide.color || "var(--slide-text-primary)" }}>
                <blockquote className="text-3xl font-normal leading-snug tracking-tight mb-6" style={{ color: "var(--slide-text-primary)" }}>{inlineMd(slide.quote)}</blockquote>
                {slide.author && <div className="text-xs font-medium tracking-wider uppercase" style={{ color: slide.color || "var(--slide-text-muted)" }}>— {stripMd(slide.author)}</div>}
              </div>
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
                      <h2 className="type-display text-6xl font-bold mb-6 tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{cleanHeadline}</h2>
                      {slide.supporting && <p className="text-2xl font-light" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p>}
                    </div>
                    {slide.imageUrl && <div className="flex-shrink-0 w-80"><div className="rounded-2xl overflow-hidden shadow-xl border border-gray-200/50"><img src={slide.imageUrl} alt={cleanHeadline} className="w-full h-auto object-contain" /></div></div>}
                  </div>
                ) : (
                  <>
                    <div className="mb-12">
                      <h2 className="type-display text-6xl font-bold mb-6 tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{cleanHeadline}</h2>
                      {slide.supporting && <p className="text-2xl font-light" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p>}
                    </div>
                    {slide.imageUrl && <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200/50 max-w-5xl mx-auto"><img src={slide.imageUrl} alt={cleanHeadline} className="w-full h-auto object-contain" style={{ maxHeight: "600px" }} /></div>}
                  </>
                )}
              </div>
            );
          })()}

          {slide.type === "agent-tree" && (
            <div className="flex gap-12 items-start mt-20">
              <div className="flex-1">
                <h2 className="type-display text-5xl font-bold leading-tight tracking-[-0.035em] mb-4" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
                {slide.supporting && <p className="text-xl font-light" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p>}
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
