import type { CardRecipe } from './types.js';
import { cardDateLines } from './recipe.js';

/** Add just the optional date/caption layer to any 2D canvas. */
export function drawCardOverlay(
  context: CanvasRenderingContext2D,
  recipe: Pick<CardRecipe, 'date' | 'dateStyle' | 'caption'>,
  width = context.canvas.width,
  height = context.canvas.height,
): void {
  context.save();
  try {
  if (recipe.date || recipe.caption) {
  const shade = context.createLinearGradient(0, height * 0.54, 0, height);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,.48)");
  context.fillStyle = shade;
  context.fillRect(0, 0, width, height);
    const padding = width * 0.09;
    const [year, date] = cardDateLines(recipe);
    context.fillStyle = "#fff";
    context.textBaseline = "bottom";
    context.font = `500 ${Math.round(width * 0.063)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    if (recipe.date) context.fillText(year, padding, height - padding - width * 0.11);
    context.font = `500 ${Math.round(width * 0.085)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    if (recipe.date) context.fillText(date, padding, height - padding);
    if (recipe.caption?.trim()) {
      context.font = `400 ${Math.round(width * 0.043)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      context.fillStyle = "rgba(255,255,255,.86)";
      const chars = Array.from(recipe.caption.trim().replace(/\s+/g, " "));
      let line = "";
      for (const char of chars) {
        if (context.measureText(line + char + "…").width > width - padding * 2) {
          line += "…";
          break;
        }
        line += char;
      }
      context.fillText(line, padding, height - padding - (recipe.date ? width * 0.25 : 0));
    }
  }
  } finally { context.restore(); }
}
