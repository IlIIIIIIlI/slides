# Tasks

- [ ] Bump `next` in package.json: `15.1.6` → `15.5.18`
- [ ] Re-install + re-lock (npm/pnpm)
- [ ] Update affected call-sites:

  - [ ] `Metadata` (signature-changed, 2 usage(s))
    - [ ] `app/layout.tsx:1:0`  — `import type { Metadata } from "next";`
    - [ ] `app/layout.tsx:7:24`  — `export const metadata: Metadata = {`

- [ ] Run test suite
- [ ] Run `steward analyze` again — impacts should be empty for this dep
- [ ] Archive this proposal: `openspec archive`
