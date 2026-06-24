import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SLIDE_TYPES,
  AUDIENCE_TYPES,
  STYLE_PRESETS,
  SLIDE_TYPE_DESCRIPTIONS,
  SLIDE_JSON_SCHEMA,
  PRESENTATION_JSON_SCHEMA,
} from "./schema";

describe("mcp/schema", () => {
  it("SLIDE_TYPES has 16 entries", () => {
    assert.equal(SLIDE_TYPES.length, 16);
  });

  it("every SLIDE_TYPE has a description", () => {
    for (const t of SLIDE_TYPES) {
      assert.ok(
        SLIDE_TYPE_DESCRIPTIONS[t],
        `Missing description for slide type "${t}"`,
      );
    }
  });

  it("SLIDE_JSON_SCHEMA has required fields", () => {
    assert.deepEqual(SLIDE_JSON_SCHEMA.required, ["type"]);
    assert.ok(SLIDE_JSON_SCHEMA.properties.type);
    assert.ok(SLIDE_JSON_SCHEMA.properties.headline);
    assert.ok(SLIDE_JSON_SCHEMA.properties.points);
  });

  it("SLIDE_JSON_SCHEMA type enum matches SLIDE_TYPES", () => {
    const schemaEnum = (SLIDE_JSON_SCHEMA.properties.type as { enum: readonly string[] }).enum;
    assert.deepEqual([...schemaEnum].sort(), [...SLIDE_TYPES].sort());
  });

  it("headline has maxLength 80", () => {
    const h = SLIDE_JSON_SCHEMA.properties.headline as { maxLength: number };
    assert.equal(h.maxLength, 80);
  });

  it("supporting has maxLength 200", () => {
    const s = SLIDE_JSON_SCHEMA.properties.supporting as { maxLength: number };
    assert.equal(s.maxLength, 200);
  });

  it("points has maxItems 5", () => {
    const p = SLIDE_JSON_SCHEMA.properties.points as { maxItems: number };
    assert.equal(p.maxItems, 5);
  });

  it("AUDIENCE_TYPES has 3 entries", () => {
    assert.equal(AUDIENCE_TYPES.length, 3);
    assert.ok((AUDIENCE_TYPES as readonly string[]).includes("technical"));
    assert.ok((AUDIENCE_TYPES as readonly string[]).includes("academic"));
    assert.ok((AUDIENCE_TYPES as readonly string[]).includes("winston"));
  });

  it("STYLE_PRESETS has expected values", () => {
    assert.ok((STYLE_PRESETS as readonly string[]).includes("minimal"));
    assert.ok((STYLE_PRESETS as readonly string[]).includes("bold"));
  });

  it("PRESENTATION_JSON_SCHEMA requires id, title, slides", () => {
    assert.deepEqual(PRESENTATION_JSON_SCHEMA.required, ["id", "title", "slides"]);
  });
});
