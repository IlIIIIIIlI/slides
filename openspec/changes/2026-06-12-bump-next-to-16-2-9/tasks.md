# Tasks

- [ ] Bump `next` in package.json: `15.5.18` → `16.2.9`
- [ ] Re-install + re-lock (npm/pnpm)
- [ ] Update affected call-sites:

  - [ ] `ResolvingViewport` (signature-changed, 17 usage(s))
    - [ ] `.next/types/app/(site)/layout.ts:3:119`  — `import type { ResolvingMetadata, ResolvingViewport } from 'next/dist/lib/metadata/types/metadata-interface.js'`
    - [ ] `.next/types/app/(site)/layout.ts:45:20`  — `checkFields<Diff<ResolvingViewport, SecondArg<MaybeField<TEntry, 'generateViewport'>>, 'generateViewport'>>()`
    - [ ] `.next/types/app/(site)/library/page.ts:3:134`  — `import type { ResolvingMetadata, ResolvingViewport } from 'next/dist/lib/metadata/types/metadata-interface.js'`
    - [ ] `.next/types/app/(site)/library/page.ts:45:20`  — `checkFields<Diff<ResolvingViewport, SecondArg<MaybeField<TEntry, 'generateViewport'>>, 'generateViewport'>>()`
    - [ ] `.next/types/app/(site)/page.ts:3:115`  — `import type { ResolvingMetadata, ResolvingViewport } from 'next/dist/lib/metadata/types/metadata-interface.js'`
    - [ ] `.next/types/app/(site)/page.ts:45:20`  — `checkFields<Diff<ResolvingViewport, SecondArg<MaybeField<TEntry, 'generateViewport'>>, 'generateViewport'>>()`
    - [ ] `.next/types/app/(site)/workspace/page.ts:3:138`  — `import type { ResolvingMetadata, ResolvingViewport } from 'next/dist/lib/metadata/types/metadata-interface.js'`
    - [ ] `.next/types/app/(site)/workspace/page.ts:45:20`  — `checkFields<Diff<ResolvingViewport, SecondArg<MaybeField<TEntry, 'generateViewport'>>, 'generateViewport'>>()`
    - ...and 9 more — see `index.yaml`
  - [ ] `Metadata` (signature-changed, 2 usage(s))
    - [ ] `app/layout.tsx:1:0`  — `import type { Metadata } from "next";`
    - [ ] `app/layout.tsx:7:24`  — `export const metadata: Metadata = {`
  - [ ] `Metadata.metadataBase` (signature-changed, 2 usage(s))
    - [ ] `app/layout.tsx:1:0`  — `import type { Metadata } from "next";`
    - [ ] `app/layout.tsx:7:24`  — `export const metadata: Metadata = {`
  - [ ] `Metadata.other` (signature-changed, 2 usage(s))
    - [ ] `app/layout.tsx:1:0`  — `import type { Metadata } from "next";`
    - [ ] `app/layout.tsx:7:24`  — `export const metadata: Metadata = {`

- [ ] Run test suite
- [ ] Run `steward analyze` again — impacts should be empty for this dep
- [ ] Archive this proposal: `openspec archive`
