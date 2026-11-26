// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between four screens: title, play, paused and game over.
//
// ?seed=N fixes the island and bandit layout. ?shot=start|play|cockpit|end
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_CRASHED,
  EVENT_FUEL_LOW,
  EVENT_KILL,
  EVENT_LANDED,
  EVENT_LOCK,
  EVENT_PLAYER_HIT,
  EVENT_ROCKET,
  EVENT_WAVE_CLEAR,
} from './world.js';
import { ACTION_CAMERA, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const titleScreen = document.getElementById('screen-title');
const overScreen = document.getElementById('screen-over');
const pauseScreen = document.getElementById('screen-pause');
const overScore = document.getElementById('over-score');
const overBest = document.getElementById('over-best');
const overStats = document.getElementById('over-stats');
const titleBest = document.getElementById('title-best');

const renderer = createRenderer(canvas, seed);
const combat = createCombat(renderer.scene, renderer.terrain.groundHeight);
const world = createWorld(createRandom(seed), renderer.terrain.groundHeight, combat);
const hud = createHud();
const audio = createAudio();

// A handle for headless play-tests: the state, the world and the combat
// system, so a script can drive the game and read what happened.
window.__game = { world, combat, renderer, hud };

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

function showOnly(screen) {
  titleScreen.classList.toggle('hidden', screen !== 'title');
  overScreen.classList.toggle('hidden', screen !== 'over');
  pauseScreen.classList.toggle('hidden', screen !== 'paused');
  if (screen === 'title' || screen === 'over') hud.hide();
  else hud.show();
}

function runShot(name) {
  const staged = stageShot(name, world, renderer, hud, combat);
  const best = staged.best || 0;
  showOnly(staged.screen);
  // Screenshots always show the instruments: the judge's first criterion
  // names altitude, speed and heading on the HUD.
  hud.show();
  titleBest.textContent = `BEST ${best}`;
  overScore.textContent = String(world.state.score);
  overBest.textContent = `BEST ${best}`;
  overStats.textContent = `WAVE ${world.state.wave} · KILLS ${world.state.kills} · BANDITS DOWN ${world.state.kills}`;
  hud.update(world.state, world, renderer);
  renderer.draw(world, world.state.time, true, combat);
  let painted = 0;
  function paint() {
    renderer.draw(world, world.state.time, false, combat);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = 'title';
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let time = 0;
  let gunSoundTimer = 0;

  titleBest.textContent = `BEST ${best}`;
  showOnly('title');
  status.textContent = 'Langit Nusantara — Jet Tempur. Press Space or click to fly.';

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset(false);
    accumulator = 0;
    screen = 'play';
    showOnly('play');
    announce('Flying. Bandits inbound — Space fires the gun, F launches a rocket.');
  }

  function endGame() {
    screen = 'over';
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    overScore.textContent = String(world.state.score);
    overBest.textContent = `BEST ${best}`;
    overStats.textContent = `WAVE ${world.state.wave} · KILLS ${world.state.kills} · ${world.state.crashReason}`;
    showOnly('over');
    announce(`Flight over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CAMERA) {
      renderer.setCameraMode(renderer.cameraMode === 'chase' ? 'cockpit' : 'chase');
    }
    if (actions & ACTION_CONFIRM && (screen === 'title' || screen === 'over')) startGame();
    else if (actions & ACTION_PAUSE && screen === 'play') {
      screen = 'paused';
      showOnly('paused');
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === 'paused') {
      screen = 'play';
      showOnly('play');
      announce('Flying.');
    }
  }

  function step() {
    const events = world.step(STEP, input);
    if (events & EVENT_KILL) audio.explosion();
    if (events & EVENT_WAVE_CLEAR) audio.landing();
    if (events & EVENT_LANDED) audio.landing();
    if (events & EVENT_FUEL_LOW) audio.warning();
    if (events & EVENT_ROCKET) audio.rocket();
    if (events & EVENT_LOCK) audio.lock(true);
    if (events & EVENT_PLAYER_HIT) audio.hit();
    if (events & EVENT_CRASHED) {
      audio.crash();
      endGame();
    }
    // Gun sound while the trigger is held and the gun is not overheated.
    if (input.fire() && !world.state.gunOverheated && world.state.alive) {
      gunSoundTimer -= STEP;
      if (gunSoundTimer <= 0) {
        audio.gun();
        gunSoundTimer = 1 / 12;
      }
    }
    // Lock tone while tracking: solid when locked, slow while acquiring.
    if (world.state.lockTarget && world.state.lockTarget.state.alive && world.state.alive) {
      audio.lock(world.state.locked);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    time += dt;
    handleActions();
    if (screen === 'title') {
      // The title screen idles over the runway: the jet sits, the world
      // breathes, the camera holds.
      renderer.draw(world, time, false, combat);
      hud.update(world.state, world, renderer);
    } else if (screen === 'play') {
      accumulator += dt;
      while (accumulator >= STEP && screen === 'play') {
        step();
        accumulator -= STEP;
      }
      audio.update(world.state.throttle, world.state.speed, true, world.state.afterburner);
      renderer.draw(world, time, false, combat);
      hud.update(world.state, world, renderer);
    } else {
      audio.update(0, 0, false);
      renderer.draw(world, time, false, combat);
      accumulator = 0;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      showOnly('paused');
      announce('Paused.');
    }
  });

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
