import { catalogFragmentFunctions } from './catalog-shaders.js';

/** Original HADA compositions. Shader indices preserve v1 artwork. */
export const vertexSource = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export function createFragmentSource(extension: { functions?: string; dispatch?: string } = {}): string {
  return `
precision highp float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_seed;
uniform float u_time;
uniform float u_theme;
uniform sampler2D u_palette;
uniform float u_palette_row;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float result = 0.0, amplitude = 0.5;
  mat2 turn = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 6; i++) {
    result += amplitude * noise(p);
    p = turn * p * 2.03 + 7.13;
    amplitude *= 0.50;
  }
  return result;
}
vec3 colorAt(float point) {
  return texture2D(u_palette, vec2(clamp(point, 0.002, 0.998), u_palette_row)).rgb;
}
vec3 washColorAt(float point) {
  return texture2D(u_palette, vec2(clamp(point, 0.002, 0.998), 0.75)).rgb;
}

${extension.functions ?? ""}

${catalogFragmentFunctions}

void main() {
  vec2 uv = v_uv;
  if (u_theme > 7.5) {
    vec3 art = hadaCatalogArtwork(u_theme, uv);
    float grain = (hash(gl_FragCoord.xy + u_seed) - 0.5) * 0.012;
    float vignette = 1.0 - smoothstep(0.18, 0.88, distance(uv, vec2(0.5))) * 0.12;
    gl_FragColor = vec4(clamp(art * vignette + grain, 0.0, 1.0), 1.0);
    return;
  }
  ${extension.dispatch ?? ""}
  vec2 p = uv * vec2(2.0, 3.0);
  p += vec2(u_seed * 0.013, u_seed * 0.021);
  float t = u_time * 0.11;
  vec2 drift = vec2(t * 0.32, t * 0.19);
  vec2 q = vec2(fbm(p * 0.83 + drift), fbm(p * 0.91 + 13.2 - drift));
  vec2 r = vec2(fbm(p * 1.27 + q * 2.7 + 5.8 + drift),
                fbm(p * 1.16 + q * 2.6 + 2.7 - drift));
  float body = fbm(p * 2.45 + r * 4.4 + drift);
  float detail = fbm(p * 5.0 + r * 5.5 + drift);
  float field = clamp((fbm(p * 0.72 + q * 1.3) - 0.19) * 1.72, 0.0, 1.0);
  vec3 color;

  if (u_theme < 0.5) {
    // Aurora: long, softly folded curtains of color and cream light.
    float folds = sin(uv.x * 6.0 + q.x * 5.0 + uv.y * 4.2 + t) * 0.5 + 0.5;
    float band = smoothstep(0.2, 0.92, folds * 0.62 + body * 0.53);
    color = colorAt(clamp(field * 0.57 + folds * 0.43, 0.0, 1.0));
    color *= 0.61 + band * 0.64 + detail * 0.12;
    color = mix(color, vec3(0.98, 0.95, 0.87), pow(band, 3.0) * 0.35);
  } else if (u_theme < 1.5) {
    // Current: silky contour ribbons with a finer grain in the light.
    float bend = uv.x * 1.1 + uv.y * 0.38 + q.x * 0.32;
    float ribbon = sin(bend * 17.0 + r.x * 1.3 + t) * 0.5 + 0.5;
    float lines = smoothstep(0.14, 0.88, ribbon);
    color = colorAt(clamp(field * 0.58 + uv.y * 0.28 + q.x * 0.2, 0.0, 1.0));
    color *= 0.54 + lines * 0.58;
    color = mix(color, vec3(0.97, 0.94, 0.84), pow(lines, 4.0) * 0.24);
  } else if (u_theme < 2.5) {
    // Cloud: dimensional, billowing pigment with warm backlit edges.
    float vapor = fbm(p * 2.3 + q * 1.8 + drift);
    float cloud = smoothstep(0.19, 0.79, vapor);
    float highlight = smoothstep(0.38, 0.76, vapor);
    float billow = fbm(p * 2.3 + q * 1.8 + vec2(-0.16, 0.19) + drift);
    float lighting = clamp((billow - vapor) * 1.3 + 0.96, 0.60, 1.18);
    color = colorAt(field);
    color *= (0.62 + cloud * 0.65) * lighting;
    color = mix(color, vec3(0.99, 0.96, 0.87), highlight * 0.52);
    color += vec3(0.02, 0.018, 0.016) * detail;
  } else {
    // Horizon: softened strata and a luminous band above the dark foreground.
    float horizon = uv.y + (q.x - 0.5) * 0.24 + (r.x - 0.5) * 0.16;
    float halo = exp(-pow((horizon - 0.48) * 5.7, 2.0));
    float ripples = sin(uv.y * 47.0 + q.x * 4.0) * 0.5 + 0.5;
    color = colorAt(clamp(horizon * 0.84 + field * 0.21, 0.0, 1.0));
    color *= 0.69 + halo * 0.40 + body * 0.16;
    color = mix(color, vec3(0.99, 0.96, 0.88), halo * 0.28);
    color += color * ripples * (1.0 - smoothstep(0.1, 0.46, uv.y)) * 0.12;
  }

  // Fixed fine grain is a rendering texture, never pointer-driven movement.
  float grain = (hash(gl_FragCoord.xy + u_seed) - 0.5) * 0.027;
  float vignette = 1.0 - smoothstep(0.1, 0.84, distance(uv, vec2(0.5))) * 0.15;
  color = clamp(color * vignette + grain, 0.0, 1.0);
  gl_FragColor = vec4(color, 1.0);
}`;

}

export const fragmentSource = createFragmentSource();
