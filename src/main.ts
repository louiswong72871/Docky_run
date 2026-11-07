import { render } from "./game/draw.ts";
import {
  WORLD_H,
  WORLD_W,
  begin,
  createGame,
  decide,
  padScore,
  update,
  type GameState,
  type Input,
  type Mode,
  type Phase,
} from "./game/logic.ts";
import { Sfx } from "./game/sfx.ts";
import "./style.css";

const BEST_KEY = "agang-run-best";
const MUTE_KEY = "agang-run-mute";

function readNumber(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function must<T extends Element>(id: string): T {
  const element = document.querySelector<T>(id);
  if (!element) throw new Error(`找不到 ${id}`);
  return element;
}

const canvas = must<HTMLCanvasElement>("#game");
const context = canvas.getContext("2d");
if (!context) throw new Error("無法建立畫面");
const ctx = context;

const statusEl = must<HTMLParagraphElement>("#status");
const rowStart = must<HTMLDivElement>("#row-start");
const rowDead = must<HTMLDivElement>("#row-dead");
const rowDemo = must<HTMLDivElement>("#row-demo");
const rowPlay = must<HTMLDivElement>("#row-play");
const muteBtn = must<HTMLButtonElement>("#mute");
const jumpBtn = must<HTMLButtonElement>("#jump");
const duckBtn = must<HTMLButtonElement>("#duck");

const sfx = new Sfx(readMuted());
const state: GameState = createGame(readNumber(BEST_KEY), 1);
const debug = new URLSearchParams(location.search).has("debug");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let jumpQueued = false;
let duckKey = false;
let duckPointer = false;
let storedBest = state.best;
let demoHold = 0;
let squash = 0;
let shake = 0;

function saveBest(): void {
  if (state.best === storedBest) return;
  storedBest = state.best;
  try {
    localStorage.setItem(BEST_KEY, String(state.best));
  } catch {
    storedBest = state.best;
  }
}

function syncMute(): void {
  muteBtn.textContent = sfx.muted ? "聲音關" : "聲音開";
  muteBtn.setAttribute("aria-pressed", sfx.muted ? "true" : "false");
}

function syncUi(): void {
  const running = state.phase === "running";
  const deadPlay = state.phase === "dead" && state.mode === "play";
  const demo = state.mode === "demo" && state.phase !== "ready" && !deadPlay;
  rowStart.hidden = state.phase !== "ready";
  rowDead.hidden = !deadPlay;
  rowDemo.hidden = !demo;
  rowPlay.hidden = !(running && state.mode === "play");

  switch (state.phase) {
    case "ready":
      statusEl.textContent = "按「開始播放」，阿剛會自己跳、自己蹲，一直循環。";
      break;
    case "running":
      statusEl.textContent =
        state.mode === "demo"
          ? "正在循環播放。阿剛會自己跳過木桶，也會蹲低避開藤蔓和蜜蜂。"
          : "你來控制。地上的木桶跳過去，頭上的藤蔓和蜜蜂蹲下來。";
      break;
    case "dead":
      statusEl.textContent =
        state.mode === "demo"
          ? "差點撞到，正在重新接上循環。"
          : `撞到了。這次 ${padScore(state.score)} 分，最高 ${padScore(state.best)} 分。`;
      break;
    default: {
      const neverPhase: never = state.phase;
      statusEl.textContent = String(neverPhase);
    }
  }
}

function start(mode: Mode): void {
  sfx.unlock();
  begin(state, mode);
  demoHold = 0;
  shake = 0;
  jumpQueued = false;
  duckKey = false;
  duckPointer = false;
  syncUi();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

function toggleMute(): void {
  sfx.muted = !sfx.muted;
  try {
    localStorage.setItem(MUTE_KEY, sfx.muted ? "1" : "0");
  } catch {
    sfx.muted = sfx.muted;
  }
  syncMute();
}

function onButton(id: string, mode: Mode): void {
  must<HTMLButtonElement>(id).addEventListener("click", () => start(mode));
}

onButton("#watch", "demo");
onButton("#rewatch", "demo");
onButton("#play", "play");
onButton("#retry", "play");
onButton("#takeover", "play");

jumpBtn.addEventListener("click", () => {
  if (state.mode === "play" && state.phase === "running") jumpQueued = true;
});

duckBtn.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  duckBtn.setPointerCapture(event.pointerId);
  duckPointer = true;
});
duckBtn.addEventListener("pointerup", () => {
  duckPointer = false;
});
duckBtn.addEventListener("pointercancel", () => {
  duckPointer = false;
});

canvas.addEventListener("pointerdown", () => {
  if (state.mode === "play" && state.phase === "running") jumpQueued = true;
});

window.addEventListener("keydown", (event) => {
  if (event.code === "KeyM" && !(event.target instanceof HTMLButtonElement)) {
    event.preventDefault();
    toggleMute();
    return;
  }
  if (state.mode !== "play" || state.phase !== "running") return;
  if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") {
    event.preventDefault();
    if (!event.repeat) jumpQueued = true;
  }
  if (event.code === "ArrowDown" || event.code === "KeyS") {
    event.preventDefault();
    duckKey = true;
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowDown" || event.code === "KeyS") duckKey = false;
});

window.addEventListener("blur", () => {
  duckKey = false;
  duckPointer = false;
});

muteBtn.addEventListener("click", () => {
  sfx.unlock();
  toggleMute();
});

function currentPhase(game: GameState): Phase {
  return game.phase;
}

function step(): void {
  const beforeLift = state.runner.lift;
  const beforeDuck = state.runner.ducking;
  const beforeScore = state.score;
  const beforePhase = state.phase;

  if (state.phase === "dead" && state.mode === "demo") {
    demoHold += 1;
    if (demoHold > 28) {
      begin(state, "demo");
      demoHold = 0;
      syncUi();
    }
    return;
  }

  if (state.phase !== "running") {
    jumpQueued = false;
    return;
  }

  const input: Input =
    state.mode === "demo"
      ? decide(state)
      : { jumpPressed: jumpQueued, duckHeld: duckKey || duckPointer };
  jumpQueued = false;
  update(state, input);

  if (beforeLift <= 0 && state.runner.lift > 0) sfx.jump();
  if (!beforeDuck && state.runner.ducking && state.runner.lift <= 0) sfx.duck();
  if (beforeLift > 12 && state.runner.lift === 0) squash = 1;
  if (Math.floor(state.score / 100) > Math.floor(beforeScore / 100)) sfx.mark();

  if (beforePhase === "running" && currentPhase(state) === "dead") {
    sfx.die();
    shake = 9;
    saveBest();
    syncUi();
  } else if (state.mode === "play") {
    saveBest();
  }
}

function fit(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(width / WORLD_W, 0, 0, height / WORLD_H, 0, 0);
}

let last = performance.now();
let acc = 0;
const frameMs = 1000 / 60;

function frame(now: number): void {
  acc += Math.min(80, now - last);
  last = now;
  let guard = 0;
  while (acc >= frameMs && guard < 3) {
    step();
    acc -= frameMs;
    guard += 1;
  }
  squash *= 0.82;
  if (shake > 0) shake *= 0.84;
  fit();
  render(ctx, state, { now, shake: reduceMotion ? 0 : shake, squash, debug });
  requestAnimationFrame(frame);
}

syncMute();
syncUi();
requestAnimationFrame(frame);
