import test from "node:test";
import assert from "node:assert/strict";

import {
  crawlProductPath,
  parseUrlList,
  assertSafeCrawlUrl,
  CrawlValidationError,
  CrawlFetchError,
} from "@/lib/generation/product-crawl";

const SHARED_CHROME = `
<header>
  <a href="/" class="logo"><img src="/logo.svg" alt="Acme Logo" /></a>
  <nav>
    <a href="/features">Features</a>
    <a href="/pricing">Pricing</a>
    <a href="/docs">Docs</a>
  </nav>
</header>
`;

const FIXTURES: Record<string, string> = {
  "https://acme.example/": `<!DOCTYPE html><html><head><title>Acme Landing</title></head><body>
    ${SHARED_CHROME}
    <main>
      <h1>Ship faster with Acme</h1>
      <p>Acme helps product teams launch features without drowning in ops toil every sprint cycle.</p>
      <a class="btn primary cta" href="/signup">Get started</a>
    </main>
    <footer><p>© 2026 Acme Inc.</p></footer>
  </body></html>`,
  "https://acme.example/features": `<!DOCTYPE html><html><head><title>Acme Features</title></head><body>
    ${SHARED_CHROME}
    <main>
      <h1>Everything in one workspace</h1>
      <p>Explore automations, analytics, and collaboration tools designed for modern product teams.</p>
      <button class="cta get-started">Get started</button>
    </main>
    <footer><p>© 2026 Acme Inc.</p></footer>
  </body></html>`,
};

function mockFetch(url: string | URL | Request): Promise<Response> {
  const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
  const html = FIXTURES[href];
  if (!html) {
    return Promise.resolve(new Response("not found", { status: 404, statusText: "Not Found" }));
  }
  return Promise.resolve(
    new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  );
}

// ---- validation / SSRF ----

test("parseUrlList: rejects empty and non-http schemes", () => {
  assert.throws(() => parseUrlList([]), CrawlValidationError);
  assert.throws(() => parseUrlList(["ftp://x.example/"]), CrawlValidationError);
  assert.throws(() => parseUrlList(["javascript:alert(1)"]), CrawlValidationError);
});

test("assertSafeCrawlUrl: blocks localhost and private ranges", () => {
  assert.throws(() => assertSafeCrawlUrl("http://localhost/admin"), CrawlValidationError);
  assert.throws(() => assertSafeCrawlUrl("http://127.0.0.1/"), CrawlValidationError);
  assert.throws(() => assertSafeCrawlUrl("http://10.0.0.5/"), CrawlValidationError);
  assert.throws(() => assertSafeCrawlUrl("http://192.168.1.1/"), CrawlValidationError);
  assert.throws(() => assertSafeCrawlUrl("http://172.16.0.1/"), CrawlValidationError);
  assert.throws(() => assertSafeCrawlUrl("http://169.254.169.254/latest"), CrawlValidationError);
  // public ok
  const u = assertSafeCrawlUrl("https://example.com/path");
  assert.equal(u.hostname, "example.com");
});

test("parseUrlList: enforces max cap", () => {
  const many = Array.from({ length: 13 }, (_, i) => `https://example.com/p${i}`);
  assert.throws(() => parseUrlList(many, 12), /At most 12/);
});

// ---- crawl orchestration ----

test("crawlProductPath: ordered slides, sourceUrl notes, shared lp: chrome keys", async () => {
  const result = await crawlProductPath({
    urls: ["https://acme.example/", "https://acme.example/features"],
    title: "Acme Tour",
    fetchImpl: mockFetch as typeof fetch,
  });

  assert.equal(result.slideCount, 2);
  assert.equal(result.slides.length, 2);
  assert.equal(result.title, "Acme Tour");
  assert.equal(result.sourceType, "url");
  assert.equal(result.autoAnimate, true);
  assert.deepEqual(result.sourceUrls, [
    "https://acme.example/",
    "https://acme.example/features",
  ]);

  // Source URL traceability on each slide
  assert.match(result.slides[0].notes ?? "", /https:\/\/acme\.example\//);
  assert.match(result.slides[1].notes ?? "", /https:\/\/acme\.example\/features/);

  // Headlines differ between steps
  assert.equal(result.slides[0].headline, "Ship faster with Acme");
  assert.equal(result.slides[1].headline, "Everything in one workspace");

  // Specs retained for animKey inspection
  const specs = result.slideSpecs!;
  assert.equal(specs.length, 2);

  const chromeKeys0 = specs[0].contentBlocks
    .filter((b) => b.animKey?.startsWith("lp:"))
    .map((b) => ({ role: b.type, key: b.animKey, content: b.content.slice(0, 40) }));
  const chromeKeys1 = specs[1].contentBlocks
    .filter((b) => b.animKey?.startsWith("lp:"))
    .map((b) => b.animKey);

  assert.ok(chromeKeys0.length >= 1, `expected shared lp: keys on slide 0, got ${JSON.stringify(chromeKeys0)}`);

  // Nav / logo / CTA that match should share keys
  const keys0 = new Set(
    specs[0].contentBlocks.filter((b) => b.animKey).map((b) => b.animKey!),
  );
  const keys1 = new Set(
    specs[1].contentBlocks.filter((b) => b.animKey).map((b) => b.animKey!),
  );
  const shared = [...keys0].filter((k) => keys1.has(k));
  assert.ok(shared.length >= 2, `expected ≥2 shared chrome keys (logo+nav/cta), got ${shared}`);
  for (const k of shared) {
    assert.match(k!, /^lp:(title|body|figure|code):\d+$/);
  }

  const nav0 = specs[0].contentBlocks.find((b) => /features/i.test(b.content) && /pricing/i.test(b.content));
  const nav1 = specs[1].contentBlocks.find((b) => /features/i.test(b.content) && /pricing/i.test(b.content));
  assert.ok(nav0?.animKey && nav0.animKey === nav1?.animKey, "nav chrome should share lp: key");

  // Player supporting should be product body copy, not nav labels
  assert.match(result.slides[0].supporting ?? "", /product teams/i);
  assert.doesNotMatch(result.slides[0].supporting ?? "", /^Features/);

  // Different H1 content must not share a title key incorrectly
  const t0 = specs[0].contentBlocks.find((b) => b.type === "headline");
  const t1 = specs[1].contentBlocks.find((b) => b.type === "headline");
  if (t0?.animKey && t1?.animKey) {
    // Different titles → if both have keys they must differ
    assert.notEqual(t0.content, t1.content);
    assert.notEqual(t0.animKey, t1.animKey);
  }

  // Player slides carry animKeys array from adapter
  assert.ok(
    (result.slides[0].animKeys?.length ?? 0) >= 1 ||
      (result.slides[1].animKeys?.length ?? 0) >= 1,
    "player slides should expose animKeys",
  );

  // No internal fields leaked into slideSpecs
  const serialized = JSON.stringify(specs);
  assert.ok(!serialized.includes('"_bbox"'));
  assert.ok(!serialized.includes('"_role"'));
});

test("crawlProductPath: fetch failure names the URL and does not succeed", async () => {
  await assert.rejects(
    () =>
      crawlProductPath({
        urls: ["https://acme.example/", "https://acme.example/missing"],
        fetchImpl: mockFetch as typeof fetch,
      }),
    (err: unknown) => {
      assert.ok(err instanceof CrawlFetchError);
      assert.match(err.url, /missing/);
      assert.match(err.message, /missing|404|Fetch failed/i);
      return true;
    },
  );
});

test("crawlProductPath: SSRF rejected before fetch", async () => {
  let called = false;
  await assert.rejects(
    () =>
      crawlProductPath({
        urls: ["http://127.0.0.1:8080/secret"],
        fetchImpl: (() => {
          called = true;
          return Promise.resolve(new Response("nope"));
        }) as typeof fetch,
      }),
    CrawlValidationError,
  );
  assert.equal(called, false, "must not fetch private targets");
});
