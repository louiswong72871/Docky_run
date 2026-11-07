import assert from "node:assert/strict";
import { test } from "node:test";
import {
  begin,
  boxesOverlap,
  createGame,
  decide,
  obstacleBox,
  runnerBox,
  update,
  type Obstacle,
} from "./logic.ts";

function vineAt(x: number): Obstacle {
  return { id: 1, kind: "vine", x, w: 44, h: 44, strike: 220, label: false };
}

test("standing hits a vine and ducking clears it", () => {
  const state = createGame(0, 1);
  begin(state, "play");
  state.spawnIn = 100000;
  state.obstacles = [vineAt(runnerBox(state).x - 6)];

  const standing = createGame(0, 1);
  begin(standing, "play");
  standing.spawnIn = 100000;
  standing.obstacles = [vineAt(runnerBox(standing).x - 6)];
  update(standing, { jumpPressed: false, duckHeld: false });
  assert.equal(standing.phase, "dead");

  for (let frame = 0; frame < 40; frame += 1) {
    update(state, { jumpPressed: false, duckHeld: true });
  }
  assert.equal(state.phase, "running");
  assert.equal(boxesOverlap(runnerBox(state), obstacleBox(vineAt(runnerBox(state).x - 6))), false);
});

test("demo runner survives a long loop", () => {
  for (const seed of [1, 2, 8, 42]) {
    const state = createGame(0, seed);
    begin(state, "demo");
    for (let frame = 0; frame < 9000; frame += 1) {
      update(state, decide(state));
      if (state.phase === "dead") {
        assert.fail(
          `seed ${seed} died at frame ${state.frame} score ${state.score} speed ${state.speed.toFixed(2)} lift ${state.runner.lift.toFixed(1)} duck ${state.runner.ducking} obstacles ${JSON.stringify(state.obstacles)}`,
        );
      }
    }
    assert.ok(state.score > 400, `seed ${seed} score ${state.score}`);
    assert.equal(state.best, 0);
  }
});

test("a player who never jumps hits a barrel", () => {
  const state = createGame(0, 3);
  begin(state, "play");
  for (let frame = 0; frame < 2000; frame += 1) {
    update(state, { jumpPressed: false, duckHeld: false });
    if (state.phase === "dead") return;
  }
  assert.fail("expected a ground obstacle to end the run");
});
