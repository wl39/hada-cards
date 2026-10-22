/** Original HADA procedural compositions. These are not React Bits components. */
export const catalogFragmentFunctions = `
const float H_PI = 3.14159265359;
mat2 hRotate(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float hLine(float distance, float width) {
  return 1.0 - smoothstep(width * 0.5, width, abs(distance));
}
float hSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0));
}
vec2 hPoint(vec2 cell) { return vec2(hash(cell + 0.7), hash(cell + 43.1)); }
// Nearest/second-nearest feature distances plus stable cell identity.
vec3 hVoronoi(vec2 p, float time) {
  vec2 base = floor(p), f = fract(p);
  float first = 9.0, second = 9.0, identity = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 random = hPoint(base + offset);
      vec2 point = offset + 0.5 + 0.33 * sin(time + random * 6.283185) - f;
      float distance = dot(point, point);
      if (distance < first) { second = first; first = distance; identity = random.x; }
      else second = min(second, distance);
    }
  }
  return vec3(sqrt(first), sqrt(second), identity);
}
float hStarLayer(vec2 p, float time) {
  vec2 cell = floor(p), f = fract(p) - 0.5;
  vec2 center = (hPoint(cell) - 0.5) * 0.55;
  vec2 delta = f - center;
  float identity = hash(cell + 7.0);
  float star = exp(-dot(delta, delta) * 380.0);
  float glint = exp(-abs(delta.x) * 120.0 - abs(delta.y) * 18.0)
    + exp(-abs(delta.x) * 18.0 - abs(delta.y) * 120.0);
  return (star + glint * 0.22) * smoothstep(0.55, 0.95, identity)
    * (0.65 + 0.35 * sin(time * 1.8 + identity * 40.0));
}

vec3 hadaCatalogArtwork(float theme, vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(2.0, 3.0);
  float t = u_time * 0.4;
  float seed = fract(u_seed * 0.017) * 6.283185;
  vec3 color = vec3(0.0);

  if (theme < 8.5) { // 8 Dunes: seven soft, independently drifting sand ridges.
    color = colorAt(0.95) * 0.72;
    for (int i = 0; i < 7; i++) {
      float fi = 6.0 - float(i);
      float ridge = 0.08 + fi * 0.145 + 0.08 * sin(uv.x * (3.0 + fi * 0.22) + t * 0.35 + fi + seed)
        + 0.035 * sin(uv.x * 8.0 - t * 0.24 + fi * 1.5);
      float fill = 1.0 - smoothstep(ridge - 0.012, ridge + 0.012, uv.y);
      vec3 layer = colorAt(fi / 6.0) * (0.54 + fi * 0.065);
      layer += colorAt(fi / 6.0) * exp(-abs(uv.y - ridge) * 80.0) * 0.25;
      color = mix(color, layer, fill * 0.90);
    }
  } else if (theme < 9.5) { // 9 Marble: branching mineral veins in flowing stone.
    vec2 q = p * 1.4 + vec2(seed, t * 0.18);
    float warp = fbm(q + vec2(sin(t * 0.3), cos(t * 0.2)));
    float vein = abs(sin(q.x * 2.3 + q.y * 0.7 + warp * 8.0));
    float filigree = pow(1.0 - vein, 9.0);
    color = colorAt(clamp(warp * 1.4 - 0.2, 0.0, 1.0)) * (0.45 + vein * 0.55);
    color += colorAt(1.0 - warp) * filigree * 0.65;
  } else if (theme < 10.5) { // 10 Ink: overlapping translucent pools with feathered edges.
    color = colorAt(0.02) * 0.16;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      vec2 center = vec2(sin(fi * 2.3 + t * 0.27 + seed), cos(fi * 1.7 - t * 0.21)) * vec2(0.65, 0.95);
      vec2 q = p - center;
      float edge = length(q) + (noise(q * 4.0 + fi + t * 0.1) - 0.5) * 0.24;
      float pool = 1.0 - smoothstep(0.32, 0.82, edge);
      float rim = exp(-pow((edge - 0.60) * 12.0, 2.0));
      color = mix(color, colorAt(fi / 4.0) * (0.65 + rim * 0.28), pool * 0.68);
    }
  } else if (theme < 11.5) { // 11 Chrome: warped polished-metal reflections.
    float warp = p.x + 0.32 * sin(p.y * 2.2 + t + seed) + 0.14 * sin(p.y * 5.0 - t * 0.6);
    float reflection = 0.5 + 0.5 * sin(warp * 7.0 + p.y * 0.4);
    float gleam = pow(reflection, 12.0);
    float dark = 0.16 + 0.8 * smoothstep(0.15, 0.85, reflection);
    color = colorAt(clamp(uv.y + warp * 0.12, 0.0, 1.0)) * dark;
    color += colorAt(1.0 - uv.y) * gleam * 0.65;
  } else if (theme < 12.5) { // 12 Contours: eccentric nested contour shells.
    vec2 center = vec2(sin(t * 0.4 + seed), cos(t * 0.3)) * 0.22;
    vec2 q = p - center;
    float angle = atan(q.y, q.x);
    float radius = length(q) * (1.0 + 0.10 * sin(angle * 5.0 + t));
    float band = 0.5 + 0.5 * cos(radius * 27.0 - t * 2.0 + sin(angle * 3.0));
    color = colorAt(fract(radius * 0.58)) * (0.18 + 0.85 * pow(band, 4.0));
  } else if (theme < 13.5) { // 13 Lava: rising, merging molten droplets.
    float field = 0.0;
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      vec2 center = vec2(sin(fi * 2.4 + seed + t * 0.3) * 0.7,
        mod(fi * 0.63 + t * (0.22 + fi * 0.018), 4.2) - 2.1);
      vec2 delta = p - center;
      field += (0.10 + 0.025 * sin(fi)) / (dot(delta, delta) + 0.045);
    }
    float body = smoothstep(0.75, 1.65, field);
    float rim = exp(-pow((field - 1.05) * 3.0, 2.0));
    color = colorAt(uv.y) * (0.12 + body * 0.75) + colorAt(1.0 - uv.y) * rim * 0.35;
  } else if (theme < 14.5) { // 14 Ocean: foamy perspective waves below a quiet horizon.
    float horizon = 0.76;
    float depth = max(0.035, horizon - uv.y);
    float x = p.x / (0.6 + depth);
    float phase = 3.5 / (depth + 0.2) + sin(x * 3.0 + t) * 0.45 - t * 2.0;
    float crest = pow(0.5 + 0.5 * sin(phase), 9.0);
    vec3 sea = colorAt(clamp(depth * 1.5, 0.0, 1.0)) * (0.38 + crest * 0.66);
    sea += colorAt(0.95) * crest * 0.18;
    vec3 sky = colorAt(0.05) * (0.48 + 0.22 * exp(-abs(uv.y - horizon) * 9.0));
    color = mix(sea, sky, smoothstep(horizon - 0.015, horizon + 0.015, uv.y));
  } else if (theme < 15.5) { // 15 Smoke: luminous twisting vapor columns.
    float drift = sin(p.y * 1.7 - t + seed) * 0.35 + sin(p.y * 4.0 - t * 0.7) * 0.08;
    float vapor = fbm(vec2(p.x * 3.0 + drift, p.y * 1.8 - t * 0.55) + seed);
    float plume = exp(-pow((p.x - drift) * (1.3 + uv.y * 0.8), 2.0));
    float wisps = pow(clamp(vapor * 1.4, 0.0, 1.0), 2.4) * plume;
    color = colorAt(clamp(vapor * 1.5 - 0.2, 0.0, 1.0)) * (0.08 + wisps * 1.15);
  } else if (theme < 16.5) { // 16 Prism: luminous nested triangular glass facets.
    vec2 q = hRotate(sin(t * 0.3 + seed) * 0.12) * p;
    float triangle = max(abs(q.x) * 0.866 + q.y * 0.5, -q.y);
    float edges = 0.5 + 0.5 * cos(triangle * 21.0 - t * 1.6);
    float beam = exp(-pow((q.y + q.x * 0.45) * 11.0, 2.0));
    color = colorAt(fract(triangle * 0.8 + 0.12)) * (0.20 + pow(edges, 10.0) * 0.65);
    color += colorAt(clamp(q.x * 0.5 + 0.5, 0.0, 1.0)) * beam * 0.45;
  } else if (theme < 17.5) { // 17 Mosaic: gliding square ceramic tiles with beveled seams.
    vec2 q = uv * vec2(6.0, 9.0) + vec2(t * 0.13, t * 0.08);
    vec2 cell = floor(q), f = fract(q);
    float identity = hash(cell + seed);
    float bevel = smoothstep(0.0, 0.08, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
    float sheen = 0.75 + 0.23 * sin(t + identity * 12.0 + f.x * 1.7);
    color = colorAt(identity) * (0.15 + 0.85 * bevel) * sheen;
  } else if (theme < 18.5) { // 18 Tessera: irregular polygonal stones with glowing grout.
    vec3 cell = hVoronoi(p * 3.1 + seed, t * 0.22);
    float edge = smoothstep(0.02, 0.10, cell.y - cell.x);
    color = colorAt(cell.z) * (0.26 + edge * (0.64 - cell.x * 0.20));
    color += colorAt(1.0 - cell.z) * (1.0 - edge) * 0.20;
  } else if (theme < 19.5) { // 19 Kaleidoscope: rotating mirrored star facets.
    float angle = atan(p.y, p.x) + t * 0.18 + seed;
    float wedge = abs(mod(angle, H_PI / 3.0) - H_PI / 6.0);
    vec2 q = vec2(cos(wedge), sin(wedge)) * length(p);
    float planes = sin(q.x * 9.0 - t) * cos(q.y * 15.0 + t * 0.6);
    float jewel = abs(sin(q.x * 5.0 + q.y * 7.0 + t * 0.4));
    color = colorAt(clamp(planes * 0.5 + 0.5, 0.0, 1.0)) * (0.28 + jewel * 0.72);
  } else if (theme < 20.5) { // 20 Origami: angular paper planes with moving fold light.
    vec2 q = hRotate(0.2) * p * 2.3 + vec2(t * 0.06, -t * 0.04);
    vec2 cell = floor(q), f = fract(q);
    float face = step(f.x, f.y);
    float identity = hash(cell + face * 19.0 + seed);
    float fold = abs(f.x - f.y);
    float light = 0.60 + face * 0.25 + sin(t * 0.7 + cell.x + cell.y) * 0.10;
    color = colorAt(identity) * light * (0.75 + smoothstep(0.0, 0.035, fold) * 0.25);
  } else if (theme < 21.5) { // 21 Truchet: linked quarter-circle archways.
    vec2 q = p * 3.0 + vec2(t * 0.12, 0.0);
    vec2 cell = floor(q), f = fract(q);
    if (hash(cell + seed) > 0.5) f.x = 1.0 - f.x;
    float arc = min(abs(length(f) - 0.5), abs(length(f - 1.0) - 0.5));
    float pipe = 1.0 - smoothstep(0.08, 0.13, arc);
    float core = 1.0 - smoothstep(0.0, 0.025, arc);
    color = colorAt(fract((cell.x + cell.y) * 0.16)) * (0.13 + pipe * 0.68 + core * 0.18);
  } else if (theme < 22.5) { // 22 Chevrons: nested moving zigzag folds.
    float saw = abs(fract(uv.x * 3.0 + sin(t * 0.2) * 0.08) - 0.5) * 2.0;
    float stripe = uv.y * 8.0 + saw * 1.3 - t * 0.42;
    float band = fract(stripe);
    float bevel = 0.45 + smoothstep(0.04, 0.7, band) * 0.5;
    color = colorAt(fract(floor(stripe) * 0.137 + seed * 0.1)) * bevel;
  } else if (theme < 23.5) { // 23 Hexagons: honeycomb cavities breathing with light.
    vec2 q = p * 3.3 + vec2(t * 0.06, 0.0);
    vec2 r = vec2(1.0, 1.7320508);
    vec2 a = mod(q, r) - r * 0.5;
    vec2 b = mod(q - r * 0.5, r) - r * 0.5;
    vec2 cell = dot(a, a) < dot(b, b) ? a : b;
    float shape = max(abs(cell.x), dot(abs(cell), vec2(0.5, 0.8660254)));
    float id = hash(floor(q - cell + seed));
    float edge = hLine(shape - 0.43, 0.045);
    float glow = 0.6 + 0.4 * sin(t * 1.2 + id * 20.0);
    color = colorAt(id) * (0.12 + edge * 0.8 * glow + exp(-dot(cell, cell) * 18.0) * 0.18);
  } else if (theme < 24.5) { // 24 Beams: broad diagonal light shafts drifting through haze.
    color = washColorAt(uv.y) * 0.08;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float beam = p.x + p.y * (0.25 + fi * 0.06) - sin(t * 0.38 + fi * 1.5 + seed) * 0.95;
      float light = exp(-beam * beam * (12.0 + fi * 8.0));
      color += colorAt(fi / 4.0) * light * (0.48 + uv.y * 0.32);
    }
  } else if (theme < 25.5) { // 25 Rays: a shifting sunburst of translucent radial wedges.
    vec2 q = p - vec2(sin(t * 0.2 + seed) * 0.2, 0.55);
    float angle = atan(q.y, q.x), radius = length(q);
    float ray = pow(0.5 + 0.5 * sin(angle * 19.0 + t * 0.8 + sin(radius * 2.0)), 7.0);
    float halo = exp(-radius * 1.5);
    color = colorAt(0.5 + 0.5 * sin(angle + seed)) * (0.15 + ray * 0.68 + halo * 0.75);
  } else if (theme < 26.5) { // 26 Eclipse: a dark disk and traveling luminous corona.
    vec2 q = p - vec2(0.0, 0.22);
    float radius = length(q), angle = atan(q.y, q.x);
    float corona = exp(-abs(radius - 0.64) * 15.0);
    float flare = pow(0.5 + 0.5 * cos(angle - t * 0.5 - seed), 8.0);
    float disk = smoothstep(0.61, 0.65, radius);
    color = colorAt(uv.y) * 0.10 * disk;
    color += colorAt(0.5 + 0.5 * sin(angle + seed)) * corona * (0.40 + flare * 1.3) * disk;
  } else if (theme < 27.5) { // 27 Portal: receding elliptical luminous tunnel rings.
    vec2 q = p * vec2(1.0, 0.70);
    float radius = length(q), angle = atan(q.y, q.x);
    float depth = -log(max(radius, 0.025));
    float ring = pow(0.5 + 0.5 * cos(depth * 12.0 + t * 2.0), 16.0);
    float spokes = pow(0.5 + 0.5 * sin(angle * 8.0 + depth * 0.5 - t * 0.2), 12.0);
    color = colorAt(fract(depth * 0.30 + seed * 0.1)) * (0.06 + ring * 0.78 + spokes * 0.15) * smoothstep(0.01, 0.15, radius);
  } else if (theme < 28.5) { // 28 Neon: a glowing grid receding toward the horizon.
    float ground = 0.57 - uv.y;
    float z = 1.0 / max(ground + 0.10, 0.05);
    vec2 grid = vec2(p.x * z * 1.2, z - t * 0.9);
    float lines = max(hLine(fract(grid.x) - 0.5, 0.045), hLine(fract(grid.y) - 0.5, 0.045));
    float floorMask = 1.0 - smoothstep(0.53, 0.59, uv.y);
    float sun = exp(-pow(length((uv - vec2(0.5, 0.66)) * vec2(1.0, 1.5)) * 8.0, 2.0));
    color = colorAt(uv.y) * (0.07 + lines * floorMask * 0.74 + sun * 0.5);
  } else if (theme < 29.5) { // 29 Spectrum: rising rounded columns of colored light.
    float column = floor(uv.x * 13.0), x = fract(uv.x * 13.0) - 0.5;
    float height = 0.22 + 0.66 * (0.5 + 0.5 * sin(column * 1.7 + t * 1.7 + seed));
    float body = (1.0 - smoothstep(0.20, 0.43, abs(x))) * (1.0 - smoothstep(height - 0.05, height + 0.01, uv.y));
    float glow = exp(-x * x * 4.0) * exp(-abs(uv.y - height) * 8.0);
    color = colorAt(column / 12.0) * (0.06 + body * (0.42 + uv.y * 0.5) + glow * 0.17);
  } else if (theme < 30.5) { // 30 Caustics: refracted pools of moving underwater light.
    vec2 q = p * 2.0 + vec2(sin(t * 0.3), cos(t * 0.4)) * 0.15;
    vec3 a = hVoronoi(q, t * 0.65 + seed);
    vec3 b = hVoronoi(q * 1.3 + 3.0, -t * 0.5);
    float net = pow(1.0 - clamp((a.y - a.x) * 3.3, 0.0, 1.0), 5.0);
    float second = pow(1.0 - clamp((b.y - b.x) * 3.3, 0.0, 1.0), 6.0);
    color = colorAt(clamp(uv.y + a.z * 0.25, 0.0, 1.0)) * (0.27 + net * 0.48 + second * 0.33);
  } else if (theme < 31.5) { // 31 Halftone: a wave encoded in expanding circular print dots.
    vec2 grid = uv * vec2(18.0, 27.0);
    vec2 cell = floor(grid), f = fract(grid) - 0.5;
    float wave = 0.5 + 0.5 * sin(cell.x * 0.35 + sin(cell.y * 0.28 - t) * 2.0 + t + seed);
    float radius = 0.08 + wave * 0.36;
    float dotMask = 1.0 - smoothstep(radius - 0.025, radius + 0.025, length(f));
    color = colorAt(cell.y / 26.0) * (0.10 + dotMask * 0.84);
  } else if (theme < 32.5) { // 32 Stars: two parallax layers of softly twinkling stars.
    float near = hStarLayer(p * 3.6 + vec2(t * 0.11, -t * 0.05) + seed, t);
    float far = hStarLayer(p * 6.5 + vec2(t * 0.04, -t * 0.02) - seed, t + 3.0);
    color = colorAt(uv.y) * (0.07 + near * 2.8 + far * 1.2);
  } else if (theme < 33.5) { // 33 Galaxy: a slowly turning spiral with a bright stellar core.
    vec2 q = p * vec2(1.0, 0.68);
    float radius = length(q), angle = atan(q.y, q.x);
    float spiral = 0.5 + 0.5 * cos(angle * 3.0 - radius * 8.5 + t * 0.4 + seed);
    float arms = pow(spiral, 6.0) * exp(-radius * 1.5);
    float core = exp(-radius * radius * 18.0);
    float stars = hStarLayer(p * 8.0 + seed, t) * 0.22;
    color = colorAt(clamp(radius * 0.75, 0.0, 1.0)) * (0.05 + arms * 1.1 + core * 1.2 + stars);
  } else if (theme < 34.5) { // 34 Nebula: drifting cosmic clouds cut by scattered starlight.
    vec2 q = p * 1.4 + vec2(t * 0.08, -t * 0.11) + seed;
    float cloud = fbm(q + fbm(q * 1.2 + 3.0) * 2.4);
    float gas = pow(clamp((cloud - 0.22) * 2.3, 0.0, 1.0), 2.0);
    float stars = hStarLayer(p * 8.0 + seed, t) * 0.55;
    color = colorAt(clamp(cloud * 1.8 - 0.4, 0.0, 1.0)) * (0.05 + gas * 0.80 + stars);
  } else if (theme < 35.5) { // 35 Orbits: orbital paths and independently moving satellites.
    color = washColorAt(uv.y) * 0.06;
    for (int i = 0; i < 5; i++) {
      float fi = float(i), radius = 0.25 + fi * 0.19;
      vec2 q = hRotate(fi * 0.32 + seed * 0.1) * p;
      vec2 ellipse = q * vec2(1.0, 1.8);
      float orbit = exp(-abs(length(ellipse) - radius) * 110.0) * 0.45;
      float angle = t * (0.8 - fi * 0.11) + fi * 2.1;
      vec2 center = vec2(cos(angle), sin(angle) / 1.8) * radius;
      float planet = exp(-dot(q - center, q - center) * 650.0);
      color += colorAt(fi / 4.0) * (orbit + planet);
    }
  } else if (theme < 36.5) { // 36 Meteors: long diagonal trails crossing a sparse night sky.
    vec2 q = hRotate(-0.48) * p;
    color = washColorAt(uv.y) * (0.045 + hStarLayer(p * 9.0, t) * 0.25);
    for (int i = 0; i < 7; i++) {
      float fi = float(i), random = hash(vec2(fi, seed));
      float x = random * 3.8 - 1.9;
      float head = mod(t * (0.65 + random * 0.4) + fi * 0.83, 5.0) - 2.5;
      float tail = q.y - head;
      float streak = exp(-pow((q.x - x) * 70.0, 2.0)) * exp(-max(tail, 0.0) * 2.6)
        * smoothstep(-0.045, 0.02, tail);
      color += colorAt(fi / 6.0) * streak;
    }
  } else if (theme < 37.5) { // 37 Constellation: softly orbiting nodes joined by thin lines.
    color = washColorAt(uv.y) * 0.055;
    for (int i = 0; i < 9; i++) {
      float fi = float(i);
      vec2 a = vec2(sin(fi * 2.31 + seed + t * 0.08), cos(fi * 1.73 + t * 0.12)) * vec2(0.83, 1.25);
      vec2 b = vec2(sin((fi + 1.0) * 2.31 + seed + t * 0.08), cos((fi + 1.0) * 1.73 + t * 0.12)) * vec2(0.83, 1.25);
      float line = exp(-hSegment(p, a, b) * 180.0) * 0.25;
      float star = exp(-dot(p - a, p - a) * 900.0) + exp(-dot(p - a, p - a) * 70.0) * 0.15;
      color += colorAt(fi / 8.0) * (line + star);
    }
  } else if (theme < 38.5) { // 38 Cells: round translucent membranes in an organic tissue.
    vec3 cell = hVoronoi(p * 2.6 + seed, t * 0.55);
    float membrane = exp(-abs(cell.y - cell.x - 0.04) * 22.0);
    float nucleus = exp(-cell.x * cell.x * 90.0);
    float body = exp(-cell.x * cell.x * 2.5);
    color = colorAt(cell.z) * (0.12 + body * 0.35 + membrane * 0.45 + nucleus * 0.35);
  } else if (theme < 39.5) { // 39 Petals: a breathing rosette with overlapping rounded petals.
    float radius = length(p), angle = atan(p.y, p.x) + t * 0.16;
    float flower = 0.48 + 0.30 * cos(angle * 7.0 + sin(t * 0.5 + seed) * 0.6);
    float edge = radius - flower;
    float fill = 1.0 - smoothstep(-0.08, 0.04, edge);
    float veins = pow(0.5 + 0.5 * cos(angle * 35.0 + radius * 9.0), 8.0);
    color = colorAt(0.5 + 0.5 * sin(angle + seed)) * (0.07 + fill * (0.50 + veins * 0.25));
    color += colorAt(0.5) * exp(-radius * radius * 28.0) * 0.60;
  } else if (theme < 40.5) { // 40 Fern: a swaying central stem with paired leaf fronds.
    float bend = sin(p.y * 1.6 + t * 0.7 + seed) * 0.10;
    vec2 q = p - vec2(bend, 0.0);
    float stem = exp(-abs(q.x) * 150.0) * 0.45;
    float fronds = 0.0;
    for (int i = 0; i < 10; i++) {
      float fi = float(i), y = -1.25 + fi * 0.25;
      float width = (1.0 - fi * 0.065) * 0.75;
      vec2 leaf = vec2(abs(q.x), q.y - y);
      float spine = hSegment(leaf, vec2(0.0), vec2(width, 0.30));
      float body = exp(-spine * spine * 250.0) * (1.0 - smoothstep(width * 0.78, width, leaf.x));
      fronds += body * (0.65 + sin(leaf.x * 40.0 + fi) * 0.18);
    }
    color = colorAt(clamp(uv.y * 0.8 + abs(q.x) * 0.2, 0.0, 1.0)) * (0.07 + stem + fronds * 0.70);
  } else if (theme < 41.5) { // 41 Ripples: three overlapping circular wave sources.
    float waves = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 center = vec2(sin(fi * 2.1 + seed), cos(fi * 2.5 + seed)) * 0.6;
      float radius = length(p - center);
      waves += sin(radius * 19.0 - t * 2.6 + fi) * exp(-radius * 0.60) / 3.0;
    }
    float crest = pow(0.5 + 0.5 * waves, 4.0);
    color = colorAt(clamp(waves * 0.75 + 0.5, 0.0, 1.0)) * (0.32 + crest * 1.1);
  } else if (theme < 42.5) { // 42 Rain: descending droplets and thin vertical glass trails.
    color = washColorAt(uv.y) * 0.19;
    vec2 grid = uv * vec2(12.0, 5.0);
    float column = floor(grid.x), x = fract(grid.x) - 0.5;
    float speed = 0.65 + hash(vec2(column, seed));
    float y = fract(grid.y + t * speed + hash(vec2(column, 9.0)));
    float drop = exp(-x * x * 190.0 - pow((y - 0.2) * 16.0, 2.0));
    float trail = exp(-x * x * 650.0) * smoothstep(0.2, 0.3, y) * (1.0 - smoothstep(0.3, 0.95, y));
    color += colorAt(column / 11.0) * (drop * 0.85 + trail * 0.25);
  } else if (theme < 43.5) { // 43 Fireflies: drifting luminous discs with soft bokeh halos.
    color = washColorAt(uv.y) * 0.07;
    for (int i = 0; i < 13; i++) {
      float fi = float(i);
      vec2 center = vec2(sin(fi * 2.7 + t * 0.18 + seed), cos(fi * 1.9 + t * 0.23)) * vec2(0.95, 1.4);
      vec2 delta = p - center;
      float size = 30.0 + hash(vec2(fi, 8.0)) * 170.0;
      float glow = exp(-dot(delta, delta) * size);
      float pulse = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(t * 1.6 + fi), 2.0);
      color += colorAt(fi / 12.0) * glow * pulse;
    }
  } else if (theme < 44.5) { // 44 Woven: alternating over-under strands of a textile.
    vec2 q = hRotate(0.12 * sin(t * 0.2)) * p * 5.0 + t * 0.06;
    vec2 cell = floor(q), f = fract(q);
    float vertical = sin(f.x * H_PI), horizontal = sin(f.y * H_PI);
    float over = mod(cell.x + cell.y, 2.0);
    float strand = mix(horizontal, vertical, over);
    float crossing = mix(vertical, horizontal, over);
    float thread = 0.88 + 0.12 * sin((over > 0.5 ? f.x : f.y) * 65.0);
    color = colorAt(fract((over > 0.5 ? cell.x : cell.y) * 0.17 + seed * 0.1))
      * (0.16 + pow(strand, 0.5) * 0.74) * (0.75 + crossing * 0.25) * thread;
  } else if (theme < 45.5) { // 45 Topography: contour maps of evolving island elevations.
    vec2 q = p * 1.3 + seed;
    float terrain = fbm(q + vec2(t * 0.10, -t * 0.07));
    float level = terrain * 15.0;
    float line = hLine(fract(level) - 0.5, 0.055);
    float major = hLine(fract(level / 3.0) - 0.5, 0.04);
    color = colorAt(clamp((terrain - 0.22) * 1.8, 0.0, 1.0)) * (0.28 + line * 0.48 + major * 0.18);
  } else if (theme < 46.5) { // 46 Moire: circular and rotated fine gratings interfere.
    vec2 q = hRotate(t * 0.06 + seed * 0.1) * p;
    float a = sin(length(q - vec2(0.22, 0.0)) * 65.0);
    float b = sin(q.x * 61.0 + q.y * 6.0 + t);
    float interference = a * b;
    float broad = 0.5 + 0.5 * sin(length(q) * 4.0 - q.x * 2.0 + t * 0.2);
    color = colorAt(broad) * (0.23 + (0.5 + 0.5 * interference) * 0.70);
  } else if (theme < 47.5) { // 47 Dot Matrix: a rolling relief surface made of raised discs.
    vec2 q = uv * vec2(13.0, 20.0), cell = floor(q), f = fract(q) - 0.5;
    float height = 0.5 + 0.5 * sin(cell.x * 0.4 + cell.y * 0.25 - t * 1.5 + seed);
    float radius = 0.20 + height * 0.20;
    float disc = 1.0 - smoothstep(radius - 0.035, radius + 0.01, length(f));
    float dome = sqrt(max(0.0, 1.0 - dot(f, f) / (radius * radius)));
    float light = 0.3 + dome * 0.45 + (f.x - f.y) * 0.35;
    color = colorAt(height) * (0.08 + disc * light);
  } else if (theme < 48.5) { // 48 Circuit: right-angle traces carrying traveling pulses.
    vec2 q = p * 3.3, cell = floor(q), f = fract(q);
    float id = hash(cell + seed);
    if (id > 0.5) f = f.yx;
    float corner = min(hSegment(f, vec2(0.0, 0.25), vec2(0.65, 0.25)),
      hSegment(f, vec2(0.65, 0.25), vec2(0.65, 1.0)));
    float trace = exp(-corner * 90.0);
    float node = exp(-dot(f - vec2(0.65, 0.25), f - vec2(0.65, 0.25)) * 850.0);
    float pulse = pow(0.5 + 0.5 * cos((f.x + f.y + cell.x + cell.y) * 5.0 - t * 3.0), 14.0);
    color = colorAt(id) * (0.075 + trace * (0.30 + pulse * 0.65) + node * 0.4);
  } else if (theme < 49.5) { // 49 Ribbons: broad translucent bands crossing horizontally.
    color = washColorAt(uv.y) * 0.09;
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      float center = -1.2 + fi * 0.44 + sin(p.x * (1.7 + fi * 0.12) + t * 0.7 + fi + seed) * 0.32;
      float delta = p.y - center;
      float ribbon = 1.0 - smoothstep(0.10, 0.17, abs(delta));
      float shade = 0.6 + 0.4 * cos(delta * 12.0);
      color = mix(color, colorAt(fi / 5.0) * shade, ribbon * 0.88);
    }
  } else if (theme < 50.5) { // 50 Wave Grid: a flexible illuminated wire mesh.
    vec2 q = p;
    q.x += sin(p.y * 2.3 + t + seed) * 0.22;
    q.y += sin(p.x * 2.8 - t * 0.8) * 0.22;
    vec2 grid = q * vec2(7.0, 9.0);
    float xline = hLine(fract(grid.x) - 0.5, 0.06);
    float yline = hLine(fract(grid.y) - 0.5, 0.06);
    float relief = 0.5 + 0.5 * cos(p.x * 2.0 + p.y * 1.5 - t);
    color = colorAt(clamp(uv.y + sin(p.x + t * 0.2) * 0.2, 0.0, 1.0))
      * (0.08 + max(xline, yline) * (0.38 + relief * 0.55));
  } else { // 51 Checker: a flowing, curved checkerboard in perspective.
    float depth = uv.y * 1.8 + 0.20;
    vec2 q = vec2(p.x / depth, 1.0 / depth - t * 0.30) * 3.0;
    q.x += sin(q.y * 0.8 + t * 0.4 + seed) * 0.35;
    vec2 cell = floor(q), f = fract(q);
    float checker = mod(cell.x + cell.y, 2.0);
    float seams = smoothstep(0.0, 0.035, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
    color = colorAt(fract(cell.y * 0.13 + checker * 0.45)) * (0.28 + checker * 0.57) * (0.65 + seams * 0.35);
  }
  return color;
}
`;
