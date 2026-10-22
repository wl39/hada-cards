import type { CardRecipe, ColorWeight, BackgroundDefinition, RenderOptions } from './types.js';
import { fragmentSource, vertexSource } from './shaders.js';
import { BACKGROUNDS, CONTINUOUS_COLOR_THEMES } from './backgrounds.js';
import { validateRecipe } from './recipe.js';
import { drawCardOverlay } from './date-layer.js';
import { rgb, colorsFor, createPaletteTexture } from './palette.js';

export type AnimationMode = 'thumbnail' | 'full';
export interface RendererConfiguration {
  backgrounds?: readonly BackgroundDefinition[];
  continuousThemes?: ReadonlySet<string>;
  fragmentSource?: string;
  vertexSource?: string;
}

/** Each instance owns its GPU, caches and scheduling; applications can supply extensions. */
export function createCardRenderer(configuration: RendererConfiguration = {}) {
  const backgrounds = configuration.backgrounds ?? BACKGROUNDS;
  const themeIndex = Object.fromEntries(backgrounds.map(background => [background.id, background.index]));
  const continuousThemes = configuration.continuousThemes ?? CONTINUOUS_COLOR_THEMES;
  let disposed = false;
  function assertActive() {
    if (disposed) throw new Error('Renderer has been disposed');
  }
  function assertRecipe(recipe: CardRecipe) {
    assertActive();
    validateRecipe(recipe);
    if (!Object.hasOwn(themeIndex, recipe.theme)) throw new RangeError(`Unknown background: ${recipe.theme}`);
  }
const CACHE_LIMIT = 180;
const imageCache = new Map<string, string>();
const paletteCache = new Map<string, Uint8Array>();
const pending = new Map<string, Promise<string>>();
let sharedEngine: ArtworkEngine | null | undefined;
let renderQueue = Promise.resolve();
let fallbackSurface: HTMLCanvasElement | undefined;

function paletteBytes(recipe: CardRecipe): Uint8Array {
  const key = JSON.stringify(recipe.colors);
  const cached = paletteCache.get(key);
  if (cached) return cached;
  const palette = createPaletteTexture(recipe.colors);
  paletteCache.set(key, palette);
  if (paletteCache.size > CACHE_LIMIT) paletteCache.delete(paletteCache.keys().next().value!);
  return palette;
}

class ArtworkEngine {
  readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGLRenderingContext;
  private readonly program: WebGLProgram;
  private readonly textures = new Map<string, WebGLTexture>();
  private readonly buffer: WebGLBuffer;
  private readonly locations: Record<string, WebGLUniformLocation | null>;

  constructor(canvas = document.createElement("canvas")) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL unavailable");
    this.gl = gl;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Shader unavailable");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message =
          gl.getShaderInfoLog(shader) ?? "Shader compilation failed";
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, configuration.vertexSource ?? vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, configuration.fragmentSource ?? fragmentSource);
    const program = gl.createProgram();
    if (!program) throw new Error("Renderer unavailable");
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("Renderer unavailable");
    this.program = program;
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error("Renderer unavailable");
    this.buffer = buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    this.locations = Object.fromEntries(
      ["u_resolution", "u_seed", "u_time", "u_theme", "u_palette", "u_palette_row"].map(
        (key) => [key, gl.getUniformLocation(program, key)],
      ),
    );
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(this.locations.u_palette, 0);
  }

  private resize(width: number, height: number): void {
    const gl = this.gl;
    if (gl.isContextLost()) throw new Error("Graphics context lost");
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  private drawTile(
    recipe: CardRecipe,
    width: number,
    height: number,
    time: number,
  ): void {
    const gl = this.gl;
    const key = JSON.stringify(recipe.colors);
    let texture = this.textures.get(key);
    if (!texture) {
      texture = gl.createTexture() ?? undefined;
      if (!texture) throw new Error("Palette unavailable");
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        256,
        2,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        paletteBytes(recipe),
      );
      this.textures.set(key, texture);
      if (this.textures.size > CACHE_LIMIT) {
        const oldest = this.textures.keys().next().value!;
        gl.deleteTexture(this.textures.get(oldest)!);
        this.textures.delete(oldest);
      }
    } else gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform2f(this.locations.u_resolution, width, height);
    gl.uniform1f(this.locations.u_seed, (Math.abs(recipe.seed) % 100000) / 31);
    gl.uniform1f(this.locations.u_time, time);
    gl.uniform1f(this.locations.u_theme, themeIndex[recipe.theme]);
    gl.uniform1f(this.locations.u_palette_row, continuousThemes.has(recipe.theme) ? 0.75 : 0.25);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  draw(recipe: CardRecipe, width: number, height: number, time = 0): void {
    this.resize(width, height);
    this.gl.disable(this.gl.SCISSOR_TEST);
    this.gl.viewport(0, 0, width, height);
    this.drawTile(recipe, width, height, time);
  }

  /** Submit every tile before any canvas copy; keep one stable GPU allocation. */
  drawAtlas(tiles: AtlasTile[], width: number, height: number): void {
    this.resize(width, height);
    const gl = this.gl;
    gl.enable(gl.SCISSOR_TEST);
    for (const tile of tiles) {
      const y = height - tile.y - tile.height;
      gl.viewport(tile.x, y, tile.width, tile.height);
      gl.scissor(tile.x, y, tile.width, tile.height);
      this.drawTile(
        tile.entry.recipe,
        tile.width,
        tile.height,
        tile.entry.elapsed,
      );
    }
    gl.disable(gl.SCISSOR_TEST);
    gl.flush();
  }

  destroy(): void {
    const gl = this.gl;
    gl.deleteBuffer(this.buffer);
    for (const texture of this.textures.values()) gl.deleteTexture(texture);
    gl.deleteProgram(this.program);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

function getSharedEngine(): ArtworkEngine | null {
  if (sharedEngine === undefined) {
    try {
      sharedEngine = new ArtworkEngine();
    } catch {
      sharedEngine = null;
    }
  }
  return sharedEngine;
}

/** A deterministic Canvas2D fallback also serves browsers with WebGL disabled. */
function drawFallback(
  recipe: CardRecipe,
  width: number,
  height: number,
  time = 0,
  canvas = document.createElement("canvas"),
): HTMLCanvasElement {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  const colors = colorsFor(recipe);
  context.fillStyle = "#202326";
  context.fillRect(0, 0, width, height);
  let value = recipe.seed >>> 0;
  const random = () => {
    value = (Math.imul(1664525, value) + 1013904223) >>> 0;
    return value / 4294967296;
  };
  for (let i = 0; i < 24; i++) {
    const color = colors[i % colors.length];
    const [r, g, b] = rgb(color.color);
    const x =
      random() * width +
      (Math.sin(time * 0.2 + i * 1.73) - Math.sin(i * 1.73)) * width * 0.12;
    const y =
      random() * height +
      (Math.cos(time * 0.16 + i * 0.93) - Math.cos(i * 0.93)) * height * 0.08;
    const radius = width * (0.25 + random() * 0.65);
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    const opacity = 0.28 + Math.min(1, color.completed / color.weight) * 0.25;
    gradient.addColorStop(0, `rgba(${r},${g},${b},${opacity})`);
    gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }
  return canvas;
}

function artworkCanvas(
  recipe: CardRecipe,
  width: number,
  height: number,
  time = 0,
): HTMLCanvasElement {
  const engine = getSharedEngine();
  if (engine) {
    try {
      engine.draw(recipe, width, height, time);
      return engine.canvas;
    } catch {
      engine.destroy();
      sharedEngine = null;
    }
  }
  fallbackSurface ??= document.createElement("canvas");
  return drawFallback(recipe, width, height, time, fallbackSurface);
}

function cachedCardDataUrl(recipe: CardRecipe): string | undefined {
  return imageCache.get(JSON.stringify(recipe));
}

/** Static previews and animated cards share the same single WebGL renderer. */
function renderCardDataUrl(recipe: CardRecipe): Promise<string> {
  assertRecipe(recipe);
  const key = JSON.stringify(recipe);
  const cached = imageCache.get(key);
  if (cached) return Promise.resolve(cached);
  const existing = pending.get(key);
  if (existing) return existing;
  const request = new Promise<string>((resolve, reject) => {
    renderQueue = renderQueue.then(
      () =>
        new Promise<void>((finish) => {
          const render = () => {
            try {
              assertActive();
              const result = artworkCanvas(recipe, 240, 360).toDataURL(
                "image/webp",
                0.86,
              );
              imageCache.set(key, result);
              if (imageCache.size > CACHE_LIMIT)
                imageCache.delete(imageCache.keys().next().value!);
              resolve(result);
            } catch (error) {
              reject(error);
            } finally {
              pending.delete(key);
              finish();
            }
          };
          // Yield between cards so navigation and task entry remain responsive.
          setTimeout(render, 0);
        }),
    );
  });
  pending.set(key, request);
  return request;
}

async function renderCardBlob(
  recipe: CardRecipe,
  options: RenderOptions = {},
): Promise<Blob> {
  assertRecipe(recipe);
  const dimension = (value: number, min: number, max: number) => {
    if (!Number.isFinite(value)) throw new RangeError('Dimensions must be finite');
    return Math.max(min, Math.min(max, Math.round(value)));
  };
  const width = dimension(options.width ?? 1200, 64, 2400);
  const height = dimension(options.height ?? width * 1.5, 96, 3600);
  const time = options.time ?? 0;
  if (!Number.isFinite(time) || time < 0) throw new RangeError('Time must be non-negative');
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.drawImage(artworkCanvas(recipe, width, height, time), 0, 0);
  if (!options.backgroundOnly) drawCardOverlay(context, recipe, width, height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Image export failed")),
      "image/png",
    ),
  );
}


interface AnimationEntry {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  recipe: CardRecipe;
  mode: AnimationMode;
  visible: boolean;
  elapsed: number;
  previousTick?: number;
  boostRemaining: number;
  dirty: boolean;
  onError?: () => void;
}

const animations = new Map<HTMLCanvasElement, AnimationEntry>();
let animationFrame = 0;
let intersection: IntersectionObserver | undefined;
let modalObserver: MutationObserver | undefined;
let motionPreference: MediaQueryList | undefined;

function wakeAnimations(): void {
  if (!animationFrame && animations.size && !document.hidden) {
    animationFrame = requestAnimationFrame(drawAnimations);
  }
}

function restartAnimations(): void {
  previousAnimationTimestamp = undefined;
  measurementStart = undefined;
  measuredFrames = 0;
  measuredWorkMs = 0;
  for (const entry of animations.values()) {
    entry.previousTick = undefined;
    entry.dirty = true;
  }
  if (document.hidden) {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  } else wakeAnimations();
}

interface AtlasTile {
  entry: AnimationEntry;
  x: number;
  y: number;
  width: number;
  height: number;
}

let renderScale = 1;
let previousAnimationTimestamp: number | undefined;
let fastestFrameMs = 1000 / 60;
let measurementStart: number | undefined;
let measuredFrames = 0;
let measuredWorkMs = 0;
let healthyWindows = 0;

function packAtlas(entries: AnimationEntry[]): {
  tiles: AtlasTile[];
  width: number;
  height: number;
} {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  // Read every DOM size before writing canvas dimensions. Interleaving these
  // operations forced layout once per card in the earlier renderer.
  const dimensions = entries.map((entry) => {
    const base =
      entry.mode === "thumbnail"
        ? Math.min(
            192,
            Math.max(96, Math.round(entry.canvas.clientWidth * pixelRatio)),
          )
        : Math.min(
            720,
            Math.max(180, Math.round(entry.canvas.clientWidth * pixelRatio)),
          );
    return { entry, base };
  });
  const area = dimensions.reduce(
    (sum, item) => sum + item.base * item.base * 1.5,
    0,
  );
  const scale = Math.min(renderScale, Math.sqrt(900_000 / Math.max(1, area)));
  const tiles: AtlasTile[] = dimensions
    .map(({ entry, base }) => {
      const width = Math.max(32, Math.round((base * scale) / 2) * 2);
      return { entry, width, height: Math.round(width * 1.5), x: 0, y: 0 };
    })
    .sort((a, b) => b.height - a.height);
  const actualArea = tiles.reduce(
    (sum, tile) => sum + tile.width * tile.height,
    0,
  );
  const rowWidth = Math.max(
    ...tiles.map((tile) => tile.width),
    Math.ceil(Math.sqrt(actualArea) / 16) * 16,
  );
  let x = 0,
    y = 0,
    rowHeight = 0,
    width = 0;
  for (const tile of tiles) {
    if (x && x + tile.width > rowWidth) {
      y += rowHeight;
      x = 0;
      rowHeight = 0;
    }
    tile.x = x;
    tile.y = y;
    x += tile.width;
    rowHeight = Math.max(rowHeight, tile.height);
    width = Math.max(width, x);
  }
  return { tiles, width, height: y + rowHeight };
}

function publishFrameMetrics(
  timestamp: number,
  workMs: number,
  tiles: AtlasTile[],
  atlasWidth: number,
  atlasHeight: number,
): void {
  if (measurementStart === undefined) measurementStart = timestamp;
  measuredFrames++;
  measuredWorkMs += workMs;
  const duration = timestamp - measurementStart;
  if (duration < 750) return;
  const fps = ((measuredFrames - 1) * 1000) / duration;
  const averageWork = measuredWorkMs / measuredFrames;
  const averageFrame = duration / Math.max(1, measuredFrames - 1);
  for (const { entry } of tiles) {
    Object.assign(entry.canvas.dataset, {
      frameRate: fps.toFixed(1),
      renderMs: averageWork.toFixed(2),
      renderScale: renderScale.toFixed(2),
      activeCards: String(tiles.length),
      renderer: sharedEngine ? "webgl-atlas" : "canvas-fallback",
      atlasWidth: String(atlasWidth),
      atlasHeight: String(atlasHeight),
    });
  }
  // Preserve cadence first. Lower pixel cost when frames miss the observed
  // display budget, then cautiously restore detail after sustained headroom.
  if (
    averageFrame > fastestFrameMs * 1.3 ||
    averageWork > fastestFrameMs * 0.85
  ) {
    renderScale = Math.max(0.5, renderScale * 0.86);
    healthyWindows = 0;
  } else if (
    averageFrame <= fastestFrameMs * 1.15 &&
    averageWork < fastestFrameMs * 0.55
  ) {
    healthyWindows++;
    if (healthyWindows >= 3) {
      renderScale = Math.min(1, renderScale + 0.08);
      healthyWindows = 0;
    }
  } else healthyWindows = 0;
  measurementStart = timestamp;
  measuredFrames = 1;
  measuredWorkMs = 0;
}

function drawAnimations(timestamp: number): void {
  animationFrame = 0;
  if (document.hidden) return;
  const started = performance.now();
  const dialogs = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
  const topDialog = dialogs[dialogs.length - 1];
  const reduced = motionPreference?.matches ?? false;
  const active: AnimationEntry[] = [];
  for (const entry of animations.values()) {
    const { canvas } = entry;
    const visible =
      entry.visible &&
      canvas.isConnected &&
      canvas.clientWidth > 0 &&
      !canvas.closest("[inert]") &&
      (!topDialog || topDialog.contains(canvas));
    if (!visible) {
      entry.previousTick = undefined;
      continue;
    }
    if (reduced && !entry.dirty) continue;
    const delta =
      entry.previousTick === undefined
        ? 0
        : Math.min(0.12, Math.max(0, (timestamp - entry.previousTick) / 1000));
    entry.previousTick = timestamp;
    if (!reduced) {
      const boost = entry.boostRemaining / 2;
      entry.elapsed += delta * (1.35 + 5.4 * boost * boost);
      entry.boostRemaining = Math.max(0, entry.boostRemaining - delta);
    }
    active.push(entry);
  }
  if (!active.length) {
    previousAnimationTimestamp = undefined;
    measurementStart = undefined;
    measuredFrames = 0;
    measuredWorkMs = 0;
    return;
  }
  if (previousAnimationTimestamp !== undefined) {
    const interval = timestamp - previousAnimationTimestamp;
    if (interval >= 4 && interval < fastestFrameMs) fastestFrameMs = interval;
  }
  previousAnimationTimestamp = timestamp;
  const { tiles, width, height } = packAtlas(active);
  let engine = getSharedEngine();
  if (engine) {
    try {
      engine.drawAtlas(tiles, width, height);
    } catch {
      engine.destroy();
      sharedEngine = null;
      engine = null;
    }
  }
  // All GPU draw calls finish before the first copy, avoiding a flush/readback
  // stall between every pair of cards. The source allocation stays stable.
  for (const tile of tiles) {
    const { entry } = tile;
    const { canvas } = entry;
    try {
      if (canvas.width !== tile.width || canvas.height !== tile.height) {
        canvas.width = tile.width;
        canvas.height = tile.height;
      }
      if (engine) {
        entry.context.drawImage(
          engine.canvas,
          tile.x,
          tile.y,
          tile.width,
          tile.height,
          0,
          0,
          tile.width,
          tile.height,
        );
      } else {
        drawFallback(
          entry.recipe,
          tile.width,
          tile.height,
          entry.elapsed,
          canvas,
        );
      }
      if (entry.dirty) canvas.style.opacity = "1";
      entry.dirty = false;
    } catch {
      canvas.style.opacity = "0";
      entry.visible = false;
      entry.onError?.();
    }
  }
  if (!reduced) {
    publishFrameMetrics(
      timestamp,
      performance.now() - started,
      tiles,
      width,
      height,
    );
    // Follow the display's animation cadence; no artificial 20/30 fps cap.
    animationFrame = requestAnimationFrame(drawAnimations);
  }
}

function attachAnimationObservers(): void {
  if (motionPreference) return;
  motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  motionPreference.addEventListener("change", restartAnimations);
  document.addEventListener("visibilitychange", restartAnimations);
  window.addEventListener("resize", restartAnimations);
  if (typeof IntersectionObserver !== "undefined") {
    intersection = new IntersectionObserver((entries) => {
      for (const result of entries) {
        const entry = animations.get(result.target as HTMLCanvasElement);
        if (entry) {
          entry.visible = result.isIntersecting;
          entry.previousTick = undefined;
          if (entry.visible) entry.dirty = true;
        }
      }
      wakeAnimations();
    });
  }
  if (typeof MutationObserver !== "undefined") {
    modalObserver = new MutationObserver(wakeAnimations);
    // Native modal dialogs make the page inert without adding an inert
    // attribute. Observe dialog removal/open so paused calendars resume.
    modalObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open", "inert"],
    });
  }
}

function detachAnimationObservers(): void {
  cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  previousAnimationTimestamp = undefined;
  measurementStart = undefined;
  measuredFrames = 0;
  measuredWorkMs = 0;
  intersection?.disconnect();
  intersection = undefined;
  modalObserver?.disconnect();
  modalObserver = undefined;
  motionPreference?.removeEventListener("change", restartAnimations);
  motionPreference = undefined;
  document.removeEventListener("visibilitychange", restartAnimations);
  window.removeEventListener("resize", restartAnimations);
}

/** Every visible card receives frames from one shared WebGL context. */
function animateCard(
  canvas: HTMLCanvasElement,
  recipe: CardRecipe,
  options: { mode?: AnimationMode; onError?: () => void } = {},
): () => void {
  assertRecipe(recipe);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    options.onError?.();
    return () => {};
  }
  canvas.style.opacity = "0";
  const previous = animations.get(canvas);
  if (previous) intersection?.unobserve(canvas);
  const entry: AnimationEntry = {
    canvas,
    context,
    recipe,
    mode: options.mode ?? "full",
    visible: typeof IntersectionObserver === "undefined",
    elapsed: 0,
    boostRemaining: 0,
    dirty: true,
    onError: options.onError,
  };
  animations.set(canvas, entry);
  attachAnimationObservers();
  intersection?.observe(canvas);
  wakeAnimations();
  return () => {
    if (animations.get(canvas) !== entry) return;
    intersection?.unobserve(canvas);
    animations.delete(canvas);
    canvas.style.opacity = "0";
    if (!animations.size) detachAnimationObservers();
  };
}

/** A click briefly increases velocity while preserving the current phase. */
function boostCard(canvas: HTMLCanvasElement): void {
  const entry = animations.get(canvas);
  if (!entry || motionPreference?.matches) return;
  entry.boostRemaining = 2;
  wakeAnimations();
}

  /** Draw only artwork to a caller-owned canvas, at any aspect ratio. */
  function renderBackground(canvas: HTMLCanvasElement, recipe: CardRecipe, time = 0): void {
    assertRecipe(recipe);
    if (!Number.isFinite(time) || time < 0) throw new RangeError('Time must be non-negative');
    if (canvas.width < 1 || canvas.height < 1 || canvas.width > 2400 || canvas.height > 3600)
      throw new RangeError('Canvas size must be within 1×1 and 2400×3600');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(artworkCanvas(recipe, canvas.width, canvas.height, time), 0, 0);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    if (animations.size) detachAnimationObservers();
    animations.clear();
    sharedEngine?.destroy();
    sharedEngine = null;
    imageCache.clear();
    paletteCache.clear();
    fallbackSurface = undefined;
  }

  return { animateCard, boostCard, cachedCardDataUrl, renderCardDataUrl, renderCardBlob, renderBackground, dispose };
}

export type CardRenderer = ReturnType<typeof createCardRenderer>;
export const defaultRenderer = createCardRenderer();
export const { animateCard, boostCard, cachedCardDataUrl, renderCardDataUrl, renderCardBlob, renderBackground } = defaultRenderer;
