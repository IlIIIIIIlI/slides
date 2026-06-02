# slides
# slides

## Auto-Animate / Flip Morphing

The player supports GSAP Flip-style element morphing between consecutive slides. Shared elements (title, code blocks) automatically morph position and size during navigation.

### Setting `animKey` on blocks

In a `SlideSpec`, add `animKey` to any `ContentBlock` to give it a stable identity across slides:

```json
{
  "contentBlocks": [
    { "type": "headline", "content": "My Slide Title", "animKey": "main-title" },
    { "type": "code-block", "content": "console.log('hello')" }
  ]
}
```

If `animKey` is omitted, the system auto-derives one:
- `headline` → `"title"`
- `code-block` → `"code:0"`, `"code:1"`, … (by occurrence)

Any block without a key (e.g., `supporting`, `bullet-list`) does not participate in morphing.

### Disabling morphing for a deck

Set `"autoAnimate": false` at the presentation level to disable all morphing for that deck:

```json
{
  "id": "...",
  "autoAnimate": false,
  "slides": [ ... ]
}
```

### Reduced-motion

Morphing is automatically disabled when the user's OS preference is `prefers-reduced-motion: reduce`.
