import { describe, expect, it } from 'vitest';
import { BACKGROUNDS, createCardRecipe, formatCardDate, parseCardRecipe, createCardRenderer } from '../src/index';

describe('independent composition', () => {
  it('changing the date does not select another background, palette or seed', () => {
    const a = createCardRecipe({ date: '2026-10-23', colors: ['#112233'] });
    const b = createCardRecipe({ date: '2040-02-29', colors: ['#112233'] });
    expect({ ...a, date: b.date }).toEqual(b);
    expect(createCardRecipe().date).toBe('');
  });
  it('accepts arbitrary palettes and preserves ratios without mutating inputs', () => {
    const colors = [{ color: '#123456', weight: 3 }, { color: '#abcdef', weight: 1, completed: .5 }];
    const before = JSON.stringify(colors);
    const recipe = createCardRecipe({ background: 'mosaic', colors, seed: 77, caption: 'Hello' });
    expect(recipe.colors).toEqual([{ color: '#123456', weight: 3, completed: 3 }, { color: '#abcdef', weight: 1, completed: .5 }]);
    expect(JSON.stringify(colors)).toBe(before);
    expect(parseCardRecipe(JSON.stringify(recipe))).toEqual(recipe);
  });
  it('formats optional calendar dates without timezone shifts', () => {
    expect(formatCardDate('2024-02-29', 'en')).toEqual(['2024', 'Feb 29']);
    expect(formatCardDate('2026-01-01', 'numeric')).toEqual(['2026', '01.01']);
    expect(formatCardDate('2026-12-31', 'ko')).toEqual(['2026', '12월 31일']);
    expect(formatCardDate('')).toEqual(['', '']);
    for (const date of ['2023-02-29', '2026-13-01', 'invalid', '2026-2-3']) expect(() => formatCardDate(date)).toThrow();
  });
  it('rejects non-finite inputs, unsupported versions and invalid imported colors', () => {
    for (const options of [{ seed: NaN }, { colors: ['red'] }, { colors: [{ color: '#123456', weight: -1 }] }, { colors: [{ color: '#123456', weight: 1, completed: 2 }] }])
      expect(() => createCardRecipe(options)).toThrow();
    expect(() => parseCardRecipe(JSON.stringify({ ...createCardRecipe(), rendererVersion: 2 }))).toThrow();
    expect(() => parseCardRecipe('null')).toThrow();
  });
  it('preserves released indices while allowing new original backgrounds', () => {
    expect(BACKGROUNDS.length).toBeGreaterThanOrEqual(48);
    expect(new Set(BACKGROUNDS.map(b => b.index)).size).toBe(BACKGROUNDS.length);
    expect(new Set(BACKGROUNDS.map(b => b.id)).size).toBe(BACKGROUNDS.length);
    expect(BACKGROUNDS.slice(0, 48).map(b => b.index)).toEqual([0, 1, 2, 3, ...Array.from({ length: 44 }, (_, i) => i + 8)]);
    const renderer = createCardRenderer();
    expect(() => renderer.renderCardDataUrl(createCardRecipe({ background: 'silk' }))).toThrow('Unknown background');
    renderer.dispose();
    expect(() => renderer.renderCardDataUrl(createCardRecipe())).toThrow('disposed');
  });
});
