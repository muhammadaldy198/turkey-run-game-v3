// Keyboard and pointer input. Held keys give held verbs (slide, and the run itself); one-shot
// presses (jump, dash, hide, gobble, start, pause) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted twice.
// Actions are abstracted, not raw keys: jump is Space/Up/W, slide is Down/S, dash is Shift,
// hide is H, gobble is G, confirm is Space/Enter/click, pause is P/Escape.

export const ACTION_JUMP = 1;
export const ACTION_DASH = 2;
export const ACTION_HIDE = 4;
export const ACTION_GOBBLE = 8;
export const ACTION_CONFIRM = 16;
export const ACTION_PAUSE = 32;

const JUMP = new Set(['Space', 'ArrowUp', 'KeyW']);
const SLIDE = new Set(['ArrowDown', 'KeyS']);
const DASH = new Set(['ShiftLeft', 'ShiftRight']);
const HIDE = new Set(['KeyH']);
const GOBBLE = new Set(['KeyG']);
const CONFIRM = new Set(['Enter', 'KeyR']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  let slide = false;
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (JUMP.has(event.code)) {
      if (!event.repeat) actions |= ACTION_JUMP;
      // Space also confirms on menus; the loop decides which it means by screen.
      if (event.code === 'Space' && !event.repeat) actions |= ACTION_CONFIRM;
    } else if (SLIDE.has(event.code)) slide = true;
    else if (DASH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DASH;
    } else if (HIDE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_HIDE;
    } else if (GOBBLE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_GOBBLE;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (SLIDE.has(event.code)) slide = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    slide = false;
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  return {
    /** True while a slide key is held. */
    sliding() {
      return slide;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
