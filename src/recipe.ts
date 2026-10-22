import type { CardOptions, CardRecipe, DateStyle } from './types.js';

export function validateDate(date: string): void {
  if (date === '') return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError('Date must be YYYY-MM-DD');
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
    throw new RangeError('Invalid calendar date');
}

export function validateRecipe(recipe: CardRecipe): void {
  if (!recipe || typeof recipe !== 'object') throw new TypeError('Card recipe required');
  if (recipe.rendererVersion !== 1) throw new RangeError('Unsupported renderer version');
  if (typeof recipe.theme !== 'string' || !recipe.theme) throw new TypeError('Background required');
  if (!Number.isFinite(recipe.seed)) throw new RangeError('Seed must be finite');
  if (typeof recipe.date !== 'string') throw new TypeError('Date must be a string');
  validateDate(recipe.date);
  if (!['en', 'numeric', 'ko'].includes(recipe.dateStyle)) throw new RangeError('Invalid date style');
  if (recipe.caption !== undefined && typeof recipe.caption !== 'string') throw new TypeError('Caption must be a string');
  if (!Array.isArray(recipe.colors) || recipe.colors.length > 256) throw new RangeError('Use at most 256 colors');
  for (const entry of recipe.colors) {
    if (!entry || !/^#[\da-f]{6}$/i.test(entry.color)) throw new TypeError('Colors must be #RRGGBB');
    if (!Number.isFinite(entry.weight) || entry.weight < 0) throw new RangeError('Weight must be non-negative');
    if (!Number.isFinite(entry.completed) || entry.completed < 0 || entry.completed > entry.weight)
      throw new RangeError('Completed must be between zero and weight');
  }
  if (!Number.isFinite(recipe.colors.reduce((sum, entry) => sum + entry.weight, 0)))
    throw new RangeError('Total weight must be finite');
}

/** Date, background, palette and seed are independent inputs. No date-based selection. */
export function createCardRecipe(options: CardOptions = {}): CardRecipe {
  const recipe: CardRecipe = {
    theme: options.background ?? 'aurora',
    seed: options.seed ?? 1,
    colors: (options.colors ?? ['#657a9e', '#d4a2a7', '#eee0c9']).map(entry => {
      if (typeof entry === 'string') return { color: entry, weight: 1, completed: 1 };
      const weight = entry.weight ?? 1;
      return { color: entry.color, weight, completed: entry.completed ?? weight };
    }),
    date: options.date ?? '',
    dateStyle: options.dateStyle ?? 'en',
    ...(options.caption === undefined ? {} : { caption: options.caption }),
    rendererVersion: 1,
  };
  validateRecipe(recipe);
  return recipe;
}

/** Pure calendar formatting; timezone and current date never affect output. */
export function formatCardDate(date: string, style: DateStyle = 'en'): [string, string] {
  validateDate(date);
  if (!date) return ['', ''];
  const [year, month, day] = date.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const label = style === 'ko' ? `${month}월 ${day}일`
    : style === 'numeric' ? `${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`
    : `${names[month - 1]} ${day}`;
  return [String(year), label];
}

export function cardDateLines(recipe: Pick<CardRecipe, 'date' | 'dateStyle'>): [string, string] {
  return formatCardDate(recipe.date, recipe.dateStyle);
}

/** Parse saved editor state without evaluating code or trusting imported properties. */
export function parseCardRecipe(json: string): CardRecipe {
  const value: unknown = JSON.parse(json);
  validateRecipe(value as CardRecipe);
  const recipe = value as CardRecipe;
  return createCardRecipe({ background: recipe.theme, colors: recipe.colors, seed: recipe.seed,
    date: recipe.date, dateStyle: recipe.dateStyle, caption: recipe.caption });
}
