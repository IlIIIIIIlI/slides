export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

// Browser-like UA so sites don't serve a stripped/blocked variant to bots.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Server-side HTML proxy so pages that set X-Frame-Options / CSP frame-ancestors
// (github, twitter, google, …) can still be embedded in a slide <iframe>. We
// fetch the page ourselves, then re-serve it from our own origin WITHOUT the
// framing-blocker headers. A <base> tag is injected so the page's relative
// assets/links still resolve against the real origin.
//
// Caveats (inherent to proxying, not bugs): heavy SPAs / login-gated / strict-
// CORS sites (github is all three) will render partially — their client-side
// fetches hit our origin or are CORS-blocked. Static / SSR pages work well.
export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Only http(s) urls are allowed" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return new NextResponse(
      errorPage(parsed.hostname, "could not be reached"),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "";

  // Non-HTML (images, pdf, json…): stream through untouched so direct asset
  // requests proxied through here still work.
  if (!contentType.includes("text/html")) {
    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  let html = await upstream.text();

  // Final URL after redirects — relative assets must resolve against this.
  const finalUrl = upstream.url || parsed.toString();
  const baseHref = new URL("./", finalUrl).toString();

  html = rewriteHtml(html, baseHref);

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Explicitly DO NOT forward upstream X-Frame-Options / CSP — that is the
      // whole point. Our own response carries no framing restriction.
      "Cache-Control": "public, max-age=300",
    },
  });
}

function rewriteHtml(html: string, baseHref: string): string {
  // Drop meta-CSP so it can't re-impose restrictions inside the frame.
  html = html.replace(
    /<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi,
    "",
  );

  const baseTag = `<base href="${baseHref}">`;
  if (/<head[^>]*>/i.test(html)) {
    // Insert right after the opening <head> so it wins over later relative refs.
    html = html.replace(/(<head[^>]*>)/i, `$1${baseTag}`);
  } else if (/<html[^>]*>/i.test(html)) {
    html = html.replace(/(<html[^>]*>)/i, `$1<head>${baseTag}</head>`);
  } else {
    html = baseTag + html;
  }
  return html;
}

function errorPage(host: string, reason: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><base href="/"></head>
<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;background:#f3f4f6;color:#9ca3af">
<div style="text-align:center">
  <div style="font-size:42px;line-height:1">🗎</div>
  <div style="margin-top:12px;font-size:14px"><b style="color:#6b7280">${host}</b> ${reason}.</div>
</div></body></html>`;
}
