# Upstream changelog: tailwindcss 3.4.19 → 4.3.2

_What the maintainers say changed, across every release in range. See `specs/` for what actually touches your code._

### v4.3.2 — 2026-06-29
**Fixed**
- Support bare spacing values for `auto-rows-*` and `auto-cols-*` utilities (e.g. `auto-rows-12` and `auto-cols-16`) ([#20229](https://github.com/tailwindlabs/tailwindcss/pull/20229))
- Prevent `@tailwindcss/cli` in `--watch` mode from crashing on Windows when `@source` points to a directory that doesn't exist ([#20242](https://github.com/tailwindlabs/tailwindcss/pull/20242))
- Prevent `@tailwindcss/vite` from crashing in Deno v2.8.x when `context.parentURL` is not a valid URL ([#20245](https://github.com/tailwindlabs/tailwindcss/pull/20245))
- Ensure `@tailwindcss/cli` in `--watch` mode rebuilds when the input CSS file changes in an ignored directory ([#20246](https://github.com/tailwindlabs/tailwindcss/pull/20246))
- Allow `@variant` rules used in `addBase(…)` to use custom variants defined later ([#20247](https://github.com/tailwindlabs/tailwindcss/pull/20247))
- Prevent `@tailwindcss/vite` from crashing during HMR when scanned files or directories are deleted ([#20259](https://github.com/tailwindlabs/tailwindcss/pull/20259))
- Generate `font-size` instead of `color` declarations for `text-[--spacing(…)]` ([#20260](https://github.com/tailwindlabs/tailwindcss/pull/20260))
- Prevent `@source` patterns from scanning unrelated sibling files and folders ([#20263](https://github.com/tailwindlabs/tailwindcss/pull/20263))
- Extract class candidates adjacent to Template Toolkit delimiters like `%]…[%` in `.tt`, `.tt2`, and `.tx` files ([#20269](https://github.com/tailwindlabs/tailwindcss/pull/20269))
- Extract class candidates from conditional Maud syntax like `p.text-black[condition]` ([#20269](https://github.com/tailwindlabs/tailwindcss/pull/20269))
- Prevent `@position-try` rules from triggering unknown at-rule warnings when optimizing CSS ([#20277](https://github.com/tailwindlabs/tailwindcss/pull/20277))
- Support class suggestions for named opacity modifiers from `--opacity` theme values ([#20287](https://github.com/tailwindlabs/tailwindcss/pull/20287))
- Prevent type errors in `@tailwindcss/postcss` when used with newer PostCSS patch releases ([#20289](https://github.com/tailwindlabs/tailwindcss/pull/20289))

### v4.3.1 — 2026-06-12
**Added**
- Add `--silent` option to suppress output in `@tailwindcss/cli` ([#20100](https://github.com/tailwindlabs/tailwindcss/pull/20100))
**Changed**
- Generate `0` instead of `calc(var(--spacing) * 0)` for spacing utilities like `m-0` and `left-0` ([#20196](https://github.com/tailwindlabs/tailwindcss/pull/20196))
- Generate `var(--spacing)` instead of `calc(var(--spacing) * 1)` for spacing utilities like `m-1` and `left-1` ([#20196](https://github.com/tailwindlabs/tailwindcss/pull/20196))
**Fixed**
- Remove deprecation warnings by using `Module#registerHooks` instead of `Module#register` on Node 26+ ([#20028](https://github.com/tailwindlabs/tailwindcss/pull/20028))
- Canonicalization: don't crash when plugin utilities throw for unsupported values ([#20052](https://github.com/tailwindlabs/tailwindcss/pull/20052))
- Allow `@apply` to be used with CSS mixins ([#19427](https://github.com/tailwindlabs/tailwindcss/pull/19427))
- Ensure `not-*` correctly negates `@container` queries, including `style(…)` queries ([#20059](https://github.com/tailwindlabs/tailwindcss/pull/20059))
- Ensure `drop-shadow-*` color utilities work with custom shadow values containing `calc(…)` ([#20080](https://github.com/tailwindlabs/tailwindcss/pull/20080))
- Fix 'Sourcemap is likely to be incorrect' warnings when using `@tailwindcss/vite` ([#20103](https://github.com/tailwindlabs/tailwindcss/pull/20103))
- Ensure `@tailwindcss/webpack` can be installed in Rspack projects without requiring `webpack` as a peer dependency ([#20027](https://github.com/tailwindlabs/tailwindcss/pull/20027))
- Canonicalization: don't suggest invalid `calc(…)` expressions (e.g. `px-[calc(1rem+0px)]` → `px-[calc(1rem+0)]`) ([#20127](https://github.com/tailwindlabs/tailwindcss/pull/20127))
- Canonicalization: avoid suggesting large spacing-scale values for arbitrary lengths (e.g. `left-[99999px]` → `left-[99999px]`, not `left-24999.75`) ([#20130](https://github.com/tailwindlabs/tailwindcs…
- Ensure `@tailwindcss/cli` in `--watch` mode recovers when a tracked dependency is deleted and restored ([#20137](https://github.com/tailwindlabs/tailwindcss/pull/20137))
- Ensure standalone `@tailwindcss/cli` binaries are ignored when scanning for class candidates ([#20139](https://github.com/tailwindlabs/tailwindcss/pull/20139))
- Ensure class candidates are extracted from Twig `addClass(…)` and `removeClass(…)` calls ([#20198](https://github.com/tailwindlabs/tailwindcss/pull/20198))
- Don't crash in the Ruby or Vue preprocessors when scanning files containing invalid UTF-8 bytes ([#19588](https://github.com/tailwindlabs/tailwindcss/pull/19588))
- Allow `@variant` to be used inside `addBase` ([#19480](https://github.com/tailwindlabs/tailwindcss/pull/19480))
- Ensure `@source` globs with symlinks are preserved ([#20203](https://github.com/tailwindlabs/tailwindcss/pull/20203))
- Ensure later `@source` rules can re-include files excluded by earlier `@source not` rules ([#20203](https://github.com/tailwindlabs/tailwindcss/pull/20203))
- Upgrade: don't migrate empty class rules to invalid `@utility` rules ([#20205](https://github.com/tailwindlabs/tailwindcss/pull/20205))
- Ensure transitions between `inset-shadow-none` and other inset shadows work correctly ([#20208](https://github.com/tailwindlabs/tailwindcss/pull/20208))
- Ensure explicitly referenced `@source` directories are scanned even when ignored by git ([#20214](https://github.com/tailwindlabs/tailwindcss/pull/20214))
- Ensure `@source` globs ending in `**/*` preserve dynamic path segments to avoid scanning too many files ([#20217](https://github.com/tailwindlabs/tailwindcss/pull/20217))
- Canonicalization: don't fold `calc(…)` divisions when the result would require high precision (e.g. `w-[calc(100%/3.5)]` → `w-[calc(100%/3.5)]`, not `w-[28.571428571428573%]`) ([#20221](https://github…
- Serve ESM type declarations to ESM importers of `@tailwindcss/postcss` ([#20228](https://github.com/tailwindlabs/tailwindcss/pull/20228))

### v4.3.0 — 2026-05-08
**Added**
- Add `@container-size` utility ([#18901](https://github.com/tailwindlabs/tailwindcss/pull/18901))
- Add `scrollbar-{auto,thin,none}` utilities for `scrollbar-width`, and `scrollbar-thumb-*` / `scrollbar-track-*` color utilities for `scrollbar-color` ([#19981](https://github.com/tailwindlabs/tailwind…
- Add `scrollbar-gutter-*` utilities ([#20018](https://github.com/tailwindlabs/tailwindcss/pull/20018))
- Add `zoom-*` utilities ([#20020](https://github.com/tailwindlabs/tailwindcss/pull/20020))
- Add `tab-*` utilities ([#20022](https://github.com/tailwindlabs/tailwindcss/pull/20022))
- Allow using `@variant` with stacked variants (e.g. `@variant hover:focus { … }`) ([#19996](https://github.com/tailwindlabs/tailwindcss/pull/19996))
- Allow using `@variant` with compound variants (e.g. `@variant hover, focus { … }`) ([#19996](https://github.com/tailwindlabs/tailwindcss/pull/19996))
- Support `--default(…)` in `--value(…)` and `--modifier(…)` for functional `@utility` definitions ([#19989](https://github.com/tailwindlabs/tailwindcss/pull/19989))
**Fixed**
- Ensure `@plugin` resolves package JavaScript entries instead of browser CSS entries when using `@tailwindcss/vite` ([#19949](https://github.com/tailwindlabs/tailwindcss/pull/19949))
- Fix relative `@import` and `@plugin` paths resolving from the wrong directory when using `@tailwindcss/vite` ([#19965](https://github.com/tailwindlabs/tailwindcss/pull/19965))
- Ensure CSS files containing `@variant` are processed by `@tailwindcss/vite` ([#19966](https://github.com/tailwindlabs/tailwindcss/pull/19966))
- Resolve imports relative to `base` when `result.opts.from` is not provided when using `@tailwindcss/postcss` ([#19980](https://github.com/tailwindlabs/tailwindcss/pull/19980))
- Canonicalization: preserve significant `_` whitespace in arbitrary values ([#19986](https://github.com/tailwindlabs/tailwindcss/pull/19986))
- Canonicalization: add parentheses when removing whitespace from arbitrary values would hurt readability (e.g. `w-[calc(100%---spacing(60))]` → `w-[calc(100%-(--spacing(60)))]`) ([#19986](https://githu…
- Canonicalization: preserve the original unit in arbitrary values instead of normalizing to base units (e.g. `-mt-[20in]` → `mt-[-20in]`, not `mt-[-1920px]`) ([#19988](https://github.com/tailwindlabs/t…
- Canonicalization: migrate arbitrary `:has()` variants from `[&:has(…)]` to `has-[…]` ([#19991](https://github.com/tailwindlabs/tailwindcss/pull/19991))
- Upgrade: don’t migrate inline `style` attributes (e.g. `style="flex-grow: 1"` → `style="flex-grow: 1"`, not `style="grow: 1"`) ([#19918](https://github.com/tailwindlabs/tailwindcss/pull/19918))
- Allow multiple `@utility` definitions with the same name but different value types ([#19777](https://github.com/tailwindlabs/tailwindcss/pull/19777))
- Export missing `PluginWithConfig` type from `tailwindcss/plugin` to fix errors when inferring plugin config types ([#19707](https://github.com/tailwindlabs/tailwindcss/pull/19707))
- Ensure `start` and `end` legacy utilities without values do not generate CSS ([#20003](https://github.com/tailwindlabs/tailwindcss/pull/20003))
- Ensure `--value(…)` is required in functional `@utility` definitions ([#20005](https://github.com/tailwindlabs/tailwindcss/pull/20005))
- Canonicalization: preserve required whitespace around operators in negated arbitrary values (e.g. `-left-[(var(--a)+var(--b))]`) ([#20011](https://github.com/tailwindlabs/tailwindcss/pull/20011))

### v4.2.4 — 2026-04-21
**Fixed**
- Ensure imports in `@import` and `@plugin` still resolve correctly when using Vite aliases in `@tailwindcss/vite` ([#19947](https://github.com/tailwindlabs/tailwindcss/pull/19947))

### v4.2.3 — 2026-04-20
**Fixed**
- Canonicalization: improve canonicalizations for `tracking-*` utilities by preferring non-negative utilities (e.g. `-tracking-tighter` → `tracking-wider`) ([#19827](https://github.com/tailwindlabs/tail…
- Fix crash due to invalid characters in candidate (exceeding valid unicode code point range) ([#19829](https://github.com/tailwindlabs/tailwindcss/pull/19829))
- Ensure query params in imports are considered unique resources when using `@tailwindcss/webpack` ([#19723](https://github.com/tailwindlabs/tailwindcss/pull/19723))
- Canonicalization: collapse arbitrary values into shorthand utilities (e.g. `px-[1.2rem] py-[1.2rem]` → `p-[1.2rem]`) ([#19837](https://github.com/tailwindlabs/tailwindcss/pull/19837))
- Canonicalization: collapse `border-{t,b}-*` into `border-y-*`, `border-{l,r}-*` into `border-x-*`, and `border-{t,r,b,l}-*` into `border-*` ([#19842](https://github.com/tailwindlabs/tailwindcss/pull/1…
- Canonicalization: collapse `scroll-m{t,b}-*` into `scroll-my-*`, `scroll-m{l,r}-*` into `scroll-mx-*`, and `scroll-m{t,r,b,l}-*` into `scroll-m-*` ([#19842](https://github.com/tailwindlabs/tailwindcss…
- Canonicalization: collapse `scroll-p{t,b}-*` into `scroll-py-*`, `scroll-p{l,r}-*` into `scroll-px-*`, and `scroll-p{t,r,b,l}-*` into `scroll-p-*` ([#19842](https://github.com/tailwindlabs/tailwindcss…
- Canonicalization: collapse `overflow-{x,y}-*` into `overflow-*` ([#19842](https://github.com/tailwindlabs/tailwindcss/pull/19842))
- Canonicalization: collapse `overscroll-{x,y}-*` into `overscroll-*` ([#19842](https://github.com/tailwindlabs/tailwindcss/pull/19842))
- Read from `--placeholder-color` instead of `--background-color` for `placeholder-*` utilities ([#19843](https://github.com/tailwindlabs/tailwindcss/pull/19843))
- Upgrade: ensure files are not emptied out when killing the upgrade process while it's running ([#19846](https://github.com/tailwindlabs/tailwindcss/pull/19846))
- Upgrade: use `config.content` when migrating from Tailwind CSS v3 to Tailwind CSS v4 ([#19846](https://github.com/tailwindlabs/tailwindcss/pull/19846))
- Upgrade: never migrate files that are ignored by git ([#19846](https://github.com/tailwindlabs/tailwindcss/pull/19846))
- Add `.env` and `.env.*` to default ignored content files ([#19846](https://github.com/tailwindlabs/tailwindcss/pull/19846))
- Canonicalization: migrate `overflow-ellipsis` into `text-ellipsis` ([#19849](https://github.com/tailwindlabs/tailwindcss/pull/19849))
- Canonicalization: migrate `start-full` → `inset-s-full`, `start-auto` → `inset-s-auto`, `start-px` → `inset-s-px`, and `start-<number>` → `inset-s-<number>` as well as negative versions ([#19849](http…
- Canonicalization: migrate `end-full` → `inset-e-full`, `end-auto` → `inset-e-auto`, `end-px` → `inset-e-px`, and `end-<number>` → `inset-e-<number>` as well as negative versions ([#19849](https://gith…
- Canonicalization: move the `-` sign inside the arbitrary value `-left-[9rem]` → `left-[-9rem]` ([#19858](https://github.com/tailwindlabs/tailwindcss/pull/19858))
- Canonicalization: move the `-` sign outside the arbitrary value `ml-[calc(-1*var(--width))]` → `-ml-(--width)` ([#19858](https://github.com/tailwindlabs/tailwindcss/pull/19858))
- Improve performance when scanning JSONL / NDJSON files ([#19862](https://github.com/tailwindlabs/tailwindcss/pull/19862))
- Support `NODE_PATH` environment variable in standalone CLI ([#19617](https://github.com/tailwindlabs/tailwindcss/pull/19617))

### v4.2.2 — 2026-03-18
**Added**
- Support Vite 8 in `@tailwindcss/vite` ([#19790](https://github.com/tailwindlabs/tailwindcss/pull/19790))
**Fixed**
- Don't crash when candidates contain prototype properties like `row-constructor` ([#19725](https://github.com/tailwindlabs/tailwindcss/pull/19725))
- Canonicalize `calc(var(--spacing)*…)` expressions into `--spacing(…)` ([#19769](https://github.com/tailwindlabs/tailwindcss/pull/19769))
- Fix crash in canonicalization step when handling utilities containing `@property` at-rules (e.g. `shadow-sm border`) ([#19727](https://github.com/tailwindlabs/tailwindcss/pull/19727))
- Skip full reload for server only modules scanned by client CSS when using `@tailwindcss/vite` ([#19745](https://github.com/tailwindlabs/tailwindcss/pull/19745))
- Improve canonicalization for bare values exceeding default spacing scale suggestions (e.g. `w-1234 h-1234` → `size-1234`) ([#19809](https://github.com/tailwindlabs/tailwindcss/pull/19809))
- Fix canonicalization resulting in empty list (e.g. `w-5 h-5 size-5` → `''` instead of `size-5`) ([#19812](https://github.com/tailwindlabs/tailwindcss/pull/19812))

### v4.2.1 — 2026-02-23
**Fixed**
- Allow trailing dash in functional utility names for backwards compatibility ([#19696](https://github.com/tailwindlabs/tailwindcss/pull/19696))
- Properly detect classes containing `.` characters within curly braces in MDX files ([#19711](https://github.com/tailwindlabs/tailwindcss/pull/19711))

### v4.2.0 — 2026-02-18
**Added**
- Add mauve, olive, mist, and taupe color palettes to the default theme ([#19627](https://github.com/tailwindlabs/tailwindcss/pull/19627))
- Add `@tailwindcss/webpack` package to run Tailwind CSS as a webpack plugin ([#19610](https://github.com/tailwindlabs/tailwindcss/pull/19610))
- Add `pbs-*` and `pbe-*` utilities for `padding-block-start` and `padding-block-end` ([#19601](https://github.com/tailwindlabs/tailwindcss/pull/19601))
- Add `mbs-*` and `mbe-*` utilities for `margin-block-start` and `margin-block-end` ([#19601](https://github.com/tailwindlabs/tailwindcss/pull/19601))
- Add `scroll-pbs-*` and `scroll-pbe-*` utilities for `scroll-padding-block-start` and `scroll-padding-block-end` ([#19601](https://github.com/tailwindlabs/tailwindcss/pull/19601))
- Add `scroll-mbs-*` and `scroll-mbe-*` utilities for `scroll-margin-block-start` and `scroll-margin-block-end` ([#19601](https://github.com/tailwindlabs/tailwindcss/pull/19601))
- Add `border-bs-*` and `border-be-*` utilities for `border-block-start` and `border-block-end` ([#19601](https://github.com/tailwindlabs/tailwindcss/pull/19601))
- Add `inline-*`, `min-inline-*`, `max-inline-*` utilities for `inline-size`, `min-inline-size`, and `max-inline-size` ([#19612](https://github.com/tailwindlabs/tailwindcss/pull/19612))
- Add `block-*`, `min-block-*`, `max-block-*` utilities for `block-size`, `min-block-size`, and `max-block-size` ([#19612](https://github.com/tailwindlabs/tailwindcss/pull/19612))
- Add `inset-s-*`, `inset-e-*`, `inset-bs-*`, `inset-be-*` utilities for `inset-inline-start`, `inset-inline-end`, `inset-block-start`, and `inset-block-end` ([#19613](https://github.com/tailwindlabs/ta…
- Add `font-features-*` utility for `font-feature-settings` ([#19623](https://github.com/tailwindlabs/tailwindcss/pull/19623))
**Removed**
- Deprecate `start-*` and `end-*` utilities in favor of `inset-s-*` and `inset-e-*` utilities ([#19613](https://github.com/tailwindlabs/tailwindcss/pull/19613))
**Fixed**
- Prevent double `@supports` wrapper for `color-mix` values ([#19450](https://github.com/tailwindlabs/tailwindcss/pull/19450))
- Allow whitespace around `@source inline()` argument ([#19461](https://github.com/tailwindlabs/tailwindcss/pull/19461))
- Emit comment when source maps are saved to files when using `@tailwindcss/cli` ([#19447](https://github.com/tailwindlabs/tailwindcss/pull/19447))
- Detect utilities containing capital letters followed by numbers ([#19465](https://github.com/tailwindlabs/tailwindcss/pull/19465))
- Fix class extraction for Rails' strict locals ([#19525](https://github.com/tailwindlabs/tailwindcss/pull/19525))
- Align `@utility` name validation with Oxide scanner rules ([#19524](https://github.com/tailwindlabs/tailwindcss/pull/19524))
- Fix infinite loop when using `@variant` inside `@custom-variant` ([#19633](https://github.com/tailwindlabs/tailwindcss/pull/19633))
- Allow multiples of `.25` in `aspect-*` fractions (e.g. `aspect-8.5/11`) ([#19688](https://github.com/tailwindlabs/tailwindcss/pull/19688))
- Ensure changes to external files listed via `@source` trigger a full page reload when using `@tailwindcss/vite` ([#19670](https://github.com/tailwindlabs/tailwindcss/pull/19670))
- Improve performance of Oxide scanner in bigger projects by reducing file system walks ([#19632](https://github.com/tailwindlabs/tailwindcss/pull/19632))
- Ensure import aliases in Astro v5 work without crashing when using `@tailwindcss/vite` ([#19677](https://github.com/tailwindlabs/tailwindcss/issues/19677))
- Allow escape characters in `@utility` names to improve support with formatters such as Biome ([#19626](https://github.com/tailwindlabs/tailwindcss/pull/19626))
- Fix incorrect canonicalization results when canonicalizing multiple times ([#19675](https://github.com/tailwindlabs/tailwindcss/pull/19675))
- Add `.jj` to default ignored content directories ([#19687](https://github.com/tailwindlabs/tailwindcss/pull/19687))

### v4.1.18 — 2025-12-11
**Fixed**
- Ensure validation of `source(…)` happens relative to the file it is in ([#19274](https://github.com/tailwindlabs/tailwindcss/pull/19274))
- Include filename and line numbers in CSS parse errors ([#19282](https://github.com/tailwindlabs/tailwindcss/pull/19282))
- Skip comments in Ruby files when checking for class names ([#19243](https://github.com/tailwindlabs/tailwindcss/pull/19243))
- Skip over arbitrary property utilities with a top-level `!` in the value ([#19243](https://github.com/tailwindlabs/tailwindcss/pull/19243))
- Support environment API in `@tailwindcss/vite` ([#18970](https://github.com/tailwindlabs/tailwindcss/pull/18970))
- Preserve case of theme keys from JS configs and plugins ([#19337](https://github.com/tailwindlabs/tailwindcss/pull/19337))
- Write source maps correctly on the CLI when using `--watch` ([#19373](https://github.com/tailwindlabs/tailwindcss/pull/19373))
- Handle special defaults (like `ringColor.DEFAULT`) in JS configs ([#19348](https://github.com/tailwindlabs/tailwindcss/pull/19348))
- Improve backwards compatibility for `content` theme key from JS configs ([#19381](https://github.com/tailwindlabs/tailwindcss/pull/19381))
- Upgrade: Handle `future` and `experimental` config keys ([#19344](https://github.com/tailwindlabs/tailwindcss/pull/19344))
- Try to canonicalize any arbitrary utility to a bare value ([#19379](https://github.com/tailwindlabs/tailwindcss/pull/19379))
- Validate candidates similarly to Oxide ([#19397](https://github.com/tailwindlabs/tailwindcss/pull/19397))
- Canonicalization: combine `text-*` and `leading-*` classes ([#19396](https://github.com/tailwindlabs/tailwindcss/pull/19396))
- Correctly handle duplicate CLI arguments ([#19416](https://github.com/tailwindlabs/tailwindcss/pull/19416))
- Don’t emit color-mix fallback rules inside `@keyframes` ([#19419](https://github.com/tailwindlabs/tailwindcss/pull/19419))
- CLI: Don't hang when output is `/dev/stdout` ([#19421](https://github.com/tailwindlabs/tailwindcss/pull/19421))

### v4.1.17 — 2025-11-06
**Fixed**
- Substitute `@variant` inside legacy JS APIs ([#19263](https://github.com/tailwindlabs/tailwindcss/pull/19263))
- Prevent occasional crash on Windows when loaded into a worker thread ([#19242](https://github.com/tailwindlabs/tailwindcss/pull/19242))

### v4.1.16 — 2025-10-23
**Fixed**
- Discard candidates with an empty data type ([#19172](https://github.com/tailwindlabs/tailwindcss/pull/19172))
- Fix canonicalization of arbitrary variants with attribute selectors ([#19176](https://github.com/tailwindlabs/tailwindcss/pull/19176))
- Fix invalid colors due to nested `&` ([#19184](https://github.com/tailwindlabs/tailwindcss/pull/19184))
- Improve canonicalization for `& > :pseudo` and `& :pseudo` arbitrary variants ([#19178](https://github.com/tailwindlabs/tailwindcss/pull/19178))

### v4.1.15 — 2025-10-20
**Changed**
- Remove the `postinstall` script from oxide ([#19149](https://github.com/tailwindlabs/tailwindcss/pull/19149))
**Fixed**
- Fix Safari devtools rendering issue due to `color-mix` fallback ([#19069](https://github.com/tailwindlabs/tailwindcss/pull/19069))
- Suppress Lightning CSS warnings about `:deep`, `:slotted`, and `:global` ([#19094](https://github.com/tailwindlabs/tailwindcss/pull/19094))
- Fix resolving theme keys when starting with the name of another theme key in JS configs and plugins ([#19097](https://github.com/tailwindlabs/tailwindcss/pull/19097))
- Allow named groups in combination with `not-*`, `has-*`, and `in-*` ([#19100](https://github.com/tailwindlabs/tailwindcss/pull/19100))
- Prevent important utilities from affecting other utilities ([#19110](https://github.com/tailwindlabs/tailwindcss/pull/19110))
- Don’t index into strings with the `theme(…)` function ([#19111](https://github.com/tailwindlabs/tailwindcss/pull/19111))
- Fix parsing issue when `\t` is used in at-rules ([#19130](https://github.com/tailwindlabs/tailwindcss/pull/19130))
- Upgrade: Canonicalize utilities containing `0` values ([#19095](https://github.com/tailwindlabs/tailwindcss/pull/19095))
- Upgrade: Migrate deprecated `break-words` to `wrap-break-word` ([#19157](https://github.com/tailwindlabs/tailwindcss/pull/19157))

### v4.1.14 — 2025-10-01
**Fixed**
- Handle `'` syntax in ClojureScript when extracting classes ([#18888](https://github.com/tailwindlabs/tailwindcss/pull/18888))
- Handle `@variant` inside `@custom-variant` ([#18885](https://github.com/tailwindlabs/tailwindcss/pull/18885))
- Merge suggestions when using `@utility` ([#18900](https://github.com/tailwindlabs/tailwindcss/pull/18900))
- Ensure that file system watchers created when using the CLI are always cleaned up ([#18905](https://github.com/tailwindlabs/tailwindcss/pull/18905))
- Do not generate `grid-column` utilities when configuring `grid-column-start` or `grid-column-end` ([#18907](https://github.com/tailwindlabs/tailwindcss/pull/18907))
- Do not generate `grid-row` utilities when configuring `grid-row-start` or `grid-row-end` ([#18907](https://github.com/tailwindlabs/tailwindcss/pull/18907))
- Prevent duplicate CSS when overwriting a static utility with a theme key ([#18056](https://github.com/tailwindlabs/tailwindcss/pull/18056))
- Show Lightning CSS warnings (if any) when optimizing/minifying ([#18918](https://github.com/tailwindlabs/tailwindcss/pull/18918))
- Use `default` export condition for `@tailwindcss/vite` ([#18948](https://github.com/tailwindlabs/tailwindcss/pull/18948))
- Re-throw errors from PostCSS nodes ([#18373](https://github.com/tailwindlabs/tailwindcss/pull/18373))
- Detect classes in markdown inline directives ([#18967](https://github.com/tailwindlabs/tailwindcss/pull/18967))
- Ensure files with only `@theme` produce no output when built ([#18979](https://github.com/tailwindlabs/tailwindcss/pull/18979))
- Support Maud templates when extracting classes ([#18988](https://github.com/tailwindlabs/tailwindcss/pull/18988))
- Upgrade: Do not migrate `variant = 'outline'` during upgrades ([#18922](https://github.com/tailwindlabs/tailwindcss/pull/18922))
- Upgrade: Show version mismatch (if any) when running upgrade tool ([#19028](https://github.com/tailwindlabs/tailwindcss/pull/19028))
- Upgrade: Ensure first class inside `className` is migrated ([#19031](https://github.com/tailwindlabs/tailwindcss/pull/19031))
- Upgrade: Migrate classes inside `*ClassName` and `*Class` attributes ([#19031](https://github.com/tailwindlabs/tailwindcss/pull/19031))

### v4.1.13 — 2025-09-04
**Changed**
- Drop warning from browser build ([#18731](https://github.com/tailwindlabs/tailwindcss/issues/18731))
- Drop exact duplicate declarations when emitting CSS ([#18809](https://github.com/tailwindlabs/tailwindcss/issues/18809))
**Fixed**
- Don't transition `visibility` when using `transition` ([#18795](https://github.com/tailwindlabs/tailwindcss/pull/18795))
- Discard matched variants with unknown named values ([#18799](https://github.com/tailwindlabs/tailwindcss/pull/18799))
- Discard matched variants with non-string values ([#18799](https://github.com/tailwindlabs/tailwindcss/pull/18799))
- Show suggestions for known `matchVariant` values ([#18798](https://github.com/tailwindlabs/tailwindcss/pull/18798))
- Replace deprecated `clip` with `clip-path` in `sr-only` ([#18769](https://github.com/tailwindlabs/tailwindcss/pull/18769))
- Hide internal fields from completions in `matchUtilities` ([#18820](https://github.com/tailwindlabs/tailwindcss/pull/18820))
- Ignore `.vercel` folders by default (can be overridden by `@source …` rules) ([#18855](https://github.com/tailwindlabs/tailwindcss/pull/18855))
- Consider variants starting with `@-` to be invalid (e.g. `@-2xl:flex`) ([#18869](https://github.com/tailwindlabs/tailwindcss/pull/18869))
- Do not allow custom variants to start or end with a `-` or `_` ([#18867](https://github.com/tailwindlabs/tailwindcss/pull/18867), [#18872](https://github.com/tailwindlabs/tailwindcss/pull/18872))
- Upgrade: Migrate `aria` theme keys to `@custom-variant` ([#18815](https://github.com/tailwindlabs/tailwindcss/pull/18815))
- Upgrade: Migrate `data` theme keys to `@custom-variant` ([#18816](https://github.com/tailwindlabs/tailwindcss/pull/18816))
- Upgrade: Migrate `supports` theme keys to `@custom-variant` ([#18817](https://github.com/tailwindlabs/tailwindcss/pull/18817))

### v4.1.12 — 2025-08-14
**Fixed**
- Don't consider the global important state in `@apply` ([#18404](https://github.com/tailwindlabs/tailwindcss/pull/18404))
- Add missing suggestions for `flex-<number>` utilities ([#18642](https://github.com/tailwindlabs/tailwindcss/pull/18642))
- Fix trailing `)` from interfering with extraction in Clojure keywords ([#18345](https://github.com/tailwindlabs/tailwindcss/pull/18345))
- Detect classes inside Elixir charlist, word list, and string sigils ([#18432](https://github.com/tailwindlabs/tailwindcss/pull/18432))
- Track source locations through `@plugin` and `@config` ([#18345](https://github.com/tailwindlabs/tailwindcss/pull/18345))
- Allow boolean values of `process.env.DEBUG` in `@tailwindcss/node` ([#18485](https://github.com/tailwindlabs/tailwindcss/pull/18485))
- Ignore consecutive semicolons in the CSS parser ([#18532](https://github.com/tailwindlabs/tailwindcss/pull/18532))
- Center the dropdown icon added to an input with a paired datalist by default ([#18511](https://github.com/tailwindlabs/tailwindcss/pull/18511))
- Extract candidates in Slang templates ([#18565](https://github.com/tailwindlabs/tailwindcss/pull/18565))
- Improve error messages when encountering invalid functional utility names ([#18568](https://github.com/tailwindlabs/tailwindcss/pull/18568))
- Discard CSS AST objects with `false` or `undefined` properties ([#18571](https://github.com/tailwindlabs/tailwindcss/pull/18571))
- Allow users to disable URL rebasing in `@tailwindcss/postcss` via `transformAssetUrls: false` ([#18321](https://github.com/tailwindlabs/tailwindcss/pull/18321))
- Fix false-positive migrations in `addEventListener` and JavaScript variable names ([#18718](https://github.com/tailwindlabs/tailwindcss/pull/18718))
- Fix Standalone CLI showing default Bun help when run via symlink on Windows ([#18723](https://github.com/tailwindlabs/tailwindcss/pull/18723))
- Read from `--border-color-*` theme keys in `divide-*` utilities for backwards compatibility ([#18704](https://github.com/tailwindlabs/tailwindcss/pull/18704/))
- Don't scan `.hdr` and `.exr` files for classes by default ([#18734](https://github.com/tailwindlabs/tailwindcss/pull/18734))

### v4.1.11 — 2025-06-26
**Fixed**
- Add heuristic to skip candidate migrations inside `emit(…)` ([#18330](https://github.com/tailwindlabs/tailwindcss/pull/18330))
- Extract candidates with variants in Clojure/ClojureScript keywords ([#18338](https://github.com/tailwindlabs/tailwindcss/pull/18338))
- Document `--watch=always` in the CLI's usage ([#18337](https://github.com/tailwindlabs/tailwindcss/pull/18337))
- Add support for Vite 7 to `@tailwindcss/vite` ([#18384](https://github.com/tailwindlabs/tailwindcss/pull/18384))

### v4.1.10 — 2025-06-11
**Fixed**
- Fix incorrectly generated CSS when using percentages in arbitrary values with calc (e.g. `w-[calc(100%-var(--offset))]`) ([#18289](https://github.com/tailwindlabs/tailwindcss/pull/18289))

### v4.1.9 — 2025-06-11
**Fixed**
- Correctly parse custom properties with strings containing semicolons ([#18251](https://github.com/tailwindlabs/tailwindcss/pull/18251))
- Upgrade: Migrate arbitrary modifiers without percentage signs to bare values (e.g. `/[0.16]` → `/16`) ([#18184](https://github.com/tailwindlabs/tailwindcss/pull/18184))
- Upgrade: Migrate CSS variable shorthands where fallback value contains function call ([#18184](https://github.com/tailwindlabs/tailwindcss/pull/18184))
- Upgrade: Migrate negative arbitrary values to negative bare values (e.g. `mb-[-32rem]` → `-mb-128`) ([#18212](https://github.com/tailwindlabs/tailwindcss/pull/18212))
- Upgrade: Do not migrate `blur` in `wire:model.blur` ([#18216](https://github.com/tailwindlabs/tailwindcss/pull/18216))
- Don't add spaces around CSS dashed idents when formatting math expressions ([#18220](https://github.com/tailwindlabs/tailwindcss/pull/18220))

### v4.1.8 — 2025-05-28
**Added**
- Improve error messages when `@apply` fails ([#18059](https://github.com/tailwindlabs/tailwindcss/pull/18059))
**Fixed**
- Upgrade: Do not migrate declarations that look like candidates in `<style>` blocks ([#18057](https://github.com/tailwindlabs/tailwindcss/pull/18057), [18068](https://github.com/tailwindlabs/tailwindcs…
- Upgrade: Don't error when looking for `tailwindcss` in pnpm monorepos ([#18065](https://github.com/tailwindlabs/tailwindcss/pull/18065))
- Upgrade: Don't error when updating dependencies in pnpm monorepos ([#18065](https://github.com/tailwindlabs/tailwindcss/pull/18065))
- Upgrade: Migrate deprecated `order-none` to `order-0` ([#18126](https://github.com/tailwindlabs/tailwindcss/pull/18126))
- Support Leptos `class:` attributes when extracting classes ([#18093](https://github.com/tailwindlabs/tailwindcss/pull/18093))
- Fix "Cannot read properties of undefined" crash on malformed arbitrary value ([#18133](https://github.com/tailwindlabs/tailwindcss/pull/18133))
- Upgrade: Migrate `-mt-[0px]` to `mt-[0px]` instead of the other way around ([#18154](https://github.com/tailwindlabs/tailwindcss/pull/18154))
- Fix Haml pre-processing crash when there is no `\n` at the end of the file ([#18155](https://github.com/tailwindlabs/tailwindcss/pull/18155))
- Ignore `.pnpm-store` folders by default (can be overridden by `@source …` rules) ([#18163](https://github.com/tailwindlabs/tailwindcss/pull/18163))
- Fix PostCSS crash when calling `toJSON()` ([#18083](https://github.com/tailwindlabs/tailwindcss/pull/18083))

### v4.1.7 — 2025-05-15
**Added**
- Upgrade: Migrate bare values to named values ([#18000](https://github.com/tailwindlabs/tailwindcss/pull/18000))
- Upgrade: Added cache to improve template migration performance ([#18025](https://github.com/tailwindlabs/tailwindcss/pull/18025))
**Fixed**
- Allow `_` before numbers during candidate extraction ([#17961](https://github.com/tailwindlabs/tailwindcss/pull/17961))
- Prevent duplicate suggestions when using `@theme` and `@utility` together ([#17675](https://github.com/tailwindlabs/tailwindcss/pull/17675))
- Ensure that media queries within `::before` and `::after` pseudo selectors create valid CSS rules in production builds ([#17979](https://github.com/tailwindlabs/tailwindcss/pull/17979))
- Ensure that the standalone CLI does not leave temporary files behind ([#17981](https://github.com/tailwindlabs/tailwindcss/pull/17981))
- Ensure `-rotate-*` utilities properly negate arbitrary values ([#18014](https://github.com/tailwindlabs/tailwindcss/pull/18014))
- Ignore custom variants using `:merge(…)` selectors in legacy JS plugins ([#18020](https://github.com/tailwindlabs/tailwindcss/pull/18020))
- Ensure classes containing `.` are properly extracted from Clojure files ([#18038](https://github.com/tailwindlabs/tailwindcss/pull/18038))
- Upgrade: Fix error when using `@import … source(…)` ([#17963](https://github.com/tailwindlabs/tailwindcss/pull/17963))
- Upgrade: Change casing of utilities with named values to kebab-case to match updated theme variables ([#18017](https://github.com/tailwindlabs/tailwindcss/pull/18017))
- Upgrade: Don't migrate strings that match utility names in Vue attribute bindings other than `class` ([#18025](https://github.com/tailwindlabs/tailwindcss/pull/18025))

### v4.1.6 — 2025-05-09
**Added**
- Upgrade: Automatically convert arbitrary values to named values when possible (e.g. `h-[1lh]` to `h-lh`) ([#17831](https://github.com/tailwindlabs/tailwindcss/pull/17831), [#17854](https://github.com/…
- Upgrade: Update dependencies in parallel for improved performance ([#17898](https://github.com/tailwindlabs/tailwindcss/pull/17898))
- Add detailed logging about `@source` directives, discovered files and scanned files when using `DEBUG=*` ([#17906](https://github.com/tailwindlabs/tailwindcss/pull/17906), [#17952](https://github.com/…
- Add support for generating source maps in development ([#17775](https://github.com/tailwindlabs/tailwindcss/pull/17775))
**Fixed**
- Ensure negative arbitrary `scale` values generate negative values ([#17831](https://github.com/tailwindlabs/tailwindcss/pull/17831))
- Fix HAML extraction with embedded Ruby ([#17846](https://github.com/tailwindlabs/tailwindcss/pull/17846))
- Don't scan files for utilities when using `@reference` ([#17836](https://github.com/tailwindlabs/tailwindcss/pull/17836))
- Fix incorrectly replacing `_` with ` ` in arbitrary modifier shorthand `bg-red-500/(--my_opacity)` ([#17889](https://github.com/tailwindlabs/tailwindcss/pull/17889))
- Don't scan `.log` files for classes by default ([#17906](https://github.com/tailwindlabs/tailwindcss/pull/17906))
- Ensure that custom utilities applying other custom utilities don't swallow nested `@apply` rules ([#17925](https://github.com/tailwindlabs/tailwindcss/pull/17925))
- Download platform specific package if `optionalDependencies` are skipped ([#17929](https://github.com/tailwindlabs/tailwindcss/pull/17929))

### v4.1.5 — 2025-04-30
**Added**
- Support using `@tailwindcss/upgrade` to upgrade between versions of v4.* ([#17717](https://github.com/tailwindlabs/tailwindcss/pull/17717))
- Add `h-lh` / `min-h-lh` / `max-h-lh` utilities ([#17790](https://github.com/tailwindlabs/tailwindcss/pull/17790))
- Transition `display`, `visibility`, `content-visibility`, `overlay`, and `pointer-events` when using `transition` to simplify `@starting-style` usage ([#17812](https://github.com/tailwindlabs/tailwind…
**Fixed**
- Don't scan `.geojson` or `.db` files for classes by default ([#17700](https://github.com/tailwindlabs/tailwindcss/pull/17700), [#17711](https://github.com/tailwindlabs/tailwindcss/pull/17711))
- Hide default shadow suggestions when missing default shadow theme keys ([#17743](https://github.com/tailwindlabs/tailwindcss/pull/17743))
- Replace `_` with `.` in theme suggestions for `@utility` if surrounded by digits ([#17733](https://github.com/tailwindlabs/tailwindcss/pull/17733))
- Skip `color-mix(…)` when opacity is `100%` ([#17815](https://github.com/tailwindlabs/tailwindcss/pull/17815))
- PostCSS: Ensure that errors in imported stylesheets are recoverable ([#17754](https://github.com/tailwindlabs/tailwindcss/pull/17754))
- Upgrade: Bump all Tailwind CSS related dependencies during upgrade ([#17763](https://github.com/tailwindlabs/tailwindcss/pull/17763))
- Upgrade: Don't add `-` to variants starting with `@` ([#17814](https://github.com/tailwindlabs/tailwindcss/pull/17814))
- Upgrade: Don't format stylesheets that didn't change when upgrading ([#17824](https://github.com/tailwindlabs/tailwindcss/pull/17824))

### v4.1.4 — 2025-04-14
**Added**
- Add experimental `@tailwindcss/oxide-wasm32-wasi` target for running Tailwind in browser environments like StackBlitz ([#17558](https://github.com/tailwindlabs/tailwindcss/pull/17558))
**Fixed**
- Ensure `color-mix(…)` polyfills do not cause used CSS variables to be removed ([#17555](https://github.com/tailwindlabs/tailwindcss/pull/17555))
- Ensure `color-mix(…)` polyfills create fallbacks for theme variables that reference other theme variables ([#17562](https://github.com/tailwindlabs/tailwindcss/pull/17562))
- Fix brace expansion in declining ranges like `{10..0..5}` and `{0..10..-5}` ([#17591](https://github.com/tailwindlabs/tailwindcss/pull/17591))
- Work around a Chrome rendering bug when using the `skew-*` utilities ([#17627](https://github.com/tailwindlabs/tailwindcss/pull/17627))
- Ensure container query variant names can contain hyphens ([#17628](https://github.com/tailwindlabs/tailwindcss/pull/17628))
- Ensure `shadow-inherit`, `inset-shadow-inherit`, `drop-shadow-inherit`, and `text-shadow-inherit` inherit the shadow color ([#17647](https://github.com/tailwindlabs/tailwindcss/pull/17647))
- Ensure compatibility with array tuples used in `fontSize` JS theme keys ([#17630](https://github.com/tailwindlabs/tailwindcss/pull/17630))
- Ensure folders with binary file extensions in their names are scanned for utilities ([#17595](https://github.com/tailwindlabs/tailwindcss/pull/17595))
- Upgrade: Convert `fontSize` array tuple syntax to CSS theme variables ([#17630](https://github.com/tailwindlabs/tailwindcss/pull/17630))

### v4.1.3 — 2025-04-04
**Fixed**
- Show warning when using unsupported bare value data type in `--value(…)` ([#17464](https://github.com/tailwindlabs/tailwindcss/pull/17464))
- PostCSS: Ensure changes to the input CSS file don't generate stale output when using Turbopack ([#17554](https://github.com/tailwindlabs/tailwindcss/pull/17554))
- Ensure classes are detected in Ruby's `%w` syntax in Slim templates ([#17557](https://github.com/tailwindlabs/tailwindcss/pull/17557))

### v4.1.2 — 2025-04-03
**Fixed**
- Don't rely on the presence of `@layer base` to polyfill `@property` ([#17506](https://github.com/tailwindlabs/tailwindcss/pull/17506))
- Support setting multiple inset shadows as arbitrary values ([#17523](https://github.com/tailwindlabs/tailwindcss/pull/17523))
- Fix `drop-shadow-*` utilities that are defined with multiple shadows ([#17515](https://github.com/tailwindlabs/tailwindcss/pull/17515))
- PostCSS: Fix race condition when two changes are queued concurrently ([#17514](https://github.com/tailwindlabs/tailwindcss/pull/17514))
- PostCSS: Ensure files containing `@tailwind utilities` are processed ([#17514](https://github.com/tailwindlabs/tailwindcss/pull/17514))
- Ensure the `color-mix(…)` polyfill creates fallbacks even when using colors that cannot be statically analyzed ([#17513](https://github.com/tailwindlabs/tailwindcss/pull/17513))
- Fix slow incremental builds with `@tailwindcss/vite` and `@tailwindcss/postscss` (especially on Windows) ([#17511](https://github.com/tailwindlabs/tailwindcss/pull/17511))
- Vite: Fix missing CSS file in Qwik setups ([#17533](https://github.com/tailwindlabs/tailwindcss/pull/17533))

### v4.1.1 — 2025-04-02
**Fixed**
- Disable padding in `@source inline(…)` brace expansion ([#17491](https://github.com/tailwindlabs/tailwindcss/pull/17491))
- Inject polyfills after `@import` and body-less `@layer` ([#17493](https://github.com/tailwindlabs/tailwindcss/pull/17493))
- Ensure `@tailwindcss/cli` does not contain an import for `jiti` ([#17502](https://github.com/tailwindlabs/tailwindcss/pull/17502))

### v4.1.0 — 2025-04-01
**Added**
- Add `details-content` variant ([#15319](https://github.com/tailwindlabs/tailwindcss/pull/15319))
- Add `inverted-colors` variant ([#11693](https://github.com/tailwindlabs/tailwindcss/pull/11693))
- Add `noscript` variant ([#11929](https://github.com/tailwindlabs/tailwindcss/pull/11929), [#17431](https://github.com/tailwindlabs/tailwindcss/pull/17431))
- Add `items-baseline-last` and `self-baseline-last` utilities ([#13888](https://github.com/tailwindlabs/tailwindcss/pull/13888), [#17476](https://github.com/tailwindlabs/tailwindcss/pull/17476))
- Add `pointer-none`, `pointer-coarse`, and `pointer-fine` variants ([#16946](https://github.com/tailwindlabs/tailwindcss/pull/16946))
- Add `any-pointer-none`, `any-pointer-coarse`, and `any-pointer-fine` variants ([#16941](https://github.com/tailwindlabs/tailwindcss/pull/16941))
- Add safe alignment utilities ([#14607](https://github.com/tailwindlabs/tailwindcss/pull/14607))
- Add `user-valid` and `user-invalid` variants ([#12370](https://github.com/tailwindlabs/tailwindcss/pull/12370))
- Add `wrap-anywhere`, `wrap-break-word`, and `wrap-normal` utilities ([#12128](https://github.com/tailwindlabs/tailwindcss/pull/12128))
- Add `@source inline(…)` and `@source not inline(…)` ([#17147](https://github.com/tailwindlabs/tailwindcss/pull/17147))
- Add `@source not "…"` ([#17255](https://github.com/tailwindlabs/tailwindcss/pull/17255))
- Add `text-shadow-*` utilities ([#17389](https://github.com/tailwindlabs/tailwindcss/pull/17389))
- Add `mask-*` utilities ([#17134](https://github.com/tailwindlabs/tailwindcss/pull/17134))
- Add `bg-{position,size}-*` utilities for arbitrary values ([#17432](https://github.com/tailwindlabs/tailwindcss/pull/17432))
- Add `shadow-*/<alpha>`, `inset-shadow-*/<alpha>`, `drop-shadow-*/<alpha>`, and `text-shadow-*/<alpha>` utilities to control shadow opacity ([#17398](https://github.com/tailwindlabs/tailwindcss/pull/17…
- Add `drop-shadow-<color>` utilities ([#17434](https://github.com/tailwindlabs/tailwindcss/pull/17434))
- Improve compatibility with older versions of Safari and Firefox ([#17435](https://github.com/tailwindlabs/tailwindcss/pull/17435))
**Changed**
- Ignore `node_modules` by default (can be overridden by `@source …` rules) ([#17255](https://github.com/tailwindlabs/tailwindcss/pull/17255))
- `@source` rules that include file extensions or point inside `node_modules/` folders no longer consider your `.gitignore` rules ([#17255](https://github.com/tailwindlabs/tailwindcss/pull/17255))
- Deprecate `bg-{left,right}-{top,bottom}` in favor of `bg-{top,bottom}-{left,right}` utilities ([#17378](https://github.com/tailwindlabs/tailwindcss/pull/17378))
- Deprecate `object-{left,right}-{top,bottom}` in favor of `object-{top,bottom}-{left,right}` utilities ([#17437](https://github.com/tailwindlabs/tailwindcss/pull/17437))
**Fixed**
- Follow symlinks when resolving `@source` directives ([#17391](https://github.com/tailwindlabs/tailwindcss/pull/17391))
- Don't scan ignored files for classes when changing an ignored file triggers a rebuild using `@tailwindcss/cli` ([#17255](https://github.com/tailwindlabs/tailwindcss/pull/17255))
- Support negated `content` rules in legacy JavaScript configuration ([#17255](https://github.com/tailwindlabs/tailwindcss/pull/17255))
- Interpret syntax like `@("@")md:…` as `@md:…` in Razor files ([#17427](https://github.com/tailwindlabs/tailwindcss/pull/17427))
- Disallow top-level braces, top-level semicolons, and unbalanced parentheses and brackets in arbitrary values ([#17361](https://github.com/tailwindlabs/tailwindcss/pull/17361))
- Ensure the `--theme(…)` function still resolves to the CSS variables when using legacy JS plugins ([#17458](https://github.com/tailwindlabs/tailwindcss/pull/17458))
- Detect used theme variables in CSS module files ([#17433](https://github.com/tailwindlabs/tailwindcss/pull/17433), [#17467](https://github.com/tailwindlabs/tailwindcss/pull/17467))

### v4.0.17 — 2025-03-26
**Fixed**
- Fix an issue causing the CLI to hang when processing Ruby files ([#17383](https://github.com/tailwindlabs/tailwindcss/pull/17383))

### v4.0.16 — 2025-03-25
**Added**
- Add support for literal values in `--value('…')` and `--modifier('…')` ([#17304](https://github.com/tailwindlabs/tailwindcss/pull/17304))
**Fixed**
- Fix class extraction followed by `(` in Pug ([#17320](https://github.com/tailwindlabs/tailwindcss/pull/17320))
- Ensure `@keyframes` for theme animations are emitted if they are referenced following a comma ([#17352](https://github.com/tailwindlabs/tailwindcss/pull/17352))
- Vite: Ensure that updates to an imported CSS file are properly propagated after updating source files ([#17347](https://github.com/tailwindlabs/tailwindcss/pull/17347))
- Pre process `Slim` templates embedded in Ruby files ([#17336](https://github.com/tailwindlabs/tailwindcss/pull/17336))
- Error when input and output files resolve to the same file when using the CLI ([#17311](https://github.com/tailwindlabs/tailwindcss/pull/17311))
- Add missing suggestions when `--spacing(--value(integer, number))` is used ([#17308](https://github.com/tailwindlabs/tailwindcss/pull/17308))
- Add `::-webkit-details-marker` pseudo to `marker` variant ([#17362](https://github.com/tailwindlabs/tailwindcss/pull/17362))

### v4.0.15 — 2025-03-20
**Changed**
- The `--theme(…)` function now returns CSS variables from your theme variables unless used inside positions where CSS variables are invalid (e.g. inside `@media` queries) ([#17036](https://github.com/t…
**Fixed**
- Fix incorrect angle in `-bg-conic-*` utilities ([#17174](https://github.com/tailwindlabs/tailwindcss/pull/17174))
- Fix `border-[12px_4px]` being interpreted as a `border-color` instead of a `border-width` ([#17248](https://github.com/tailwindlabs/tailwindcss/pull/17248))
- Work around a crash in Safari 16.4 and 16.5 when using the default Preflight styles ([#17306](https://github.com/tailwindlabs/tailwindcss/pull/17306))
- Pre-process `<template lang="…">` in Vue files ([#17252](https://github.com/tailwindlabs/tailwindcss/pull/17252))
- Ensure that all CSS variables used by Preflight are prefixed ([#17036](https://github.com/tailwindlabs/tailwindcss/pull/17036))
- Prevent segfault when loaded in a worker thread on Linux ([#17276](https://github.com/tailwindlabs/tailwindcss/pull/17276))
- Ensure multiple `--value(…)` or `--modifier(…)` calls don't delete subsequent declarations ([#17273](https://github.com/tailwindlabs/tailwindcss/pull/17273))
- Fix class extraction followed by `(` in Slim ([#17278](https://github.com/tailwindlabs/tailwindcss/pull/17278))
- Export `PluginUtils` from `tailwindcss/plugin` for compatibility with v3 ([#17299](https://github.com/tailwindlabs/tailwindcss/pull/17299))
- Remove redundant `line-height: initial` from Preflight ([#15212](https://github.com/tailwindlabs/tailwindcss/pull/15212))
- Increase Standalone hardware compatibility on macOS x64 builds ([#17267](https://github.com/tailwindlabs/tailwindcss/pull/17267))
- Ensure that the CSS file rebuilds if a new CSS variable is used from templates ([#17301](https://github.com/tailwindlabs/tailwindcss/pull/17301))
