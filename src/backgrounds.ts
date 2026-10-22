import type { BackgroundDefinition } from './types.js';

export const THEME_FAMILIES = ['atmosphere', 'fluid', 'geometry', 'light', 'space', 'organic', 'pattern'] as const;
export type ThemeFamily = (typeof THEME_FAMILIES)[number];
export const THEME_FAMILY_LABELS: Record<ThemeFamily, { ko: string; en: string }> = {
  atmosphere: { ko: '하늘', en: 'Atmosphere' },
  fluid: { ko: '흐름', en: 'Fluid' },
  geometry: { ko: '도형', en: 'Geometry' },
  light: { ko: '빛', en: 'Light' },
  space: { ko: '우주', en: 'Space' },
  organic: { ko: '자연', en: 'Nature' },
  pattern: { ko: '패턴', en: 'Pattern' },
};

/** Append only. These indices are also the uniform values used by saved artwork. */
export const BACKGROUNDS = [
  { id: 'aurora', label: 'Aurora', family: 'atmosphere', index: 0 },
  { id: 'current', label: 'Current', family: 'fluid', index: 1 },
  { id: 'cloud', label: 'Cloud', family: 'atmosphere', index: 2 },
  { id: 'horizon', label: 'Horizon', family: 'light', index: 3 },
  { id: 'dunes', label: 'Dunes', family: 'fluid', index: 8 },
  { id: 'marble', label: 'Marble', family: 'fluid', index: 9 },
  { id: 'ink', label: 'Ink', family: 'fluid', index: 10 },
  { id: 'chrome', label: 'Chrome', family: 'fluid', index: 11 },
  { id: 'contours', label: 'Contours', family: 'fluid', index: 12 },
  { id: 'lava', label: 'Lava', family: 'fluid', index: 13 },
  { id: 'ocean', label: 'Ocean', family: 'fluid', index: 14 },
  { id: 'smoke', label: 'Smoke', family: 'fluid', index: 15 },
  { id: 'prism', label: 'Prism', family: 'geometry', index: 16 },
  { id: 'mosaic', label: 'Mosaic', family: 'geometry', index: 17 },
  { id: 'tessera', label: 'Tessera', family: 'geometry', index: 18 },
  { id: 'kaleidoscope', label: 'Kaleidoscope', family: 'geometry', index: 19 },
  { id: 'origami', label: 'Origami', family: 'geometry', index: 20 },
  { id: 'truchet', label: 'Truchet', family: 'geometry', index: 21 },
  { id: 'chevrons', label: 'Chevrons', family: 'geometry', index: 22 },
  { id: 'hexagons', label: 'Hexagons', family: 'geometry', index: 23 },
  { id: 'beams', label: 'Beams', family: 'light', index: 24 },
  { id: 'rays', label: 'Rays', family: 'light', index: 25 },
  { id: 'eclipse', label: 'Eclipse', family: 'light', index: 26 },
  { id: 'portal', label: 'Portal', family: 'light', index: 27 },
  { id: 'neon', label: 'Neon', family: 'light', index: 28 },
  { id: 'spectrum', label: 'Spectrum', family: 'light', index: 29 },
  { id: 'caustics', label: 'Caustics', family: 'light', index: 30 },
  { id: 'halftone', label: 'Halftone', family: 'light', index: 31 },
  { id: 'stars', label: 'Stars', family: 'space', index: 32 },
  { id: 'galaxy', label: 'Galaxy', family: 'space', index: 33 },
  { id: 'nebula', label: 'Nebula', family: 'space', index: 34 },
  { id: 'orbits', label: 'Orbits', family: 'space', index: 35 },
  { id: 'meteors', label: 'Meteors', family: 'space', index: 36 },
  { id: 'constellation', label: 'Constellation', family: 'space', index: 37 },
  { id: 'cells', label: 'Cells', family: 'organic', index: 38 },
  { id: 'petals', label: 'Petals', family: 'organic', index: 39 },
  { id: 'fern', label: 'Fern', family: 'organic', index: 40 },
  { id: 'ripples', label: 'Ripples', family: 'organic', index: 41 },
  { id: 'rain', label: 'Rain', family: 'organic', index: 42 },
  { id: 'fireflies', label: 'Fireflies', family: 'organic', index: 43 },
  { id: 'woven', label: 'Woven', family: 'pattern', index: 44 },
  { id: 'topography', label: 'Topography', family: 'pattern', index: 45 },
  { id: 'moire', label: 'Moiré', family: 'pattern', index: 46 },
  { id: 'dots', label: 'Dot Matrix', family: 'pattern', index: 47 },
  { id: 'circuit', label: 'Circuit', family: 'pattern', index: 48 },
  { id: 'ribbons', label: 'Ribbons', family: 'pattern', index: 49 },
  { id: 'wavegrid', label: 'Wave Grid', family: 'pattern', index: 50 },
  { id: 'checker', label: 'Checker', family: 'pattern', index: 51 },
 ] as const satisfies readonly BackgroundDefinition[];

export type BackgroundId = (typeof BACKGROUNDS)[number]['id'];

export const CONTINUOUS_COLOR_THEMES: ReadonlySet<string> = new Set([
  'aurora', 'current', 'cloud', 'horizon',
  'marble', 'chrome', 'contours', 'lava', 'ocean', 'smoke', 'prism',
  'rays', 'eclipse', 'portal', 'neon', 'caustics', 'halftone', 'stars', 'galaxy',
  'nebula', 'petals', 'fern', 'ripples', 'topography', 'moire', 'dots', 'wavegrid',
]);
