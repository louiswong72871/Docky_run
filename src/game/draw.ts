import {
  GROUND_Y,
  RUN_X,
  WORLD_H,
  WORLD_W,
  isOverhead,
  obstacleBox,
  padScore,
  runnerBox,
  type GameState,
  type Obstacle,
} from "./logic.ts";

const FONT =
  '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", "WenQuanYi Micro Hei", "Droid Sans Fallback", sans-serif';
const OUTLINE = "#24160f";
const FUR = "#6b4330";
const FUR_DARK = "#3e2618";
const MUZZLE = "#f6d7bc";
const SCARF = "#e0a04a";
const EYE = "#fffaf3";

export interface RenderView {
  now: number;
  shake: number;
  squash: number;
  debug: boolean;
}

export function render(ctx: CanvasRenderingContext2D, state: GameState, view: RenderView): void {
  const distance = state.phase === "ready" ? view.now * 0.012 : state.distance;
  ctx.fillStyle = "#8ecae6";
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = "#d2ae74";
  ctx.fillRect(0, GROUND_Y, WORLD_W, WORLD_H - GROUND_Y);
  ctx.fillStyle = "#4e9a46";
  ctx.fillRect(0, GROUND_Y - 8, WORLD_W, 14);
  const obstacles = state.phase === "ready"
    ? [
        { id: -1, kind: "barrel" as const, x: 390, w: 44, h: 50, strike: 0, label: true },
        { id: -2, kind: "vine" as const, x: 590, w: 44, h: 44, strike: 220, label: true },
      ]
    : state.obstacles;
  for (const obs of obstacles) drawObstacle(ctx, obs, view.now);
  drawGorilla(ctx, state, distance, state.runner.ducking, state.runner.lift);
  if (state.phase === "dead") {
    ctx.fillStyle = "rgba(28, 14, 8, 0.28)";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }
  if (state.phase !== "ready") {
    ctx.fillStyle = "#24160f";
    ctx.font = `800 16px ${FONT}`;
    ctx.fillText(`分數 ${padScore(state.score)}`, 16, 28);
    const best = `最高 ${padScore(state.best)}`;
    ctx.fillText(best, WORLD_W - ctx.measureText(best).width - 16, 28);
  }
  if (view.debug && state.phase === "running") {
    const body = runnerBox(state);
    ctx.strokeStyle = "#ff3355";
    ctx.strokeRect(body.x, body.y, body.w, body.h);
    for (const obs of state.obstacles) {
      const box = obstacleBox(obs);
      ctx.strokeStyle = "#2255ff";
      ctx.strokeRect(box.x, box.y, box.w, box.h);
    }
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle, now: number): void {
  const overhead = isOverhead(obs.kind);
  if (overhead) {
    const sway = Math.sin(now / 260 + obs.id) * 4;
    ctx.strokeStyle = "#5a3a24";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(obs.x - 26, 30);
    ctx.quadraticCurveTo(obs.x + obs.w / 2, 52, obs.x + obs.w + 28, 24);
    ctx.stroke();
    ctx.fillStyle = "#1f6b3a";
    ctx.fillRect(obs.x + sway * 0.2, obs.strike - obs.h, obs.w, obs.h);
    ctx.fillStyle = "#d64545";
    ctx.fillRect(obs.x + 8, obs.strike - 8, obs.w - 16, 6);
  } else {
    ctx.fillStyle = "#d39245";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ctx.fillRect(obs.x, GROUND_Y - obs.h, obs.w, obs.h);
    ctx.strokeRect(obs.x, GROUND_Y - obs.h, obs.w, obs.h);
    ctx.fillStyle = "#5c3b28";
    ctx.fillRect(obs.x, GROUND_Y - obs.h * 0.7, obs.w, 5);
  }
  if (obs.label) {
    const text = overhead ? "蹲" : "跳";
    const y = overhead ? obs.strike - obs.h - 34 : GROUND_Y - obs.h - 34;
    ctx.fillStyle = "#fff8ec";
    ctx.fillRect(obs.x, y, 32, 24);
    ctx.fillStyle = OUTLINE;
    ctx.font = `800 16px ${FONT}`;
    ctx.fillText(text, obs.x + 8, y + 18);
  }
}

function drawGorilla(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  distance: number,
  ducking: boolean,
  lift: number,
): void {
  const swing = lift > 1 ? 1.1 : Math.sin(state.phase === "ready" ? 0.85 : distance * 0.17);
  ctx.save();
  ctx.translate(RUN_X + 46, GROUND_Y - lift);
  if (ducking) ctx.scale(1.1, 0.55);
  ctx.fillStyle = FUR;
  ctx.beginPath();
  ctx.ellipse(8, -70, 28, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(30, -98, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = MUZZLE;
  ctx.beginPath();
  ctx.ellipse(44, -90, 14, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = EYE;
  ctx.beginPath();
  ctx.arc(36, -99, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = OUTLINE;
  ctx.beginPath();
  ctx.arc(38, -99, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = SCARF;
  ctx.fillRect(8, -86, 16, 8);
  ctx.fillStyle = FUR_DARK;
  ctx.fillRect(-8, -46, 14, 46 + swing * 8);
  ctx.fillRect(12, -46, 14, 46 - swing * 8);
  ctx.restore();
}
