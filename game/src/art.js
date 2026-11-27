// Drawing only, no rules: flat Thanksgiving art drawn from shapes — a turkey, a farmer,
// carving knives, ovens, hay, trees and four zone skies. Every decoration is placed by a
// hash of its world x, so the background is stable as the camera scrolls and the same seed
// always paints the same frame.

import { FIELD, FONT, PALETTE } from './config.js';

/** Deterministic 0..1 hash of an integer (for stable decoration placement). */
export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function text(ctx, value, x, y, size, color, align, weight) {
  ctx.font = `${weight || ''} ${size}px ${FONT}`.trim();
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

/** The zone sky: gradient, sun with rays, clouds, birds and a distant farm silhouette. */
export function drawSky(ctx, zone, cameraX, elapsed) {
  const g = ctx.createLinearGradient(0, 0, 0, FIELD.groundY);
  g.addColorStop(0, zone.sky[0]);
  g.addColorStop(1, zone.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD.width, FIELD.groundY);
  // Sun with rays, upper right.
  const sx = 1080;
  const sy = 110;
  ctx.fillStyle = 'rgba(255, 236, 170, 0.9)';
  ctx.beginPath();
  ctx.arc(sx, sy, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 236, 170, 0.55)';
  ctx.lineWidth = 5;
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + elapsed * 0.05;
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(a) * 64, sy + Math.sin(a) * 64);
    ctx.lineTo(sx + Math.cos(a) * 86, sy + Math.sin(a) * 86);
    ctx.stroke();
  }
  // Clouds drift slowly with the camera so the sky is never empty.
  ctx.fillStyle = 'rgba(255, 250, 235, 0.85)';
  for (let i = 0; i < 5; i += 1) {
    const cx = ((i * 317 + 120 - cameraX * 0.12 - elapsed * 6) % 1500 + 1500) % 1500 - 110;
    const cy = 60 + i * 38;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 74, 20, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 34, cy + 6, 52, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Birds.
  ctx.strokeStyle = 'rgba(60, 30, 20, 0.7)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i += 1) {
    const bx = ((i * 211 + 90 - cameraX * 0.2 - elapsed * 24) % 1400 + 1400) % 1400 - 60;
    const by = 150 + (i % 3) * 46 + Math.sin(elapsed * 2 + i) * 6;
    const flap = Math.sin(elapsed * 6 + i * 2) * 6;
    ctx.beginPath();
    ctx.moveTo(bx - 12, by + flap);
    ctx.quadraticCurveTo(bx, by - 8, bx + 12, by + flap);
    ctx.stroke();
  }
  // Distant farm silhouette: barn roofline and windmill on the horizon.
  ctx.fillStyle = 'rgba(90, 50, 30, 0.35)';
  const bx0 = 140 - (cameraX * 0.08) % 1280;
  ctx.beginPath();
  ctx.moveTo(bx0, FIELD.groundY);
  ctx.lineTo(bx0, FIELD.groundY - 70);
  ctx.lineTo(bx0 + 60, FIELD.groundY - 110);
  ctx.lineTo(bx0 + 120, FIELD.groundY - 70);
  ctx.lineTo(bx0 + 120, FIELD.groundY);
  ctx.closePath();
  ctx.fill();
  // Floating feathers drift through the sky half.
  ctx.fillStyle = 'rgba(255, 244, 220, 0.8)';
  for (let i = 0; i < 5; i += 1) {
    const fx = ((i * 389 + 200 - cameraX * 0.15 - elapsed * 14) % 1350 + 1350) % 1350 - 40;
    const fy = 210 + (i % 3) * 60 + Math.sin(elapsed * 1.5 + i * 1.7) * 10;
    ctx.beginPath();
    ctx.ellipse(fx, fy, 9, 4, 0.5 + Math.sin(elapsed + i) * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The ground: dirt with grass tufts, flowers and footprints keyed to world x. */
export function drawGround(ctx, zone, cameraX) {
  ctx.fillStyle = zone.ground;
  ctx.fillRect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.fillRect(0, FIELD.groundY, FIELD.width, 6);
  const startCell = Math.floor(cameraX / 46);
  for (let c = startCell; c < startCell + 32; c += 1) {
    const wx = c * 46;
    const sx = wx - cameraX;
    const r = hash(c);
    if (r < 0.45) {
      // Grass tuft.
      ctx.strokeStyle = zone.name === 'WOODS' ? '#2e5a26' : '#4e7a2e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, FIELD.groundY + 8);
      ctx.lineTo(sx - 5, FIELD.groundY - 8);
      ctx.moveTo(sx + 4, FIELD.groundY + 8);
      ctx.lineTo(sx + 4, FIELD.groundY - 12);
      ctx.moveTo(sx + 9, FIELD.groundY + 8);
      ctx.lineTo(sx + 14, FIELD.groundY - 7);
      ctx.stroke();
    } else if (r < 0.55) {
      // A small autumn flower.
      ctx.fillStyle = ['#ff9e2e', '#e5534b', '#f2c94c'][c % 3];
      ctx.beginPath();
      ctx.arc(sx, FIELD.groundY - 6, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (r < 0.68) {
      // Turkey footprints.
      ctx.fillStyle = 'rgba(60, 35, 15, 0.4)';
      ctx.beginPath();
      ctx.ellipse(sx, FIELD.groundY + 22, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** The turkey: ~60 px wide, fan tail, head and wattle, legs that run. x,y = feet. */
export function drawTurkey(ctx, x, y, opts) {
  const o = opts || {};
  const run = o.runPhase || 0;
  const slide = !!o.slide;
  const hidden = !!o.hidden;
  const legSwing = Math.sin(run * 10) * 10;
  ctx.save();
  ctx.translate(x, y);
  if (slide) ctx.scale(1.25, 0.62);
  if (hidden) ctx.globalAlpha = 0.25;
  // Tail fan: five feathers.
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = PALETTE.turkeyTail[i];
    ctx.beginPath();
    ctx.ellipse(-14 - i * 3, -26 - Math.abs(i - 2) * -4, 10, 26 - Math.abs(i - 2) * 3, -0.5 - i * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  // Body.
  ctx.fillStyle = PALETTE.turkeyBody;
  ctx.beginPath();
  ctx.ellipse(0, -26, 26, 22, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // Wing.
  ctx.fillStyle = '#6e3e22';
  ctx.beginPath();
  ctx.ellipse(-4, -24, 14, 10, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Head and beak.
  ctx.fillStyle = PALETTE.turkeyHead;
  ctx.beginPath();
  ctx.arc(20, -52, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8a33c';
  ctx.beginPath();
  ctx.moveTo(30, -54);
  ctx.lineTo(42, -50);
  ctx.lineTo(30, -47);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1b1430';
  ctx.beginPath();
  ctx.arc(23, -55, 2.4, 0, Math.PI * 2);
  ctx.fill();
  // Wattle.
  ctx.fillStyle = PALETTE.turkeyWattle;
  ctx.beginPath();
  ctx.ellipse(26, -42, 4, 7, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Legs.
  ctx.strokeStyle = '#e8a33c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-6, -8);
  ctx.lineTo(-6 + legSwing, 0);
  ctx.moveTo(6, -8);
  ctx.lineTo(6 - legSwing, 0);
  ctx.stroke();
  ctx.restore();
}

/** The farmer: overalls, hat, pitchfork, and a "!" when he is close. x,y = feet. */
export function drawFarmer(ctx, x, y, opts) {
  const o = opts || {};
  const run = o.runPhase || 0;
  const searching = o.searching;
  const legSwing = Math.sin(run * 10 + 1) * 9;
  ctx.save();
  ctx.translate(x, y);
  // Legs.
  ctx.strokeStyle = PALETTE.farmerOveralls;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-6, -26);
  ctx.lineTo(-6 + legSwing, 0);
  ctx.moveTo(6, -26);
  ctx.lineTo(6 - legSwing, 0);
  ctx.stroke();
  // Body: overalls over a shirt.
  ctx.fillStyle = PALETTE.farmerShirt;
  ctx.fillRect(-14, -62, 28, 38);
  ctx.fillStyle = PALETTE.farmerOveralls;
  ctx.fillRect(-12, -44, 24, 20);
  // Arms: one reaches forward, one holds the pitchfork.
  ctx.strokeStyle = PALETTE.farmerShirt;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(10, -56);
  ctx.lineTo(26, searching ? -78 : -44);
  ctx.stroke();
  // Pitchfork.
  ctx.strokeStyle = '#8a6a3e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(30, -10);
  ctx.lineTo(30, -84);
  ctx.stroke();
  ctx.strokeStyle = '#c9ced6';
  ctx.lineWidth = 3;
  for (let i = -1; i <= 1; i += 1) {
    ctx.beginPath();
    ctx.moveTo(30 + i * 7, -84);
    ctx.lineTo(30 + i * 7, -96);
    ctx.stroke();
  }
  // Head, hat, beard.
  ctx.fillStyle = PALETTE.farmerSkin;
  ctx.beginPath();
  ctx.arc(0, -72, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8e0cc';
  ctx.beginPath();
  ctx.ellipse(0, -62, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.farmerHat;
  ctx.beginPath();
  ctx.ellipse(0, -80, 17, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-9, -96, 18, 16);
  ctx.restore();
  if (o.close) {
    text(ctx, '!', x + 26, y - 108, 34, '#ffdd55', 'center', 'bold');
  }
  if (searching) {
    text(ctx, '?', x + 26, y - 108, 34, '#ffdd55', 'center', 'bold');
  }
}

/** A carving knife: blade over handle. x = centre, tipH = tip height above ground. */
export function drawKnife(ctx, x, tipH, length, stuck) {
  const top = FIELD.groundY - tipH - length;
  const bladeTop = top + length * 0.35;
  // Handle.
  ctx.fillStyle = PALETTE.knifeHandle;
  ctx.fillRect(x - 5, top, 10, length * 0.35);
  // Blade.
  ctx.fillStyle = PALETTE.knifeBlade;
  ctx.beginPath();
  ctx.moveTo(x - 9, bladeTop);
  ctx.lineTo(x + 9, bladeTop);
  ctx.lineTo(x, FIELD.groundY - tipH);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 4, bladeTop + 6);
  ctx.lineTo(x - 2, FIELD.groundY - tipH - 12);
  ctx.stroke();
  if (stuck) {
    ctx.fillStyle = 'rgba(60, 35, 15, 0.5)';
    ctx.beginPath();
    ctx.ellipse(x, FIELD.groundY + 2, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A brick oven with a door; the flame jet rises from its vent when BURN. */
export function drawOven(ctx, x, phase, elapsed) {
  const gy = FIELD.groundY;
  // Brick body.
  ctx.fillStyle = '#8a4a30';
  ctx.fillRect(x - 70, gy - 118, 140, 118);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  for (let r = 0; r < 5; r += 1) {
    ctx.beginPath();
    ctx.moveTo(x - 70, gy - 94 + r * 24);
    ctx.lineTo(x + 70, gy - 94 + r * 24);
    ctx.stroke();
  }
  // Arched door, glowing when the jet burns (and warming up while it ignites).
  ctx.fillStyle = phase === 'BURN' ? '#ff9e2e' : phase === 'IGNITE' ? '#c96a1e' : '#2a1a10';
  ctx.beginPath();
  ctx.moveTo(x - 30, gy);
  ctx.lineTo(x - 30, gy - 52);
  ctx.quadraticCurveTo(x, gy - 78, x + 30, gy - 52);
  ctx.lineTo(x + 30, gy);
  ctx.closePath();
  ctx.fill();
  // Chimney.
  ctx.fillStyle = '#6e3a24';
  ctx.fillRect(x + 38, gy - 150, 26, 40);
  // Flame column from the vent when burning (the hazard itself).
  if (phase === 'BURN') {
    const flick = Math.sin(elapsed * 22) * 8;
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = PALETTE.flame[i];
      ctx.beginPath();
      ctx.moveTo(x - 34 + i * 10, gy);
      ctx.quadraticCurveTo(x - 30 + i * 8 + flick, gy - 60 - i * 14, x + flick * 0.4, gy - 96 - i * 8);
      ctx.quadraticCurveTo(x + 30 - i * 8 - flick, gy - 60 - i * 14, x + 34 - i * 10, gy);
      ctx.closePath();
      ctx.fill();
    }
  } else if (phase === 'IGNITE') {
    // Heating up: a small flame licks up inside the glowing door, so the oven
    // reads hot even before the full burn — a screenshot caught mid-ignite still
    // shows fire, not a cold black arch.
    const flick = Math.sin(elapsed * 18) * 5;
    ctx.fillStyle = PALETTE.flame[0];
    ctx.beginPath();
    ctx.moveTo(x - 20, gy);
    ctx.quadraticCurveTo(x - 14 + flick, gy - 34, x + flick * 0.4, gy - 52);
    ctx.quadraticCurveTo(x + 14 - flick, gy - 34, x + 20, gy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.flame[1];
    ctx.beginPath();
    ctx.moveTo(x - 10, gy);
    ctx.quadraticCurveTo(x - 6 + flick, gy - 20, x + flick * 0.4, gy - 32);
    ctx.quadraticCurveTo(x + 6 - flick, gy - 20, x + 10, gy);
    ctx.closePath();
    ctx.fill();
  }
  text(ctx, 'OVEN — HOT!', x, gy - 128, 17, '#ffd9a0', 'center', 'bold');
}

/** Hay bale, fence, crate, root, log, mud, corn, hide spot, beam, branch, gate, pine. */
export function drawHay(ctx, x, w, h) {
  ctx.fillStyle = PALETTE.hay;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, FIELD.groundY - h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a87c22';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, FIELD.groundY - h / 2, w / 2 - 10, h / 2 - 8, 0, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawFence(ctx, x, w, h) {
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(x, FIELD.groundY - h, 8, h);
  ctx.fillRect(x + w - 8, FIELD.groundY - h, 8, h);
  ctx.fillRect(x, FIELD.groundY - h + 8, w, 8);
  ctx.fillRect(x, FIELD.groundY - 22, w, 8);
}

export function drawCrate(ctx, x, w, h) {
  ctx.fillStyle = '#a8763e';
  ctx.fillRect(x, FIELD.groundY - h, w, h);
  ctx.strokeStyle = '#7a5230';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 3, FIELD.groundY - h + 3, w - 6, h - 6);
  ctx.beginPath();
  ctx.moveTo(x + 3, FIELD.groundY - h + 3);
  ctx.lineTo(x + w - 3, FIELD.groundY - 3);
  ctx.moveTo(x + w - 3, FIELD.groundY - h + 3);
  ctx.lineTo(x + 3, FIELD.groundY - 3);
  ctx.stroke();
}

export function drawBeam(ctx, x, w, bottom, top) {
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(x - 6, FIELD.groundY - top - 30, 12, top + 30);
  ctx.fillRect(x + w - 6, FIELD.groundY - top - 30, 12, top + 30);
  ctx.fillRect(x - 10, FIELD.groundY - top, w + 20, top - bottom);
  ctx.fillStyle = '#f2c94c';
  ctx.fillRect(x - 10, FIELD.groundY - top, w + 20, 5);
}

export function drawBranch(ctx, x, w, bottom, top) {
  // A low woods bough: a thick limb across the slide band, with leaf clusters on
  // top. Same [bottom, top] band as the barn beam, so the picture matches the hit.
  ctx.fillStyle = '#4a3220';
  ctx.fillRect(x - 8, FIELD.groundY - top, w + 16, top - bottom);
  ctx.fillStyle = '#6e4a26';
  ctx.fillRect(x - 8, FIELD.groundY - top, w + 16, 8);
  ctx.fillStyle = '#2f6b2f';
  for (let i = 0; i < 4; i += 1) {
    const lx = x + ((i + 0.5) / 4) * w;
    ctx.beginPath();
    ctx.arc(lx, FIELD.groundY - top - 6, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#3f8b3f';
  ctx.beginPath();
  ctx.arc(x + w * 0.25, FIELD.groundY - top - 12, 9, 0, Math.PI * 2);
  ctx.arc(x + w * 0.7, FIELD.groundY - top - 10, 8, 0, Math.PI * 2);
  ctx.fill();
}

export function drawRoot(ctx, x, w, h) {
  ctx.fillStyle = '#5a4632';
  ctx.beginPath();
  ctx.moveTo(x, FIELD.groundY);
  ctx.quadraticCurveTo(x + w * 0.3, FIELD.groundY - h - 12, x + w * 0.55, FIELD.groundY - h);
  ctx.quadraticCurveTo(x + w * 0.8, FIELD.groundY - h - 8, x + w, FIELD.groundY);
  ctx.closePath();
  ctx.fill();
}

export function drawLog(ctx, x, w, h) {
  ctx.fillStyle = '#6e4a26';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, FIELD.groundY - h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9a06a';
  ctx.beginPath();
  ctx.ellipse(x + w - 6, FIELD.groundY - h / 2, 7, h / 2 - 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawMud(ctx, x, w) {
  ctx.fillStyle = '#5a4026';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, FIELD.groundY + 12, w / 2, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2 - 20, FIELD.groundY + 9, w / 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawCorn(ctx, x, h) {
  const y = FIELD.groundY - h;
  ctx.fillStyle = PALETTE.cornHusk;
  ctx.beginPath();
  ctx.moveTo(x - 12, y + 8);
  ctx.lineTo(x - 18, y + 22);
  ctx.lineTo(x - 6, y + 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.corn;
  ctx.beginPath();
  ctx.ellipse(x, y, 9, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d9a441';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 12);
  ctx.lineTo(x, y + 12);
  ctx.stroke();
}

export function drawHideSpot(ctx, x, w, kind, hidden) {
  if (kind === 'bush') {
    ctx.fillStyle = '#2e5a26';
    ctx.beginPath();
    ctx.arc(x + w / 2 - 20, FIELD.groundY - 26, 34, 0, Math.PI * 2);
    ctx.arc(x + w / 2 + 20, FIELD.groundY - 22, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3e7a30';
    ctx.beginPath();
    ctx.arc(x + w / 2, FIELD.groundY - 40, 26, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'pantry') {
    drawCrate(ctx, x, w * 0.5, 58);
    drawCrate(ctx, x + w * 0.5, w * 0.5, 58);
    ctx.fillStyle = '#8a6a3e';
    ctx.fillRect(x + w * 0.2, FIELD.groundY - 96, w * 0.6, 38);
  } else {
    // Haystack.
    ctx.fillStyle = PALETTE.hay;
    ctx.beginPath();
    ctx.moveTo(x, FIELD.groundY);
    ctx.quadraticCurveTo(x + w / 2, FIELD.groundY - 110, x + w, FIELD.groundY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#a87c22';
    ctx.lineWidth = 3;
    for (let i = 1; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + (w * i) / 4, FIELD.groundY - 8);
      ctx.quadraticCurveTo(x + (w * i) / 4 + 6, FIELD.groundY - 50 - i * 8, x + (w * i) / 4, FIELD.groundY - 84);
      ctx.stroke();
    }
  }
  if (!hidden) {
    ctx.fillStyle = 'rgba(20, 12, 6, 0.75)';
    ctx.beginPath();
    ctx.arc(x + w / 2, FIELD.groundY - 118, 13, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, 'H', x + w / 2, FIELD.groundY - 110, 16, '#fff6e8', 'center', 'bold');
  }
}

export function drawGate(ctx, x, index, label) {
  // Two posts and a beam the turkey jumps over or slides under; the banner names it.
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(x - 8, FIELD.groundY - 190, 16, 190);
  ctx.fillRect(x + 92, FIELD.groundY - 190, 16, 190);
  drawBeam(ctx, x, 100, 46, 110);
  ctx.fillStyle = '#3a2410';
  ctx.fillRect(x - 30, FIELD.groundY - 232, 160, 40);
  ctx.fillStyle = '#f2c94c';
  ctx.font = `bold 20px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(label || `GATE ${index + 1}`, x + 50, FIELD.groundY - 205);
}

export function drawPine(ctx, x, baseY, scale, shade) {
  ctx.fillStyle = '#4a2c1a';
  ctx.fillRect(x - 4, baseY - 26 * scale, 8, 26 * scale);
  ctx.fillStyle = shade;
  for (let i = 0; i < 3; i += 1) {
    const w = (56 - i * 14) * scale;
    const y = baseY - (26 + i * 30) * scale;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x, y - 44 * scale);
    ctx.lineTo(x + w / 2, y);
    ctx.closePath();
    ctx.fill();
  }
}
