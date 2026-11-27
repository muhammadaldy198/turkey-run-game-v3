// GOBBLE OR GONE: The Long Run to Dawn — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window, so no
// rule below depends on the screen size. The track is 1500 metres of side-view running in four
// zones (farmyard -> barn -> kitchen -> woods), chased by a farmer who chases, searches and
// corners, against a 120-second dinner bell that a clean run only just beats.

export const FIELD = { width: 1280, height: 720, groundY: 664 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Metres per pixel of track: the world is 1500 m long. */
export const PX_PER_M = 16;
export const TRACK_M = 1500;
export const TRACK_PX = TRACK_M * PX_PER_M;

/** Four playable zones, each 375 m. The fourth (woods) is the finish, not a backdrop. */
export const ZONES = [
  { name: 'FARMYARD', fromM: 0, toM: 375, sky: ['#ffd9a0', '#ff9e5e'], ground: '#7a9a4e' },
  { name: 'BARN', fromM: 375, toM: 750, sky: ['#ffc27d', '#e26a4e'], ground: '#8a6a3e' },
  { name: 'KITCHEN', fromM: 750, toM: 1125, sky: ['#ffb37a', '#c94f3d'], ground: '#9a7a52' },
  { name: 'WOODS', fromM: 1125, toM: 1500, sky: ['#c98bb8', '#5e4a8a'], ground: '#4e7a44' },
];

export const BELL_SECONDS = 120;

export const TURKEY = {
  width: 60,
  height: 64,
  slideHeight: 34,
  /** Base run speed (px/s): a clean run takes ~104 s of the 120 s bell, so the bell bites. */
  speed: 230,
  jumpV: 1150,
  gravity: 2000,
  /** Screen x the camera holds the turkey at (world scrolls past it). */
  screenX: 360,
};

export const STAMINA = {
  max: 100,
  dashCost: 30,
  dashTime: 1.1,
  dashMult: 1.55,
  regen: 10,
  goldenBonus: 20,
};

export const FARMER = {
  /** The farmer starts close: the chase is on from the first step. */
  gapStart: 150,
  gapMax: 420,
  /** The farmer runs this much faster than the turkey's base run (px/s): the gap
   * closes by this much while the turkey just runs. Dashing opens it; stumbling
   * (speed zero) closes it at the farmer's full speed. */
  close: 8,
  /** Doubled while the bell is under 20 s: the last seconds are a sprint. */
  panicMult: 2,
  panicUnder: 20,
  /** Gap lost on each gate where the farmer cuts the corner. */
  cornerCut: 50,
  /** Gap gained by one gobble (8 s cooldown), and while the farmer runs past a hidden turkey. */
  gobbleGain: 80,
  gobbleCooldown: 8,
  /** While the farmer searches a haystack the gap closes this fast (px/s). */
  searchClose: 16,
  /** Seconds hidden before the farmer stops and searches; then seconds to be found. */
  searchAfter: 2.5,
  searchTime: 3,
  /** Gap reset after the farmer catches the turkey (one feather lost). */
  caughtReset: 220,
  caughtInvuln: 2,
};

export const HIDE = {
  /** Gap the farmer gives up while he runs past a hidden turkey (over ~1.2 s). */
  passGain: 120,
  /** Burst of speed when the turkey bolts out of hiding. */
  burstTime: 0.6,
  burstMult: 1.3,
};

export const FEATHERS = 3;

export const SCORE = {
  corn: 10,
  gateUp: 25,
  golden: 40,
  gateLow: 10,
  /** One point per metre run: distBonus is a real field, wired into the total. */
  perMetre: 1,
  timeBonusMult: 5,
};

export const HAZARD = {
  /** Seconds the turkey is stopped after a stumble, and immune to chain hits. */
  stumbleTime: 0.45,
  stumbleInvuln: 1,
  /** Oven jet cycle (s): warn, then burn, then off. */
  jetPeriod: 1.6,
  jetIgnite: 0.5,
  jetBurn: 0.8,
  jetWidth: 70,
  jetHeight: 90,
  /** A knife starts falling when the turkey is this close to its mark. */
  knifeTrigger: 300,
  knifeGravity: 2600,
  knifeLength: 110,
};

export const PALETTE = {
  backdrop: '#1b1430',
  text: '#fff6e8',
  muted: '#e8d9b8',
  dark: '#2a1e12',
  panel: 'rgba(30, 18, 8, 0.88)',
  gold: '#f2c94c',
  red: '#e5534b',
  green: '#7ec850',
  turkeyBody: '#8a5230',
  turkeyTail: ['#a0522d', '#d2691e', '#e8a33c', '#c96a2e', '#8a4a22'],
  turkeyHead: '#f2e3c9',
  turkeyWattle: '#e5534b',
  farmerShirt: '#3a6ea5',
  farmerOveralls: '#5a4632',
  farmerSkin: '#e8b98a',
  farmerHat: '#d9b25a',
  knifeBlade: '#dfe5ec',
  knifeHandle: '#3a2a1a',
  corn: '#f2c94c',
  cornHusk: '#5e8a3c',
  hay: '#d9a441',
  wood: '#7a5230',
  flame: ['#ffdd55', '#ff9e2e', '#ff5a1e'],
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'gobble-or-gone-v3.best';
