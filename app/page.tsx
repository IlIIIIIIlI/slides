"use client";

import { useState, useEffect } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { slides } from "./slides";

// Tree node component for agent tree
function TreeNode({
  name,
  children,
  isFolder,
  color,
  level = 0,
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
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        ) : (
          <span className="w-4"></span>
        )}
        {isFolder ? (
          <svg
            className="w-4 h-4"
            style={{ color: color || "#60a5fa" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        )}
        <span style={{ color: isFolder ? "var(--text-primary)" : "var(--text-secondary)" }}>{name}</span>
      </div>
      {isFolder && isOpen && children && (
        <div className="ml-4 border-l border-gray-200">{children}</div>
      )}
    </div>
  );
}

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isIframeExpanded, setIsIframeExpanded] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"forward" | "backward">(
    "forward",
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setSlideDirection("forward");
        setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSlideDirection("backward");
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Home") {
        e.preventDefault();
        setSlideDirection("backward");
        setCurrentSlide(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setSlideDirection("forward");
        setCurrentSlide(slides.length - 1);
      } else if (e.key === "Escape" && isIframeExpanded) {
        e.preventDefault();
        setIsIframeExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isIframeExpanded]);

  const slide = slides[currentSlide];
  const progress = ((currentSlide + 1) / slides.length) * 100;

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#fafafa] text-gray-900 flex flex-col relative">
      {/* Progress bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 z-50">
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{
            width: `${progress}%`,
            backgroundColor: slide.color || "#14b8a6",
          }}
        />
      </div>

      {/* Slide Content with animation */}
      <div
        key={currentSlide}
        className={`flex-1 flex items-center p-16 relative ${
          slideDirection === "forward"
            ? "animate-slide-in-down"
            : "animate-slide-in-up"
        }`}
      >
        {/* Team name - Always at top right with glow effect */}
        <div className="absolute top-12 right-16">
          <div className="relative">
            {/* Glow effect */}
            <div
              className="absolute inset-0 blur-lg opacity-40"
              style={{
                background: "linear-gradient(135deg, #f59e0b 0%, #3b82f6 100%)",
              }}
            />
            {/* Text - matching slide-label size and style */}
            <span
              className="relative slide-label font-bold"
              style={{
                background: "linear-gradient(135deg, #f59e0b 0%, #3b82f6 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              SYNOGIZE LAB
            </span>
          </div>
        </div>

        {/* Label - Always at top left */}
        {slide.label && (
          <div
            className="absolute top-12 left-16 slide-label"
            style={{ color: slide.color }}
          >
            {slide.label}
          </div>
        )}

        <div className="max-w-7xl w-full mx-auto">
          {slide.type === "title" && (
            <div className="text-center relative">
              {/* Large gradient background effect */}
              <div
                className="absolute inset-0 opacity-10 blur-3xl"
                style={{
                  background:
                    "radial-gradient(circle at 30% 50%, #f59e0b 0%, transparent 50%), radial-gradient(circle at 70% 50%, #3b82f6 0%, transparent 50%)",
                }}
              />

              {/* Main title with gradient */}
              <h1
                className="type-display text-9xl font-bold mb-8 tracking-[-0.035em] leading-none relative z-10"
                style={{
                  background: "linear-gradient(135deg, #f59e0b 0%, #3b82f6 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {slide.headline}
              </h1>

              {slide.subtitle && (
                <p
                  className="text-3xl font-light relative z-10"
                  style={{ color: "var(--text-muted)" }}
                >
                  {slide.subtitle}
                </p>
              )}

              {/* Decorative line */}
              <div className="mt-12 flex justify-center relative z-10">
                <div
                  className="h-1 w-32 rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #f59e0b 0%, #3b82f6 100%)",
                  }}
                />
              </div>
            </div>
          )}

          {slide.type === "goals" && (
            <div className="mt-20">
              <h2
                className="type-display text-7xl font-bold mb-16 tracking-[-0.035em] leading-none"
                style={{ color: "var(--text-primary)" }}
              >
                {slide.headline}
              </h2>
              <div className="space-y-6">
                {slide.points?.map((point, idx) => (
                  <div
                    key={idx}
                    className="text-2xl leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    • {point}
                  </div>
                ))}
              </div>
            </div>
          )}

          {slide.type === "section-divider" && (
            <div className="text-center relative">
              {/* Gradient background */}
              <div
                className="absolute inset-0 opacity-5"
                style={{
                  background: `radial-gradient(circle at center, ${slide.color} 0%, transparent 70%)`,
                }}
              />
              <h2
                className="type-display text-9xl font-bold tracking-[-0.035em] leading-none relative z-10"
                style={{ color: slide.color }}
              >
                {slide.headline}
              </h2>
            </div>
          )}

          {slide.type === "statement" && (
            <div className="mt-20">
              <h2
                className="type-display text-7xl font-bold mb-10 leading-tight tracking-[-0.035em]"
                style={{ color: "var(--text-primary)" }}
              >
                {slide.headline}
              </h2>
              {slide.supporting && (
                <p
                  className="text-2xl leading-relaxed max-w-4xl font-light"
                  style={{ color: "var(--text-muted)" }}
                >
                  {slide.supporting}
                </p>
              )}
            </div>
          )}

          {slide.type === "code" && (
            <div className="flex gap-16 items-start mt-20">
              {/* Left side - Text content */}
              <div className="flex-1">
                <h2
                  className="type-display text-5xl font-bold leading-tight tracking-[-0.035em]"
                  style={{ color: "var(--text-primary)" }}
                >
                  {slide.headline}
                </h2>
              </div>

              {/* Right side - Terminal window */}
              <div className="flex-1">
                <div className="rounded-lg overflow-hidden shadow-lg border border-gray-200/50">
                  {/* Terminal header */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-[#f6f6f6] border-b border-gray-200/50">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
                      <div className="w-3 h-3 rounded-full bg-[#febc2e]"></div>
                      <div className="w-3 h-3 rounded-full bg-[#28c840]"></div>
                    </div>
                    <div
                      className="flex-1 text-center text-[11px] font-medium"
                      style={{ color: "var(--text-muted)" }}
                    >
                      server-action.ts
                    </div>
                  </div>
                  {/* Terminal content */}
                  <div className="bg-[#1e1e1e]">
                    <SyntaxHighlighter
                      language="typescript"
                      style={vscDarkPlus}
                      customStyle={{
                        margin: 0,
                        padding: "1.5rem",
                        background: "#1e1e1e",
                        fontSize: "13px",
                        lineHeight: "1.6",
                      }}
                      showLineNumbers={false}
                    >
                      {slide.code || ""}
                    </SyntaxHighlighter>
                  </div>
                </div>
              </div>
            </div>
          )}

          {slide.type === "framework" && (
            <div className="mt-20">
              <h2
                className="type-display text-6xl font-bold mb-16 tracking-[-0.035em]"
                style={{ color: "var(--text-primary)" }}
              >
                {slide.headline}
              </h2>
              <div className="space-y-8">
                {slide.points?.map((point, idx) => (
                  <div key={idx} className="text-2xl leading-relaxed">
                    <span
                      className="font-mono font-semibold"
                      style={{ color: slide.color }}
                    >
                      {point.split("—")[0]}
                    </span>
                    {point.includes("—") && (
                      <span
                        className="font-light"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {" "}
                        — {point.split("—")[1]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {slide.supporting && (
                <p
                  className="text-xl mt-10 leading-relaxed font-light max-w-3xl"
                  style={{ color: "var(--text-muted)" }}
                >
                  {slide.supporting}
                </p>
              )}
            </div>
          )}

          {slide.type === "recap" && (
            <div className="mt-20">
              <h2
                className="type-display text-7xl font-bold mb-16 tracking-[-0.035em]"
                style={{ color: "var(--text-primary)" }}
              >
                {slide.headline}
              </h2>
              <div className="space-y-6">
                {slide.points?.map((point, idx) => (
                  <div
                    key={idx}
                    className="text-2xl leading-relaxed flex items-start"
                  >
                    <span
                      className="mr-4 font-light"
                      style={{ color: "var(--text-faint)" }}
                    >
                      •
                    </span>
                    <span
                      className="font-light"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {point}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {slide.type === "split-visual" && (
            <div className="mt-20">
              <h2
                className="type-display text-6xl font-bold mb-16 tracking-[-0.035em]"
                style={{ color: "var(--text-primary)" }}
              >
                {slide.headline}
              </h2>
              <div className="grid grid-cols-2 gap-16">
                {/* Left column */}
                <div className="relative">
                  <div
                    className="absolute -left-8 top-0 w-1 h-full rounded-full"
                    style={{ backgroundColor: slide.color }}
                  />
                  <p
                    className="text-3xl font-light leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {slide.leftContent}
                  </p>
                </div>
                {/* Right column */}
                <div className="relative">
                  <div
                    className="absolute -left-8 top-0 w-1 h-full rounded-full opacity-30"
                    style={{ backgroundColor: slide.color }}
                  />
                  <p
                    className="text-3xl font-light leading-relaxed"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {slide.rightContent}
                  </p>
                </div>
              </div>
            </div>
          )}

          {slide.type === "comparison" && (
            <div className="mt-20">
              <h2
                className="type-display text-6xl font-bold mb-16 tracking-[-0.035em]"
                style={{ color: "var(--text-primary)" }}
              >
                {slide.headline}
              </h2>
              <div className="grid grid-cols-2 gap-16">
                {/* Before column */}
                <div>
                  <div className="mb-8">
                    <span
                      className="text-sm font-semibold uppercase tracking-wider"
                      style={{ color: "#ef4444" }}
                    >
                      Before
                    </span>
                  </div>
                  <div className="space-y-4">
                    {slide.beforePoints?.map((point, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 text-xl leading-relaxed"
                      >
                        <span
                          className="mt-1.5 text-2xl"
                          style={{ color: "#ef4444" }}
                        >
                          ✕
                        </span>
                        <span
                          className="font-light"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {point}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* After column */}
                <div>
                  <div className="mb-8">
                    <span
                      className="text-sm font-semibold uppercase tracking-wider"
                      style={{ color: slide.color }}
                    >
                      With Scrat
                    </span>
                  </div>
                  <div className="space-y-4">
                    {slide.afterPoints?.map((point, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 text-xl leading-relaxed"
                      >
                        <span
                          className="mt-1.5 text-2xl"
                          style={{ color: slide.color }}
                        >
                          ✓
                        </span>
                        <span
                          className="font-light"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {point}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {slide.type === "big-number" && (
            <div className="mt-20 text-center">
              <div
                className="type-display text-[12rem] font-bold leading-none mb-8"
                style={{
                  background: `linear-gradient(135deg, ${slide.color} 0%, ${slide.color}99 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {slide.bigNumber}
              </div>
              {slide.numberLabel && (
                <p
                  className="text-3xl font-light mb-12"
                  style={{ color: "var(--text-muted)" }}
                >
                  {slide.numberLabel}
                </p>
              )}
              <h2
                className="type-display text-5xl font-bold tracking-[-0.035em]"
                style={{ color: "var(--text-primary)" }}
              >
                {slide.headline}
              </h2>
              {slide.supporting && (
                <p
                  className="text-2xl font-light mt-6 max-w-3xl mx-auto"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {slide.supporting}
                </p>
              )}
            </div>
          )}

          {slide.type === "iframe" && (
            <div className="flex gap-12 items-start mt-20">
              {/* Left side - Headline */}
              <div className="flex-[0.8]">
                <h2
                  className="type-display text-5xl font-bold leading-tight tracking-[-0.035em]"
                  style={{ color: "var(--text-primary)" }}
                >
                  {slide.headline}
                </h2>
              </div>

              {/* Right side - iframe window */}
              <div className="flex-[1.5]">
                <div className="h-[600px] rounded-xl shadow-2xl overflow-hidden border border-gray-200/50">
                  {/* Browser header */}
                  <div className="flex items-center justify-between px-4 py-2 bg-[#f6f6f6] border-b border-gray-200/50">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="h-3 w-3 rounded-full bg-[#ff5f57]/80"></div>
                        <div className="h-3 w-3 rounded-full bg-[#febc2e]/80"></div>
                        <div className="h-3 w-3 rounded-full bg-[#28c840]/80"></div>
                      </div>
                    </div>
                    <div className="flex flex-1 items-center justify-center px-4">
                      <div className="flex max-w-md flex-1 items-center gap-2 rounded-md px-3 py-1.5 text-sm bg-white border border-gray-200">
                        <svg
                          className="h-3.5 w-3.5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <circle cx="12" cy="12" r="10"></circle>
                          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
                          <path d="M2 12h20"></path>
                        </svg>
                        <span className="truncate text-gray-600 text-xs">
                          {slide.iframeUrl
                            ? new URL(slide.iframeUrl).hostname
                            : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="rounded-md p-1.5 transition-colors hover:bg-gray-200 text-gray-500"
                        title="Refresh"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </button>
                      <a
                        href={slide.iframeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md p-1.5 transition-colors hover:bg-gray-200 text-gray-500"
                        title="Open in new tab"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                      <button
                        onClick={() => setIsIframeExpanded(true)}
                        className="rounded-md p-1.5 transition-colors hover:bg-gray-200 text-gray-500"
                        title="Expand"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {/* iframe content */}
                  <div className="relative h-[calc(100%-48px)] bg-white">
                    <iframe
                      src={slide.iframeUrl}
                      title="Web Preview"
                      className="h-full w-full border-0"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      style={{ minHeight: "100%" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {slide.type === "quote" && (
            <div className="mt-20 max-w-5xl mx-auto">
              {/* Large quote with quotation marks */}
              <div className="relative mb-16">
                {/* Opening quotation mark */}
                <div className="absolute -left-16 -top-8 text-[200px] leading-none opacity-10 font-serif">
                  &quot;
                </div>

                <blockquote
                  className="relative text-5xl font-normal leading-tight tracking-tight mb-8"
                  style={{ color: "var(--text-primary)" }}
                >
                  {slide.quote}
                </blockquote>

                {/* Author attribution */}
                {slide.author && (
                  <div
                    className="text-sm font-medium tracking-wider uppercase"
                    style={{ color: "var(--text-muted)" }}
                  >
                    — {slide.author}
                  </div>
                )}
              </div>

              {/* Link preview card */}
              {slide.linkPreview && (
                <a
                  href={slide.linkPreview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <div className="rounded-xl border border-gray-200 overflow-hidden hover:border-gray-300 transition-all bg-white shadow-sm hover:shadow-md flex items-center gap-4 p-4">
                    {/* Thumbnail or fallback */}
                    <div className="w-48 h-28 rounded-lg overflow-hidden flex-shrink-0 relative">
                      {slide.linkPreview.thumbnail ? (
                        <img
                          src={slide.linkPreview.thumbnail}
                          alt={slide.linkPreview.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            // Fallback if image fails to load
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                            const parent = target.parentElement;
                            if (parent) {
                              parent.style.background =
                                "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
                              const icon = document.createElement("div");
                              icon.className =
                                "absolute inset-0 flex items-center justify-center";
                              icon.innerHTML = `
                                <svg class="w-12 h-12 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                              `;
                              parent.appendChild(icon);
                            }
                          }}
                        />
                      ) : (
                        // Default gradient background if no thumbnail
                        <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <svg
                            className="w-12 h-12 text-white/80"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-lg font-semibold mb-1 group-hover:text-blue-600 transition-colors truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {slide.linkPreview.title}
                      </h3>
                      <div
                        className="flex items-center gap-2 text-sm"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <div className="w-5 h-5 rounded-full bg-gray-200 flex-shrink-0"></div>
                        <span className="font-medium">
                          {slide.linkPreview.author}
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              )}
            </div>
          )}

          {slide.type === "image" && (
            <div className="mt-20">
              {slide.imageLayout === "side" ? (
                // Side layout: Text on left, smaller image on right
                <div className="flex gap-16 items-center">
                  <div className="flex-1">
                    <h2
                      className="type-display text-6xl font-bold mb-6 tracking-[-0.035em]"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {slide.headline}
                    </h2>
                    {slide.supporting && (
                      <p
                        className="text-2xl font-light"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {slide.supporting}
                      </p>
                    )}
                  </div>
                  {slide.imageUrl && (
                    <div className="flex-shrink-0 w-80">
                      <div className="rounded-2xl overflow-hidden shadow-xl border border-gray-200/50">
                        <img
                          src={slide.imageUrl}
                          alt={slide.headline}
                          className="w-full h-auto object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Full layout: Default behavior
                <>
                  <div className="mb-12">
                    <h2
                      className="type-display text-6xl font-bold mb-6 tracking-[-0.035em]"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {slide.headline}
                    </h2>
                    {slide.supporting && (
                      <p
                        className="text-2xl font-light"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {slide.supporting}
                      </p>
                    )}
                  </div>
                  {slide.imageUrl && (
                    <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200/50 max-w-5xl mx-auto">
                      <img
                        src={slide.imageUrl}
                        alt={slide.headline}
                        className="w-full h-auto object-contain"
                        style={{ maxHeight: "600px" }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {slide.type === "agent-tree" && (
            <div className="flex gap-12 items-start mt-20">
              {/* Left side - Text content */}
              <div className="flex-1">
                <h2
                  className="type-display text-5xl font-bold leading-tight tracking-[-0.035em] mb-4"
                  style={{ color: "var(--text-primary)" }}
                >
                  {slide.headline}
                </h2>
                {slide.supporting && (
                  <p
                    className="text-xl font-light"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {slide.supporting}
                  </p>
                )}
              </div>

              {/* Right side - Interactive Agent tree */}
              <div className="flex-1">
                <div className="rounded-lg overflow-hidden shadow-lg border border-gray-200/50">
                  {/* Tree header */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-[#f6f6f6] border-b border-gray-200/50">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
                      <div className="w-3 h-3 rounded-full bg-[#febc2e]"></div>
                      <div className="w-3 h-3 rounded-full bg-[#28c840]"></div>
                    </div>
                    <div
                      className="flex-1 text-center text-[11px] font-medium"
                      style={{ color: "var(--text-muted)" }}
                    >
                      agent-execution.tree
                    </div>
                  </div>
                  {/* Tree content with interactive folders */}
                  <div className="bg-white p-4 font-mono text-sm max-h-[600px] overflow-y-auto">
                    <TreeNode name="Orchestrator Agent" isFolder={true} color={slide.color} defaultOpen={true}>
                      <TreeNode name="Table Understanding Agent" isFolder={true} color={slide.color} defaultOpen={false}>
                        <TreeNode name="Schema Analyzer" isFolder={false} />
                        <TreeNode name="Data Generation Mechanism Detector" isFolder={false} />
                      </TreeNode>

                      <TreeNode name="Column Classification Agent" isFolder={true} color={slide.color} defaultOpen={false}>
                        <TreeNode name="Numeric Analyzer" isFolder={false} />
                        <TreeNode name="Categorical Analyzer" isFolder={false} />
                        <TreeNode name="Temporal Analyzer" isFolder={false} />
                        <TreeNode name="Text/Image Analyzer" isFolder={false} />
                      </TreeNode>

                      <TreeNode name="Relationship Mining Agent" isFolder={true} color={slide.color} defaultOpen={false}>
                        <TreeNode name="Correlation Detector" isFolder={false} />
                        <TreeNode name="Dependency Mapper" isFolder={false} />
                      </TreeNode>

                      <TreeNode name="Quality Check Agent" isFolder={true} color={slide.color} defaultOpen={false}>
                        <TreeNode name="Completeness Checker" isFolder={false} />
                        <TreeNode name="Validity Checker" isFolder={false} />
                        <TreeNode name="Consistency Checker" isFolder={false} />
                        <TreeNode name="Uniqueness Checker" isFolder={false} />
                      </TreeNode>

                      <TreeNode name="Repair Planning Agent" isFolder={true} color={slide.color} defaultOpen={false}>
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
        <div
          className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-300"
          onClick={() => setIsIframeExpanded(false)}
        >
          <div
            className="w-full h-full rounded-xl shadow-2xl overflow-hidden border border-gray-200/50 bg-white animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Browser header */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#f6f6f6] border-b border-gray-200/50">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-[#ff5f57]/80"></div>
                  <div className="h-3 w-3 rounded-full bg-[#febc2e]/80"></div>
                  <div className="h-3 w-3 rounded-full bg-[#28c840]/80"></div>
                </div>
              </div>
              <div className="flex flex-1 items-center justify-center px-4">
                <div className="flex max-w-md flex-1 items-center gap-2 rounded-md px-3 py-1.5 text-sm bg-white border border-gray-200">
                  <svg
                    className="h-3.5 w-3.5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
                    <path d="M2 12h20"></path>
                  </svg>
                  <span className="truncate text-gray-600 text-xs">
                    {slide.iframeUrl ? new URL(slide.iframeUrl).hostname : ""}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="rounded-md p-1.5 transition-colors hover:bg-gray-200 text-gray-500"
                  title="Refresh"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
                <a
                  href={slide.iframeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md p-1.5 transition-colors hover:bg-gray-200 text-gray-500"
                  title="Open in new tab"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
                <button
                  onClick={() => setIsIframeExpanded(false)}
                  className="rounded-md p-1.5 transition-colors hover:bg-gray-200 text-gray-500"
                  title="Close (ESC)"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
            {/* iframe content */}
            <div className="relative h-[calc(100%-48px)] bg-white">
              <iframe
                src={slide.iframeUrl}
                title="Web Preview (Expanded)"
                className="h-full w-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                style={{ minHeight: "100%" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Navigation Footer */}
      <div className="flex items-center justify-between px-8 py-6 bg-white/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentSlide((prev) => Math.max(prev - 1, 0))}
            disabled={currentSlide === 0}
            className="text-gray-400 hover:text-gray-900 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            aria-label="Previous slide"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={() =>
              setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1))
            }
            disabled={currentSlide === slides.length - 1}
            className="text-gray-400 hover:text-gray-900 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            aria-label="Next slide"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        <div className="text-sm text-gray-400 font-medium tabular-nums">
          {currentSlide + 1} / {slides.length}
        </div>
      </div>
    </main>
  );
}
