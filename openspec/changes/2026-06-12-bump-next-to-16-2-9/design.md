# Design

## Migration approach

Three options, in order of recommendation:

1. **Codemod**: write a single transform that rewrites all 23 call-sites. Best when the API change is mechanical.
2. **Manual file-by-file**: walk the list in `tasks.md`, adapt each site. Best when semantics shifted.
3. **Wrap-and-adapt**: introduce a thin internal shim mirroring the old API; revisit later. Best as a stopgap.

## Risks

- Type-checker may flag transitive uses not in this proposal — re-run `steward analyze` after edits.
- Behavior changes that don't break compilation (e.g. default option flips) won't show here. Read the upstream changelog.
