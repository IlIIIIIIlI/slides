import type { OutlinePlan, OutlineSection, SemanticColorKey, PresentationBrief } from '@/core/schemas/types';

export const DEFAULT_NARRATIVE_ARC: Omit<OutlineSection, 'recommendedSlideCount' | 'candidateEvidenceIds'>[] = [
  {
    id: 'SEC-OPENING',
    name: 'Opening',
    purpose: 'Establish context, introduce the presenter and topic',
    semanticColor: 'opening' as SemanticColorKey,
  },
  {
    id: 'SEC-PROBLEM',
    name: 'Problem / Tension',
    purpose: 'Define the problem space and why it matters now',
    semanticColor: 'problem' as SemanticColorKey,
  },
  {
    id: 'SEC-EVIDENCE',
    name: 'Evidence / Research',
    purpose: 'Ground the problem in data, research, or real examples',
    semanticColor: 'data' as SemanticColorKey,
  },
  {
    id: 'SEC-SOLUTION',
    name: 'Solution',
    purpose: 'Present the core solution, architecture, or approach',
    semanticColor: 'solution' as SemanticColorKey,
  },
  {
    id: 'SEC-PROOF',
    name: 'Demo / Proof',
    purpose: 'Show the solution working in practice',
    semanticColor: 'technical' as SemanticColorKey,
  },
  {
    id: 'SEC-CLOSING',
    name: 'Closing',
    purpose: 'Next steps, call to action, recap',
    semanticColor: 'success' as SemanticColorKey,
  },
];

const SECTION_BUDGET_RATIOS: Record<string, number> = {
  opening: 0.15,
  problem: 0.15,
  evidence: 0.2,
  solution: 0.25,
  proof: 0.15,
  closing: 0.1,
};

export function createOutlinePlan(
  presentationId: string,
  brief: PresentationBrief,
): OutlinePlan {
  const total = brief.targetSlideCount ?? 12;

  const sections: OutlineSection[] = DEFAULT_NARRATIVE_ARC.map((arc, i) => {
    const key = Object.keys(SECTION_BUDGET_RATIOS)[i] ?? 'closing';
    const ratio = SECTION_BUDGET_RATIOS[key] ?? 0.1;
    return {
      ...arc,
      recommendedSlideCount: Math.max(1, Math.round(total * ratio)),
      candidateEvidenceIds: [],
    };
  });

  return {
    presentationId,
    sections,
    totalSlideCount: total,
    appendixCandidateIds: [],
    status: 'draft',
  };
}

export function computeSlideBudget(
  sections: OutlineSection[],
): Record<string, number> {
  return Object.fromEntries(sections.map((s) => [s.id, s.recommendedSlideCount]));
}

export function getSectionForSlide(
  slideIndex: number,
  sections: OutlineSection[],
): OutlineSection | undefined {
  let cursor = 0;
  for (const section of sections) {
    cursor += section.recommendedSlideCount;
    if (slideIndex < cursor) return section;
  }
  return sections[sections.length - 1];
}
