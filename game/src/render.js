// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. The camera holds the turkey at screen x 360 while the four zones scroll past;
// the farmer is drawn only when his screen x is inside the frame (never half-clipped at
// the left edge — that was a v2 defect). Text that holds a number is rebuilt only when
// the number changes, so a frame allocates nothing.

import { FIELD, FONT, PALETTE, TRACK_PX, TURKEY, ZONES } from './config.js';
import { drawBeam, drawBranch, drawCorn, drawCrate, drawFarmer, drawFence, drawGate, drawGround, drawHay, drawHideSpot, drawKnife, drawLog, drawMud, drawOven, drawPine, drawRoot, drawSky, drawTurkey, hash } from './art.js';
import { createHud } from './hud.js';
import { scoreOf, zoneAtX } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** The panel's width; its height grows with its lines. */
const PANEL = { width: 640, top: 150, line: 34, bottom: 74 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const hud = createHud();
  const bestLabel = cachedLabel('BEST ');
  const totalLabel = cachedLabel('TOTAL ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`.trim());
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    text(title, FIELD.width / 2, y + 72, 44, PALETTE.text, 'center', 'bold');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.gold, 'center', 'bold');
  }

  function drawField(state) {
    const zone = zoneAtX(state.x);
    const cam = state.cameraX;
    const shakeX = state.shake > 0 ? (hash(Math.floor(state.elapsed * 60)) - 0.5) * 8 : 0;
    const shakeY = state.shake > 0 ? (hash(Math.floor(state.elapsed * 60) + 7) - 0.5) * 6 : 0;
    context.save();
    context.translate(shakeX, shakeY);
    drawSky(context, zone, cam, state.elapsed);
    // Woods zone: three layers of pines behind the track.
    if (zone.name === 'WOODS') {
      for (let layer = 0; layer < 3; layer += 1) {
        const parallax = 0.25 + layer * 0.2;
        const baseY = FIELD.groundY - layer * 8;
        const startCell = Math.floor((cam * parallax) / 90);
        for (let c = startCell; c < startCell + 18; c += 1) {
          const wx = c * 90 + hash(c * 3 + layer) * 40;
          const sx = wx - cam * parallax;
          drawPine(context, sx, baseY, 0.8 + layer * 0.35, layer === 2 ? '#2e5a26' : layer === 1 ? '#3e6e30' : '#4e7e38');
        }
      }
    }
    drawGround(context, zone, cam);
    const sx = (wx) => wx - cam;
    // Hide spots.
    for (const spot of state.hideSpots) {
      if (sx(spot.x) < -160 || sx(spot.x) > FIELD.width + 40) continue;
      drawHideSpot(context, sx(spot.x), spot.w, spot.kind, state.hidden && state.hideSpot === spot);
    }
    // Corn.
    for (const cob of state.corns) {
      if (cob.taken) continue;
      if (sx(cob.x) < -30 || sx(cob.x) > FIELD.width + 30) continue;
      drawCorn(context, sx(cob.x), cob.h);
    }
    // Hazards.
    for (const hz of state.hazards) {
      if (sx(hz.x) < -180 || sx(hz.x) > FIELD.width + 40) continue;
      if (hz.kind === 'hay') drawHay(context, sx(hz.x), hz.w, hz.h);
      else if (hz.kind === 'fence') drawFence(context, sx(hz.x), hz.w, hz.h);
      else if (hz.kind === 'crate') drawCrate(context, sx(hz.x), hz.w, hz.h);
      else if (hz.kind === 'beam') drawBeam(context, sx(hz.x), hz.w, hz.bottom, hz.top);
      else if (hz.kind === 'branch') drawBranch(context, sx(hz.x), hz.w, hz.bottom, hz.top);
      else if (hz.kind === 'root') drawRoot(context, sx(hz.x), hz.w, hz.h);
      else if (hz.kind === 'log') drawLog(context, sx(hz.x), hz.w, hz.h);
      else if (hz.kind === 'mud') drawMud(context, sx(hz.x), hz.w);
    }
    // Gates (the three beam gates; the Dawn Gate is the finish arch, drawn at the end).
    for (let gi = 0; gi < 3; gi += 1) {
      const gx = sx(state.gateX[gi]);
      if (gx < -200 || gx > FIELD.width + 40) continue;
      drawGate(context, gx, gi, `GATE ${gi + 1} — ${['YARD', 'BARN', 'KITCHEN'][gi]}`);
    }
    // The Dawn Gate at the end of the woods.
    const dawnX = sx(TRACK_PX);
    if (dawnX > -200 && dawnX < FIELD.width + 40) {
      context.fillStyle = '#5a3a22';
      context.fillRect(dawnX - 10, FIELD.groundY - 260, 20, 260);
      context.fillRect(dawnX + 110, FIELD.groundY - 260, 20, 260);
      context.fillStyle = '#3a2410';
      context.fillRect(dawnX - 40, FIELD.groundY - 300, 200, 44);
      text('DAWN GATE', dawnX + 60, FIELD.groundY - 268, 22, PALETTE.gold, 'center', 'bold');
    }
    // Ovens and their flame jets (kitchen).
    for (const jet of state.jets) {
      if (sx(jet.x) < -180 || sx(jet.x) > FIELD.width + 40) continue;
      drawOven(context, sx(jet.x), state.jetPhase(jet), state.elapsed);
    }
    // Knives: falling blades and stuck ones.
    for (const knife of state.knives) {
      if (knife.state === 'waiting') continue;
      if (sx(knife.x) < -40 || sx(knife.x) > FIELD.width + 40) continue;
      drawKnife(context, sx(knife.x), knife.fallH, knife.state === 'stuck' ? 90 : 110, knife.state === 'stuck');
    }
    // Farmer: behind the turkey by the gap; never drawn half-clipped at the left edge.
    const farmerSX = TURKEY.screenX - state.gap;
    if (farmerSX >= 20) {
      drawFarmer(context, farmerSX, FIELD.groundY, {
        runPhase: state.elapsed,
        searching: state.farmerState === 'SEARCH',
        close: state.gap < 150,
      });
    }
    // Turkey.
    const turkeySX = state.x - cam;
    if (!state.hidden) {
      drawTurkey(context, turkeySX, FIELD.groundY - state.h, {
        runPhase: state.elapsed,
        slide: state.sliding,
      });
    } else if (state.hideSpot) {
      // A beak and an eye peek out of the haystack while hidden.
      const hx = sx(state.hideSpot.x) + state.hideSpot.w / 2;
      drawTurkey(context, hx, FIELD.groundY, { runPhase: 0, hidden: true });
    }
    // Woods: drifting leaves.
    if (zone.name === 'WOODS') {
      context.fillStyle = 'rgba(242, 201, 76, 0.8)';
      for (let i = 0; i < 8; i += 1) {
        const lx = ((i * 173 - cam * 0.5 - state.elapsed * 26) % 1400 + 1400) % 1400 - 60;
        const ly = ((i * 97 + state.elapsed * 42) % 480) + 60;
        context.beginPath();
        context.ellipse(lx, ly, 7, 3, 0.6, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.restore();
  }

  function drawDawnWoods(state) {
    // The end screen's backdrop: the dawn woods the game promises, drawn full.
    const woods = ZONES[3];
    drawSky(context, woods, state.cameraX, state.elapsed);
    for (let layer = 0; layer < 3; layer += 1) {
      const baseY = FIELD.groundY - layer * 8;
      for (let c = 0; c < 16; c += 1) {
        drawPine(context, c * 90 + hash(c * 3 + layer) * 40, baseY, 0.9 + layer * 0.4, layer === 2 ? '#2e5a26' : layer === 1 ? '#3e6e30' : '#4e7e38');
      }
    }
    drawGround(context, woods, 0);
    // The turkey, alive, at the left of the frame.
    drawTurkey(context, FIELD.width * 0.18, FIELD.groundY, { runPhase: 0 });
  }

  const TITLE_LINES = [
    '4 zones · 1500 metres · 120 seconds · 1 dinner bell',
    'Jump the hay. Slide under the beams. Hide in the haystacks.',
    'Dash when it counts. Gobble to scare the farmer back.',
    '',
  ];
  const PAUSED_LINES = ['The farmer waits. The bell does not.'];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawField(state);
      TITLE_LINES[3] = bestLabel(best);
      drawPanel('GOBBLE OR GONE', ['THE LONG RUN TO DAWN', ...TITLE_LINES], 'Press Space or click to run');
      return;
    }
    if (screen === SCREEN_OVER) {
      if (state.overReason === 'escaped') {
        drawDawnWoods(state);
      } else {
        drawField(state);
        context.fillStyle = 'rgba(20, 8, 8, 0.55)';
        context.fillRect(0, 0, FIELD.width, FIELD.height);
      }
      const lines = [
        `CORN ${state.corn} × 10 = ${state.corn * 10}`,
        `DISTANCE ${Math.floor(state.distM)}m = ${state.distBonus}`,
        `GATES + GOLDEN ${state.gateBonus}`,
        state.overReason === 'escaped'
          ? `TIME BONUS ${Math.max(0, Math.ceil(state.timeLeft))}s left × 5 = ${state.timeBonus}`
          : 'TIME BONUS 0 — the bell rang',
        totalLabel(scoreOf(state)),
        `FEATHERS ${state.feathers}/3 · GOLDEN ${state.goldenCount}/3`,
      ];
      const title = state.overReason === 'escaped'
        ? 'ESCAPED!'
        : state.overReason === 'bell'
          ? 'THE DINNER BELL RANG'
          : 'CAUGHT FOR DINNER';
      if (state.overReason === 'escaped') {
        lines.unshift('Out the window, into the dawn woods — the sun rises, the turkey lives.');
      }
      drawPanel(title, lines, 'Press Space or click to run again');
      return;
    }
    drawField(state);
    hud.draw(context, state);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
