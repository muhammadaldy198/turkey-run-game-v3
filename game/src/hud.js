// The HUD: one bar, one grid, every number rebuilt only when it changes. Score, corn,
// distance and the dinner bell across the top; feathers and the stamina bar on the right;
// the farmer gap meter under the bar; the stakes ("ESCAPE OR DINNER") written in the frame;
// contextual pills (behind you / corner cut / searching / hide here) beneath the bar.

import { FARMER, FIELD, FONT, PALETTE, TURKEY } from './config.js';
import { scoreOf, zoneAtX } from './world.js';

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

export function createHud() {
  const scoreLabel = cachedLabel('SCORE ');
  const cornLabel = cachedLabel('CORN ');
  const distLabel = cachedLabel('DIST ');
  const bellLabel = cachedLabel('');

  function text(ctx, value, x, y, size, color, align, weight) {
    ctx.font = `${weight || ''} ${size}px ${FONT}`.trim();
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function mmss(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function drawBar(ctx, x, y, w, h, frac, fill, back) {
    ctx.fillStyle = back || 'rgba(0,0,0,0.45)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
  }

  function drawFeather(ctx, x, y, size, alive) {
    ctx.fillStyle = alive ? PALETTE.gold : 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y, size / 2.4, size / 1.6, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /** The in-play HUD over the field. */
  function draw(ctx, state) {
    // Top bar. The left group (score / corn / distance) is laid out from measured
    // widths, not fixed x: three-digit corn and four-digit distance used to run into
    // each other at fixed positions.
    ctx.fillStyle = 'rgba(20, 12, 6, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, 62);
    ctx.font = `bold 26px ${FONT}`;
    let lx = 20;
    const scoreText = scoreLabel(scoreOf(state));
    text(ctx, scoreText, lx, 40, 26, PALETTE.text, 'left', 'bold');
    lx += ctx.measureText(scoreText).width + 24;
    const cornText = cornLabel(state.corn);
    text(ctx, cornText, lx, 40, 26, PALETTE.gold, 'left', 'bold');
    lx += ctx.measureText(cornText).width + 24;
    text(ctx, distLabel(`${Math.floor(state.distM)}m`), lx, 40, 26, PALETTE.text, 'left', 'bold');
    const zone = zoneAtX(state.x);
    text(ctx, `ESCAPE OR DINNER · ${zone.name}`, FIELD.width / 2, 40, 20, PALETTE.text, 'center', 'bold');
    // Bell: red and pulsing under 20 seconds.
    const bellColor = state.timeLeft <= 20 ? (Math.floor(state.elapsed * 4) % 2 ? '#ff6a5e' : '#ffd9a0') : PALETTE.text;
    text(ctx, `BELL ${bellLabel(mmss(state.timeLeft))}`, FIELD.width - 320, 40, 26, bellColor, 'right', 'bold');
    // Feathers (lives).
    for (let i = 0; i < 3; i += 1) {
      drawFeather(ctx, FIELD.width - 290 + i * 26, 34, 20, i < state.feathers);
    }
    // Stamina bar under the bell.
    drawBar(ctx, FIELD.width - 320, 48, 120, 8, state.stamina / 100, '#7ec850');
    text(ctx, 'DASH', FIELD.width - 192, 56, 12, PALETTE.muted, 'left', 'bold');

    // Gap meter: the farmer's distance, with the turkey's own mark.
    const gy = 78;
    ctx.fillStyle = 'rgba(20, 12, 6, 0.6)';
    ctx.fillRect(20, gy, 420, 34);
    const gapFrac = Math.max(0, Math.min(1, state.gap / FARMER.gapMax));
    drawBar(ctx, 30, gy + 8, 300, 10, gapFrac, state.gap < 150 ? '#e5534b' : '#7ec850');
    text(ctx, `FARMER ${Math.max(0, Math.round(state.gap / 16))}m BEHIND`, 340, gy + 18, 16, PALETTE.text, 'left', 'bold');
    // Turkey marker at the right end of the meter, farmer marker by gap.
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(30 + 300, gy + 13, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e5534b';
    ctx.beginPath();
    ctx.arc(30 + 300 * gapFrac, gy + 13, 6, 0, Math.PI * 2);
    ctx.fill();

    // Contextual pill under the bar.
    if (state.pill) {
      const label = state.pill.text;
      ctx.font = `bold 22px ${FONT}`;
      const w = ctx.measureText(label).width + 36;
      ctx.fillStyle = 'rgba(20, 12, 6, 0.8)';
      ctx.beginPath();
      ctx.roundRect((FIELD.width - w) / 2, 126, w, 40, 20);
      ctx.fill();
      text(ctx, label, FIELD.width / 2, 154, 22, '#ffd9a0', 'center', 'bold');
    }

    // Hide prompt when a haystack is near and the turkey could duck in.
    if (!state.hidden && state.nearHide && !state.pill) {
      text(ctx, 'H — HIDE IN THE HAYSTACK', FIELD.width / 2, 200, 20, '#fff6e8', 'center', 'bold');
    }
    // Hidden indicator.
    if (state.hidden) {
      text(ctx, 'HIDDEN — SPACE TO BOLT OUT', FIELD.width / 2, 200, 20, '#7ec850', 'center', 'bold');
    }
  }

  return { draw };
}

/** The turkey's screen x (the camera holds it here) — shared with the renderer. */
export function turkeyScreenX() {
  return TURKEY.screenX;
}
