/**
 * Product-path crawl: ordered product URLs → layout extract → anim-key synthesis → deck draft.
 *
 * Pipeline:
 *   1. Validate URL list (http(s) only, count cap, SSRF guards)
 *   2. Sequential fetch with timeout per URL
 *   3. `extractBlocksFromHtml` → one ExtractedSlide per URL
 *   4. `synthesizeAnimKeys` (same as PDF path) → `stripInternal`
 *   5. Convert to player `Slide[]` via `specToSlide` and return a persistable draft
 */

import { randomUUID } from "crypto";
import type { Slide } from "@/app/slides";
import { specToSlide } from "@/core/rendering/adapter";
import {
  synthesizeAnimKeys,
  stripInternal,
  type ExtractedSlide,
} from "@/lib/generation/anim-key-synthesis";
import {
  extractBlocksFromHtml,
  extractedSlideFromWeb,
} from "@/lib/generation/web-layout-extract";

export const DEFAULT_MAX_URLS = 12;
export const DEFAULT_TIMEOUT_MS = 15_000;

export interface CrawlOptions {
  maxUrls?: number;
  timeoutMs?: number;
  /** MVP may no-op; reserved for future screenshot capture. */
  includeScreenshots?: boolean;
}

export interface CrawlProductPathInput {
  urls: string[];
  title?: string;
  options?: CrawlOptions;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface CrawlProductPathResult {
  id: string;
  title: string;
  slideCount: number;
  sourceName: string;
  sourceType: "url";
  audienceType: string;
  stylePreset: string;
  generatedAt: string;
  slides: Slide[];
  /** Ordered source URLs (same order as slides). */
  sourceUrls: string[];
  autoAnimate: true;
  /** Raw SlideSpecs after synthesis (optional audit; not required for player). */
  slideSpecs?: ReturnType<typeof stripInternal>;
}

export class CrawlValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "CrawlValidationError";
  }
}

export class CrawlFetchError extends Error {
  readonly status = 502;
  readonly url: string;
  constructor(url: string, message: string) {
    super(message);
    this.name = "CrawlFetchError";
    this.url = url;
  }
}

function isPrivateIpv4(hostname: string): boolean {
  // hostname already lowercased; may be an IPv4 literal
  const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return true; // treat invalid as blocked
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (
    h === "localhost" ||
    h === "localhost.localdomain" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h === "metadata.google.internal" ||
    h === "metadata" ||
    h === "0.0.0.0"
  ) {
    return true;
  }
  // IPv6 loopback / link-local / ULA
  if (h === "::1" || h === "[::1]") return true;
  if (h.startsWith("fe80:") || h.startsWith("[fe80:")) return true;
  if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("[fc") || h.startsWith("[fd")) {
    // rough ULA check
    if (/^\[?f[cd][0-9a-f]{0,2}:/i.test(h)) return true;
  }
  if (isPrivateIpv4(h.replace(/^\[|\]$/g, ""))) return true;
  return false;
}

/**
 * Validate and normalize a single URL for crawl. Throws CrawlValidationError.
 */
export function assertSafeCrawlUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new CrawlValidationError(`Invalid URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new CrawlValidationError(`Only http(s) URLs are allowed: ${raw}`);
  }
  if (url.username || url.password) {
    throw new CrawlValidationError(`URLs with credentials are not allowed: ${url.origin}`);
  }
  if (isBlockedHostname(url.hostname)) {
    throw new CrawlValidationError(`URL targets a blocked private or local host: ${url.hostname}`);
  }
  return url;
}

export function parseUrlList(urls: unknown, maxUrls = DEFAULT_MAX_URLS): string[] {
  if (!Array.isArray(urls)) {
    throw new CrawlValidationError("`urls` must be an array of strings");
  }
  const cleaned = urls
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter(Boolean);
  if (cleaned.length === 0) {
    throw new CrawlValidationError("Provide at least one URL");
  }
  if (cleaned.length > maxUrls) {
    throw new CrawlValidationError(`At most ${maxUrls} URLs are allowed (got ${cleaned.length})`);
  }
  return cleaned.map((u) => assertSafeCrawlUrl(u).href);
}

async function fetchHtml(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "slides-product-crawl/1.0",
      },
    });
    if (!res.ok) {
      throw new CrawlFetchError(url, `Fetch failed for ${url}: HTTP ${res.status}`);
    }
    const ct = res.headers.get("content-type") ?? "";
    // Allow missing content-type (fixtures / simple servers)
    if (ct && !/text\/html|application\/xhtml\+xml|text\/plain/i.test(ct)) {
      throw new CrawlFetchError(url, `Fetch failed for ${url}: unexpected content-type ${ct}`);
    }
    return await res.text();
  } catch (err) {
    if (err instanceof CrawlFetchError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new CrawlFetchError(url, `Fetch timed out for ${url}`);
    }
    throw new CrawlFetchError(
      url,
      `Fetch failed for ${url}: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Crawl an ordered product path into a morph-ready presentation draft.
 * Does not persist — callers write via `saveDeck` / presentations API.
 */
export async function crawlProductPath(
  input: CrawlProductPathInput,
): Promise<CrawlProductPathResult> {
  const maxUrls = input.options?.maxUrls ?? DEFAULT_MAX_URLS;
  const timeoutMs = input.options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = input.fetchImpl ?? fetch;

  const urls = parseUrlList(input.urls, maxUrls);
  const extractedSlides: ExtractedSlide[] = [];
  const pageTitles: string[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const html = await fetchHtml(url, timeoutMs, fetchImpl);
    const layout = extractBlocksFromHtml(html, { baseUrl: url });
    pageTitles.push(layout.title);
    extractedSlides.push(
      extractedSlideFromWeb(layout, {
        id: `tour-${i + 1}`,
        sourceUrl: url,
        sectionId: "product-tour",
      }),
    );
  }

  synthesizeAnimKeys(extractedSlides);
  const slideSpecs = stripInternal(extractedSlides);

  const slides: Slide[] = slideSpecs.map((spec, i) => {
    const slide = specToSlide(spec);
    // Ensure notes carry source URL for traceability (adapter omits speakerNotes)
    const sourceLine = `Source: ${urls[i]}`;
    return {
      ...slide,
      notes: spec.speakerNotes ?? sourceLine,
      // Prefer statement layout for tour steps; title if first and looks like a hero
      type: slide.type === "title" ? "title" : "statement",
      label: slide.label ?? "TOUR",
      color: slide.color ?? "#14b8a6",
    };
  });

  const title =
    input.title?.trim() ||
    pageTitles[0] ||
    `Product tour: ${hostnameOf(urls[0])}`;

  const id = randomUUID();
  const generatedAt = new Date().toISOString();

  return {
    id,
    title,
    slideCount: slides.length,
    sourceName: urls.length === 1 ? urls[0] : `${urls.length} product URLs`,
    sourceType: "url",
    audienceType: "Customer",
    stylePreset: "dark-minimal",
    generatedAt,
    slides,
    sourceUrls: urls,
    autoAnimate: true,
    slideSpecs,
  };
}
