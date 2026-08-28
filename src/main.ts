import "./style.css";
import {
  clamp,
  appendTrailPoint,
  createOrbiters,
  createSpore,
  createTrail,
  hsla,
  mix,
  oracleFor,
  paletteFor,
  titleFor,
  type GardenControls,
  type GardenMode,
  type Orb,
  type Trail,
  type Spore,
} from "./garden";

const DEFAULT_CONTROLS: GardenControls = {
  seed: "moon ink",
  bloom: 64,
  drift: 42,
  gravity: 28,
  chroma: 78,
  pulse: 58,
  mode: "nebula",
};

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <main class="shell">
    <section class="hero">
      <div class="hero__copy">
        <p class="eyebrow">Experimental sandbox</p>
        <h1>QUILL</h1>
        <p class="lede">
          Seed a phrase, tune the pressure, and grow a living draft of glyphs, echoes, and ink trails.
        </p>
      </div>
      <div class="hero__chips" id="chips"></div>
    </section>

    <section class="stage" aria-label="generative stage">
      <canvas class="stage__canvas" id="garden-canvas"></canvas>
      <div class="stage__overlay">
        <div class="oracle" id="oracle"></div>
        <div class="hint">
          drag to write · space seed · r randomize · f freeze · c capture · x
          sweep
        </div>
      </div>
    </section>

    <aside class="panel" aria-label="controls">
      <label class="field">
        <span>Seed phrase</span>
        <input id="seed" type="text" value="${DEFAULT_CONTROLS.seed}" />
      </label>

      <label class="field">
        <span>Mode</span>
        <select id="mode">
          <option value="nebula">Nebula ink</option>
          <option value="reef">Reef gloss</option>
          <option value="ember">Ember draft</option>
        </select>
      </label>

      <label class="field">
        <span>Bloom</span>
        <input id="bloom" type="range" min="0" max="100" value="${DEFAULT_CONTROLS.bloom}" />
      </label>

      <label class="field">
        <span>Drift</span>
        <input id="drift" type="range" min="0" max="100" value="${DEFAULT_CONTROLS.drift}" />
      </label>

      <label class="field">
        <span>Gravity</span>
        <input id="gravity" type="range" min="0" max="100" value="${DEFAULT_CONTROLS.gravity}" />
      </label>

      <label class="field">
        <span>Pulse</span>
        <input id="pulse" type="range" min="0" max="100" value="${DEFAULT_CONTROLS.pulse}" />
      </label>

      <label class="field">
        <span>Chroma</span>
        <input id="chroma" type="range" min="0" max="100" value="${DEFAULT_CONTROLS.chroma}" />
      </label>

      <div class="actions">
        <button id="randomize" type="button">Randomize</button>
        <button id="freeze" type="button" data-state="off">Freeze</button>
        <button id="capture" type="button">Capture</button>
        <button id="share" type="button">Share</button>
        <button id="clear" type="button">Sweep</button>
      </div>

      <div class="stats" id="stats"></div>
    </aside>
  </main>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#garden-canvas")!;
const oracleNode = document.querySelector<HTMLDivElement>("#oracle")!;
const chipsNode = document.querySelector<HTMLDivElement>("#chips")!;
const statsNode = document.querySelector<HTMLDivElement>("#stats")!;
const freezeButton = document.querySelector<HTMLButtonElement>("#freeze")!;
const captureButton = document.querySelector<HTMLButtonElement>("#capture")!;
const shareButton = document.querySelector<HTMLButtonElement>("#share")!;

const ctx = canvas.getContext("2d")!;

const saved = readUrlControls();
let controls: GardenControls = { ...DEFAULT_CONTROLS, ...saved };

const inputs = {
  seed: document.querySelector<HTMLInputElement>("#seed")!,
  mode: document.querySelector<HTMLSelectElement>("#mode")!,
  bloom: document.querySelector<HTMLInputElement>("#bloom")!,
  drift: document.querySelector<HTMLInputElement>("#drift")!,
  gravity: document.querySelector<HTMLInputElement>("#gravity")!,
  pulse: document.querySelector<HTMLInputElement>("#pulse")!,
  chroma: document.querySelector<HTMLInputElement>("#chroma")!,
};

setControlsToUI(controls);
updateUrlState(controls);

const stage = {
  width: 0,
  height: 0,
  dpr: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
};

const pointer = {
  x: 0,
  y: 0,
  active: false,
  down: false,
};

let frozen = false;
let orbiters = createOrbiters(controls.seed, controls);
let spores: Spore[] = [];
let trails: Trail[] = [];
let lastTime = performance.now();
let simulationTime = 0;
let activeTrail: Trail | null = null;

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

canvas.addEventListener("pointermove", (event) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = event.clientX - rect.left;
  pointer.y = event.clientY - rect.top;
  pointer.active = true;
  if (pointer.down && activeTrail) {
    appendTrailPoint(activeTrail, pointer.x, pointer.y, event.pressure || 0.7);
  }
});

canvas.addEventListener("pointerleave", () => {
  pointer.active = false;
  pointer.down = false;
  activeTrail = null;
});

canvas.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  pointer.down = true;
  canvas.setPointerCapture(event.pointerId);
  plantMark(x, y, event.pressure || 0.7);
});

canvas.addEventListener("pointerup", () => {
  pointer.down = false;
  activeTrail = null;
});

canvas.addEventListener("pointercancel", () => {
  pointer.down = false;
  activeTrail = null;
});

document
  .querySelector<HTMLButtonElement>("#randomize")
  ?.addEventListener("click", randomizeDraft);

freezeButton.addEventListener("click", () => {
  frozen = !frozen;
  freezeButton.dataset.state = frozen ? "on" : "off";
  freezeButton.textContent = frozen ? "Thaw" : "Freeze";
});

captureButton.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `${slugify(controls.seed || "quill")}-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

shareButton.addEventListener("click", async () => {
  updateUrlState(controls);
  const url = `${location.origin}${location.pathname}${location.search}${location.hash}`;
  try {
    await navigator.clipboard.writeText(url);
    shareButton.textContent = "Copied";
    window.setTimeout(() => {
      shareButton.textContent = "Share";
    }, 900);
  } catch {
    window.prompt("Copy this URL", url);
  }
});

document
  .querySelector<HTMLButtonElement>("#clear")
  ?.addEventListener("click", clearCanvas);

for (const [key, input] of Object.entries(inputs)) {
  input.addEventListener("input", () => {
    controls = readControlsFromUI();
    orbiters = createOrbiters(controls.seed, controls);
    updateUrlState(controls);
    if (key === "seed" || key === "mode") {
      updateOracle();
    }
  });
}

window.addEventListener("keydown", (event) => {
  if (isTypingTarget(event.target)) {
    return;
  }

  switch (event.key.toLowerCase()) {
    case "r":
      event.preventDefault();
      randomizeDraft();
      break;
    case "f":
      event.preventDefault();
      freezeButton.click();
      break;
    case "c":
      event.preventDefault();
      captureButton.click();
      break;
    case "x":
      event.preventDefault();
      clearCanvas();
      break;
    case " ":
      event.preventDefault();
      plantMark(stage.width * 0.5, stage.height * 0.5, 0.9);
      break;
  }
});

updateOracle();
requestAnimationFrame(tick);

function tick(now: number): void {
  const dt = Math.min(0.04, (now - lastTime) / 1000);
  lastTime = now;
  if (!frozen) {
    simulationTime += dt;
  }
  draw(simulationTime, dt);
  requestAnimationFrame(tick);
}

function draw(simTime: number, dt: number): void {
  const palette = paletteFor(controls.seed, controls.mode, controls.chroma);
  const pulse = mix(0.35, 2.2, controls.pulse / 100);
  const drift = controls.drift / 100;
  const gravity = controls.gravity / 100;
  const bloom = controls.bloom / 100;

  fadeCanvas(simTime, palette);

  const centerX =
    stage.width * 0.5 +
    (pointer.active ? (pointer.x - stage.width * 0.5) * 0.1 : 0);
  const centerY =
    stage.height * 0.52 +
    (pointer.active ? (pointer.y - stage.height * 0.5) * 0.1 : 0);
  const time = simTime;
  const spread = Math.min(stage.width, stage.height) * mix(0.18, 0.42, bloom);

  drawRings(centerX, centerY, spread, palette);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let index = 0; index < orbiters.length; index += 1) {
    const orb = orbiters[index];
    const wobble = Math.sin(time * pulse + orb.phase * 2 + index * 0.17);
    const gravityLift = Math.cos(time * 0.35 + orb.phase) * gravity * 24;
    const orbitRadius =
      orb.radius * mix(0.58, 1.24, bloom) + wobble * orb.wobble * 14 * drift;
    const angle =
      orb.angle + time * orb.speed * 1200 * pulse + wobble * drift * 0.9;
    const x = centerX + Math.cos(angle) * orbitRadius;
    const y = centerY + Math.sin(angle) * orbitRadius + gravityLift;
    const trail = 0.12 + bloom * 0.22;

    drawPetal(x, y, orb, palette, trail);
    drawOrbitLine(centerX, centerY, x, y, palette, trail * 0.7);
  }

  for (const spore of spores) {
    spore.life = Math.max(0, spore.life - dt * (frozen ? 0 : 0.12));
    drawSpore(spore, palette);
  }

  for (const trail of trails) {
    trail.life = Math.max(0, trail.life - dt * (frozen ? 0 : 0.08));
    drawTrail(trail, palette, drift, pulse);
  }

  ctx.restore();

  spores = spores.filter((spore) => spore.life > 0.01);
  trails = trails.filter(
    (trail) => trail.life > 0.02 && trail.points.length > 1,
  );

  drawHud(simTime, palette);
}

function drawRings(
  centerX: number,
  centerY: number,
  spread: number,
  palette: ReturnType<typeof paletteFor>,
): void {
  const rings = 4;
  ctx.save();
  ctx.strokeStyle = hsla(palette.baseHue, 32, 70, 0.18);
  ctx.lineWidth = 1;
  for (let index = 1; index <= rings; index += 1) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, spread * (index / rings), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOrbitLine(
  centerX: number,
  centerY: number,
  x: number,
  y: number,
  palette: ReturnType<typeof paletteFor>,
  alpha: number,
): void {
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(x, y);
  ctx.strokeStyle = hsla(palette.glowHue, 78, 62, alpha * 0.35);
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawPetal(
  x: number,
  y: number,
  orb: Orb,
  palette: ReturnType<typeof paletteFor>,
  alpha: number,
): void {
  const scale = orb.size;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(orb.angle * 0.25);
  ctx.beginPath();
  ctx.ellipse(0, 0, scale * 2.4, scale, orb.angle, 0, Math.PI * 2);
  ctx.fillStyle = hsla(
    (palette.accentHue + orb.hue * 0.35) % 360,
    82,
    64,
    alpha,
  );
  ctx.fill();
  ctx.strokeStyle = hsla(palette.coreHue, 92, 82, alpha * 0.7);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

function drawSpore(spore: Spore, palette: ReturnType<typeof paletteFor>): void {
  const alpha = clamp(spore.life, 0, 1);
  ctx.save();
  ctx.beginPath();
  ctx.arc(
    spore.x,
    spore.y,
    spore.radius * (1 + (1 - alpha) * 0.8),
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = hsla(
    (spore.hue + palette.glowHue) % 360,
    86,
    66,
    alpha * 0.35,
  );
  ctx.fill();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = hsla(palette.coreHue, 92, 86, alpha * 0.55);
  ctx.stroke();
  ctx.restore();
}

function drawTrail(
  trail: Trail,
  palette: ReturnType<typeof paletteFor>,
  drift: number,
  pulse: number,
): void {
  if (trail.points.length < 2) {
    return;
  }

  const alpha = clamp(trail.life, 0, 1);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = hsla(trail.hue, 85, 68, alpha * 0.65);
  ctx.fillStyle = hsla(palette.glowHue, 80, 72, alpha * 0.18);
  ctx.shadowColor = hsla(palette.glowHue, 90, 70, alpha * 0.3);
  ctx.shadowBlur = 16 * alpha;
  ctx.beginPath();
  const head = trail.points[0];
  ctx.moveTo(head.x, head.y);
  for (let index = 1; index < trail.points.length; index += 1) {
    const point = trail.points[index];
    const prev = trail.points[index - 1];
    const mx = (prev.x + point.x) * 0.5;
    const my = (prev.y + point.y) * 0.5;
    ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
  }
  const tail = trail.points[trail.points.length - 1];
  ctx.lineTo(tail.x, tail.y);
  ctx.lineWidth =
    trail.width * mix(0.7, 1.45, pulse / 2.2) * (0.6 + drift * 0.7);
  ctx.stroke();

  for (const point of trail.points) {
    ctx.beginPath();
    ctx.arc(
      point.x,
      point.y,
      trail.width * 0.18 * point.pressure,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = hsla(trail.hue, 78, 80, alpha * 0.3 * point.pressure);
    ctx.fill();
  }

  ctx.restore();
}

function fadeCanvas(
  time: number,
  palette: ReturnType<typeof paletteFor>,
): void {
  const gradient = ctx.createLinearGradient(0, 0, stage.width, stage.height);
  gradient.addColorStop(0, hsla(palette.baseHue, 30, 9, 0.16));
  gradient.addColorStop(1, hsla(palette.coreHue, 28, 12, 0.16));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, stage.width, stage.height);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = hsla(palette.baseHue, 12, 4, 0.16);
  ctx.fillRect(0, 0, stage.width, stage.height);
  ctx.restore();

  const shimmer = Math.sin(time * 1.2) * 0.015 + 0.04;
  ctx.save();
  ctx.globalAlpha = shimmer;
  ctx.fillStyle = hsla(palette.glowHue, 70, 75, 0.12);
  ctx.fillRect(0, 0, stage.width, stage.height);
  ctx.restore();
}

function drawHud(time: number, palette: ReturnType<typeof paletteFor>): void {
  const title = titleFor(controls.seed);
  const oracle = oracleFor(controls.seed, controls.mode);
  oracleNode.innerHTML = `
    <strong>${title}</strong>
    <span>${oracle}</span>
  `;

  chipsNode.innerHTML = `
    <span>seed ${escapeHtml(controls.seed || "untitled")}</span>
    <span>mode ${controls.mode}</span>
    <span>spores ${spores.length}</span>
    <span>trails ${trails.length}</span>
    <span>pulse ${controls.pulse}</span>
  `;

  statsNode.innerHTML = `
    <div><strong>${Math.round(controls.bloom)}</strong><span>bloom</span></div>
    <div><strong>${Math.round(controls.drift)}</strong><span>drift</span></div>
    <div><strong>${Math.round(controls.gravity)}</strong><span>gravity</span></div>
    <div><strong>${Math.round(controls.chroma)}</strong><span>chroma</span></div>
    <div><strong>${frozen ? "paused" : "live"}</strong><span>state</span></div>
    <div><strong>${Math.round(time % 60)}s</strong><span>cycle</span></div>
  `;

  document.documentElement.style.setProperty(
    "--accent-hue",
    String(palette.accentHue.toFixed(2)),
  );
  document.documentElement.style.setProperty(
    "--base-hue",
    String(palette.baseHue.toFixed(2)),
  );
}

function resizeCanvas(): void {
  const rect = canvas.getBoundingClientRect();
  stage.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  stage.width = Math.max(1, rect.width);
  stage.height = Math.max(1, rect.height);
  canvas.width = Math.max(1, Math.floor(rect.width * stage.dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * stage.dpr));
  ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
}

function setControlsToUI(state: GardenControls): void {
  inputs.seed!.value = state.seed;
  inputs.mode!.value = state.mode;
  inputs.bloom!.value = String(state.bloom);
  inputs.drift!.value = String(state.drift);
  inputs.gravity!.value = String(state.gravity);
  inputs.pulse!.value = String(state.pulse);
  inputs.chroma!.value = String(state.chroma);
}

function readControlsFromUI(): GardenControls {
  return {
    seed: inputs.seed!.value.trim() || DEFAULT_CONTROLS.seed,
    mode: inputs.mode!.value as GardenMode,
    bloom: Number(inputs.bloom!.value),
    drift: Number(inputs.drift!.value),
    gravity: Number(inputs.gravity!.value),
    pulse: Number(inputs.pulse!.value),
    chroma: Number(inputs.chroma!.value),
  };
}

function updateOracle(): void {
  oracleNode.textContent = `${titleFor(controls.seed)} / ${oracleFor(controls.seed, controls.mode)}`;
}

function randomizeDraft(): void {
  controls = {
    ...controls,
    seed: randomSeedWord(),
    bloom: randomInt(48, 92),
    drift: randomInt(16, 72),
    gravity: randomInt(10, 56),
    chroma: randomInt(60, 100),
    pulse: randomInt(30, 88),
    mode: randomMode(),
  };
  orbiters = createOrbiters(controls.seed, controls);
  spores = [];
  trails = [];
  activeTrail = null;
  setControlsToUI(controls);
  updateUrlState(controls);
  updateOracle();
}

function clearCanvas(): void {
  spores = [];
  trails = [];
  activeTrail = null;
  pointer.down = false;
}

function plantMark(x: number, y: number, pressure = 1): void {
  activeTrail = createTrail(
    x,
    y,
    controls.seed,
    controls.chroma / 100,
    pressure,
  );
  trails.push(activeTrail);
  spores.push(createSpore(x, y, controls.seed, controls.bloom / 100));
}

function randomSeedWord(): string {
  const words = [
    "moon ink",
    "violet draft",
    "glass glyph",
    "ember line",
    "salt margin",
    "hollow stanza",
    "arc light",
    "feral folio",
  ];
  return words[randomInt(0, words.length - 1)];
}

function randomMode(): GardenMode {
  return ["nebula", "reef", "ember"][randomInt(0, 2)] as GardenMode;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement || target instanceof HTMLSelectElement
  );
}

function readUrlControls(): Partial<GardenControls> {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  if ([...params.keys()].length === 0) {
    return {};
  }

  const seed = params.get("s")?.trim();
  const mode = params.get("m");

  const controls: Partial<GardenControls> = {};
  if (seed) controls.seed = seed;
  if (mode === "nebula" || mode === "reef" || mode === "ember") {
    controls.mode = mode;
  }

  const bloom = parseMaybeNumber(params.get("b"));
  const drift = parseMaybeNumber(params.get("d"));
  const gravity = parseMaybeNumber(params.get("g"));
  const pulse = parseMaybeNumber(params.get("p"));
  const chroma = parseMaybeNumber(params.get("c"));

  if (bloom !== undefined) controls.bloom = bloom;
  if (drift !== undefined) controls.drift = drift;
  if (gravity !== undefined) controls.gravity = gravity;
  if (pulse !== undefined) controls.pulse = pulse;
  if (chroma !== undefined) controls.chroma = chroma;

  return controls;
}

function updateUrlState(state: GardenControls): void {
  const params = new URLSearchParams();
  params.set("s", state.seed);
  params.set("m", state.mode);
  params.set("b", String(state.bloom));
  params.set("d", String(state.drift));
  params.set("g", String(state.gravity));
  params.set("p", String(state.pulse));
  params.set("c", String(state.chroma));
  history.replaceState(
    null,
    "",
    `${location.pathname}${location.search}#${params}`,
  );
}

function parseMaybeNumber(value: string | null): number | undefined {
  if (value === null || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
