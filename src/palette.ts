import type { ColorWeight } from './types.js';

export function rgb(hex: string): [number, number, number] {
  const full = /^#[\da-f]{6}$/i.test(hex) ? hex.slice(1) : "85878a";
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function colorsFor(recipe: { colors: readonly ColorWeight[] }): ColorWeight[] {
  const values = recipe.colors.filter(
    (entry) => Number.isFinite(entry.weight) && entry.weight > 0,
  );
  return values.length
    ? values
    : [{ color: "#878b91", weight: 1, completed: 0.35 }];
}

/** Completed is a count, just like weight. Unfinished work keeps its hue, softly dimmed. */
export function createPaletteTexture(colors: readonly ColorWeight[]): Uint8Array {
  const recipe = { colors };
  const values = colorsFor(recipe);
  const total = values.reduce((sum, entry) => sum + entry.weight, 0);
  const palette = new Uint8Array(256 * 4);
  let index = 0,
    edge = values[0].weight / total;
  for (let i = 0; i < 256; i++) {
    const point = (i + 0.5) / 256;
    while (index < values.length - 1 && point > edge) {
      index++;
      edge += values[index].weight / total;
    }
    const entry = values[index];
    const value = rgb(entry.color);
    const progress = Math.max(0, Math.min(1, entry.completed / entry.weight));
    const brightness = 0.68 + progress * 0.32;
    const mean = value[0] * 0.21 + value[1] * 0.72 + value[2] * 0.07;
    for (let channel = 0; channel < 3; channel++) {
      palette[i * 4 + channel] = Math.round(
        (value[channel] * (0.7 + progress * 0.3) +
          mean * (0.3 - progress * 0.3)) *
          brightness,
      );
    }
    palette[i * 4 + 3] = 255;
  }
  // One texture holds object hues and a broad wash in separate rows. Mixed
  // compositions can soften their backdrop while retaining distinct object colors.
  // Both blends are cached; each shader lookup still takes a single sample.
  const softened = new Uint8Array(256 * 2 * 4);
  for (const [row, radius] of [7, 72].entries()) {
    const kernel = Array.from({ length: radius * 2 + 1 }, (_, i) => {
      const distance = i - radius;
      return row ? Math.exp(-(distance * distance) / (2 * 24 * 24)) : 8 - Math.abs(distance);
    });
    const kernelWeight = kernel.reduce((sum, value) => sum + value, 0);
    for (let x = 0; x < 256; x++) {
      const offset = (row * 256 + x) * 4;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let d = -radius; d <= radius; d++) {
          sum += palette[Math.max(0, Math.min(255, x + d)) * 4 + c] * kernel[d + radius];
        }
        softened[offset + c] = Math.round(sum / kernelWeight);
      }
      softened[offset + 3] = 255;
    }
  }
  return softened;
}

