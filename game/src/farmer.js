// The farmer: not one number but a small behaviour machine with four states, so the chase
// reads as a farmer who chases, searches and corners the turkey (K2 names all three).
//
//   CHASE  — the gap closes steadily, twice as fast while the bell is under 20 seconds.
//   FLEE   — right after a gobble the farmer recoils and the gap opens (visual only; the
//            gobble's gap gain is applied at once by the world).
//   SEARCH — the turkey has hidden too long: the farmer stops at the haystack, sniffs, and
//            the gap closes twice as fast; stay hidden and he finds the turkey.
//   CORNER — at every gate the farmer cuts the corner: an instant chunk of gap, with a pill
//            telling the player ("HE CUT THE CORNER!").
//
// The world owns the gap number; this module owns the farmer's state and how fast the gap
// moves. Every function here is pure over the state object the world passes in.

import { FARMER, HIDE, TURKEY } from './config.js';

export const FARMER_CHASE = 'CHASE';
export const FARMER_FLEE = 'FLEE';
export const FARMER_SEARCH = 'SEARCH';

/**
 * The farmer's running speed right now (px/s). The gap moves by (turkey speed -
 * farmer speed): he is a little faster than the turkey's base run, twice as much
 * faster while the bell is under 20 seconds, so the last seconds are a sprint.
 * A stumble costs gap through zero turkey speed, not through a separate penalty.
 */
export function farmerSpeed(state) {
  let close = FARMER.close;
  if (state.timeLeft <= FARMER.panicUnder) close *= FARMER.panicMult;
  return TURKEY.speed + close;
}

/** Called when the turkey crosses a gate: the farmer cuts the corner to that gate. */
export function farmerOnGateCut(state) {
  state.gap = Math.max(0, state.gap - FARMER.cornerCut);
}

/** Called when the turkey gobbles: the farmer flinches back for a beat. */
export function farmerOnGobble(state) {
  state.gap = Math.min(FARMER.gapMax, state.gap + FARMER.gobbleGain);
  state.farmerState = FARMER_FLEE;
  state.farmerTimer = 0.8;
}

/** Called when the turkey is caught (gap hit zero): one feather lost, gap reset. */
export function farmerOnCaught(state) {
  state.gap = FARMER.caughtReset;
  state.farmerState = FARMER_CHASE;
  state.farmerTimer = 0;
}

/**
 * One step of the farmer's own clock. Returns 'found' when a search that ran its course
 * finds the hidden turkey (the world turns that into a lost feather), else null.
 */
export function farmerStep(state, dt) {
  if (state.farmerState === FARMER_FLEE) {
    state.farmerTimer -= dt;
    if (state.farmerTimer <= 0) state.farmerState = FARMER_CHASE;
    return null;
  }
  if (state.farmerState === FARMER_SEARCH) {
    // The turkey bolted out while he was searching: the search is over, no find.
    if (!state.hidden) {
      state.farmerState = FARMER_CHASE;
      state.farmerTimer = 0;
      return null;
    }
    state.farmerTimer -= dt;
    if (state.farmerTimer <= 0) {
      state.farmerState = FARMER_CHASE;
      state.farmerTimer = 0;
      return 'found';
    }
    return null;
  }
  // CHASE: while the turkey hides, the farmer runs past the haystack (gap opens) until he
  // has been hidden from too long — then he stops and searches.
  if (state.hidden) {
    state.gap = Math.min(FARMER.gapMax, state.gap + (HIDE.passGain / 1.2) * dt);
    if (state.hiddenTime >= FARMER.searchAfter) {
      state.farmerState = FARMER_SEARCH;
      state.farmerTimer = FARMER.searchTime;
    }
  }
  return null;
}
