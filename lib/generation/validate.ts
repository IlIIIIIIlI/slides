// Lightweight validator that runs against the runtime Slide[] (not SlideSpec).
// Mirrors the shape of core/validation but operates on the prompt-output schema.

import type { Slide } from "@/app/slides";

const HEADLINE_MAX = 80;
const SUPPORTING_MAX = 200;
const POINTS_MAX = 5;

export interface SlideWarning {
  slideIndex: number;
  field: string;
  message: string;
}

export function validateSlides(slides: Slide[]): SlideWarning[] {
  const warnings: SlideWarning[] = [];

  if (slides.length === 0) {
    warnings.push({ slideIndex: -1, field: "slides", message: "No slides produced." });
    return warnings;
  }

  if (slides[0].type !== "title") {
    warnings.push({ slideIndex: 0, field: "type", message: "First slide should be type 'title'." });
  }
  const last = slides[slides.length - 1];
  if (last.type !== "statement" && last.type !== "recap") {
    warnings.push({ slideIndex: slides.length - 1, field: "type", message: "Last slide should be 'statement' or 'recap'." });
  }

  slides.forEach((s, i) => {
    if (s.headline && s.headline.length > HEADLINE_MAX) {
      warnings.push({ slideIndex: i, field: "headline", message: `Headline ${s.headline.length} chars (max ${HEADLINE_MAX}).` });
    }
    if (s.supporting && s.supporting.length > SUPPORTING_MAX) {
      warnings.push({ slideIndex: i, field: "supporting", message: `Supporting ${s.supporting.length} chars (max ${SUPPORTING_MAX}).` });
    }
    if (s.points && s.points.length > POINTS_MAX) {
      warnings.push({ slideIndex: i, field: "points", message: `${s.points.length} points (max ${POINTS_MAX}).` });
    }
    if (s.type === "quote" && (!s.quote || !s.author)) {
      warnings.push({ slideIndex: i, field: "quote", message: "Quote slide is missing quote text or author." });
    }
    if (s.type === "big-number" && !s.bigNumber) {
      warnings.push({ slideIndex: i, field: "bigNumber", message: "big-number slide is missing bigNumber." });
    }
    if (!s.color) {
      warnings.push({ slideIndex: i, field: "color", message: "Slide missing color." });
    }
  });

  return warnings;
}
