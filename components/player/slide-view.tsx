"use client";

import { useState, useRef, useCallback } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Slide, Brand, FileTreeNode, SlideElementOverride } from "@/app/slides";
import { resolveVariant } from "@/lib/slide-variants";
import { inlineMd, stripMd } from "@/lib/markdown-inline";
import { Adjustable } from "@/components/player/adjustable";
import ZoomableImage from "@/components/player/zoomable-image";

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

// Route every embed through our same-origin HTML proxy so pages that send
// X-Frame-Options / CSP frame-ancestors (github, twitter, …) can still be framed.
// See app/api/embed/route.ts.
export function embedSrc(url?: string): string | undefined {
  if (!url) return undefined;
  return `/api/embed?url=${encodeURIComponent(url)}`;
}

// ScrollFadeFrame — embeds a live webpage (iframe) inside a fixed-height column
// that scrolls the whole page vertically, with a top/bottom transparency mask so
// the content fades in/out at the edges. The mask is applied to the scroll
// viewport (not the scrolled content), so the fade stays pinned to the edges
// while the page slides underneath. A tall inner iframe lets the wrapper own the
// scroll instead of the nested document.
function ScrollFadeFrame({ url, onExpand }: { url?: string; onExpand?: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atTop, setAtTop] = useState(true);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) setAtTop(el.scrollTop < 8);
  }, []);

  // Mask only the edge that has hidden content: no top fade when scrolled to the
  // very top, so the first line isn't dimmed before the user scrolls.
  const maskTop = atTop ? "black 0%" : "transparent 0%, black 12%";
  const maskImage = `linear-gradient(to bottom, ${maskTop}, black 88%, transparent 100%)`;

  if (!url) return null;

  return (
    <div className="relative h-[620px]">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="h-full w-full overflow-y-auto rounded-xl"
        style={{ maskImage, WebkitMaskImage: maskImage, scrollbarWidth: "none" }}
      >
        <iframe
          src={embedSrc(url)}
          title="Web Preview (scroll)"
          className="w-full border-0 block bg-white"
          height={2400}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
      {onExpand && (
        <button
          onClick={onExpand}
          title="Expand"
          className="absolute right-3 top-3 z-10 rounded-md bg-white/80 p-1.5 text-gray-500 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-gray-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
        </button>
      )}
    </div>
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

export type SlideAdjProps = {
  elKey: string;
  override?: SlideElementOverride;
  editMode: boolean;
  selected: boolean;
  onSelect: (key: string) => void;
  onChange: (key: string, patch: SlideElementOverride) => void;
};

export interface SlideViewProps {
  slide: Slide;
  brand: Brand;
  /** Per-element Adjustable props. Player wires edit/drag; export passes a static no-op. */
  adj: (key: string) => SlideAdjProps;
  headlineFlipId?: string;
  codeFlipId?: string;
  /** Selected quiz option for this slide (player state); undefined when non-interactive. */
  quizAnswer?: string;
  onQuizSelect?: (option: string) => void;
  onExpandIframe?: () => void;
  /** Whether in-slide images open the zoom lightbox (off in adjust mode / export). */
  interactiveImages?: boolean;
}

// SlideView — renders one slide's content (brand badge, label, and the
// type/variant switch). Extracted from the player so the export/print route can
// render every slide from the same source of truth.
export function SlideView({
  slide,
  brand,
  adj,
  headlineFlipId,
  codeFlipId,
  quizAnswer,
  onQuizSelect,
  onExpandIframe,
  interactiveImages = false,
}: SlideViewProps) {
  const v = resolveVariant(slide);
  const brandGradient = `linear-gradient(135deg, ${brand.gradientFrom} 0%, ${brand.gradientTo} 100%)`;
  return (
    <>
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

          {slide.type === "iframe" && v === "split" && (
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
                    <button onClick={() => onExpandIframe?.()} className="rounded-md p-1.5 transition-colors hover:bg-gray-200 text-gray-500">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    </button>
                  </div>
                  <div className="relative h-[calc(100%-48px)] bg-white">
                    <iframe src={embedSrc(slide.iframeUrl)} title="Web Preview" className="h-full w-full border-0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" style={{ minHeight: "100%" }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {slide.type === "iframe" && v === "scroll" && (
            <div className="flex gap-12 items-start mt-20">
              <div className="flex-[0.8] pt-4">
                <Adjustable {...adj("headline")}>
                  <h2 data-flip-id={headlineFlipId} className="type-display text-5xl font-bold leading-tight tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{stripMd(slide.headline)}</h2>
                </Adjustable>
                {slide.supporting && (
                  <Adjustable {...adj("supporting")}>
                    <p className="text-xl font-light mt-6 leading-relaxed" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p>
                  </Adjustable>
                )}
                {slide.iframeUrl && (
                  <div className="mt-8 flex items-center gap-2 text-sm" style={{ color: "var(--slide-text-muted)" }}>
                    <svg className="h-3.5 w-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
                    <span className="font-mono opacity-70">{new URL(slide.iframeUrl).hostname}</span>
                  </div>
                )}
              </div>
              <div className="flex-[1.5]">
                <ScrollFadeFrame url={slide.iframeUrl} onExpand={() => onExpandIframe?.()} />
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
                    {slide.imageUrl && <Adjustable {...adj("image")} className="flex-shrink-0 w-80"><div className="rounded-2xl overflow-hidden shadow-xl border border-gray-200/50"><ZoomableImage src={slide.imageUrl} alt={cleanHeadline} className="w-full h-auto object-contain" interactive={interactiveImages} /></div></Adjustable>}
                  </div>
                ) : (
                  <>
                    <div className="mb-12">
                      <Adjustable {...adj("headline")}>
                        <h2 data-flip-id={headlineFlipId} className="type-display text-6xl font-bold mb-6 tracking-[-0.035em]" style={{ color: "var(--slide-text-primary)" }}>{cleanHeadline}</h2>
                      </Adjustable>
                      {slide.supporting && <Adjustable {...adj("supporting")}><p className="text-2xl font-light" style={{ color: "var(--slide-text-muted)" }}>{inlineMd(slide.supporting)}</p></Adjustable>}
                    </div>
                    {slide.imageUrl && <Adjustable {...adj("image")} className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200/50 max-w-5xl mx-auto"><ZoomableImage src={slide.imageUrl} alt={cleanHeadline} className="w-full h-auto object-contain" style={{ maxHeight: "600px" }} interactive={interactiveImages} /></Adjustable>}
                  </>
                )}
              </div>
            );
          })()}

          {slide.type === "quiz" && (() => {
            const selected = quizAnswer;
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
                        onClick={() => onQuizSelect?.(option)}
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
    </>
  );
}
