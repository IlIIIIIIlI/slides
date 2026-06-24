# Ship slides as an MCP skill: `npx skills add` your own deck generator

## Why

Package lib/generation as an MCP skill (mirroring hyperframes' `npx skills add` pattern) so Claude/Cursor/Gemini can author SlideSpec JSON directly against your schemas, call the existing app/api endpoints, and preview via the player. The novel bit is exposing core/schemas as the MCP tool surface — agents get typed slide primitives, not freeform HTML — which turns the project into a reusable agent skill rather than just an app.

## Inspired by

- https://github.com/heygen-com/hyperframes
- https://github.com/CopilotKit/CopilotKit


## Decision

- [ ] **Adopt** — proceed with `tasks.md`
- [ ] **Defer** / **Reject**

_novelty 4/5 · effort 2/5 · promoted from a Project Steward idea you approved._
