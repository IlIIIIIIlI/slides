# Upstream changelog: next 15.5.18 → 16.2.9

_What the maintainers say changed, across every release in range. See `specs/` for what actually touches your code._

### v16.2.9 — 2026-06-10
**Changed**
- Empty release to ensure `next@latest` points at a stable release. Next.js only allows publishing with Trusted Publishing enabled. In order to fix NPM dist-tags, we have to release a new version. Updat…

### v16.2.8 — 2026-06-10
**Changed**
- Release with no changes in an attempt to fix `next@latest` pointing at a prerelease version.

### v15.5.19 — 2026-06-01
**Changed**
- [15.5.x] Don't drop `FormData` entries (#94244)
- [15.5.x] Fix CI (#94281)

### v16.2.7 — 2026-06-01
**Changed**
- Backport documentation fixes for v16.2 (#93804)
- [backport] Patch `playwright-core` to resolve `_finishedPromise` on `requestFailed` (#93920)
- [backport] Fix dev mode hydration failure when page is served from HTTP cache (#93492)
- [backport] Fix catch-all `router.query` corruption with `basePath` + `rewrites` (#93917)
- [backport] Encode non-ASCII characters in cache tags at construction (#93918)
- [backport] Fix server action forwarding loop with middleware rewrites (#93919)
- [backport] Turbopack: switch from base40 to base38 hash encoding (#93932)
- [ci] Disable hanging node 24 typescript tests on 16.2 backport branch (#94164)
- [backport] Fix "type: module" in project dir when using standalone or adapters (#94050)
- [backport] Propagate adapter preferred regions (#94200)
- [16.2.x] Don't drop `FormData` entries (#94240)
- [backport] feat(turbopack): add LocalPathOrProjectPath PostCSS config resolution (#94284)

### v16.2.6 — 2026-05-07
**Changed**
- fix: preserve HTTP access fallbacks during prerender recovery (#92231)
- Fix fallback route params case in app-page handler (#91737)
- Fix invalid HTML response for route-level RSC requests in deployment adapter (#91541)
- Patch setHeader for direct route handlers (#93101)
- Include deployment id in `cacheHandlers` keys (#93453)
- Fix double-encoding of URL pathname parts in client param parsing (#93491)
**Security**
- [GHSA-8h8q-6873-q5fj: Denial of Service with Server Components](https://github.com/vercel/next.js/security/advisories/GHSA-8h8q-6873-q5fj)
- [GHSA-267c-6grr-h53f: Middleware / Proxy bypass in App Router applications via segment-prefetch routes](https://github.com/vercel/next.js/security/advisories/GHSA-267c-6grr-h53f)
- [GHSA-26hh-7cqf-hhc6: Middleware / Proxy bypass in App Router applications via segment-prefetch routes - **Incomplete Fix Follow-Up**](https://github.com/vercel/next.js/security/advisories/GHSA-26hh-7…
- [GHSA-mg66-mrh9-m8jx: Denial of Service via connection exhaustion in applications using Cache Components](https://github.com/vercel/next.js/security/advisories/GHSA-mg66-mrh9-m8jx)
- [GHSA-492v-c6pp-mqqv: Middleware / Proxy bypass through dynamic route parameter injection](https://github.com/vercel/next.js/security/advisories/GHSA-492v-c6pp-mqqv)
- [GHSA-c4j6-fc7j-m34r: Server-side request forgery in applications using WebSocket upgrades](https://github.com/vercel/next.js/security/advisories/GHSA-c4j6-fc7j-m34r)
- [GHSA-36qx-fr4f-26g5: Middleware / Proxy bypass in Pages Router applications using i18n](https://github.com/vercel/next.js/security/advisories/GHSA-36qx-fr4f-26g5)
- [GHSA-ffhc-5mcf-pf4q: Cross-site scripting in App Router applications using CSP nonces](https://github.com/vercel/next.js/security/advisories/GHSA-ffhc-5mcf-pf4q)
- [GHSA-gx5p-jg67-6x7h: Cross-site scripting in beforeInteractive scripts with untrusted input](https://github.com/vercel/next.js/security/advisories/GHSA-gx5p-jg67-6x7h)
- [GHSA-h64f-5h5j-jqjh: Denial of Service in the Image Optimization API](https://github.com/vercel/next.js/security/advisories/GHSA-h64f-5h5j-jqjh)
- [GHSA-wfc6-r584-vfw7: Cache poisoning in React Server Component responses](https://github.com/vercel/next.js/security/advisories/GHSA-wfc6-r584-vfw7)
- [GHSA-vfv6-92ff-j949: Cache poisoning via collisions in React Server Component cache-busting](https://github.com/vercel/next.js/security/advisories/GHSA-vfv6-92ff-j949)
- [GHSA-3g8h-86w9-wvmq: Middleware / Proxy redirects can be cache-poisoned](https://github.com/vercel/next.js/security/advisories/GHSA-3g8h-86w9-wvmq)

### v16.2.5 — 2026-05-06
**Changed**
- fix: preserve HTTP access fallbacks during prerender recovery (#92231)
- Fix fallback route params case in app-page handler (#91737)
- Fix invalid HTML response for route-level RSC requests in deployment adapter (#91541)
- Patch setHeader for direct route handlers (#93101)
- Include deployment id in `cacheHandlers` keys (#93453)
- Fix double-encoding of URL pathname parts in client param parsing (#93491)
**Security**
- [GHSA-8h8q-6873-q5fj: Denial of Service with Server Components](https://github.com/vercel/next.js/security/advisories/GHSA-8h8q-6873-q5fj)
- [GHSA-267c-6grr-h53f: Middleware / Proxy bypass in App Router applications via segment-prefetch routes](https://github.com/vercel/next.js/security/advisories/GHSA-267c-6grr-h53f)
- [GHSA-mg66-mrh9-m8jx: Denial of Service via connection exhaustion in applications using Cache Components](https://github.com/vercel/next.js/security/advisories/GHSA-mg66-mrh9-m8jx)
- [GHSA-492v-c6pp-mqqv: Middleware / Proxy bypass through dynamic route parameter injection](https://github.com/vercel/next.js/security/advisories/GHSA-492v-c6pp-mqqv)
- [GHSA-c4j6-fc7j-m34r: Server-side request forgery in applications using WebSocket upgrades](https://github.com/vercel/next.js/security/advisories/GHSA-c4j6-fc7j-m34r)
- [GHSA-36qx-fr4f-26g5: Middleware / Proxy bypass in Pages Router applications using i18n](https://github.com/vercel/next.js/security/advisories/GHSA-36qx-fr4f-26g5)
- [GHSA-ffhc-5mcf-pf4q: Cross-site scripting in App Router applications using CSP nonces](https://github.com/vercel/next.js/security/advisories/GHSA-ffhc-5mcf-pf4q)
- [GHSA-gx5p-jg67-6x7h: Cross-site scripting in beforeInteractive scripts with untrusted input](https://github.com/vercel/next.js/security/advisories/GHSA-gx5p-jg67-6x7h)
- [GHSA-h64f-5h5j-jqjh: Denial of Service in the Image Optimization API](https://github.com/vercel/next.js/security/advisories/GHSA-h64f-5h5j-jqjh)
- [GHSA-wfc6-r584-vfw7: Cache poisoning in React Server Component responses](https://github.com/vercel/next.js/security/advisories/GHSA-wfc6-r584-vfw7)
- [GHSA-vfv6-92ff-j949: Cache poisoning via collisions in React Server Component cache-busting](https://github.com/vercel/next.js/security/advisories/GHSA-vfv6-92ff-j949)
- [GHSA-3g8h-86w9-wvmq: Middleware / Proxy redirects can be cache-poisoned](https://github.com/vercel/next.js/security/advisories/GHSA-3g8h-86w9-wvmq)
