"use client";

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Play, Upload, Link as LinkIcon, Sparkles, Check, AlertCircle, ChevronDown, Download } from "lucide-react";
import { THEME_PRESETS, SEMANTIC_COLOR_LABELS } from "@/core/theming/presets";
import { SLIDE_VARIANTS, DEFAULT_VARIANT } from "@/lib/slide-variants";
import { useGenerate } from "@/hooks/use-generate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { SlideImageField } from "@/components/workspace/slide-image-field";
import { SlideTransfer } from "@/components/workspace/slide-transfer";
import { ProductCrawlForm } from "@/components/workspace/product-crawl-form";
import type { Slide, Brand } from "@/app/slides";

// ========================
// Shared types
// ========================

interface PresentationMeta {
  id: string;
  title: string;
  sourceName: string;
  sourceType: string;
  audienceType: string;
  stylePreset: string;
  slideCount: number;
  generatedAt: string;
}

interface FidelityChunkPoint { text: string; evidenceChunkIds?: string[]; sourceChunkIds?: string[] }
interface FidelitySectionCoverage {
  sectionId: string;
  sectionName: string;
  capturedKeyPoints: FidelityChunkPoint[];
  missedKeyPoints: FidelityChunkPoint[];
}
interface FidelityUnsupportedClaim {
  slideIndex: number;
  claim: string;
  closestSourceSpan?: string;
  sourceChunkIds: string[];
}
interface FidelityDeterministic {
  totalSlides: number;
  factualSlides: number;
  factualSlidesWithEvidence: number;
  evidenceUsageRatio: number;
  imageSlides: number;
  imageUsageRatio: number;
  slideTypeMix: Record<string, number>;
  uniqueChunkIdsCited: number;
  totalChunkIds: number;
  chunkCoverageRatio: number;
}
interface FidelityReport {
  generatedAt: string;
  overallGrade: "high" | "medium" | "low";
  summary: string;
  deterministic: FidelityDeterministic;
  coverage: FidelitySectionCoverage[];
  unsupportedClaims: FidelityUnsupportedClaim[];
}

interface ChunkRectJson { x1: number; y1: number; x2: number; y2: number }
interface ChunkBBoxJson {
  pageNumber: number;
  width: number;
  height: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  rects?: ChunkRectJson[];
}

interface FullPresentation extends PresentationMeta {
  slides: Slide[];
  brand?: Brand;
  fidelityReport?: FidelityReport;
  chunks?: { id: string; page?: number; paragraph?: number; text: string; bbox?: ChunkBBoxJson }[];
  sourceUrl?: string;
}

const DEFAULT_BRAND: Brand = { text: "SYNOGIZE LAB", gradientFrom: "#f59e0b", gradientTo: "#3b82f6" };

// ========================
// Overview Tab
// ========================

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold truncate">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function OverviewTab({ presentation, onSwitchToSources }: { presentation: FullPresentation | null; onSwitchToSources: () => void }) {
  if (!presentation) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <p className="text-sm text-muted-foreground">Select a presentation from Sources to inspect it here.</p>
        <Button variant="outline" size="sm" onClick={onSwitchToSources}>Go to Sources</Button>
      </div>
    );
  }

  const slides = presentation.slides ?? [];
  const typeCounts: Record<string, number> = {};
  for (const s of slides) typeCounts[s.type] = (typeCounts[s.type] ?? 0) + 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Slides" value={presentation.slideCount} />
        <StatCard label="Audience" value={presentation.audienceType} />
        <StatCard label="Style" value={presentation.stylePreset} />
        <StatCard label="Generated" value={new Date(presentation.generatedAt).toLocaleDateString()} />
      </div>
      <Card>
        <CardContent className="p-5 space-y-1">
          <p className="text-sm font-semibold">{presentation.title}</p>
          <p className="text-xs text-muted-foreground">Source: {presentation.sourceName}</p>
          <p className="text-xs font-mono text-muted-foreground/60">{presentation.id}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Slide Type Distribution</h3>
          <div className="space-y-2.5">
            {Object.entries(typeCounts).sort(([, a], [, b]) => b - a).map(([type, count]) => (
              <div key={type} className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-28 flex-shrink-0">{type}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-teal-500" style={{ width: `${(count / presentation.slideCount) * 100}%` }} />
                </div>
                <span className="text-xs text-muted-foreground w-4 text-right flex-shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ========================
// Sources Tab
// ========================

// Free-form text. The list below is just autocomplete suggestions, not a closed enum.
// Anything the user types that isn't recognized falls back to Technical on the server.
const AUDIENCE_SUGGESTIONS = ["Technical", "Academic", "Winston"];

function AudienceCombobox({
  value,
  onChange,
  disabled,
  suggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  suggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  // Filter suggestions by current input — but keep the full list visible until
  // the user has typed something that doesn't match.
  const filtered = value.trim()
    ? suggestions.filter((s) => s.toLowerCase().includes(value.trim().toLowerCase()))
    : suggestions;
  const showList = filtered.length > 0 ? filtered : suggestions;

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => { onChange(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          disabled={disabled}
          placeholder="Technical or Academic (free text falls back to Technical)"
          className="h-9 pr-8"
          autoComplete="off"
        />
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => {
            e.preventDefault();
            if (disabled) return;
            setOpen((v) => !v);
            inputRef.current?.focus();
          }}
          className="absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
          disabled={disabled}
          aria-label="Toggle suggestions"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
          <ul className="max-h-60 overflow-auto py-1 text-sm">
            {showList.map((s) => {
              const active = s.toLowerCase() === value.trim().toLowerCase();
              return (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => { onChange(s); setOpen(false); }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 hover:bg-accent transition-colors flex items-center justify-between",
                      active && "bg-accent/50"
                    )}
                  >
                    <span>{s}</span>
                    {active && <Check className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && value.trim() && (
              <li className="px-3 py-1.5 text-xs text-muted-foreground">
                Press Enter — Claude will use “{value.trim()}” as-is
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

const STYLE_OPTIONS = [
  { value: "dark-minimal", label: "Dark Minimal", color: "#14b8a6" },
  { value: "light-minimal", label: "Light Minimal", color: "#3b82f6" },
  { value: "terminal-green", label: "Terminal Green", color: "#22c55e" },
  { value: "bold-signal", label: "Bold Signal", color: "#f87171" },
  { value: "vintage-editorial", label: "Vintage Editorial", color: "#fbbf24" },
  { value: "swiss-modern", label: "Swiss Modern", color: "#a78bfa" },
];

const SOURCE_BADGE: Record<string, string> = {
  pdf: "bg-red-500/10 text-red-400 border-red-500/20",
  url: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  md: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  txt: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  code: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

const STEP_ORDER = ["extracting", "outlining", "drafting", "validating", "done"] as const;

function GenerationProgress({ state }: { state: ReturnType<typeof useGenerate>["state"] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{state.stepLabel}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{Math.round(state.progress)}%</span>
      </div>
      <Progress value={state.progress} className="h-1" />
      <div className="flex items-center gap-0">
        {STEP_ORDER.map((step, i) => {
          const stepIdx = STEP_ORDER.indexOf(state.step as typeof STEP_ORDER[number]);
          const thisIdx = i;
          const done = stepIdx > thisIdx || state.step === "done";
          const active = stepIdx === thisIdx;
          const labels = ["Extract", "Outline", "Draft", "Validate", "Done"];
          return (
            <div key={step} className="flex items-center flex-1">
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] transition-all",
                done ? "bg-teal-500 text-white" : active ? "bg-teal-500/20 border border-teal-500 text-teal-400" : "bg-muted text-muted-foreground"
              )}>
                {done ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <div className="flex-1 flex flex-col items-center">
                <span className={cn("text-[10px] mt-1", active ? "text-foreground" : "text-muted-foreground")}>{labels[i]}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SourcesTab({ selectedId, onSelect, onDeleteDeck }: { selectedId: string | null; onSelect: (id: string) => void; onDeleteDeck: (id: string) => Promise<boolean> }) {
  const [mode, setMode] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [audienceType, setAudienceType] = useState("Technical");
  const [stylePreset, setStylePreset] = useState("dark-minimal");
  const [library, setLibrary] = useState<PresentationMeta[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const { state, generate, reset } = useGenerate();

  const fetchLibrary = useCallback(async () => {
    try {
      const res = await fetch("/api/presentations");
      const data = await res.json();
      setLibrary(Array.isArray(data) ? data : (data.presentations ?? []));
    } catch { /* silent */ } finally { setLibraryLoading(false); }
  }, []);

  useEffect(() => { fetchLibrary(); }, [fetchLibrary]);

  // Refresh library after generation, auto-select new presentation
  useEffect(() => {
    if (state.step === "done" && state.result) {
      fetchLibrary();
    }
  }, [state.step, state.result, fetchLibrary]);

  // Refresh when a deck is deleted from anywhere in the workspace.
  useEffect(() => {
    const onDeleted = () => fetchLibrary();
    window.addEventListener("k2s:deck-deleted", onDeleted);
    return () => window.removeEventListener("k2s:deck-deleted", onDeleted);
  }, [fetchLibrary]);

  const handleAnalyze = () => {
    if (state.step !== "idle" && state.step !== "error") return;
    if (mode === "file" && !file) return;
    if (mode === "url" && !url.trim()) return;
    const fd = new FormData();
    if (mode === "file" && file) fd.append("file", file);
    if (mode === "url" && url.trim()) fd.append("url", url.trim());
    fd.append("audienceType", audienceType);
    fd.append("stylePreset", stylePreset);
    generate(fd);
  };

  const handleReset = () => {
    reset();
    setFile(null);
    setUrl("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSuccessOpen = () => {
    if (state.result) {
      onSelect(state.result.id);
      reset();
    }
  };

  const isGenerating = state.step !== "idle" && state.step !== "done" && state.step !== "error";
  const canSubmit = !isGenerating && (mode === "file" ? !!file : !!url.trim());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-8">
      {/* Left: Upload form */}
      <div className="space-y-5">
        <div>
          <h3 className="text-sm font-semibold mb-4">Generate from Source</h3>
          {/* Mode toggle */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit mb-5">
            <button
              onClick={() => setMode("file")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all", mode === "file" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <Upload className="w-3.5 h-3.5" /> File
            </button>
            <button
              onClick={() => setMode("url")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all", mode === "url" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <LinkIcon className="w-3.5 h-3.5" /> URL
            </button>
          </div>

          {mode === "file" ? (
            <div
              className={cn(
                "rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-all",
                file ? "border-teal-500/50 bg-teal-500/5" : "border-border hover:border-border/80 hover:bg-accent/30"
              )}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
            >
              <input ref={fileRef} type="file" accept=".txt,.md,.pdf,image/*,.js,.jsx,.ts,.tsx,.py,.java,.kt,.go,.rs,.rb,.php,.cs,.cpp,.cc,.c,.h,.hpp,.swift,.scala,.sh,.bash,.zsh,.sql,.json,.yaml,.yml,.toml,.html,.css,.scss,.vue,.svelte" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-md bg-teal-500/15 flex items-center justify-center">
                    <Check className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Drop a file or click to browse</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">.txt · .md · .pdf · png/jpg · code (.ts/.py/.go/...) — max 25 MB</p>
                </>
              )}
            </div>
          ) : (
            <Input
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isGenerating}
              className="h-12 text-sm"
            />
          )}
        </div>

        {/* Config row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Audience</label>
            <AudienceCombobox
              value={audienceType}
              onChange={setAudienceType}
              disabled={isGenerating}
              suggestions={AUDIENCE_SUGGESTIONS}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Style</label>
            <div className="flex items-center gap-2 h-9">
              {STYLE_OPTIONS.map((s) => (
                <Tooltip key={s.value}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setStylePreset(s.value)}
                      className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                      style={{ background: s.color, borderColor: stylePreset === s.value ? "#fafafa" : "transparent", boxShadow: stylePreset === s.value ? `0 0 0 1px ${s.color}` : "none" }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">{s.label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {STYLE_OPTIONS.find((s) => s.value === stylePreset)?.label}
            </p>
          </div>
        </div>

        {/* Error */}
        {state.step === "error" && state.error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        {/* Progress or Button */}
        {isGenerating ? (
          <Card>
            <CardContent className="p-4">
              <GenerationProgress state={state} />
            </CardContent>
          </Card>
        ) : state.step === "error" ? (
          <Button variant="outline" onClick={handleReset} className="w-full">
            Try again
          </Button>
        ) : (
          <Button onClick={handleAnalyze} disabled={!canSubmit} className="w-full gap-2">
            <Sparkles className="w-4 h-4" />
            Generate Slides
          </Button>
        )}

        <Separator />

        <ProductCrawlForm
          onCreated={(r) => {
            fetchLibrary();
            onSelect(r.id);
          }}
        />
      </div>

      {/* Right: Library */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Decks</h3>
          <Button variant="ghost" size="sm" asChild className="h-6 px-2 text-xs">
            <Link href="/library">View all →</Link>
          </Button>
        </div>
        <Separator />
        {libraryLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-3 rounded-lg border border-border space-y-2">
                <div className="flex gap-2"><Skeleton className="h-5 w-10 rounded" /><Skeleton className="h-5 w-16 rounded" /></div>
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-3 w-2/3 rounded" />
              </div>
            ))}
          </div>
        ) : library.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-xs text-muted-foreground">No presentations yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {library.slice(0, 8).map((item) => {
              const sourceStyle = SOURCE_BADGE[item.sourceType] ?? SOURCE_BADGE.txt;
              const isSelected = item.id === selectedId;
              return (
                <div
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "rounded-lg border p-3 cursor-pointer transition-all group",
                    isSelected ? "border-teal-500/30 bg-teal-500/5" : "border-border hover:border-border/80 hover:bg-accent/30"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold flex-shrink-0 ${sourceStyle}`}>
                      {item.sourceType.toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{item.slideCount} slides · {item.audienceType}</p>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                      <Link
                        href={`/player?id=${item.id}`}
                        onClick={(e) => e.stopPropagation()}
                        title="Play"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Play className="w-3 h-3" />
                      </Link>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
                          const ok = await onDeleteDeck(item.id);
                          if (ok) await fetchLibrary();
                        }}
                        title="Delete deck"
                        aria-label={`Delete ${item.title}`}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M3 6h18" />
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Success Dialog */}
      <Dialog open={state.step === "done"} onOpenChange={(open) => { if (!open) handleReset(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-teal-500/15 flex items-center justify-center">
                <Check className="w-4 h-4 text-teal-400" />
              </div>
              Deck Ready
            </DialogTitle>
          </DialogHeader>
          {state.result && (
            <div className="py-1">
              <p className="text-sm font-medium line-clamp-2">{state.result.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{state.result.slideCount} slides generated</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>Generate another</Button>
            {state.result && (
              <Button size="sm" asChild onClick={handleSuccessOpen}>
                <Link href={`/player?id=${state.result.id}`}>
                  <Play className="w-3.5 h-3.5 mr-1" /> Play
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ========================
// Theme Tab
// ========================

function resolvePresetId(stylePreset: string | undefined): string {
  if (!stylePreset) return THEME_PRESETS[0].id;
  const byId = THEME_PRESETS.find((p) => p.id === stylePreset);
  if (byId) return byId.id;
  const familyMap: Record<string, string> = {
    "dark-minimal": "preset_dark_minimal_01",
    "light-minimal": "preset_light_minimal_01",
    "terminal-green": "preset_technical_terminal_01",
  };
  return familyMap[stylePreset] ?? THEME_PRESETS[0].id;
}

function BrandEditor({ presentation, onBrandChange }: { presentation: FullPresentation | null; onBrandChange: (brand: Brand) => Promise<void> }) {
  const initial = presentation?.brand ?? DEFAULT_BRAND;
  const [text, setText] = useState(initial.text);
  const [from, setFrom] = useState(initial.gradientFrom);
  const [to, setTo] = useState(initial.gradientTo);
  const [savingBrand, setSavingBrand] = useState(false);

  useEffect(() => {
    const b = presentation?.brand ?? DEFAULT_BRAND;
    setText(b.text);
    setFrom(b.gradientFrom);
    setTo(b.gradientTo);
  }, [presentation?.id, presentation?.brand]);

  const gradient = `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
  const current = presentation?.brand ?? DEFAULT_BRAND;
  const isDirty = text !== current.text || from !== current.gradientFrom || to !== current.gradientTo;

  async function handleSave() {
    if (!presentation) return;
    setSavingBrand(true);
    await onBrandChange({ text, gradientFrom: from, gradientTo: to });
    setSavingBrand(false);
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Brand Badge</h3>
          <div className="relative">
            <div className="absolute inset-0 blur-lg opacity-40" style={{ background: gradient }} />
            <span
              className="relative text-[10px] font-bold tracking-[0.2em] uppercase"
              style={{ backgroundImage: gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
            >
              {text || "BRAND"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,auto] gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Text</label>
            <Input
              className="h-8 text-xs uppercase tracking-wider"
              value={text}
              onChange={(e) => setText(e.target.value.toUpperCase())}
              placeholder="SYNOGIZE LAB"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">From</label>
            <input type="color" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-12 rounded-md border border-border bg-transparent cursor-pointer" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">To</label>
            <input type="color" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-12 rounded-md border border-border bg-transparent cursor-pointer" />
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground">Shown top-right of every slide and used for the title-slide gradient.</p>

        <div className="flex items-center justify-end gap-2">
          {!presentation && <span className="text-[10px] text-muted-foreground">Select a presentation to save</span>}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!presentation || !isDirty || savingBrand}
            className="h-7 text-xs"
          >
            {savingBrand ? "Saving…" : "Save brand"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ThemeTab({ presentation, onPresetChange, onBrandChange }: { presentation: FullPresentation | null; onPresetChange: (presetId: string) => void; onBrandChange: (brand: Brand) => Promise<void> }) {
  const [selectedPresetId, setSelectedPresetId] = useState(() => resolvePresetId(presentation?.stylePreset));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setSelectedPresetId(resolvePresetId(presentation?.stylePreset)); }, [presentation?.stylePreset]);

  const activePreset = THEME_PRESETS.find((p) => p.id === selectedPresetId) ?? THEME_PRESETS[0];

  async function handleSelect(presetId: string) {
    setSelectedPresetId(presetId);
    if (!presentation) return;
    setSaving(true);
    await onPresetChange(presetId);
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {!presentation && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          No presentation selected — theme changes won&apos;t be saved until you select one from Sources.
        </div>
      )}
      {saving && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded-full border border-teal-500 border-t-transparent animate-spin" />
          Saving theme…
        </div>
      )}

      <BrandEditor presentation={presentation} onBrandChange={onBrandChange} />

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Preset Catalogue</h3>
        <div className="grid grid-cols-3 gap-3">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleSelect(preset.id)}
              className="rounded-xl border p-4 text-left transition-all hover:opacity-90"
              style={{
                borderColor: selectedPresetId === preset.id ? preset.semanticColors.opening : "hsl(240 3.7% 15.9%)",
                background: preset.tokens.background,
                boxShadow: selectedPresetId === preset.id ? `0 0 0 1px ${preset.semanticColors.opening}` : "none",
              }}
            >
              <div className="flex gap-1 mb-3">
                {Object.values(preset.semanticColors).slice(0, 5).map((c, i) => (
                  <div key={i} className="w-4 h-4 rounded-full" style={{ background: c }} />
                ))}
              </div>
              <p className="text-xs font-semibold" style={{ color: preset.tokens.textPrimary }}>{preset.name}</p>
              <p className="text-[10px] mt-0.5 leading-tight" style={{ color: preset.tokens.textMuted }}>{preset.description}</p>
              <div className="mt-2 flex gap-1.5">
                <span className="rounded-full px-2 py-0.5 text-[9px] font-medium" style={{ background: `${preset.semanticColors.opening}22`, color: preset.semanticColors.opening }}>{preset.backgroundMode}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-4">
            Active: <span style={{ color: activePreset.semanticColors.opening }}>{activePreset.name}</span>
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Semantic Colors</p>
              <div className="space-y-2">
                {(Object.entries(activePreset.semanticColors) as [string, string][]).map(([key, color]) => (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-md flex-shrink-0" style={{ background: color }} />
                    <p className="flex-1 text-xs">{SEMANTIC_COLOR_LABELS[key] ?? key}</p>
                    <code className="text-xs font-mono text-muted-foreground">{color}</code>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Typography</p>
              <div className="space-y-3 mb-5">
                {[["Display", activePreset.displayFont], ["Body", activePreset.bodyFont], ["Mono", activePreset.monoFont]].map(([label, font]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{font}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Tokens</p>
              <div className="space-y-2">
                {[["Motion", activePreset.tokens.motionLevel], ["Citation Mode", activePreset.tokens.citationDisplayMode], ["Border Radius", activePreset.tokens.radius]].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ========================
// Slides Tab
// ========================

const SEMANTIC_COLORS = ["#14b8a6", "#f87171", "#a78bfa", "#fbbf24", "#34d399", "#60a5fa", "#f472b6"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      {children}
    </div>
  );
}

function SlidesTab({ presentation, onSaved, onSwitchToSources }: { presentation: FullPresentation | null; onSaved: (slides: Slide[]) => void; onSwitchToSources: () => void }) {
  const [local, setLocal] = useState<Slide[]>(presentation?.slides ?? []);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [topic, setTopic] = useState("");
  const [topicCount, setTopicCount] = useState(1);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState("");

  useEffect(() => { setLocal(presentation?.slides ?? []); }, [presentation]);

  const isDirty = JSON.stringify(local) !== JSON.stringify(presentation?.slides ?? []);

  function updateSlide(idx: number, patch: Partial<Slide>) {
    setLocal(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }

  function removeSlide(idx: number) {
    setLocal(prev => prev.filter((_, i) => i !== idx));
    setExpandedIdx((cur) => (cur === idx ? null : cur !== null && cur > idx ? cur - 1 : cur));
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    setLocal(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setExpandedIdx(null);
  }

  // After a slide is moved to another deck, drop it here and persist this deck
  // so the move isn't left half-done.
  async function handleMoveAway(idx: number) {
    if (!presentation) return;
    const next = local.filter((_, i) => i !== idx);
    setLocal(next);
    setExpandedIdx(null);
    await fetch(`/api/presentations/${presentation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slides: next }),
    });
    onSaved(next);
  }

  async function handleGenerateTopic() {
    if (!presentation || !topic.trim() || genLoading) return;
    setGenLoading(true);
    setGenError("");
    try {
      const res = await fetch(`/api/presentations/${presentation.id}/generate-from-topic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), count: topicCount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      // New slides are appended to the end; server has already persisted them.
      const added = (data.slides as Slide[]) ?? [];
      setLocal(prev => [...prev, ...added]);
      onSaved([...local, ...added]);
      setTopic("");
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenLoading(false);
    }
  }

  async function handleSave() {
    if (!presentation) return;
    setSaving(true);
    await fetch(`/api/presentations/${presentation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slides: local }),
    });
    setSaving(false);
    onSaved(local);
  }

  if (!presentation) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <p className="text-sm text-muted-foreground">Select a presentation to edit slides.</p>
        <Button variant="outline" size="sm" onClick={onSwitchToSources}>Go to Sources</Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {isDirty && (
        <div className="sticky top-0 z-10 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-background px-4 py-2.5 mb-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
          <span className="flex-1 text-xs text-amber-400">Unsaved changes</span>
          <Button variant="ghost" size="sm" onClick={() => setLocal(presentation?.slides ?? [])} className="h-7 text-xs text-muted-foreground">
            Discard
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs bg-amber-400/15 text-amber-400 hover:bg-amber-400/25 border border-amber-400/30">
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      )}

      {/* Generate slides for a missing knowledge point */}
      <Card className="mb-4">
        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Add a missing knowledge point</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Describe a topic the deck doesn&apos;t cover. New slides are grounded in this deck&apos;s sources and appended to the end — drag to reorder afterwards.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. How the repair planning agent resolves conflicting fixes"
              rows={2}
              className="text-xs min-h-[44px] flex-1"
              disabled={genLoading}
            />
            <div className="flex flex-col gap-2 w-28 flex-shrink-0">
              <select
                value={topicCount}
                onChange={(e) => setTopicCount(Number(e.target.value))}
                disabled={genLoading}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{n} slide{n > 1 ? "s" : ""}</option>
                ))}
              </select>
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleGenerateTopic} disabled={genLoading || !topic.trim()}>
                {genLoading ? (
                  <span className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {genLoading ? "Generating…" : "Generate"}
              </Button>
            </div>
          </div>
          {genError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{genError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mb-4">{local.length} slides · click to edit · drag the handle to reorder</p>

      {local.map((slide, idx) => {
        const isOpen = expandedIdx === idx;
        const accent = slide.color ?? "#71717a";
        const isDragging = dragIndex === idx;
        const isDropTarget = overIndex === idx && dragIndex !== null && dragIndex !== idx;
        return (
          <div
            key={idx}
            draggable
            onDragStart={(e) => { setDragIndex(idx); setExpandedIdx(null); e.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(e) => { e.preventDefault(); if (overIndex !== idx) setOverIndex(idx); }}
            onDrop={(e) => { e.preventDefault(); if (dragIndex !== null) reorder(dragIndex, idx); setDragIndex(null); setOverIndex(null); }}
            onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
            className={cn(
              "rounded-xl border overflow-hidden transition-colors",
              isDropTarget ? "border-teal-500/60 bg-teal-500/5" : "border-border",
              isDragging && "opacity-50",
            )}
          >
            <div className="flex items-stretch">
              <span
                className="flex items-center px-2 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground"
                title="Drag to reorder"
                aria-hidden="true"
              >
                <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor"><circle cx="3" cy="3" r="1.3" /><circle cx="9" cy="3" r="1.3" /><circle cx="3" cy="8" r="1.3" /><circle cx="9" cy="8" r="1.3" /><circle cx="3" cy="13" r="1.3" /><circle cx="9" cy="13" r="1.3" /></svg>
              </span>
              <button
                className="flex-1 flex items-center gap-4 p-4 text-left hover:bg-accent/30 transition-colors"
                onClick={() => setExpandedIdx(isOpen ? null : idx)}
              >
                <span className="text-xs font-mono text-muted-foreground/60 w-6 flex-shrink-0">{String(idx + 1).padStart(2, "0")}</span>
                <Badge variant="outline" className="text-xs font-mono flex-shrink-0" style={{ color: accent, borderColor: `${accent}40` }}>
                  {slide.type}
                </Badge>
                <span className="flex-1 min-w-0 text-sm truncate">
                  {slide.headline ?? slide.quote ?? slide.question ?? "(no headline)"}
                </span>
                {slide.label && <span className="text-xs text-muted-foreground flex-shrink-0">{slide.label}</span>}
                <span className="text-muted-foreground text-xs ml-2">{isOpen ? "▲" : "▼"}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete slide #${idx + 1}? This won't be saved until you click Save.`)) removeSlide(idx);
                }}
                title="Delete slide"
                aria-label={`Delete slide ${idx + 1}`}
                className="flex items-center justify-center px-3 text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/5 transition-colors border-l border-border/50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
              </button>
            </div>

            {isOpen && (
              <div className="border-t border-border p-4 space-y-4 bg-accent/5">
                {SLIDE_VARIANTS[slide.type] && SLIDE_VARIANTS[slide.type].length > 1 && (
                  <Field label="Layout">
                    <div className="flex gap-2 flex-wrap">
                      {SLIDE_VARIANTS[slide.type].map(opt => {
                        const active = (slide.variant ?? DEFAULT_VARIANT[slide.type]) === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => {
                              const patch: Partial<Slide> = { variant: opt.value };
                              if (slide.type === "image") patch.imageLayout = opt.value as "side" | "full";
                              updateSlide(idx, patch);
                            }}
                            className={cn(
                              "px-2.5 py-1 text-[11px] rounded-md border transition-colors",
                              active ? "border-foreground text-foreground bg-foreground/5" : "border-border text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                )}

                <Field label="Color">
                  <div className="flex gap-2 flex-wrap">
                    {SEMANTIC_COLORS.map(hex => (
                      <button
                        key={hex}
                        onClick={() => updateSlide(idx, { color: hex })}
                        className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                        style={{ background: hex, boxShadow: slide.color === hex ? `0 0 0 2px hsl(240 10% 3.9%), 0 0 0 3px ${hex}` : undefined }}
                      />
                    ))}
                  </div>
                </Field>

                <Field label="Label">
                  <Input className="h-7 text-xs" value={slide.label ?? ""} placeholder="ALL-CAPS section tag" onChange={e => updateSlide(idx, { label: e.target.value })} />
                </Field>

                <Field label="Image">
                  <SlideImageField presentationId={presentation.id} slide={slide} onPatch={(p) => updateSlide(idx, p)} />
                </Field>

                <Field label="Move / copy">
                  <SlideTransfer sourceId={presentation.id} slide={slide} onMoved={() => handleMoveAway(idx)} />
                </Field>

                {slide.type !== "quote" && (
                  <Field label="Headline">
                    <Input className="h-7 text-xs" value={slide.headline ?? ""} placeholder="Bold statement, max 80 chars" onChange={e => updateSlide(idx, { headline: e.target.value })} />
                  </Field>
                )}

                {["statement", "framework", "big-number", "image", "split-visual"].includes(slide.type) && (
                  <Field label="Supporting">
                    <Textarea className="text-xs min-h-[60px]" rows={2} value={slide.supporting ?? ""} placeholder="Supporting text, max 200 chars" onChange={e => updateSlide(idx, { supporting: e.target.value })} />
                  </Field>
                )}

                {["goals", "framework", "recap"].includes(slide.type) && (
                  <Field label="Points (one per line)">
                    <Textarea className="text-xs" rows={4} value={(slide.points ?? []).join("\n")} placeholder="One bullet per line" onChange={e => updateSlide(idx, { points: e.target.value.split("\n") })} />
                  </Field>
                )}

                {slide.type === "quote" && (
                  <>
                    <Field label="Quote">
                      <Textarea className="text-xs" rows={3} value={slide.quote ?? ""} onChange={e => updateSlide(idx, { quote: e.target.value })} />
                    </Field>
                    <Field label="Author / Source">
                      <Input className="h-7 text-xs" value={slide.author ?? ""} onChange={e => updateSlide(idx, { author: e.target.value })} />
                    </Field>
                  </>
                )}

                {slide.type === "big-number" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Number">
                      <Input className="h-7 text-xs" value={slide.bigNumber ?? ""} placeholder="e.g. 70%" onChange={e => updateSlide(idx, { bigNumber: e.target.value })} />
                    </Field>
                    <Field label="Number Label">
                      <Input className="h-7 text-xs" value={slide.numberLabel ?? ""} onChange={e => updateSlide(idx, { numberLabel: e.target.value })} />
                    </Field>
                  </div>
                )}

                {slide.type === "comparison" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Before (one per line)">
                      <Textarea className="text-xs" rows={3} value={(slide.beforePoints ?? []).join("\n")} onChange={e => updateSlide(idx, { beforePoints: e.target.value.split("\n") })} />
                    </Field>
                    <Field label="After (one per line)">
                      <Textarea className="text-xs" rows={3} value={(slide.afterPoints ?? []).join("\n")} onChange={e => updateSlide(idx, { afterPoints: e.target.value.split("\n") })} />
                    </Field>
                  </div>
                )}

                {slide.type === "split-visual" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Left">
                      <Textarea className="text-xs" rows={3} value={slide.leftContent ?? ""} onChange={e => updateSlide(idx, { leftContent: e.target.value })} />
                    </Field>
                    <Field label="Right">
                      <Textarea className="text-xs" rows={3} value={slide.rightContent ?? ""} onChange={e => updateSlide(idx, { rightContent: e.target.value })} />
                    </Field>
                  </div>
                )}

                {slide.type === "quiz" && (
                  <div className="space-y-3">
                    <Field label="Question">
                      <Textarea className="text-xs" rows={2} value={slide.question ?? ""} onChange={e => updateSlide(idx, { question: e.target.value })} />
                    </Field>
                    <Field label="Options (one per line)">
                      <Textarea className="text-xs" rows={4} value={(slide.options ?? []).join("\n")} onChange={e => updateSlide(idx, { options: e.target.value.split("\n") })} />
                    </Field>
                    <Field label="Answer">
                      <Input className="h-7 text-xs" value={slide.answer ?? ""} onChange={e => updateSlide(idx, { answer: e.target.value })} />
                    </Field>
                    <Field label="Explanation">
                      <Textarea className="text-xs" rows={2} value={slide.explanation ?? ""} onChange={e => updateSlide(idx, { explanation: e.target.value })} />
                    </Field>
                  </div>
                )}

                <Field label="Speaker Notes">
                  <Textarea className="text-xs" rows={3} value={slide.notes ?? ""} placeholder="Bullet prompts for speaker" onChange={e => updateSlide(idx, { notes: e.target.value })} />
                </Field>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ========================
// Fidelity Tab
// ========================

const GRADE_STYLES: Record<FidelityReport["overallGrade"], { label: string; bg: string; text: string; border: string }> = {
  high:   { label: "High",   bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/30" },
  medium: { label: "Medium", bg: "bg-amber-500/10",   text: "text-amber-500",   border: "border-amber-500/30" },
  low:    { label: "Low",    bg: "bg-red-500/10",     text: "text-red-500",     border: "border-red-500/30" },
};

function pct(n: number) { return `${Math.round(n * 100)}%`; }

type DeckChunk = { id: string; page?: number; paragraph?: number; text: string; bbox?: ChunkBBoxJson };

const PdfPreview = dynamic(() => import("@/components/fidelity/pdf-preview"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      Loading PDF…
    </div>
  ),
});

function ChunkExcerpts({ ids, chunks, onPick, activeId }: {
  ids: string[];
  chunks: Map<string, DeckChunk>;
  onPick?: (id: string) => void;
  activeId?: string | null;
}) {
  if (!ids.length) return null;
  return (
    <div className="mt-1.5 space-y-1.5">
      {ids.map((id) => {
        const chunk = chunks.get(id);
        const clickable = !!onPick && !!chunk?.bbox;
        const active = activeId === id;
        return (
          <div
            key={id}
            data-chunk-id={id}
            onClick={clickable ? () => onPick!(id) : undefined}
            className={cn(
              "rounded border px-2.5 py-1.5 transition-colors",
              active ? "border-blue-500/60 bg-blue-500/10" : "border-border/50 bg-muted/40",
              clickable && "cursor-pointer hover:border-blue-500/40 hover:bg-blue-500/5",
            )}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-mono text-muted-foreground/70">{id}</span>
              {chunk?.page !== undefined && (
                <span className="text-[10px] text-muted-foreground/60">p{chunk.page}{chunk.paragraph !== undefined ? `¶${chunk.paragraph}` : ""}</span>
              )}
              {clickable && <span className="ml-auto text-[10px] text-blue-500/70">View in PDF →</span>}
            </div>
            {chunk ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground/90 italic line-clamp-3">{chunk.text}</p>
            ) : (
              <p className="text-[11px] italic text-muted-foreground/50">(chunk not found)</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FidelityTab({ presentation, onDeleteSlide }: { presentation: FullPresentation | null; onDeleteSlide: (idx: number) => Promise<void> | void }) {
  if (!presentation) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <p className="text-sm text-muted-foreground">Select a presentation from Sources to inspect its fidelity report.</p>
      </div>
    );
  }
  const report = presentation.fidelityReport;
  if (!report) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center space-y-2">
        <p className="text-sm text-muted-foreground">No fidelity report on this deck yet.</p>
        <p className="text-xs text-muted-foreground/70">Decks generated before this feature shipped don&apos;t have one. Regenerate the deck to get fidelity grading.</p>
      </div>
    );
  }
  return <FidelityReportView presentation={presentation} report={report} onDeleteSlide={onDeleteSlide} />;
}

function FidelityReportView({
  presentation,
  report,
  onDeleteSlide,
}: {
  presentation: FullPresentation;
  report: FidelityReport;
  onDeleteSlide: (idx: number) => Promise<void> | void;
}) {
  const det = report.deterministic;
  const grade = GRADE_STYLES[report.overallGrade];
  const chunkById = useMemo(
    () => new Map((presentation.chunks ?? []).map((c) => [c.id, c])),
    [presentation.chunks],
  );

  // Build highlight set for the PDF preview from the report. Each chunk gets
  // a single colour priority: unsupported > missed > captured.
  const pdfAvailable = presentation.sourceType === "pdf" && !!presentation.sourceUrl;
  const highlights = useMemo(() => {
    if (!pdfAvailable) return [];
    type Color = "captured" | "missed" | "unsupported";
    const PRIORITY: Record<Color, number> = { unsupported: 3, missed: 2, captured: 1 };
    const map = new Map<string, { color: Color; text: string; comment: string }>();
    const addRef = (id: string, color: Color, comment: string) => {
      const chunk = chunkById.get(id);
      if (!chunk?.bbox) return;
      const existing = map.get(id);
      if (existing && PRIORITY[existing.color] >= PRIORITY[color]) return;
      map.set(id, { color, text: chunk.text, comment });
    };
    for (const sec of report.coverage) {
      for (const p of sec.capturedKeyPoints) for (const id of p.evidenceChunkIds ?? []) addRef(id, "captured", `Captured: ${p.text}`);
      for (const p of sec.missedKeyPoints) for (const id of p.sourceChunkIds ?? []) addRef(id, "missed", `Missed: ${p.text}`);
    }
    for (const c of report.unsupportedClaims) for (const id of c.sourceChunkIds ?? []) addRef(id, "unsupported", `Unsupported claim — ${c.claim.slice(0, 80)}`);
    return Array.from(map.entries()).map(([id, v]) => {
      const chunk = chunkById.get(id)!;
      return { id, bbox: chunk.bbox!, text: v.text, comment: v.comment, color: v.color };
    });
  }, [pdfAvailable, report, chunkById]);

  const leftPanelRef = useRef<HTMLDivElement | null>(null);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  const handlePick = useCallback((id: string) => {
    setSelectedChunkId(id);
    setScrollToId(id);
  }, []);
  const handlePdfHighlightClick = useCallback((id: string) => {
    setSelectedChunkId(id);
    setScrollToId(null);
    requestAnimationFrame(() => {
      const target = leftPanelRef.current?.querySelector<HTMLElement>(`[data-chunk-id="${CSS.escape(id)}"]`);
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, []);

  return (
    <div className={cn("space-y-6", pdfAvailable && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6 lg:space-y-0 lg:items-start")}>
      <div ref={leftPanelRef} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-stretch">
        <div className={cn("rounded-xl border p-6 flex flex-col items-center justify-center min-w-[160px]", grade.bg, grade.border)}>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground mb-2">Overall</p>
          <p className={cn("text-4xl font-bold", grade.text)}>{grade.label}</p>
        </div>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground mb-2">Summary</p>
            <p className="text-sm leading-relaxed">{report.summary || "No narrative summary."}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Evidence usage" value={pct(det.evidenceUsageRatio)} sub={`${det.factualSlidesWithEvidence}/${det.factualSlides} factual slides cite chunks`} />
        <StatCard label="Chunk coverage" value={pct(det.chunkCoverageRatio)} sub={`${det.uniqueChunkIdsCited}/${det.totalChunkIds} chunks referenced`} />
        <StatCard label="Image usage" value={det.totalChunkIds === 0 || det.imageSlides + det.imageUsageRatio === 0 ? "—" : pct(det.imageUsageRatio)} sub={`${det.imageSlides} image slides`} />
        <StatCard label="Total slides" value={det.totalSlides} sub={Object.entries(det.slideTypeMix).slice(0, 3).map(([t, n]) => `${t} ${n}`).join(" · ")} />
      </div>

      {report.coverage.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Coverage by section</p>
          {report.coverage.map((sec) => (
            <Card key={sec.sectionId}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">{sec.sectionName || sec.sectionId}</p>
                  <span className="text-[10px] font-mono text-muted-foreground/60">{sec.sectionId}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-emerald-500 mb-2">Captured</p>
                    {sec.capturedKeyPoints.length === 0 ? (
                      <p className="text-xs text-muted-foreground/70">—</p>
                    ) : (
                      <ul className="space-y-3">
                        {sec.capturedKeyPoints.map((p, i) => (
                          <li key={i} className="text-xs leading-relaxed">
                            <p>{p.text}</p>
                            {p.evidenceChunkIds && p.evidenceChunkIds.length > 0 && (
                              <ChunkExcerpts ids={p.evidenceChunkIds} chunks={chunkById} onPick={pdfAvailable ? handlePick : undefined} activeId={selectedChunkId} />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-amber-500 mb-2">Missed</p>
                    {sec.missedKeyPoints.length === 0 ? (
                      <p className="text-xs text-muted-foreground/70">—</p>
                    ) : (
                      <ul className="space-y-3">
                        {sec.missedKeyPoints.map((p, i) => (
                          <li key={i} className="text-xs leading-relaxed">
                            <p>{p.text}</p>
                            {p.sourceChunkIds && p.sourceChunkIds.length > 0 && (
                              <ChunkExcerpts ids={p.sourceChunkIds} chunks={chunkById} onPick={pdfAvailable ? handlePick : undefined} activeId={selectedChunkId} />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {report.unsupportedClaims.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Unsupported claims</p>
          {report.unsupportedClaims.map((c, i) => (
            <Card key={i} className="border-amber-500/30">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm leading-relaxed">{c.claim}</p>
                  {c.slideIndex >= 0 && (
                    <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0">slide #{c.slideIndex + 1}</span>
                  )}
                </div>
                {c.closestSourceSpan && (
                  <p className="text-xs leading-relaxed text-muted-foreground italic">closest source: &ldquo;{c.closestSourceSpan}&rdquo;</p>
                )}
                {c.sourceChunkIds.length > 0 && <ChunkExcerpts ids={c.sourceChunkIds} chunks={chunkById} onPick={pdfAvailable ? handlePick : undefined} activeId={selectedChunkId} />}
                {c.slideIndex >= 0 && c.slideIndex < (presentation.slides?.length ?? 0) && (
                  <div className="pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-red-500 hover:text-red-500 border-red-500/30 hover:bg-red-500/5"
                      onClick={async () => {
                        if (confirm(`Delete slide #${c.slideIndex + 1}? This change is saved immediately.`)) {
                          await onDeleteSlide(c.slideIndex);
                        }
                      }}
                    >
                      Delete slide #{c.slideIndex + 1}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/50 text-right">Generated {new Date(report.generatedAt).toLocaleString()}</p>
      </div>
      {pdfAvailable && presentation.sourceUrl && (
        <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-7rem)] h-[600px] mt-6 lg:mt-0 flex flex-col min-h-0">
          <div className="mb-2 flex items-center justify-between flex-shrink-0">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Source PDF</p>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground/80">
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(34,197,94,0.5)" }} /> Captured</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(245,158,11,0.5)" }} /> Missed</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(239,68,68,0.5)" }} /> Unsupported</span>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <PdfPreview
              pdfUrl={presentation.sourceUrl}
              highlights={highlights}
              scrollToId={scrollToId}
              onScrolled={() => setScrollToId(null)}
              onHighlightClick={handlePdfHighlightClick}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ========================
// Main Workspace
// ========================

type Tab = "sources" | "overview" | "theme" | "slides" | "fidelity";

const TABS: { id: Tab; label: string }[] = [
  { id: "sources", label: "Sources" },
  { id: "overview", label: "Overview" },
  { id: "theme", label: "Theme" },
  { id: "slides", label: "Slides" },
  { id: "fidelity", label: "Fidelity" },
];

function WorkspaceInner() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("sources");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [presentation, setPresentation] = useState<FullPresentation | null>(null);
  const [loadingPresentation, setLoadingPresentation] = useState(false);

  // Open a specific deck when navigated to with /workspace?id=<deckId> (e.g. from the Library).
  useEffect(() => {
    const qid = searchParams.get("id");
    if (qid) {
      setSelectedId(qid);
      setActiveTab("overview");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selectedId) { setPresentation(null); return; }
    setLoadingPresentation(true);
    fetch(`/api/presentations/${selectedId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("not found");
        const data = await r.json();
        if (!data || typeof data !== "object" || !Array.isArray(data.slides)) throw new Error("malformed");
        return data as FullPresentation;
      })
      .then(setPresentation)
      .catch(() => setPresentation(null))
      .finally(() => setLoadingPresentation(false));
  }, [selectedId]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setActiveTab("overview");
  }, []);

  const handleSaved = useCallback((slides: Slide[]) => {
    setPresentation(prev => prev ? { ...prev, slides, slideCount: slides.length } : null);
  }, []);

  const handleDeleteSlide = useCallback(async (idx: number) => {
    if (!selectedId) return;
    setPresentation(prev => {
      if (!prev) return prev;
      const next = prev.slides.filter((_, i) => i !== idx);
      // fire-and-forget PATCH; deletes are persisted immediately when triggered from Fidelity tab
      fetch(`/api/presentations/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides: next }),
      }).catch(() => {});
      return { ...prev, slides: next, slideCount: next.length };
    });
  }, [selectedId]);

  const handleThemeChange = useCallback(async (presetId: string) => {
    if (!selectedId) return;
    await fetch(`/api/presentations/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stylePreset: presetId }),
    });
    setPresentation(prev => prev ? { ...prev, stylePreset: presetId } : null);
  }, [selectedId]);

  const handleBrandChange = useCallback(async (brand: Brand) => {
    if (!selectedId) return;
    await fetch(`/api/presentations/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand }),
    });
    setPresentation(prev => prev ? { ...prev, brand } : null);
  }, [selectedId]);

  const handleDeleteDeck = useCallback(async (id: string): Promise<boolean> => {
    const res = await fetch(`/api/presentations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Failed to delete the deck.");
      return false;
    }
    if (selectedId === id) {
      setSelectedId(null);
      setPresentation(null);
      setActiveTab("sources");
    }
    window.dispatchEvent(new CustomEvent("k2s:deck-deleted", { detail: { id } }));
    return true;
  }, [selectedId]);


  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-screen-xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {presentation ? presentation.title : "Workspace"}
            </h1>
            {presentation ? (
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">{presentation.audienceType}</Badge>
                <Badge variant="outline" className="text-xs">{presentation.stylePreset}</Badge>
                <span className="text-xs text-muted-foreground">{presentation.slideCount} slides</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">Upload a source and generate a deck</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {loadingPresentation && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-full border border-teal-500 border-t-transparent animate-spin" />
                Loading…
              </div>
            )}
            {presentation && (
              <>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/player?id=${presentation.id}`}>
                    <Play className="w-3.5 h-3.5 mr-1" /> Play
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/player/export?id=${presentation.id}`} target="_blank">
                    <Download className="w-3.5 h-3.5 mr-1" /> Export
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-500 hover:text-red-500 border-red-500/30 hover:bg-red-500/5"
                  onClick={async () => {
                    if (confirm(`Delete deck "${presentation.title}"? This cannot be undone.`)) {
                      const ok = await handleDeleteDeck(presentation.id);
                      if (ok) {
                        // refresh the library list inside SourcesTab via a custom event
                        window.dispatchEvent(new CustomEvent("k2s:deck-deleted", { detail: { id: presentation.id } }));
                      }
                    }
                  }}
                >
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Flat tab bar */}
        <div className="flex items-center gap-1 border-b border-border mb-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors relative",
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-foreground" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className={activeTab !== "sources" ? "hidden" : ""}>
          <SourcesTab selectedId={selectedId} onSelect={handleSelect} onDeleteDeck={handleDeleteDeck} />
        </div>
        <div className={activeTab !== "overview" ? "hidden" : ""}>
          <OverviewTab presentation={presentation} onSwitchToSources={() => setActiveTab("sources")} />
        </div>
        <div className={activeTab !== "theme" ? "hidden" : ""}>
          <ThemeTab presentation={presentation} onPresetChange={handleThemeChange} onBrandChange={handleBrandChange} />
        </div>
        <div className={activeTab !== "slides" ? "hidden" : ""}>
          <SlidesTab presentation={presentation} onSaved={handleSaved} onSwitchToSources={() => setActiveTab("sources")} />
        </div>
        {activeTab === "fidelity" && (
          <FidelityTab presentation={presentation} onDeleteSlide={handleDeleteSlide} />
        )}
      </div>
    </div>
  );
}

export default function Workspace() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <WorkspaceInner />
    </Suspense>
  );
}
