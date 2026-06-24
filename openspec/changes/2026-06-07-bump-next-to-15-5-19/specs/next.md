# Upstream API delta: next 15.1.6 → 15.5.19

_This documents how the **dependency** changed.  Our own code needs to adapt; see `tasks.md`._

## MODIFIED

- **`Metadata`** (interface, 2 usage(s) in this project)
  - was: `interface Metadata extends DeprecatedMetadataFields { metadataBase?: null | URL | undefined; title?: null | string | TemplateString | undefined; description?: null | string | undefined; applicationNam …`
  - now: `interface Metadata extends DeprecatedMetadataFields { metadataBase?: null | URL | undefined; title?: null | string | TemplateString | undefined; description?: null | string | undefined; applicationNam …`
