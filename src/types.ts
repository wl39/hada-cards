export type DateStyle = 'en' | 'numeric' | 'ko';

export interface ColorWeight {
  color: string;
  weight: number;
  /** Amount revealed, between zero and weight. Defaults to weight in createCardRecipe. */
  completed: number;
}

/** Serializable. No account, task, schedule, clock or network dependency. */
export interface CardRecipe {
  theme: string;
  seed: number;
  colors: ColorWeight[];
  /** YYYY-MM-DD, or an empty string for a card without a date. */
  date: string;
  dateStyle: DateStyle;
  caption?: string;
  rendererVersion: number;
}

export interface BackgroundDefinition {
  id: string;
  label: string;
  family: string;
  /** Stable shader uniform. Never renumber existing backgrounds. */
  index: number;
}

export interface CardOptions {
  background?: string;
  colors?: readonly (string | { color: string; weight?: number; completed?: number })[];
  seed?: number;
  date?: string;
  dateStyle?: DateStyle;
  caption?: string;
}

export interface RenderOptions {
  width?: number;
  height?: number;
  /** Omits all text and its shading. */
  backgroundOnly?: boolean;
  /** Animation phase in seconds. Zero is deterministic. */
  time?: number;
}
