// Keyboard and mouse input. Every frame the game reads a snapshot:
// pitch/roll/rudder in [-1, 1], throttle keys, and one-shot actions
// (confirm, pause, camera, mute) that the loop consumes once.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CAMERA = 4;
export const ACTION_MUTE = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDown = false;

  function code(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyC') actions |= ACTION_CAMERA;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousedown', () => {
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('mouseup', () => {
    mouseDown = false;
  });

  function axis(neg, pos) {
    const n = keys.has(neg) ? 1 : 0;
    const p = keys.has(pos) ? 1 : 0;
    return p - n;
  }

  return {
    // Arcade stick: pitch up is positive, roll right is positive.
    pitch() {
      return axis('ArrowUp', 'ArrowDown') * -1;
    },
    roll() {
      return axis('ArrowLeft', 'ArrowRight');
    },
    rudder() {
      return axis('KeyA', 'KeyD');
    },
    throttleAxis() {
      return axis('KeyS', 'KeyW');
    },
    get mouseDown() {
      return mouseDown;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
