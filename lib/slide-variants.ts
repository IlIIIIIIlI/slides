import type { Slide } from "@/app/slides";

export type SlideType = Slide["type"];

export interface VariantOption {
  value: string;
  label: string;
}

export const SLIDE_VARIANTS: Record<SlideType, VariantOption[]> = {
  title: [
    { value: "centered", label: "Centered" },
    { value: "left", label: "Left-aligned" },
  ],
  goals: [
    { value: "list", label: "List" },
    { value: "grid", label: "Grid" },
    { value: "numbered", label: "Numbered" },
  ],
  "section-divider": [
    { value: "huge", label: "Huge" },
    { value: "minimal", label: "Minimal" },
  ],
  statement: [
    { value: "large", label: "Large" },
    { value: "tight", label: "Tight" },
  ],
  "big-number": [
    { value: "hero", label: "Hero" },
    { value: "badge", label: "Badge" },
    { value: "metrics-row", label: "Metrics row" },
  ],
  quote: [
    { value: "centered", label: "Centered" },
    { value: "card", label: "Card" },
  ],
  comparison: [
    { value: "grid", label: "Grid" },
    { value: "stats", label: "Stat cards" },
  ],
  code: [
    { value: "split", label: "Split" },
    { value: "full", label: "Full-width" },
    { value: "terminal", label: "Terminal" },
  ],
  image: [
    { value: "side", label: "Side" },
    { value: "full", label: "Full-bleed" },
  ],
  framework: [
    { value: "lead-in", label: "Lead-in" },
    { value: "cards", label: "Cards" },
  ],
  recap: [
    { value: "bullets", label: "Bullets" },
    { value: "resources", label: "Resources" },
  ],
  quiz: [
    { value: "question", label: "Question" },
  ],
  "split-visual": [
    { value: "two-col", label: "Two-column" },
    { value: "ui-mockup", label: "UI mockup" },
  ],
  iframe: [
    { value: "split", label: "Split" },
    { value: "scroll", label: "Fade scroll" },
  ],
  "agent-tree": [
    { value: "split", label: "Split" },
  ],
  chart: [
    { value: "line", label: "Line" },
    { value: "bar", label: "Bar" },
  ],
};

export const DEFAULT_VARIANT: Record<SlideType, string> = Object.fromEntries(
  Object.entries(SLIDE_VARIANTS).map(([k, v]) => [k, v[0].value])
) as Record<SlideType, string>;

export function resolveVariant(slide: Slide): string {
  return slide.variant ?? DEFAULT_VARIANT[slide.type];
}
