import test from "node:test";
import assert from "node:assert/strict";

import {
  extractBlocksFromHtml,
  htmlToExtractedSlide,
  WEB_PAGE_H,
  WEB_PAGE_W,
} from "@/lib/generation/web-layout-extract";
import { normalizeText } from "@/lib/generation/anim-key-synthesis";

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

const PAGE_A = `
<!DOCTYPE html>
<html>
<head><title>Acme — Landing</title></head>
<body>
  ${SHARED_CHROME}
  <main>
    <h1>Ship faster with Acme</h1>
    <p>Acme helps product teams launch features without drowning in ops toil every sprint cycle.</p>
    <a class="btn primary cta" href="/signup">Get started</a>
  </main>
  <footer><p>© 2026 Acme Inc. All rights reserved.</p></footer>
</body>
</html>
`;

const PAGE_B = `
<!DOCTYPE html>
<html>
<head><title>Acme — Features</title></head>
<body>
  ${SHARED_CHROME}
  <main>
    <h1>Everything in one workspace</h1>
    <p>Explore automations, analytics, and collaboration tools designed for modern product teams.</p>
    <button class="cta get-started">Get started</button>
  </main>
  <footer><p>© 2026 Acme Inc. All rights reserved.</p></footer>
</body>
</html>
`;

test("extractBlocksFromHtml: maps landmarks to roles with bboxes", () => {
  const result = extractBlocksFromHtml(PAGE_A, { baseUrl: "https://acme.example/" });

  assert.ok(result.title.toLowerCase().includes("acme") || result.title.toLowerCase().includes("ship"));
  assert.equal(result.pageW, WEB_PAGE_W);
  assert.equal(result.pageH, WEB_PAGE_H);

  const title = result.blocks.find((b) => b._role === "title");
  assert.ok(title, "has title-role block for H1");
  assert.equal(title!.type, "headline");
  assert.equal(title!.content, "Ship faster with Acme");
  assert.ok(title!._bbox, "title has bbox");
  assert.equal(title!._bbox!.length, 4);

  const figure = result.blocks.find((b) => b._role === "figure");
  assert.ok(figure, "has logo figure");
  assert.match(figure!.content, /logo/i);

  const nav = result.blocks.find(
    (b) =>
      b._role === "body" &&
      /features/i.test(b.content) &&
      /pricing/i.test(b.content) &&
      /docs/i.test(b.content),
  );
  assert.ok(nav, "has nav chrome body block");

  const cta = result.blocks.find(
    (b) => b._role === "body" && normalizeText(b.content) === normalizeText("Get started"),
  );
  assert.ok(cta, "has CTA body block");

  const footer = result.blocks.find((b) => b._role === "other");
  assert.ok(footer, "footer classified as other");
});

test("extractBlocksFromHtml: shared chrome text is stable across pages; H1 differs", () => {
  const a = extractBlocksFromHtml(PAGE_A, { baseUrl: "https://acme.example/" });
  const b = extractBlocksFromHtml(PAGE_B, { baseUrl: "https://acme.example/features" });

  const isNav = (bl: { _role?: string; content: string }) =>
    bl._role === "body" &&
    /features/i.test(bl.content) &&
    /pricing/i.test(bl.content) &&
    /docs/i.test(bl.content);
  const navA = a.blocks.find(isNav);
  const navB = b.blocks.find(isNav);
  assert.ok(navA && navB);
  assert.equal(normalizeText(navA!.content), normalizeText(navB!.content));
  assert.deepEqual(navA!._bbox, navB!._bbox);

  const logoA = a.blocks.find((bl) => bl._role === "figure");
  const logoB = b.blocks.find((bl) => bl._role === "figure");
  assert.ok(logoA && logoB);
  assert.equal(normalizeText(logoA!.content), normalizeText(logoB!.content));

  const tA = a.blocks.find((bl) => bl._role === "title")!;
  const tB = b.blocks.find((bl) => bl._role === "title")!;
  assert.notEqual(normalizeText(tA.content), normalizeText(tB.content));
});

test("extractBlocksFromHtml: empty body degrades to placeholder headline", () => {
  const html = `<!DOCTYPE html><html><head><title>Empty Host</title></head><body></body></html>`;
  const result = extractBlocksFromHtml(html, { baseUrl: "https://empty.example/path" });
  assert.ok(result.blocks.length >= 1);
  const title = result.blocks.find((b) => b._role === "title");
  assert.ok(title);
  assert.ok(title!.content.length > 0);
});

test("htmlToExtractedSlide: sets speakerNotes with source URL and page dims", () => {
  const slide = htmlToExtractedSlide(PAGE_A, {
    baseUrl: "https://acme.example/",
    sourceUrl: "https://acme.example/",
    id: "step-0",
  });
  assert.equal(slide.id, "step-0");
  assert.equal(slide._pageW, WEB_PAGE_W);
  assert.equal(slide._pageH, WEB_PAGE_H);
  assert.match(slide.speakerNotes ?? "", /https:\/\/acme\.example\//);
  assert.ok(slide.contentBlocks.some((b) => b._bbox && b._role));
});
