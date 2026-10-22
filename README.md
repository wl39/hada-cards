# HADA Cards

48 original generative backgrounds. Mix any colors, choose a seed, then add an optional date and caption. Browser rendering with no service, account or HADA data dependency.

**[Open Card Studio ↗](https://hada-card-studio-wl39.jazzyswift513.chatgpt.site)** · [한국어](#한국어) · [API](#api)

The studio is owner-private and requires the owner's ChatGPT sign-in. Repository collaborators can run it locally. GitHub READMEs [remove executable scripts](https://github.com/github/markup#github-markup), so the interactive editor opens through the link above.

[![HADA Card Studio](docs/studio.png)](https://hada-card-studio-wl39.jazzyswift513.chatgpt.site)

## 한국어

배경·색상·날짜를 서로 독립적으로 조합하는 카드 모듈입니다. Studio에서 48개 배경 선택, 색상 추가·삭제, 색상별 비율·밝기, 날짜 형식·문구·시드를 편집하고 PNG 또는 카드 JSON을 저장할 수 있습니다. JSON 불러오기와 브라우저 자동 저장도 지원합니다.

현재 소스 저장소와 호스팅 데모는 비공개입니다. 소스는 MIT 라이선스로 공개할 수 있도록 준비했습니다. HADA에서만 사용하던 외부 라이선스 배경 4개는 포함하지 않았습니다.

## Run the studio

Node.js 22.12+ (Node 24 recommended).

```sh
gh repo clone wl39/hada-cards
cd hada-cards
npm ci
npm run dev
```

Open `http://127.0.0.1:5180`. The studio stores only its current recipe in this browser; it sends no card data to a server. `npm run build:studio` produces a static `studio-dist/` folder for any web host. Hosting privacy is separate from repository privacy.

## Install

This package is not published on the public npm registry. Build a versioned archive from this private repository:

```sh
npm ci
npm pack
# From your application:
npm install /path/to/hada-cards/hada-cards-0.1.0.tgz
```

HADA commits this archive into `vendor/` and pins its integrity in `package-lock.json`, so production builds need no private GitHub token. Commit the archive and lockfile together when updating a consumer. Runtime core dependencies: **zero**. React is an optional peer used only by `@hada/cards/react`.

## Usage

### Plain JavaScript / TypeScript

```ts
import { createCardRecipe, renderBackground, renderCardBlob } from '@hada/cards';

const recipe = createCardRecipe({
  background: 'current',
  colors: ['#173b45', '#46766d', '#e4c5a0'],
  seed: 7023,
  date: '2026-10-23',
  dateStyle: 'en',
  caption: 'A little progress',
});

const canvas = document.querySelector('canvas')!;
canvas.width = 800;
canvas.height = 1200;
renderBackground(canvas, recipe); // Artwork alone, at time zero
const png = await renderCardBlob(recipe); // 1200×1800, with date and caption
const artwork = await renderCardBlob(recipe, { backgroundOnly: true });
```

Dates never choose the background, palette or seed. Omit `date` for artwork without a date. The same inputs, renderer version and animation phase produce the same composition on the same graphics implementation; small cross-GPU differences are possible. WebGL loss falls back to a simpler Canvas 2D composition.

### React

```tsx
import { createCardRecipe } from '@hada/cards';
import { ArtCard } from '@hada/cards/react';

const recipe = createCardRecipe({
  background: 'mosaic', colors: ['#c77867', '#e4c5a0'], date: '2026-10-23',
});

export function Example() {
  return <ArtCard recipe={recipe} animate showDate style={{ width: 300, borderRadius: 12 }} />;
}
```

The component handles visibility, reduced motion and cleanup. Multiple cards share one GPU renderer and atlas. `animationMode="thumbnail"` reduces calendar-sized surfaces; `boost` briefly accelerates an existing animation when its value changes. React is not imported by the core entry point. `ArtCard` uses a 2:3 surface; use the canvas APIs for other aspect ratios.

### Colors without tasks

```ts
const recipe = createCardRecipe({
  colors: [
    { color: '#173b45', weight: 3 },                 // Three shares, fully revealed
    { color: '#e4c5a0', weight: 1, completed: 0.5 }, // One share, half revealed
  ],
});
```

`weight` controls area proportion. `completed` is an amount from zero to `weight`, defaulting to `weight`; it controls saturation and brightness, not a requirement to supply tasks. Hex colors use `#RRGGBB`. The core supports up to 256 colors; the studio's add button offers up to eight. An empty palette uses a neutral fallback. The calendar formatter takes `YYYY-MM-DD` with no timezone conversion.

## API

| Export | Purpose |
| --- | --- |
| `createCardRecipe(options)` | Create and validate a serializable v1 recipe; no wall clock or account input |
| `BACKGROUNDS` | 48 definitions with stable IDs, labels, families and shader indices |
| `renderBackground(canvas, recipe, time?)` | Draw artwork alone to a supplied canvas |
| `createPaletteTexture(colors)` | Create the two-row RGBA palette texture independently |
| `formatCardDate(date, style?)` / `cardDateLines(recipe)` | Format only the date, without a DOM |
| `drawCardOverlay(context, recipe, width?, height?)` | Draw date/caption over any existing 2D canvas |
| `renderCardBlob(recipe, options?)` | PNG export, optionally without any text or shading |
| `renderCardDataUrl(recipe)` | Cached 240×360 artwork-only WebP preview |
| `animateCard(canvas, recipe, options?)` | Animate a 2:3 card; returns an unsubscribe function |
| `boostCard(canvas)` | Briefly accelerate an existing animation |
| `parseCardRecipe(json)` | Validate JSON, discard unrelated fields and preserve the composition |
| `createCardRenderer(config?)` | Own a separate renderer or provide application-specific shader extensions |

`RenderOptions`: `width` (64–2400), `height` (96–3600), `backgroundOnly`, `time` (non-negative seconds, default 0). Aspect ratio defaults to 2:3. The React preview animates from time zero; PNG export defaults to the reproducible time-zero frame, rather than capturing the current animation frame.

Call the unsubscribe function when removing an animated canvas. Call `renderer.dispose()` when permanently discarding a custom renderer. Pure recipe, date and palette helpers work without a DOM; rendering needs a browser with Canvas 2D (and WebGL for full artwork).

### Application-specific backgrounds

Use `createCardRenderer({ backgrounds, continuousThemes, fragmentSource })`, pass the instance to `<ArtCard renderer={renderer} .../>`, and use the same instance for exports. The `@hada/cards/shaders` entry exposes `vertexSource`, `fragmentSource`, and `createFragmentSource({ functions, dispatch })` for GLSL extensions. Extension code is trusted application code, never user-entered text. Supply the complete background catalog including built-ins; preserve existing indices.

HADA keeps scheduling, unlocks, future-card visibility, task-to-color aggregation and historical recipes in the application. Only rendering and composition live here. Reserved indices 4–7 keep HADA's licensed extensions compatible without distributing them. See [NOTICE.md](NOTICE.md).

## Development

```sh
npm test
npm run check
npm run build:studio
npm pack --dry-run
```

CI checks types, renderer scheduling, palettes, dates, recipe validation and the studio build. `src/` contains the reusable module; `studio/` is one consuming application. Built ESM and TypeScript declarations are included in npm archives. No database migration is needed to adopt this package.

[MIT](LICENSE) · Copyright © 2026 wl39
