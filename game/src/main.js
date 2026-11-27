// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the track. ?shot=chase|title|gate|escaped (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot. The title screen runs the world harmlessly behind its panel.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_CAUGHT, EVENT_CORN, EVENT_GATE, EVENT_GOBBLE, EVENT_OVER, EVENT_STUMBLE,
  createWorld,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_DASH, ACTION_GOBBLE, ACTION_HIDE, ACTION_JUMP, ACTION_PAUSE,
  createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { autopilotAction } from './autopilot.js';
import {
  playBell, playCorn, playGate, playGobble, playJump, playStumble, playWin, unlockAudio,
} from './audio.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Sound starts on the first gesture, never before.
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. 3 feathers. 1500 metres. 120 seconds. Outrun the dinner bell.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    const score = world.state.escaped
      ? world.state.corn * 10 + world.state.gateBonus + world.state.distBonus + world.state.timeBonus
      : world.state.corn * 10 + world.state.gateBonus + world.state.distBonus;
    if (score > best) {
      best = score;
      saveBest(best);
    }
    if (world.state.overReason === 'escaped') playWin();
    else if (world.state.overReason === 'bell') playBell();
    else playStumble();
    announce(`Game over. Score ${score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, autopilotAction(world), true);
      return;
    }
    const wasGrounded = world.state.grounded;
    const verbs = {
      jump: !!(actions & ACTION_JUMP),
      dash: !!(actions & ACTION_DASH),
      hide: !!(actions & ACTION_HIDE),
      gobble: !!(actions & ACTION_GOBBLE),
      slide: input.sliding(),
    };
    if (verbs.jump && wasGrounded) playJump();
    const events = world.step(STEP, verbs, false);
    if (events & EVENT_CORN) playCorn();
    if (events & EVENT_STUMBLE) {
      playStumble();
      announce('Stumbled! The farmer closes in.');
    }
    if (events & EVENT_GATE) playGate();
    if (events & EVENT_GOBBLE) playGobble();
    if (events & EVENT_CAUGHT) announce('Caught! One feather lost.');
    if (events & EVENT_OVER) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the bell run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Gobble or Gone: The Long Run to Dawn. Press Space or click to run.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
