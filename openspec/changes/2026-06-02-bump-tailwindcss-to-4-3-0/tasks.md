# Tasks

- [ ] Bump `tailwindcss` in package.json: `3.4.19` → `4.3.0`
- [ ] Re-install + re-lock (npm/pnpm)
- [ ] Update affected call-sites:

  - [ ] `Config` (removed, 2 usage(s))
    - [ ] `tailwind.config.ts:1:0`  — `import type { Config } from "tailwindcss";`
    - [ ] `tailwind.config.ts:73:13`  — `} satisfies Config;`

- [ ] Run test suite
- [ ] Run `steward analyze` again — impacts should be empty for this dep
- [ ] Archive this proposal: `openspec archive`
