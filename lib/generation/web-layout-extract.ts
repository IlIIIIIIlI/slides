/**
 * Web DOM → synthesis-compatible spatial blocks (product-crawl path).
 *
 * Contract shared with PDF extract (`lib/generation/extract.ts`) for
 * `synthesizeAnimKeys` in `lib/generation/anim-key-synthesis.ts`:
 *
 * - Each eligible block is an `ExtractedBlock` (ContentBlock + optional internals):
 *   - `_role`: one of `title | body | figure | code | other`
 *   - `_bbox`: `[x, y, w, h]` in page coordinates (same units as `_pageW` / `_pageH`)
 * - Each slide carries `_pageW` and `_pageH` so synthesis can quantize bboxes
 *   onto the 12×9 grid (IoU ≥ 0.5 for matches).
 * - Content is plain text; matching uses `normalizeText` + FNV-1a (`contentKeyFor`).
 * - Blocks with `_role: "other"` are excluded from the match pool.
 * - Explicit `animKey` values are never overwritten by synthesis.
 *
 * This module does **not** change synthesis. It only produces the same input shape
 * PDF liteparse pages already feed, using fixed layout bands so shared chrome
 * (nav / logo / CTA) lands in stable grid cells across product tour steps.
 */

import { JSDOM } from "jsdom";
import type {
  ExtractedBlock,
  ExtractedSlide,
  LpRole,
} from "@/lib/generation/anim-key-synthesis";

/** Virtual page size for fixed-band layout (matches 12×9 grid quantization). */
export const WEB_PAGE_W = 1200;
export const WEB_PAGE_H = 900;

export interface WebExtractOptions {
  baseUrl: string;
}

export interface WebExtractResult {
  title: string;
  blocks: ExtractedBlock[];
  pageW: number;
  pageH: number;
}

// Fixed bands — shared chrome must share IoU ≥ 0.5 across pages.
// Heights/widths are sized so 12×9 quantization never collapses a side to 0
// (page cell ≈ 100×100 on WEB_PAGE_W×WEB_PAGE_H); thin chrome bands previously
// quantized to h=0 and failed IoU matching for nav.
const BAND = {
  logo: [40, 20, 160, 100] as [number, number, number, number],
  nav: [220, 20, 780, 100] as [number, number, number, number],
  title: [80, 140, 1040, 100] as [number, number, number, number],
  subtitle: [80, 260, 1040, 80] as [number, number, number, number],
  bodyStartY: 360,
  bodyH: 100,
  bodyGap: 20,
  cta: [360, 700, 480, 100] as [number, number, number, number],
  footer: [40, 820, 1120, 70] as [number, number, number, number],
};

function cleanText(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function isLikelyCta(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "button") return true;
  const cls = (el.getAttribute("class") ?? "").toLowerCase();
  const role = (el.getAttribute("role") ?? "").toLowerCase();
  const text = cleanText(el.textContent).toLowerCase();
  if (role === "button") return true;
  if (/\b(cta|btn|button|primary|signup|sign-up|get-started|buy|trial)\b/.test(cls)) {
    return true;
  }
  if (
    /^(get started|start free|sign up|try free|buy now|start trial|request demo|contact sales)$/i.test(
      text,
    )
  ) {
    return true;
  }
  return false;
}

function isLogoCandidate(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  const cls = (el.getAttribute("class") ?? "").toLowerCase();
  const id = (el.getAttribute("id") ?? "").toLowerCase();
  const alt = (el.getAttribute("alt") ?? "").toLowerCase();
  const aria = (el.getAttribute("aria-label") ?? "").toLowerCase();
  if (tag === "img" && (alt.includes("logo") || cls.includes("logo") || id.includes("logo"))) {
    return true;
  }
  if (cls.includes("logo") || id.includes("logo") || aria.includes("logo")) return true;
  if (tag === "a") {
    const href = el.getAttribute("href") ?? "";
    if (href === "/" || href.endsWith("://") || /\/$/.test(href.replace(/https?:\/\/[^/]+/, ""))) {
      // Home link with image or short brand text
      if (el.querySelector("img") || cleanText(el.textContent).length <= 40) return true;
    }
  }
  return false;
}

function resolveUrl(href: string | null, baseUrl: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return undefined;
  }
}

function makeBlock(
  type: ExtractedBlock["type"],
  content: string,
  role: LpRole,
  bbox: [number, number, number, number],
  extra?: Partial<ExtractedBlock>,
): ExtractedBlock {
  return {
    type,
    content,
    _role: role,
    _bbox: bbox,
    ...extra,
  };
}

/**
 * Parse HTML and emit landmark content blocks with fixed-band bboxes
 * consumable by `synthesizeAnimKeys`.
 */
export function extractBlocksFromHtml(
  html: string,
  options: WebExtractOptions,
): WebExtractResult {
  const dom = new JSDOM(html, { url: options.baseUrl });
  const { document } = dom.window;

  // Strip non-content noise
  document.querySelectorAll("script, style, noscript, template").forEach((n) => n.remove());

  const pageTitle =
    cleanText(document.querySelector("title")?.textContent) ||
    cleanText(document.querySelector("h1")?.textContent) ||
    (() => {
      try {
        return new URL(options.baseUrl).hostname;
      } catch {
        return "Product page";
      }
    })();

  const blocks: ExtractedBlock[] = [];
  const seen = new Set<string>();

  const pushUnique = (block: ExtractedBlock) => {
    const key = `${block._role}:${block.content.slice(0, 80)}`;
    if (!block.content.trim()) return;
    if (seen.has(key)) return;
    seen.add(key);
    blocks.push(block);
  };

  // Block order: logo → title → main body → CTA → nav chrome → footer/other.
  // Putting body paragraphs before nav ensures `specToSlide` / adapter pick
  // product copy as `supporting` (first supporting block), not the nav labels.

  // --- Logo / figure (top-left band) ---
  const logoEl =
    document.querySelector("header img, [class*='logo' i] img, img[alt*='logo' i], a[href='/'] img") ??
    Array.from(document.querySelectorAll("header a, a[href='/'], [class*='logo' i]")).find(
      isLogoCandidate,
    ) ??
    null;

  if (logoEl) {
    const img =
      logoEl.tagName.toLowerCase() === "img"
        ? (logoEl as HTMLImageElement)
        : (logoEl.querySelector("img") as HTMLImageElement | null);
    const alt =
      cleanText(img?.getAttribute("alt")) ||
      cleanText(logoEl.getAttribute("aria-label")) ||
      cleanText(logoEl.textContent) ||
      "Logo";
    const src = resolveUrl(img?.getAttribute("src") ?? null, options.baseUrl);
    pushUnique(
      makeBlock("image-ref", alt, "figure", BAND.logo, src ? { imageRef: src } : undefined),
    );
  }

  // --- H1 title ---
  const h1 = document.querySelector("h1");
  const h1Text = cleanText(h1?.textContent);
  if (h1Text) {
    pushUnique(makeBlock("headline", h1Text, "title", BAND.title));
  } else if (pageTitle) {
    // Fallback title from <title> so every slide has a headline band
    pushUnique(makeBlock("headline", pageTitle, "title", BAND.title));
  }

  // --- H2/H3 as secondary body ---
  const subheads = Array.from(document.querySelectorAll("h2, h3"))
    .map((el) => cleanText(el.textContent))
    .filter((t) => t.length >= 3)
    .slice(0, 2);
  if (subheads[0]) {
    pushUnique(makeBlock("supporting", subheads[0], "body", BAND.subtitle));
  }

  // --- Main body paragraphs ---
  const main =
    document.querySelector("main, article, [role='main']") ?? document.body;
  const paras = Array.from(main.querySelectorAll("p"))
    .map((p) => cleanText(p.textContent))
    .filter((t) => t.length >= 20)
    .slice(0, 4);

  paras.forEach((text, i) => {
    const y = BAND.bodyStartY + i * (BAND.bodyH + BAND.bodyGap);
    const bbox: [number, number, number, number] = [80, y, 1040, BAND.bodyH];
    pushUnique(makeBlock("supporting", text, "body", bbox));
  });

  // --- Nav (top strip) — after body so adapter supporting = product copy ---
  const navRoot = document.querySelector("nav, header nav, [role='navigation']");
  if (navRoot) {
    const labels = Array.from(navRoot.querySelectorAll("a"))
      .map((a) => cleanText(a.textContent))
      .filter((t) => t.length > 0 && t.length < 40)
      .slice(0, 12);
    if (labels.length > 0) {
      pushUnique(makeBlock("supporting", labels.join(" · "), "body", BAND.nav));
    }
  }

  // --- Primary CTA ---
  const ctaCandidates = Array.from(
    document.querySelectorAll("a, button, [role='button'], input[type='submit']"),
  ).filter((el) => {
    // Skip nav chrome links
    if (navRoot && navRoot.contains(el)) return false;
    if (el.closest("footer")) return false;
    return isLikelyCta(el);
  });

  const primaryCta = ctaCandidates[0];
  if (primaryCta) {
    const ctaText =
      cleanText(primaryCta.getAttribute("value")) ||
      cleanText(primaryCta.textContent) ||
      "Get started";
    pushUnique(makeBlock("supporting", ctaText, "body", BAND.cta));
  }

  // --- Footer / decorative → other (excluded from match pool) ---
  const footer = document.querySelector("footer");
  if (footer) {
    const footerText = cleanText(footer.textContent).slice(0, 120);
    if (footerText.length >= 5) {
      pushUnique(makeBlock("supporting", footerText, "other", BAND.footer));
    }
  }

  // Tiny decorative leftovers already omitted; if nothing useful, placeholder below.
  if (blocks.filter((b) => b._role !== "other").length === 0) {
    let host = "page";
    try {
      host = new URL(options.baseUrl).hostname;
    } catch {
      /* keep default */
    }
    pushUnique(
      makeBlock("headline", pageTitle || host, "title", BAND.title),
    );
  }

  return {
    title: pageTitle,
    blocks,
    pageW: WEB_PAGE_W,
    pageH: WEB_PAGE_H,
  };
}

/**
 * Build an `ExtractedSlide` for one product URL step (pre-synthesis).
 */
export function extractedSlideFromWeb(
  result: WebExtractResult,
  opts: { id: string; sourceUrl: string; sectionId?: string },
): ExtractedSlide {
  return {
    id: opts.id,
    intent: "statement",
    sectionId: opts.sectionId ?? "product-tour",
    audienceProfileId: "imported",
    themePresetId: "imported",
    evidenceRefs: [],
    assetRefs: [],
    citationPolicy: "none",
    speakerNotesMode: "prompt",
    status: "draft",
    contentBlocks: result.blocks,
    // Source URL lives in speakerNotes (no SlideSpec schema break).
    speakerNotes: `Source: ${opts.sourceUrl}`,
    renderProps: {
      label: "TOUR",
      color: "#14b8a6",
    },
    _pageW: result.pageW,
    _pageH: result.pageH,
  };
}

// Re-export for tests that want a one-shot extract → extracted slide
export function htmlToExtractedSlide(
  html: string,
  options: WebExtractOptions & { id?: string; sourceUrl?: string },
): ExtractedSlide {
  const extracted = extractBlocksFromHtml(html, { baseUrl: options.baseUrl });
  return extractedSlideFromWeb(extracted, {
    id: options.id ?? "web-slide-1",
    sourceUrl: options.sourceUrl ?? options.baseUrl,
  });
}
