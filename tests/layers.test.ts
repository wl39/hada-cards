import { describe, expect, it, vi } from 'vitest';
import { createCardRecipe, createPaletteTexture, drawCardOverlay } from '../src/index';

describe('standalone layers', () => {
  it('produces a two-row palette without a DOM or date', () => {
    const palette = createPaletteTexture([{ color: '#40a0e0', weight: 1, completed: 1 }]);
    expect(palette).toHaveLength(256 * 2 * 4);
    for (let offset = 0; offset < palette.length; offset += 4)
      expect(Array.from(palette.slice(offset, offset + 4))).toEqual([64, 160, 224, 255]);
  });
  it('draws optional text independently and restores caller drawing state', () => {
    const context = {
      canvas: { width: 800, height: 1200 }, save: vi.fn(), restore: vi.fn(),
      fillRect: vi.fn(), fillText: vi.fn(), measureText: () => ({ width: 20 }),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
    };
    drawCardOverlay(context as unknown as CanvasRenderingContext2D, createCardRecipe());
    expect(context.fillRect).not.toHaveBeenCalled();
    expect(context.fillText).not.toHaveBeenCalled();
    drawCardOverlay(context as unknown as CanvasRenderingContext2D, createCardRecipe({ caption: 'Only a caption' }));
    expect(context.fillText.mock.calls).toEqual([['Only a caption', 72, 1128]]);
    expect(context.save).toHaveBeenCalledTimes(2);
    expect(context.restore).toHaveBeenCalledTimes(2);
  });
});
