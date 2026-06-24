# Upstream API delta: next 15.1.6 → 16.2.9

_This documents how the **dependency** changed.  Our own code needs to adapt; see `tasks.md`._

## MODIFIED

- **`Metadata`** (interface, 2 usage(s) in this project)
  - was: `interface Metadata extends DeprecatedMetadataFields { metadataBase?: null | URL | undefined; title?: null | string | TemplateString | undefined; description?: null | string | undefined; applicationNam …`
  - now: `interface Metadata extends DeprecatedMetadataFields { metadataBase?: null | string | URL | undefined; title?: null | string | TemplateString | undefined; description?: null | string | undefined; appli …`
- **`Metadata.metadataBase`** (variable, 2 usage(s) in this project)
  - was: `metadataBase?: null | URL | undefined;`
  - now: `metadataBase?: null | string | URL | undefined;`
- **`Metadata.other`** (variable, 2 usage(s) in this project)
  - was: `other?: ({ [name: string]: string | number | Array<string | number>; } & DeprecatedMetadataFields) | undefined;`
  - now: `other?: { [name: string]: string | number | Array<string | number>; } | undefined;`
- **`ResolvingViewport`** (type, 17 usage(s) in this project)
  - was: `type ResolvingViewport = Promise<Viewport>;`
  - now: `type ResolvingViewport = Promise<ResolvedViewport>;`
