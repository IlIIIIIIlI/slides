import test from "node:test";
import assert from "node:assert/strict";

import { AUDIENCE_PROFILES, getAudienceProfile } from "@/lib/generation/audience";
import { hasCriticalWarnings, validateOutline, validateSlides } from "@/lib/generation/validate";

test("normalizes free-form audience labels with technical fallback", () => {
  assert.equal(getAudienceProfile("Academic researchers").id, "academic");
  assert.equal(getAudienceProfile("Engineering team review").id, "technical");
  assert.equal(getAudienceProfile("unknown custom audience").id, "technical");
  assert.equal(getAudienceProfile("").id, "technical");
});

test("rejects unknown evidence refs", () => {
  const warnings = validateSlides(
    [{ type: "big-number", label: "DATA", color: "#fbbf24", headline: "A metric", bigNumber: "70%", evidenceRefs: ["CHK-missing"] }],
    {
      audienceProfile: AUDIENCE_PROFILES.technical,
      scope: "section",
      expectedSlideCount: 1,
      validChunkIds: new Set(["CHK-1"]),
    },
  );

  assert.equal(hasCriticalWarnings(warnings), true);
  assert.ok(warnings.some((warning) => warning.field === "evidenceRefs" && warning.message.includes("Unknown evidence ref")));
});

test("rejects quiz sections for non-quiz audience profiles", () => {
  const warnings = validateOutline(
    {
      title: "Technical Deck",
      totalSlideCount: 8,
      sections: [
        { id: "SEC-OPENING", name: "Opening", purpose: "Frame", label: "OPENING", color: "#14b8a6", slideCount: 4 },
        { id: "SEC-QUIZ", name: "Quiz", purpose: "Check", label: "CHECKPOINT", color: "#34d399", slideCount: 4 },
      ],
    },
    { audienceProfile: AUDIENCE_PROFILES.technical },
  );

  assert.equal(hasCriticalWarnings(warnings), true);
  assert.ok(warnings.some((warning) => warning.message.includes("not enabled")));
});

test("requires academic quiz sections to be final", () => {
  const warnings = validateOutline(
    {
      title: "Academic Deck",
      totalSlideCount: 12,
      sections: [
        { id: "SEC-QUIZ", name: "Quiz", purpose: "Check", label: "CHECKPOINT", color: "#34d399", slideCount: 2 },
        { id: "SEC-CORE", name: "Core", purpose: "Teach", label: "CORE", color: "#a78bfa", slideCount: 10 },
      ],
    },
    { audienceProfile: AUDIENCE_PROFILES.academic },
  );

  assert.equal(hasCriticalWarnings(warnings), true);
  assert.ok(warnings.some((warning) => warning.message.includes("must be the final section")));
});

test("rejects academic factual slides without evidence refs", () => {
  const warnings = validateSlides(
    [{ type: "statement", label: "CORE", color: "#a78bfa", headline: "Source-backed claim" }],
    {
      audienceProfile: AUDIENCE_PROFILES.academic,
      scope: "section",
      expectedSlideCount: 1,
      validChunkIds: new Set(["CHK-1"]),
    },
  );

  assert.equal(hasCriticalWarnings(warnings), true);
  assert.ok(warnings.some((warning) => warning.field === "evidenceRefs"));
});
