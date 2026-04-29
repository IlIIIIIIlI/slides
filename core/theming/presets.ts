import type { ThemePreset } from '@/core/schemas/types';

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'preset_light_minimal_01',
    family: 'light-editorial',
    name: 'Light Minimal',
    description: 'Clean white canvas with strong typographic hierarchy. The current default.',
    backgroundMode: 'light',
    displayFont: 'Geist Sans',
    bodyFont: 'Geist Sans',
    monoFont: 'Geist Mono',
    semanticColors: {
      opening: '#14b8a6',
      problem: '#f87171',
      solution: '#a78bfa',
      data: '#fbbf24',
      success: '#34d399',
      technical: '#60a5fa',
      highlight: '#f472b6',
    },
    tokens: {
      background: '#fafafa',
      surface1: '#ffffff',
      surface2: '#f0f0f2',
      surface3: '#d4d4d8',
      foreground: '#09090b',
      textPrimary: '#09090b',
      textSecondary: '#52525b',
      textMuted: '#71717a',
      textFaint: '#d4d4d8',
      borderColor: '#e4e4e7',
      radius: '0.75rem',
      motionLevel: 'subtle',
      citationDisplayMode: 'footer',
    },
  },
  {
    id: 'preset_dark_minimal_01',
    family: 'dark-minimal',
    name: 'Dark Minimal',
    description: 'High-contrast dark canvas. Ideal for technical and investor audiences.',
    backgroundMode: 'dark',
    displayFont: 'Geist Sans',
    bodyFont: 'Geist Sans',
    monoFont: 'Geist Mono',
    semanticColors: {
      opening: '#2dd4bf',
      problem: '#fb7185',
      solution: '#c084fc',
      data: '#fcd34d',
      success: '#4ade80',
      technical: '#60a5fa',
      highlight: '#f9a8d4',
    },
    tokens: {
      background: '#09090b',
      surface1: '#111113',
      surface2: '#1c1c1e',
      surface3: '#2a2a2e',
      foreground: '#fafafa',
      textPrimary: '#fafafa',
      textSecondary: '#a1a1aa',
      textMuted: '#71717a',
      textFaint: '#3f3f46',
      borderColor: '#27272a',
      radius: '0.75rem',
      motionLevel: 'subtle',
      citationDisplayMode: 'footer',
    },
  },
  {
    id: 'preset_technical_terminal_01',
    family: 'technical-terminal',
    name: 'Technical Terminal',
    description: 'Monospace-first, terminal-inspired. Emphasizes code and system diagrams.',
    backgroundMode: 'dark',
    displayFont: 'Geist Mono',
    bodyFont: 'Geist Mono',
    monoFont: 'Geist Mono',
    semanticColors: {
      opening: '#00ff88',
      problem: '#ff4444',
      solution: '#aa88ff',
      data: '#ffcc00',
      success: '#00cc66',
      technical: '#4488ff',
      highlight: '#ff88bb',
    },
    tokens: {
      background: '#0a0f0a',
      surface1: '#0f170f',
      surface2: '#172017',
      surface3: '#1f2e1f',
      foreground: '#c8ffc8',
      textPrimary: '#c8ffc8',
      textSecondary: '#88bb88',
      textMuted: '#557755',
      textFaint: '#2a3e2a',
      borderColor: '#1f2e1f',
      radius: '0.25rem',
      motionLevel: 'none',
      citationDisplayMode: 'appendix',
    },
  },
];

export function getPresetById(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}

export function getPresetsByFamily(family: string): ThemePreset[] {
  return THEME_PRESETS.filter((p) => p.family === family);
}

export const DEFAULT_PRESET_ID = 'preset_light_minimal_01';

export const SEMANTIC_COLOR_LABELS: Record<string, string> = {
  opening: 'Opening',
  problem: 'Problem / Tension',
  solution: 'Solution / Answer',
  data: 'Data / Evidence',
  success: 'Success / Outcome',
  technical: 'Technical / Architecture',
  highlight: 'Highlight / CTA',
};

export const ANTI_PATTERNS = [
  'generic purple gradient on white',
  'indigo as default primary with no semantic meaning',
  'excessive card grid layouts',
  'dense bullet forests (>5 points)',
  'random mixed font families',
  'multi-color palette with no semantic mapping',
  'animation without narrative purpose',
];
