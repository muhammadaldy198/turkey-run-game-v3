// The autopilot: a reference player that plays the real game through the real step()
// function, so the screenshot scenes are what a good run really looks like and the same seed
// always gives the same frame. It is a pure function of the world's state — no randomness —
// and it never hides: hiding is a human choice (duck into a haystack to dodge a knife volley
// at the cost of bell time), and the autopilot wins without it, which is the point.
//
// Decisions, in priority order each step:
//   1. Jump the nearest jumpable threat (hay, fence, crate, root, log, stuck knife, oven jet,
//      gate beam) when its near edge is close enough that the jump arc clears it. The jump
//      window is computed from the actual speed: a dash stretches the jump to ~409 px, so
//      a dashing turkey must jump much earlier, and a dash is never started when a jump is
//      already near — a 409 px jump overshoots the next obstacle.
//   2. Slide under the nearest beam or low branch while it overlaps the turkey.
//   3. A falling knife ahead: dash past it while the blade is still high, or jump it as
//      an obstacle when it will have landed (and stuck) by the time the turkey arrives.
//   4. Gobble when the farmer is close and the cooldown is ready; dash when he is very close.
//   5. At a gate, jump for the upper path (golden feather) when there is stamina to spare,
//      else slide under for the lower path.

import { HAZARD, STAMINA, TURKEY } from './config.js';

const SLIDE_DIST = 150;
const GRAVITY = 2000;

function currentSpeed(state) {
  // Mirrors the world's motion: airborne the turkey keeps its base speed (a dash
  // or burst never stretches a jump), grounded the mud slows it.
  if (!state.grounded) return TURKEY.speed;
  let speed = TURKEY.speed;
  if (state.dashTimer > 0) speed *= STAMINA.dashMult;
  if (state.burstTimer > 0) speed *= 1.3;
  if (state.sliding) speed *= 0.92;
  const cx = state.x + TURKEY.width / 2;
  for (const hz of state.hazards) {
    if (hz.kind === 'mud' && cx >= hz.x && cx <= hz.x + hz.w) speed *= 0.6;
  }
  return speed;
}

/** Seconds until the falling knife's tip reaches the ground. */
function timeToLand(knife) {
  // fallH(t) = fallH - fallV*t - 1300*t^2 = 0
  const a = HAZARD.knifeGravity / 2;
  const b = knife.fallV;
  const c = -knife.fallH;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return Infinity;
  return (-b + Math.sqrt(disc)) / (2 * a);
}

export function autopilotAction(world) {
  const state = world.state;
  const verbs = { jump: false, dash: false, hide: false, gobble: false, slide: false };
  if (state.over || state.hidden) return verbs;
  const front = state.x + TURKEY.width;
  const cx = state.x + TURKEY.width / 2;
  const speed = currentSpeed(state);
  const grounded = state.grounded && state.stumbleTimer <= 0;

  // The jump arc is time-based and the world caps the airborne speed at base, so a
  // jump is always ~264 px no matter what the ground speed is (even while dashing).
  // Jump early enough that the turkey's body clears the far edge on the way down
  // (body 60 px + widest obstacle 80 px + 20 px margin). Using the ground speed here
  // used to open the window to 249 px while dashing — and a 264 px jump taken 249 px
  // out lands on the obstacle.
  const jumpDist = TURKEY.speed * ((2 * TURKEY.jumpV) / GRAVITY);
  const jumpWindow = Math.max(40, jumpDist - 160);

  // --- Nearest jumpable threat: hay, fence, crate, root, log, stuck knife, oven jet. ---
  // --- Nearest slide threat: beam or low branch. A slide is held while the turkey's
  // body still overlaps the bar (down to d = -120), never released early: standing up
  // a step too soon under a beam was the autopilot's killer in testing.
  let nearestJump = Infinity;
  let nearestBeam = Infinity;
  for (const hz of state.hazards) {
    if (hz.kind === 'mud') continue;
    const d = hz.x - front;
    if (hz.kind === 'beam' || hz.kind === 'branch') {
      if (d < -120 || d > 420) continue;
      if (d < nearestBeam) nearestBeam = d;
    } else {
      if (d < -hz.w || d > 420) continue;
      if (d < nearestJump) nearestJump = d;
    }
  }
  for (const knife of state.knives) {
    if (knife.state === 'stuck') {
      const d = knife.x - 8 - front;
      if (d >= -16 && d < nearestJump) nearestJump = d;
    } else if (knife.state === 'falling') {
      // A blade that lands before the turkey arrives is a stuck knife by then:
      // jump it now, while there is still room, instead of running into it.
      const dist = knife.x - cx;
      if (dist < -20 || dist > 420) continue;
      if (timeToLand(knife) < dist / speed) {
        const d = knife.x - 8 - front;
        if (d < nearestJump) nearestJump = d;
      }
    }
  }
  // Oven jets: jump over every flame column, burning or not. Jumping an OFF jet
  // costs nothing, and a BURN that starts while the turkey is 30 px out is already
  // too late to react to — the phase check used to let exactly those kill the run.
  for (const jet of state.jets) {
    const d = jet.x - HAZARD.jetWidth / 2 - front;
    if (d < -HAZARD.jetWidth || d > 420) continue;
    if (d < nearestJump) nearestJump = d;
  }

  // --- Falling knives: dash past while the blade is still high. ---
  // A dash is safe to start anywhere now: the world caps the airborne speed at base,
  // so dashing into a jump no longer stretches it to ~409 px and lands the turkey on
  // the next obstacle. (That was true before the cap, and the 500 px margin it needed
  // starved the farmer gap instead.)
  let knifeDanger = false;
  {
    for (const knife of state.knives) {
      if (knife.state !== 'falling') continue;
      const dist = knife.x - cx;
      if (dist < -20 || dist > 420) continue;
      const tLand = timeToLand(knife);
      const tArrive = dist / speed;
      // The blade is in the turkey's height band while it falls through it; arriving in
      // that window is the danger. Dashing arrives earlier, while the blade is still high.
      const tipAtArrival = knife.fallH - knife.fallV * tArrive - (HAZARD.knifeGravity / 2) * tArrive * tArrive;
      const top = state.h + (state.sliding ? TURKEY.slideHeight : TURKEY.height);
      if (tArrive < tLand && tipAtArrival < top + 30 && tipAtArrival + HAZARD.knifeLength > state.h) {
        knifeDanger = true;
        if (state.stamina >= STAMINA.dashCost && state.dashTimer <= 0) verbs.dash = true;
      }
    }
  }

  // --- Gates: jump for the upper path (golden), slide for the lower one. ---
  // Measured from the turkey's centre, like the crossing itself: the gate is
  // unpassed until the centre crosses it, so any positive distance is a live jump.
  // (Measuring from the front left a dead zone 20–30 px past the beam, where the
  // turkey ran grounded through the gate.)
  let gateDist = Infinity;
  for (let gi = 0; gi < 3; gi += 1) {
    if (state.gates[gi]) continue;
    const d = world.gateX[gi] - cx;
    if (d < gateDist) gateDist = d;
  }

  // Arbitrate by nearest threat: a beam that is nearer than any jumpable obstacle wins
  // the slide; otherwise the jump wins. (The track guarantees 340 px between hazards,
  // so two different verbs are never demanded at once.)
  if (grounded) {
    if (nearestBeam <= SLIDE_DIST && nearestBeam < nearestJump) {
      verbs.slide = true;
    } else if (nearestJump <= jumpWindow && nearestJump >= -20) {
      verbs.jump = true;
    } else if (gateDist <= jumpWindow) {
      // No lower bound: the gate is unpassed while its centre has not crossed it, and
      // jumping with the front already past the beam still clears the crossing.
      // Upper path when there is stamina to spare; the golden feather pays for the dash.
      if (state.stamina >= 40) verbs.jump = true;
      else verbs.slide = true;
    }
  }
  // Keep sliding while the turkey's body is still under the bar.
  if (state.sliding && nearestBeam <= 60 && nearestBeam > -120) verbs.slide = true;

  // --- Farmer: gobble early to keep a buffer, dash when he is close. ---
  if (!knifeDanger) {
    if (state.gap < 150 && state.stamina >= STAMINA.dashCost && state.dashTimer <= 0) {
      verbs.dash = true;
    }
  }
  if (state.gap < 180 && state.gobbleCooldown <= 0) verbs.gobble = true;

  return verbs;
}

/**
 * Run the autopilot forward from a fresh world for at most `maxSeconds` (or until the
 * world ends), returning the world. Headless tests and screenshot staging share this.
 */
export function runAutopilot(world, maxSeconds) {
  const STEP = 1 / 60;
  const limit = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < limit; i += 1) {
    if (world.state.over) break;
    world.step(STEP, autopilotAction(world), false);
  }
  return world;
}
