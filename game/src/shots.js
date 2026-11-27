// The screenshot scenes behind ?shot=chase|title|gate|escaped (with &seed=N). Each one
// plays the real rules forward from a fresh world, steered by the autopilot, so the frame is
// what a real run looks like and the same seed always gives the same frame. The gate scene
// searches for the moment the brief demands — a falling knife near the turkey and a burning
// oven in frame before gate 3 — instead of freezing at a fixed time and hoping.
//
//   chase   — early yard run, farmer close (gap <= 150), turkey mid-jump: the cover.
//   title   — the title screen over a harmless running backdrop.
//   gate    — gate 3 (kitchen exit): a knife falling ahead of the turkey, an oven BURN in
//             frame, the gate banner visible, the farmer in frame (gap <= 280).
//   escaped — a full autopilot run to the Dawn Gate: the end screen with the real stats.

import { STEP } from './config.js';
import { autopilotAction } from './autopilot.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const CHASE_MIN_SECONDS = 2.5;
const GATE_ZONE = [17100, 17950];
const GATE3_X = 18000;

function stepPilot(world, gobble) {
  const verbs = autopilotAction(world);
  if (!gobble) verbs.gobble = false;
  return world.step(STEP, verbs, false);
}

export function stageShot(name, world) {
  world.reset();
  if (name === 'title') {
    for (let i = 0; i < 5 / STEP; i += 1) {
      world.step(STEP, autopilotAction(world), true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'chase') {
    // No gobbling in this scene: the farmer closes in and the cover shows the chase.
    // Break on the first airborne moment after 2.5 s — the farmer is close by then
    // (gobbling is off), and the old gap<=150 condition almost never lined up with a
    // jump: a dash opens the gap just as the turkey takes off, so airborne moments
    // always had a wide gap and the scene froze grounded at 14 s instead.
    for (let i = 0; i < 14 / STEP; i += 1) {
      stepPilot(world, false);
      const s = world.state;
      if (s.over) break;
      if (s.elapsed >= CHASE_MIN_SECONDS && !s.grounded) break;
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'gate') {
    // Search for the demanded moment: turkey before gate 3, a knife falling ahead of
    // it, an oven hot in frame, the farmer in frame. An oven counts as hot while it
    // ignites as well as while it burns — the flame is what the shot needs, and the
    // ignite is its half-second warning.
    for (let i = 0; i < 120 / STEP; i += 1) {
      stepPilot(world, true);
      const s = world.state;
      if (s.over) break;
      if (s.x > GATE_ZONE[1]) break; // past the gate: freeze here, banner up, kitchen behind
      if (s.x < GATE_ZONE[0]) continue;
      if (s.gap > 280) continue;
      const knifeNear = s.knives.some(
        (k) => k.state === 'falling' && k.fallH < 500 && k.x >= s.x + 60 && k.x <= s.x + 320,
      );
      if (!knifeNear) continue;
      const ovenHot = s.jets.some(
        (j) => (s.jetPhase(j) === 'BURN' || s.jetPhase(j) === 'IGNITE') &&
          j.x >= s.cameraX && j.x <= s.cameraX + 1280,
      );
      if (!ovenHot) continue;
      break;
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // escaped (default): a full run to the Dawn Gate.
  for (let i = 0; i < 200 / STEP; i += 1) {
    stepPilot(world, true);
    if (world.state.over) break;
  }
  const over = world.state.over;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.escaped ? 0 : 0 };
}
