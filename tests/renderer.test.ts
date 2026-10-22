import { afterEach, describe, expect, it, vi } from "vitest";
import type { CardRecipe } from "../src/types";

const recipe: CardRecipe = {
  theme: "aurora",
  seed: 123,
  date: "2026-10-18",
  dateStyle: "en",
  rendererVersion: 1,
  colors: [{ color: "#c79375", weight: 1, completed: 1 }],
};

function environment() {
  let contextCount = 0;
  let nextFrame = 0;
  let phase = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const globalEvents = new Map<string, () => void>();
  const visibilityEvents = new Map<string, () => void>();
  const motion = {
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const drawTimes: number[] = [];
  const renderEvents: string[] = [];
  const gpuSurfaces: Array<{
    widthWrites: number;
    heightWrites: number;
    width: number;
    height: number;
  }> = [];
  let textureUploads = 0;
  const uploadedPalettes: Uint8Array[] = [];
  const paletteRows: number[] = [];
  const gl = new Proxy(
    {
      getShaderParameter: () => true,
      getProgramParameter: () => true,
      isContextLost: () => false,
      getUniformLocation: (_program: unknown, key: string) => key,
      createShader: () => ({}),
      createProgram: () => ({}),
      createBuffer: () => ({}),
      createTexture: () => ({}),
      uniform1f: (location: string, value: number) => {
        if (location === "u_time") phase = value;
        if (location === "u_palette_row") paletteRows.push(value);
      },
      drawArrays: () => {
        drawTimes.push(phase);
        renderEvents.push("draw");
      },
      texImage2D: (...args: unknown[]) => {
        textureUploads++;
        uploadedPalettes.push((args[8] as Uint8Array).slice());
      },
    } as Record<string, unknown>,
    {
      get: (target, key: string) =>
        key in target ? target[key] : /^[A-Z_0-9]+$/.test(key) ? 0 : () => {},
    },
  );
  const canvas = () => ({
    style: {} as Record<string, string>,
    dataset: {} as Record<string, string>,
    backingWidth: 0,
    backingHeight: 0,
    widthWrites: 0,
    heightWrites: 0,
    get width() {
      return this.backingWidth;
    },
    set width(value: number) {
      this.backingWidth = value;
      this.widthWrites++;
    },
    get height() {
      return this.backingHeight;
    },
    set height(value: number) {
      this.backingHeight = value;
      this.heightWrites++;
    },
    clientWidth: 60,
    isConnected: true,
    closest: () => null,
    context: { drawImage: vi.fn(() => renderEvents.push("copy")) },
    getContext(kind: string) {
      if (kind === "webgl") {
        contextCount++;
        gpuSurfaces.push(this);
        return gl;
      }
      return this.context;
    },
  });
  const doc = {
    hidden: false,
    body: {},
    dialogs: [] as Array<{ contains: (node: unknown) => boolean }>,
    createElement: () => canvas(),
    querySelectorAll() {
      return this.dialogs;
    },
    addEventListener: (key: string, callback: () => void) =>
      visibilityEvents.set(key, callback),
    removeEventListener: (key: string) => visibilityEvents.delete(key),
  };
  let intersectionCallback: IntersectionObserverCallback | undefined;
  let mutationCallback: (() => void) | undefined;
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", {
    devicePixelRatio: 1,
    matchMedia: () => motion,
    addEventListener: (key: string, callback: () => void) =>
      globalEvents.set(key, callback),
    removeEventListener: (key: string) => globalEvents.delete(key),
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }
      observe(target: unknown) {
        intersectionCallback?.(
          [{ target, isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(callback: () => void) {
        mutationCallback = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  return {
    canvas,
    doc,
    motion,
    drawTimes,
    renderEvents,
    gpuSurfaces,
    textureUploads: () => textureUploads,
    uploadedPalettes,
    paletteRows,
    contextCount: () => contextCount,
    frames,
    frame(timestamp: number) {
      const callbacks = Array.from(frames.values());
      frames.clear();
      callbacks.forEach((callback) => callback(timestamp));
    },
    visible(target: unknown, isIntersecting: boolean) {
      intersectionCallback?.(
        [{ target, isIntersecting } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    },
    visibilityChanged: () => visibilityEvents.get("visibilitychange")?.(),
    modalChanged: () => mutationCallback?.(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("shared animated cards", () => {
  it("blends contrasting Aurora colors gradually while keeping both endpoint hues", async () => {
    const env = environment();
    const { animateCard } = await import("../src/renderer");
    const stop = animateCard(env.canvas() as unknown as HTMLCanvasElement, {
      ...recipe,
      colors: [
        { color: "#ffffff", weight: 1, completed: 1 },
        { color: "#000000", weight: 1, completed: 1 },
      ],
    });
    env.frame(0);
    const palette = env.uploadedPalettes[0];
    const red = Array.from({ length: 256 }, (_, i) => palette[(256 + i) * 4]);
    expect(red[0]).toBe(255);
    expect(red[255]).toBe(0);
    expect(red[128]).toBeGreaterThan(115);
    expect(red[128]).toBeLessThan(140);
    expect(red.filter(value => value > 10 && value < 245).length).toBeGreaterThan(75);
    expect(Math.max(...red.slice(1).map((value, i) => Math.abs(value - red[i])))).toBeLessThanOrEqual(5);
    stop();
  });

  it("shares one cached texture while choosing smooth fields or distinct object hues per draw", async () => {
    const env = environment();
    const { animateCard } = await import("../src/renderer");
    const colors = [
      { color: "#ffffff", weight: 1, completed: 1 },
      { color: "#000000", weight: 3, completed: 3 },
    ];
    const snapshot = JSON.stringify(colors);
    const stops = ["aurora", "mosaic", "cloud", "aurora"].map(theme =>
      animateCard(env.canvas() as unknown as HTMLCanvasElement, { ...recipe, theme: theme as CardRecipe["theme"], colors }),
    );
    env.frame(0);
    env.frame(50);
    expect(env.textureUploads()).toBe(1);
    expect(env.uploadedPalettes[0][(256 + 48) * 4]).toBeLessThan(210);
    expect(env.uploadedPalettes[0][48 * 4]).toBe(255);
    expect(env.paletteRows).toEqual([0.75, 0.25, 0.75, 0.75, 0.75, 0.25, 0.75, 0.75]);
    expect(JSON.stringify(colors)).toBe(snapshot);
    stops.forEach(stop => stop());
  });

  it("retains a single hue in both palette rows and brightens it with task completion", async () => {
    const env = environment();
    const { animateCard } = await import("../src/renderer");
    const stops = [0, 4].map(completed =>
      animateCard(env.canvas() as unknown as HTMLCanvasElement, {
        ...recipe,
        colors: [{ color: "#40a0e0", weight: 4, completed }],
      }),
    );
    env.frame(0);
    const [unfinished, finished] = env.uploadedPalettes;
    for (let i = 0; i < 512; i++) {
      const offset = i * 4;
      expect(Array.from(finished.slice(offset, offset + 4))).toEqual([64, 160, 224, 255]);
      expect(unfinished[offset]).toBeLessThan(finished[offset]);
      expect(unfinished[offset + 1]).toBeLessThan(finished[offset + 1]);
      expect(unfinished[offset + 2]).toBeLessThan(finished[offset + 2]);
      expect(unfinished[offset + 3]).toBe(255);
    }
    stops.forEach(stop => stop());
  });

  it("uses one GPU context for an entire calendar and releases the scheduler on unmount", async () => {
    const env = environment();
    const { animateCard } = await import("../src/renderer");
    const canvases = Array.from({ length: 42 }, env.canvas);
    const stops = canvases.map((canvas) =>
      animateCard(canvas as unknown as HTMLCanvasElement, recipe, {
        mode: "thumbnail",
      }),
    );
    env.frame(0);
    env.frame(50);
    expect(env.contextCount()).toBe(1);
    expect(env.drawTimes).toHaveLength(84);
    expect(env.renderEvents.slice(0, 42)).toEqual(Array(42).fill("draw"));
    expect(env.renderEvents.slice(42, 84)).toEqual(Array(42).fill("copy"));
    expect(env.gpuSurfaces[0].widthWrites).toBe(1);
    expect(env.gpuSurfaces[0].heightWrites).toBe(1);
    expect(
      canvases.every((canvas) => canvas.width === 96 && canvas.height === 144),
    ).toBe(true);
    stops.forEach((stop) => stop());
    expect(env.frames.size).toBe(0);
  });

  it("renders every display callback and reuses palette textures across cards and frames", async () => {
    const env = environment();
    const { animateCard } = await import("../src/renderer");
    const secondRecipe = {
      ...recipe,
      colors: [{ color: "#8fbc8f", weight: 1, completed: 1 }],
    };
    const canvases = [env.canvas(), env.canvas()];
    const stops = canvases.map((canvas, index) =>
      animateCard(
        canvas as unknown as HTMLCanvasElement,
        index ? secondRecipe : recipe,
        { mode: "thumbnail" },
      ),
    );
    [0, 8.333, 16.666, 24.999].forEach(env.frame);
    expect(env.drawTimes).toHaveLength(8);
    expect(env.textureUploads()).toBe(2);
    expect(env.gpuSurfaces[0].widthWrites).toBe(1);
    expect(env.gpuSurfaces[0].heightWrites).toBe(1);
    stops.forEach((stop) => stop());
  });

  it("click boost accelerates the existing phase then returns to normal speed", async () => {
    const env = environment();
    const { animateCard, boostCard } = await import("../src/renderer");
    const canvas = env.canvas() as unknown as HTMLCanvasElement;
    const stop = animateCard(canvas, recipe, { mode: "thumbnail" });
    env.frame(0);
    env.frame(50);
    const normalDelta = env.drawTimes[1] - env.drawTimes[0];
    boostCard(canvas);
    env.frame(100);
    expect(env.drawTimes[2] - env.drawTimes[1]).toBeGreaterThan(
      normalDelta * 4,
    );
    for (let timestamp = 150; timestamp <= 2300; timestamp += 50)
      env.frame(timestamp);
    const count = env.drawTimes.length;
    expect(env.drawTimes[count - 1] - env.drawTimes[count - 2]).toBeCloseTo(
      normalDelta,
      5,
    );
    expect(
      env.drawTimes.every(
        (time, index) => !index || time > env.drawTimes[index - 1],
      ),
    ).toBe(true);
    stop();
  });

  it("keeps calendar surfaces small while giving larger gallery previews more detail", async () => {
    const env = environment();
    const { animateCard } = await import("../src/renderer");
    const canvases = [60, 160, 400].map((width) => ({
      ...env.canvas(),
      clientWidth: width,
    }));
    const stops = canvases.map((canvas) =>
      animateCard(canvas as unknown as HTMLCanvasElement, recipe, {
        mode: "thumbnail",
      }),
    );
    env.frame(0);
    expect(canvases.map((canvas) => [canvas.width, canvas.height])).toEqual([
      [96, 144],
      [160, 240],
      [192, 288],
    ]);
    expect(env.contextCount()).toBe(1);
    stops.forEach((stop) => stop());
  });

  it("pauses hidden, offscreen and modal-obscured cards without advancing their phase", async () => {
    const env = environment();
    const { animateCard } = await import("../src/renderer");
    const canvas = env.canvas() as unknown as HTMLCanvasElement;
    const stop = animateCard(canvas, recipe, { mode: "thumbnail" });
    env.frame(0);
    env.frame(50);
    env.visible(canvas, false);
    env.frame(100);
    expect(env.drawTimes).toHaveLength(2);
    expect(env.frames.size).toBe(0);
    env.visible(canvas, true);
    env.frame(10000);
    expect(env.drawTimes[2]).toBe(env.drawTimes[1]);
    env.doc.dialogs = [{ contains: () => false }];
    env.modalChanged();
    env.frame(10050);
    expect(env.drawTimes).toHaveLength(3);
    env.doc.dialogs = [];
    env.modalChanged();
    env.frame(10100);
    expect(env.drawTimes[3]).toBe(env.drawTimes[2]);
    env.doc.hidden = true;
    env.visibilityChanged();
    expect(env.frames.size).toBe(0);
    stop();
  });

  it("draws a single still frame and ignores boost with reduced motion", async () => {
    const env = environment();
    env.motion.matches = true;
    const { animateCard, boostCard } = await import("../src/renderer");
    const canvas = env.canvas() as unknown as HTMLCanvasElement;
    const stop = animateCard(canvas, recipe, { mode: "thumbnail" });
    env.frame(0);
    boostCard(canvas);
    env.frame(50);
    expect(env.drawTimes).toEqual([0]);
    expect(env.frames.size).toBe(0);
    stop();
  });
});
