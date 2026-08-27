export type GardenMode = "nebula" | "reef" | "ember";

export interface GardenControls {
  seed: string;
  bloom: number;
  drift: number;
  gravity: number;
  chroma: number;
  pulse: number;
  mode: GardenMode;
}

export interface Palette {
  baseHue: number;
  accentHue: number;
  coreHue: number;
  glowHue: number;
}

export interface Orb {
  angle: number;
  radius: number;
  speed: number;
  wobble: number;
  hue: number;
  size: number;
  phase: number;
}

export interface Spore {
  x: number;
  y: number;
  hue: number;
  life: number;
  radius: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  pressure: number;
}

export interface Trail {
  hue: number;
  life: number;
  width: number;
  points: TrailPoint[];
}

const MODE_SHIFT: Record<GardenMode, number> = {
  nebula: 220,
  reef: 160,
  ember: 24,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function mix(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

export function hashText(text: string): number {
  let hash = 2166136261;
  for (const char of text.trim().toLowerCase() || "liminal garden") {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function paletteFor(
  seed: string,
  mode: GardenMode,
  chroma: number,
): Palette {
  const base = hashText(seed);
  const hue = ((base % 360) + MODE_SHIFT[mode]) % 360;
  const accentHue = (hue + 35 + chroma * 0.6) % 360;
  const coreHue = (hue + 180 + chroma * 0.2) % 360;
  const glowHue = (hue + 280 + chroma * 0.3) % 360;

  return { baseHue: hue, accentHue, coreHue, glowHue };
}

export function makeGardenOrb(
  seed: string,
  index: number,
  total: number,
  controls: Pick<GardenControls, "mode" | "bloom" | "drift" | "pulse">,
): Orb {
  const rng = seededRandom(hashText(`${seed}:${controls.mode}:${index}`));
  const spread = mix(0.18, 1, total <= 1 ? 1 : index / (total - 1));
  const baseRadius = mix(72, 360, spread);
  const bloom = mix(0.55, 1.2, controls.bloom / 100);
  const drift = controls.drift / 100;
  const pulse = mix(0.25, 1.8, controls.pulse / 100);
  return {
    angle: rng() * Math.PI * 2,
    radius: baseRadius * bloom,
    speed: mix(-0.0014, 0.0017, rng()) * pulse,
    wobble: mix(0.4, 1.7, rng()) * (0.4 + drift),
    hue: (hashText(seed) + index * 17) % 360,
    size: mix(1.8, 6.2, rng()) * mix(0.75, 1.3, controls.bloom / 100),
    phase: rng() * Math.PI * 2,
  };
}

export function createOrbiters(seed: string, controls: GardenControls): Orb[] {
  const count = Math.round(mix(16, 58, controls.bloom / 100));
  return Array.from({ length: count }, (_, index) =>
    makeGardenOrb(seed, index, count, controls),
  );
}

export function createSpore(
  x: number,
  y: number,
  seed: string,
  intensity = 1,
): Spore {
  const base = hashText(seed);
  return {
    x,
    y,
    hue: (base + Math.round(intensity * 29)) % 360,
    life: 1,
    radius: mix(8, 18, clamp(intensity, 0, 1)),
  };
}

export function createTrail(
  x: number,
  y: number,
  seed: string,
  intensity = 1,
): Trail {
  const base = hashText(seed);
  return {
    hue: (base + Math.round(intensity * 47)) % 360,
    life: 1,
    width: mix(1.4, 5.2, clamp(intensity, 0, 1)),
    points: [{ x, y, pressure: 1 }],
  };
}

export function appendTrailPoint(
  trail: Trail,
  x: number,
  y: number,
  pressure = 1,
): Trail {
  trail.points.push({
    x,
    y,
    pressure: clamp(pressure, 0.1, 1),
  });
  if (trail.points.length > 36) {
    trail.points.shift();
  }
  return trail;
}

export function oracleFor(seed: string, mode: GardenMode): string {
  const words = {
    nebula: ["soft", "drifting", "star-silt", "halo", "echo"],
    reef: ["tide-born", "luminous", "coral", "current", "glimmer"],
    ember: ["heat", "sparks", "ash", "cinder", "pulse"],
  }[mode];
  const hash = hashText(seed);
  const a = words[hash % words.length];
  const b = words[(hash >> 3) % words.length];
  const c = words[(hash >> 5) % words.length];
  return `${capitalize(a)} ${b} / ${c} seed`;
}

export function titleFor(seed: string): string {
  const names = [
    "Liminal",
    "Murmur",
    "Feral",
    "Velvet",
    "Nocturne",
    "Glass",
    "Moss",
    "Prism",
  ];
  const nouns = [
    "garden",
    "reef",
    "archive",
    "engine",
    "orbit",
    "species",
    "weather",
    "atlas",
  ];
  const hash = hashText(seed);
  return `${names[hash % names.length]} ${nouns[(hash >> 4) % nouns.length]}`;
}

export function hsla(
  hue: number,
  saturation: number,
  lightness: number,
  alpha = 1,
): string {
  return `hsla(${Math.round(hue)} ${Math.round(saturation)}% ${Math.round(
    lightness,
  )}% / ${alpha})`;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
