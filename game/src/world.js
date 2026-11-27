// The game's rules and state, with no drawing and no browser in it: the turkey, the farmer's
// gap, the four zones, hazards, gates, hiding, dash, the dinner bell and the score. step()
// advances one fixed step and returns what happened as bit flags, so the caller can react
// without the world knowing about screens or sound. Nothing here allocates after createWorld
// returns, and nothing here reads Math.random — the seeded generator at reset() decides the
// whole track, so the same seed always plays the same game.
//
// The bell is the point of v3: the track is 1500 m and a clean run takes ~104 s of the 120 s
// bell, so every stumble, every hide and every slow mud patch eats the time bonus (and, past
// the line, the run itself). distBonus is a real field here — one point per metre run, wired
// into the total — not the dead field v2 left behind.

import {
  BELL_SECONDS, FARMER, FEATHERS, FIELD, HAZARD, HIDE, PX_PER_M, SCORE,
  STAMINA, TRACK_M, TRACK_PX, TURKEY, ZONES,
} from './config.js';
import { farmerOnCaught, farmerOnGateCut, farmerOnGobble, farmerSpeed, farmerStep } from './farmer.js';

export const EVENT_CORN = 1;
export const EVENT_STUMBLE = 2;
export const EVENT_GATE = 4;
export const EVENT_GOLDEN = 8;
export const EVENT_CAUGHT = 16;
export const EVENT_OVER = 32;
export const EVENT_HIDE = 64;
export const EVENT_SEARCH = 128;
export const EVENT_FOUND = 256;
export const EVENT_DASH = 512;
export const EVENT_GOBBLE = 1024;

export function zoneAtM(m) {
  for (const zone of ZONES) if (m >= zone.fromM && m < zone.toM) return zone;
  return ZONES[ZONES.length - 1];
}

export function zoneAtX(x) {
  return zoneAtM(x / PX_PER_M);
}

/** Live total: corn + gates/golden + distance (distBonus) + time bonus once escaped. */
export function scoreOf(state) {
  return state.corn * SCORE.corn + state.gateBonus + state.distBonus + state.timeBonus;
}

function overlaps(aX, aW, bX, bW) {
  return aX < bX + bW && aX + aW > bX;
}

export function createWorld(random) {
  const state = {
    x: 0, h: 0, vh: 0, grounded: true, sliding: false,
    stamina: STAMINA.max, dashTimer: 0, burstTimer: 0, gobbleCooldown: 0,
    hidden: false, hideSpot: null, hiddenTime: 0,
    gap: FARMER.gapStart, farmerState: 'CHASE', farmerTimer: 0,
    feathers: FEATHERS, corn: 0, gateBonus: 0, goldenCount: 0,
    gates: [false, false, false], timeBonus: 0, escaped: false,
    elapsed: 0, timeLeft: BELL_SECONDS, distM: 0, distBonus: 0,
    stumbleTimer: 0, stumbleInvuln: 0, caughtInvuln: 0,
    over: false, overReason: '', best: 0,
    cameraX: 0, shake: 0, nearHide: false,
    pill: null,
    hazards: [], corns: [], hideSpots: [], knives: [], jets: [],
  };
  const gateX = [375, 750, 1125].map((m) => m * PX_PER_M);
  // The renderer needs the gate positions and the jet phase; they live on the state so
  // draw(state, screen, best) has everything in one object.
  state.gateX = gateX;

  function setPill(text, seconds) {
    state.pill = { text, until: state.elapsed + seconds };
  }

  function addCornArc(cx, apexH) {
    // Four cobs on the parabola a jump over the obstacle at cx follows.
    const offsets = [-140, -47, 47, 140];
    const heights = [60, apexH, apexH, 60];
    for (let i = 0; i < 4; i += 1) {
      state.corns.push({ x: cx + offsets[i], h: heights[i], taken: false });
    }
  }

  function addCornLine(x0, count, gap) {
    for (let i = 0; i < count; i += 1) state.corns.push({ x: x0 + i * gap, h: 26, taken: false });
  }

  function buildTrack() {
    state.hazards = [];
    state.corns = [];
    state.hideSpots = [];
    state.knives = [];
    state.jets = [];
    // One walk per zone: hazards are placed in sequence with at least 340 px between
    // them, so one verb (jump or slide) always resolves one hazard and the turkey is
    // grounded again before the next. Independent per-kind loops used to let a beam
    // and a crate (or a root and a branch) land on top of each other, which no single
    // verb can survive — that was the autopilot's killer in testing.
    function walk(zoneFrom, zoneTo, kinds, place, minGap = 340, gapJitter = 180) {
      let x = zoneFrom + 700 + random() * 200;
      let ki = 0;
      while (x < zoneTo - 300) {
        place(kinds[ki % kinds.length], Math.round(x));
        ki += 1;
        x += minGap + random() * gapJitter;
      }
    }
    function jumpHazard(kind, x) {
      // Narrow bodies: a jump taken 100 px out must still be clearing the far edge
      // when the turkey comes down (jump arc ~264 px at base speed).
      const spec = {
        hay: { w: 70, h: 52 },
        fence: { w: 60, h: 60 },
        crate: { w: 60, h: 58 },
        root: { w: 60, h: 44 },
        log: { w: 80, h: 64 },
      }[kind];
      state.hazards.push({ kind, x, w: spec.w, h: spec.h });
      addCornArc(x + spec.w / 2, 170);
    }
    function slideHazard(kind, x) {
      state.hazards.push({ kind, x, w: 60, bottom: 46, top: 110 });
    }
    // FARMYARD 0–6000 px: hay and fences to jump, mud that slows, haystacks to hide in.
    walk(0, 6000, ['hay', 'fence', 'hay', 'mud', 'fence', 'hay'], (kind, x) => {
      if (kind === 'mud') state.hazards.push({ kind, x, w: 220 });
      else jumpHazard(kind, x);
    });
    addCornLine(500, 3, 60);
    addCornLine(3000, 3, 60);
    addCornLine(5200, 3, 60);
    state.hideSpots.push({ x: 2600, w: 120, kind: 'haystack' });
    state.hideSpots.push({ x: 4800, w: 120, kind: 'haystack' });
    // BARN 6000–12000 px: beams to slide under alternate with crates to jump.
    walk(6000, 12000, ['beam', 'crate', 'beam', 'crate', 'hay'], (kind, x) => {
      if (kind === 'beam') slideHazard(kind, x);
      else jumpHazard(kind, x);
    });
    addCornLine(6300, 3, 60);
    addCornLine(9000, 3, 60);
    state.hideSpots.push({ x: 7800, w: 120, kind: 'haystack' });
    state.hideSpots.push({ x: 10500, w: 120, kind: 'haystack' });
    // KITCHEN 12000–18000 px: oven jets and crates on a wider walk (500–620 px),
    // so a falling knife fits between any two of them. The knife marks sit at the
    // midpoint of each gap — the turkey is grounded, not landing from a jump, when
    // it reaches one, and has a full jump of clear ground after it before the next
    // obstacle. A knife on its own grid used to land in a jump's landing zone and
    // was unsurvivable: the turkey could not jump the crate and then the knife
    // inside one 340 px gap. The walk ends at 17400 and the last gap is bounded by
    // 17700, so the last knife sits at most 17550 — far enough before gate 3 that
    // the turkey lands from its jump and takes the gate cleanly, instead of the
    // gate crossing falling in the knife jump's descent.
    const kitchenXs = [];
    walk(12000, 17400, ['jet', 'crate', 'jet', 'crate', 'jet'], (kind, x) => {
      kitchenXs.push(x);
      if (kind === 'jet') state.jets.push({ x, offset: random() * HAZARD.jetPeriod });
      else jumpHazard(kind, x);
    }, 500, 120);
    const bounds = [12000, ...kitchenXs.sort((a, b) => a - b), 17700];
    for (let i = 0; i + 1 < bounds.length; i += 1) {
      const mid = Math.round((bounds[i] + bounds[i + 1]) / 2);
      state.knives.push({ x: mid, state: 'waiting', fallH: 720, fallV: 0 });
    }
    // The kitchen exit must stay dangerous right up to gate 3: one last oven and one
    // last falling knife in the final stretch, so the last 1000 px are not a dead
    // walk to the gate — and so the gate screenshot has a falling knife and a hot
    // oven in frame with the banner. (The walk's last hazard sits near 16700 and its
    // last midpoint knife near 17200, both spent before the gate is even in view.)
    state.jets.push({ x: 17500, offset: random() * HAZARD.jetPeriod });
    state.knives.push({ x: 17700, state: 'waiting', fallH: 720, fallV: 0 });
    addCornLine(12100, 3, 60);
    state.hideSpots.push({ x: 13500, w: 120, kind: 'pantry' });
    state.hideSpots.push({ x: 16200, w: 120, kind: 'pantry' });
    // WOODS 18000–24000 px: roots and logs to jump alternate with low branches to slide.
    walk(18000, 24000, ['root', 'branch', 'log', 'branch', 'root'], (kind, x) => {
      if (kind === 'branch') slideHazard(kind, x);
      else jumpHazard(kind, x);
    });
    addCornLine(18300, 3, 60);
    addCornLine(21000, 3, 60);
    state.hideSpots.push({ x: 19500, w: 120, kind: 'bush' });
    state.hideSpots.push({ x: 22200, w: 120, kind: 'bush' });
    // A hide spot must never share its ground with a hazard: bolting out of one
    // straight into a hay bale would be a trap, not a choice.
    for (const spot of state.hideSpots) {
      for (const hz of state.hazards) {
        if (Math.abs(hz.x - spot.x) < 220) spot.x += 260;
      }
      for (const jet of state.jets) {
        if (Math.abs(jet.x - spot.x) < 220) spot.x += 260;
      }
    }
  }

  function reset() {
    state.x = 0; state.h = 0; state.vh = 0; state.grounded = true; state.sliding = false;
    state.stamina = STAMINA.max; state.dashTimer = 0; state.burstTimer = 0; state.gobbleCooldown = 0;
    state.hidden = false; state.hideSpot = null; state.hiddenTime = 0;
    state.gap = FARMER.gapStart; state.farmerState = 'CHASE'; state.farmerTimer = 0;
    state.feathers = FEATHERS; state.corn = 0; state.gateBonus = 0; state.goldenCount = 0;
    state.gates = [false, false, false]; state.timeBonus = 0; state.escaped = false;
    state.elapsed = 0; state.timeLeft = BELL_SECONDS; state.distM = 0; state.distBonus = 0;
    state.stumbleTimer = 0; state.stumbleInvuln = 0; state.caughtInvuln = 0;
    state.over = false; state.overReason = ''; state.cameraX = 0; state.shake = 0;
    state.nearHide = false;
    state.pill = null;
    buildTrack();
  }

  function jetPhase(jet) {
    const t = (state.elapsed + jet.offset) % HAZARD.jetPeriod;
    if (t < HAZARD.jetIgnite) return 'IGNITE';
    if (t < HAZARD.jetIgnite + HAZARD.jetBurn) return 'BURN';
    return 'IDLE';
  }
  state.jetPhase = jetPhase;

  function nearHideSpot() {
    const cx = state.x + TURKEY.width / 2;
    for (const spot of state.hideSpots) {
      if (cx >= spot.x - 20 && cx <= spot.x + spot.w + 20) return spot;
    }
    return null;
  }

  function doStumble(events) {
    // A stumble stops the turkey for 0.45 s; the gap cost comes from that zero
    // speed against the farmer's full speed (~107 px), not a separate penalty.
    state.stumbleTimer = HAZARD.stumbleTime;
    state.stumbleInvuln = HAZARD.stumbleInvuln;
    state.shake = 0.25;
    return events | EVENT_STUMBLE;
  }

  function doCaught(events) {
    state.feathers -= 1;
    farmerOnCaught(state);
    state.caughtInvuln = FARMER.caughtInvuln;
    state.dashTimer = 0.8;
    if (state.feathers <= 0) {
      state.over = true;
      state.overReason = 'caught';
      return events | EVENT_CAUGHT | EVENT_OVER;
    }
    setPill('CAUGHT! ONE FEATHER LOST — RUN!', 2);
    return events | EVENT_CAUGHT;
  }

  /**
   * One fixed step. `verbs` is { jump, dash, hide, gobble, slide } — jump/dash/hide/gobble
   * are edge presses for this step, slide is held. With `harmless` set (the title screen's
   * backdrop) the turkey runs but nothing touches it and nothing scores.
   */
  function step(dt, verbs, harmless) {
    let events = 0;
    if (state.over) return events;
    state.elapsed += dt;
    state.timeLeft = BELL_SECONDS - state.elapsed;
    if (state.pill && state.elapsed > state.pill.until) state.pill = null;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);

    // The bell: a run that does not finish in 120 s is dinner.
    if (!harmless && state.timeLeft <= 0) {
      state.over = true;
      state.overReason = 'bell';
      return EVENT_OVER;
    }

    // --- Verbs ---------------------------------------------------------------
    if (verbs.hide && !harmless) {
      if (state.hidden) {
        // Bolt out of hiding with a burst of speed.
        state.hidden = false;
        state.hideSpot = null;
        state.burstTimer = HIDE.burstTime;
      } else if (state.grounded) {
        const spot = nearHideSpot();
        if (spot) {
          state.hidden = true;
          state.hideSpot = spot;
          state.hiddenTime = 0;
          events |= EVENT_HIDE;
        }
      }
    }
    if (state.hidden) state.hiddenTime += dt;
    if (verbs.gobble && !harmless && state.gobbleCooldown <= 0 && !state.hidden) {
      farmerOnGobble(state);
      state.gobbleCooldown = FARMER.gobbleCooldown;
      events |= EVENT_GOBBLE;
    }
    if (state.gobbleCooldown > 0) state.gobbleCooldown -= dt;
    if (verbs.dash && !harmless && !state.hidden && state.stamina >= STAMINA.dashCost && state.dashTimer <= 0) {
      state.stamina -= STAMINA.dashCost;
      state.dashTimer = STAMINA.dashTime;
      events |= EVENT_DASH;
    }
    if (state.dashTimer > 0) state.dashTimer -= dt;
    if (state.burstTimer > 0) state.burstTimer -= dt;
    if (state.stamina < STAMINA.max && state.dashTimer <= 0) {
      state.stamina = Math.min(STAMINA.max, state.stamina + STAMINA.regen * dt);
    }
    if (verbs.jump && !harmless) {
      if (state.hidden) {
        state.hidden = false;
        state.hideSpot = null;
        state.burstTimer = HIDE.burstTime;
      } else if (state.grounded && state.stumbleTimer <= 0) {
        state.vh = TURKEY.jumpV;
        state.grounded = false;
        state.sliding = false;
      }
    }
    state.sliding = !state.hidden && verbs.slide && state.grounded && state.stumbleTimer <= 0;

    // --- Motion: the turkey's speed this step --------------------------------
    let speed = TURKEY.speed;
    if (state.dashTimer > 0) speed *= STAMINA.dashMult;
    if (state.burstTimer > 0) speed *= HIDE.burstMult;
    if (state.sliding) speed *= 0.92;
    // The gap is a chase abstraction, not the turkey's feet: a dash counts toward
    // it even mid-jump, so it is taken before the airborne cap below.
    let gapSpeed = speed;
    // Airborne, the turkey keeps its base speed: a dash or burst must not stretch a
    // jump to ~409 px and land it on the next obstacle. A jump's length is set by the
    // ground speed, so it is the same every time and the track spacing can trust it.
    if (!state.grounded) speed = TURKEY.speed;
    if (state.stumbleTimer > 0) {
      speed = 0;
      gapSpeed = 0;
      state.stumbleTimer -= dt;
    }
    if (state.hidden) {
      speed = 0;
      gapSpeed = 0;
    }
    // Mud slows a grounded turkey.
    if (state.grounded && !state.hidden) {
      const cx = state.x + TURKEY.width / 2;
      for (const hz of state.hazards) {
        if (hz.kind === 'mud' && cx >= hz.x && cx <= hz.x + hz.w) {
          speed *= 0.6;
          gapSpeed *= 0.6;
        }
      }
    }

    // --- Farmer: the gap moves by (turkey speed - farmer speed) --------------
    if (!harmless) {
      if (!state.hidden) state.gap += (gapSpeed - farmerSpeed(state)) * dt;
      const farmerBefore = state.farmerState;
      const found = farmerStep(state, dt);
      if (found === 'found' && state.hidden) {
        // The search ran its course and found the turkey in the haystack.
        state.hidden = false;
        state.hideSpot = null;
        events |= EVENT_FOUND;
        events = doCaught(events);
        if (state.over) return events;
      }
      if (state.farmerState === 'SEARCH' && farmerBefore !== 'SEARCH') {
        setPill("HE'S SEARCHING THE HAYSTACKS!", 2.5);
        events |= EVENT_SEARCH;
      }
      if (state.gap < 150 && !state.pill) setPill("HE'S RIGHT BEHIND YOU!", 1.2);
      if (state.gap <= 0 && state.caughtInvuln <= 0) {
        events = doCaught(events);
        if (state.over) return events;
      }
    } else {
      // Title backdrop: the farmer keeps a friendly distance and never catches.
      state.gap = Math.max(200, state.gap - 4 * dt);
    }
    if (state.caughtInvuln > 0) state.caughtInvuln -= dt;
    if (state.stumbleInvuln > 0) state.stumbleInvuln -= dt;

    const prevX = state.x;
    state.x += speed * dt;
    state.distM = state.x / PX_PER_M;
    state.distBonus = Math.floor(state.distM);
    state.cameraX = Math.max(0, Math.min(TRACK_PX - FIELD.width, state.x - TURKEY.screenX));

    // Gravity and landing.
    if (!state.grounded) {
      state.vh -= TURKEY.gravity * dt;
      state.h += state.vh * dt;
      if (state.h <= 0) {
        state.h = 0;
        state.vh = 0;
        state.grounded = true;
      }
    }

    // --- Gates ---------------------------------------------------------------
    for (let gi = 0; gi < 3; gi += 1) {
      if (state.gates[gi]) continue;
      const gx = gateX[gi];
      const cxPrev = prevX + TURKEY.width / 2;
      const cxNow = state.x + TURKEY.width / 2;
      if (cxPrev < gx && cxNow >= gx) {
        state.gates[gi] = true;
        const upper = state.h >= 110;
        if (upper) {
          state.gateBonus += SCORE.gateUp + SCORE.golden;
          state.goldenCount += 1;
          state.stamina = Math.min(STAMINA.max, state.stamina + STAMINA.goldenBonus);
          events |= EVENT_GATE | EVENT_GOLDEN;
          setPill('GOLDEN FEATHER! +65', 1.6);
        } else if (state.sliding) {
          state.gateBonus += SCORE.gateLow;
          events |= EVENT_GATE;
        } else {
          // Ran into the beam grounded: stumble, gate still counts as passed low.
          state.gateBonus += SCORE.gateLow;
          events |= EVENT_GATE;
          if (!harmless && state.stumbleInvuln <= 0) events = doStumble(events);
        }
        if (!harmless) {
          farmerOnGateCut(state);
          setPill('HE CUT THE CORNER!', 1.6);
        }
      }
    }

    // --- Finish --------------------------------------------------------------
    if (!harmless && state.x >= TRACK_PX) {
      state.x = TRACK_PX;
      state.escaped = true;
      state.timeBonus = Math.max(0, Math.ceil(state.timeLeft)) * SCORE.timeBonusMult;
      state.over = true;
      state.overReason = 'escaped';
      return events | EVENT_OVER;
    }

    // --- Knives --------------------------------------------------------------
    const turkeyCX = state.x + TURKEY.width / 2;
    const turkeyTop = state.h + (state.sliding ? TURKEY.slideHeight : TURKEY.height);
    for (const knife of state.knives) {
      if (knife.state === 'waiting') {
        if (turkeyCX > knife.x - HAZARD.knifeTrigger) {
          knife.state = 'falling';
          knife.fallH = 720;
          knife.fallV = 0;
        }
        continue;
      }
      if (knife.state === 'falling') {
        knife.fallV += HAZARD.knifeGravity * dt;
        knife.fallH -= knife.fallV * dt;
        if (knife.fallH <= 0) {
          knife.fallH = 0;
          knife.state = 'stuck';
          continue;
        }
        // A falling blade hits a turkey under it at its height.
        if (!harmless && state.stumbleInvuln <= 0 && !state.hidden &&
            Math.abs(knife.x - turkeyCX) < 36 &&
            knife.fallH < turkeyTop && knife.fallH + HAZARD.knifeLength > state.h) {
          events = doStumble(events);
        }
      }
      // A stuck knife is a jump obstacle 90 px tall (shorter than the falling blade,
      // so a jump taken at the usual distance still clears it on the way down).
      if (knife.state === 'stuck' && !harmless && state.stumbleInvuln <= 0 && !state.hidden &&
          state.h < 90 && overlaps(turkeyCX - TURKEY.width / 2, TURKEY.width, knife.x - 8, 16)) {
        events = doStumble(events);
      }
    }

    // --- Oven jets -----------------------------------------------------------
    for (const jet of state.jets) {
      if (jetPhase(jet) !== 'BURN') continue;
      if (harmless || state.hidden || state.stumbleInvuln > 0) continue;
      // The flame column is dangerous below 90 px: jump over it or be burned.
      if (state.h < HAZARD.jetHeight && overlaps(state.x, TURKEY.width, jet.x - HAZARD.jetWidth / 2, HAZARD.jetWidth)) {
        events = doStumble(events);
      }
    }

    // --- Hazards -------------------------------------------------------------
    if (!harmless && !state.hidden && state.stumbleInvuln <= 0) {
      for (const hz of state.hazards) {
        if (hz.kind === 'mud') continue;
        if (hz.kind === 'beam' || hz.kind === 'branch') {
          // Overhead bar: hits a standing turkey, never a sliding one.
          if (state.h + (state.sliding ? TURKEY.slideHeight : TURKEY.height) > hz.bottom &&
              state.h < hz.top && overlaps(state.x, TURKEY.width, hz.x, hz.w)) {
            events = doStumble(events);
            break;
          }
          continue;
        }
        // Jump obstacles: hit while the turkey's feet are below their top.
        if (state.h < hz.h && overlaps(state.x, TURKEY.width, hz.x, hz.w)) {
          events = doStumble(events);
          break;
        }
      }
    }

    // --- Hide prompt (HUD only) ----------------------------------------------
    state.nearHide = !state.hidden && nearHideSpot() !== null;

    // --- Corn ----------------------------------------------------------------
    if (!harmless && !state.hidden) {
      for (const cob of state.corns) {
        if (cob.taken) continue;
        if (Math.abs(cob.x - turkeyCX) < 46 && cob.h >= state.h - 14 && cob.h <= turkeyTop + 14) {
          cob.taken = true;
          state.corn += 1;
          events |= EVENT_CORN;
        }
      }
    }

    return events;
  }

  reset();
  return { state, reset, step, gateX, jetPhase };
}
