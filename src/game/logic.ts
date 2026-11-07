export const WORLD_W = 800;
export const WORLD_H = 360;
export const GROUND_Y = 286;
export const RUN_X = 72;
export const RUN_H = 112;
export const DUCK_H = 60;

const GRAVITY = 0.55;
const JUMP_V = 12;
const START_SPEED = 5.8;
const MAX_SPEED = 12.2;
const ACCEL = 0.0022;
const JUMP_BUFFER = 12;

export type Phase = "ready" | "running" | "dead";
export type Mode = "demo" | "play";
export type ObstacleKind = "barrel" | "crate" | "twin" | "vine" | "bees";

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  x: number;
  w: number;
  h: number;
  strike: number;
  label: boolean;
}

export interface Runner {
  lift: number;
  vel: number;
  ducking: boolean;
  jumpBuffer: number;
}

export interface GameState {
  phase: Phase;
  mode: Mode;
  speed: number;
  distance: number;
  score: number;
  best: number;
  runner: Runner;
  obstacles: Obstacle[];
  spawnIn: number;
  nextId: number;
  rng: number;
  spawned: number;
  frame: number;
}

export interface Input {
  jumpPressed: boolean;
  duckHeld: boolean;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const TUTORIAL: readonly ObstacleKind[] = ["barrel", "barrel", "vine", "crate", "bees", "twin"];

interface KindSpec {
  w: number;
  h: number;
  strike: number;
}

const SPECS: Record<ObstacleKind, KindSpec> = {
  barrel: { w: 44, h: 50, strike: 0 },
  crate: { w: 52, h: 56, strike: 0 },
  twin: { w: 90, h: 48, strike: 0 },
  vine: { w: 44, h: 44, strike: 220 },
  bees: { w: 56, h: 34, strike: 216 },
};

export function isOverhead(kind: ObstacleKind): boolean {
  switch (kind) {
    case "vine":
    case "bees":
      return true;
    case "barrel":
    case "crate":
    case "twin":
      return false;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

export function padScore(score: number): string {
  return Math.max(0, Math.floor(score)).toString().padStart(5, "0");
}

function mulberry32(seed: number): { seed: number; value: number } {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { seed: next >>> 0, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

function takeRand(state: GameState): number {
  const next = mulberry32(state.rng || 1);
  state.rng = next.seed || 1;
  return next.value;
}

export function createGame(best = 0, seed = 1): GameState {
  return {
    phase: "ready",
    mode: "demo",
    speed: START_SPEED,
    distance: 0,
    score: 0,
    best,
    runner: { lift: 0, vel: 0, ducking: false, jumpBuffer: 0 },
    obstacles: [],
    spawnIn: 150,
    nextId: 1,
    rng: seed >>> 0 || 1,
    spawned: 0,
    frame: 0,
  };
}

export function begin(state: GameState, mode: Mode): void {
  const best = state.best;
  const seed = (state.rng + 0x9e3779b9) >>> 0 || 1;
  const next = createGame(best, seed);
  state.phase = "running";
  state.mode = mode;
  state.speed = next.speed;
  state.distance = 0;
  state.score = 0;
  state.best = best;
  state.runner = next.runner;
  state.obstacles = [];
  state.spawnIn = next.spawnIn;
  state.nextId = 1;
  state.rng = next.rng;
  state.spawned = 0;
  state.frame = 0;
}

export function runnerBox(state: GameState): Box {
  const visualH = state.runner.ducking ? DUCK_H : RUN_H;
  return {
    x: RUN_X + 22,
    y: GROUND_Y - state.runner.lift - visualH + 10,
    w: 42,
    h: visualH - 18,
  };
}

export function obstacleBox(obs: Obstacle): Box {
  if (isOverhead(obs.kind)) {
    return { x: obs.x + 8, y: obs.strike - obs.h, w: Math.max(8, obs.w - 16), h: obs.h };
  }
  return { x: obs.x + 6, y: GROUND_Y - obs.h, w: Math.max(8, obs.w - 12), h: Math.max(8, obs.h - 4) };
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function hits(state: GameState): boolean {
  const body = runnerBox(state);
  for (const obs of state.obstacles) {
    if (boxesOverlap(body, obstacleBox(obs))) return true;
  }
  return false;
}

function pickKind(state: GameState): ObstacleKind {
  if (state.spawned < TUTORIAL.length) return TUTORIAL[state.spawned] ?? "barrel";
  const newest = state.obstacles[state.obstacles.length - 1];
  const lastAir = newest ? isOverhead(newest.kind) : false;
  const roll = takeRand(state);
  if (lastAir || roll > 0.36) {
    const groundRoll = takeRand(state);
    if (groundRoll < 0.46) return "barrel";
    if (groundRoll < 0.78) return "crate";
    return "twin";
  }
  return takeRand(state) < 0.55 ? "vine" : "bees";
}

function spawn(state: GameState): void {
  const kind = pickKind(state);
  const spec = SPECS[kind];
  state.obstacles.push({
    id: state.nextId,
    kind,
    x: WORLD_W + 24,
    w: spec.w,
    h: spec.h,
    strike: spec.strike,
    label: state.spawned < 4,
  });
  state.nextId += 1;
  state.spawned += 1;
  state.spawnIn = 340 + state.speed * 38 + takeRand(state) * 170;
}

export function update(state: GameState, input: Input): void {
  if (state.phase !== "running") return;
  state.frame += 1;
  const runner = state.runner;
  runner.ducking = input.duckHeld;
  if (input.jumpPressed) runner.jumpBuffer = JUMP_BUFFER;
  const onGround = runner.lift <= 0 && runner.vel <= 0;
  if (runner.jumpBuffer > 0 && onGround && !runner.ducking) {
    runner.vel = JUMP_V;
    runner.lift = 0;
    runner.jumpBuffer = 0;
  } else if (runner.jumpBuffer > 0) {
    runner.jumpBuffer -= 1;
  }
  const gravity = runner.ducking && runner.lift > 0 ? GRAVITY * 2.65 : GRAVITY;
  runner.vel -= gravity;
  runner.lift += runner.vel;
  if (runner.lift <= 0) {
    runner.lift = 0;
    runner.vel = 0;
  }
  state.distance += state.speed;
  state.score = Math.floor(state.distance / 36);
  if (state.mode === "play" && state.score > state.best) state.best = state.score;
  for (const obs of state.obstacles) obs.x -= state.speed;
  state.obstacles = state.obstacles.filter((obs) => obs.x + obs.w > -90);
  if (hits(state)) {
    state.phase = "dead";
    return;
  }
  state.speed = Math.min(MAX_SPEED, state.speed + ACCEL);
  state.spawnIn -= state.speed;
  if (state.spawnIn <= 0) spawn(state);
}

function nearestThreat(state: GameState): Obstacle | null {
  let best: Obstacle | null = null;
  for (const obs of state.obstacles) {
    if (obs.x + obs.w < RUN_X + 8) continue;
    if (!best || obs.x < best.x) best = obs;
  }
  return best;
}

function cloneState(state: GameState): GameState {
  return { ...state, runner: { ...state.runner }, obstacles: state.obstacles.map((obs) => ({ ...obs })) };
}

function jumpClears(state: GameState, jumpAt: number, threatId: number): boolean {
  const sim = cloneState(state);
  for (let frame = 0; frame < 140; frame += 1) {
    update(sim, { jumpPressed: frame === jumpAt, duckHeld: false });
    if (sim.phase === "dead") return false;
    const still = sim.obstacles.find((obs) => obs.id === threatId);
    if (!still || still.x + still.w < RUN_X + 8) return true;
  }
  return sim.phase !== "dead";
}

function shouldDuck(state: GameState, obs: Obstacle): boolean {
  const lead = state.speed * 16;
  return obs.x < RUN_X + 86 + lead && obs.x + obs.w > RUN_X + 6;
}

const IDLE_INPUT: Input = { jumpPressed: false, duckHeld: false };

export function decide(state: GameState): Input {
  if (state.phase !== "running") return IDLE_INPUT;
  const threat = nearestThreat(state);
  if (!threat) return IDLE_INPUT;
  if (isOverhead(threat.kind)) return { jumpPressed: false, duckHeld: shouldDuck(state, threat) };
  if (state.runner.lift > 0.5 || state.runner.vel > 0) return IDLE_INPUT;
  const distance = threat.x - (RUN_X + 70);
  if (distance > state.speed * 34) return IDLE_INPUT;
  let latest = -1;
  for (let at = 0; at <= 7; at += 1) {
    if (jumpClears(state, at, threat.id)) latest = at;
  }
  return { jumpPressed: latest === 0, duckHeld: false };
}
