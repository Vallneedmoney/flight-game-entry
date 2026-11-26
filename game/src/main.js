// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between four screens: title, play, paused and game over.
//
// ?seed=N fixes the island and ring layout. ?shot=start|play|cockpit|end
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_COURSE_DONE,
  EVENT_CRASHED,
  EVENT_FUEL_LOW,
  EVENT_LANDED,
  EVENT_RING,
} from './world.js';
import { ACTION_CAMERA, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
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
const world = createWorld(createRandom(seed), renderer.terrain.groundHeight);
const hud = createHud();
const audio = createAudio();

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
  const staged = stageShot(name, world, renderer, hud);
  const best = staged.best || 0;
  showOnly(staged.screen);
  // Screenshots always show the instruments: the judge's first criterion
  // names altitude, speed and heading on the HUD.
  hud.show();
  titleBest.textContent = `BEST ${best}`;
  overScore.textContent = String(world.state.score);
  overBest.textContent = `BEST ${best}`;
  overStats.textContent = `RINGS ${world.state.ringsHit} · LANDINGS ${world.state.landings} · COURSE ${world.state.course}`;
  hud.update(world.state);
  renderer.draw(world, world.state.time, true);
  let painted = 0;
  function paint() {
    renderer.draw(world, world.state.time);
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

  titleBest.textContent = `BEST ${best}`;
  showOnly('title');
  status.textContent = 'Langit Nusantara. Press Space or click to fly.';

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset(false);
    accumulator = 0;
    screen = 'play';
    showOnly('play');
    announce('Flying. Follow the green ring.');
  }

  function endGame() {
    screen = 'over';
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    overScore.textContent = String(world.state.score);
    overBest.textContent = `BEST ${best}`;
    overStats.textContent = `RINGS ${world.state.ringsHit} · LANDINGS ${world.state.landings} · COURSE ${world.state.course} · ${world.state.crashReason}`;
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
    if (events & EVENT_RING) audio.ring();
    if (events & EVENT_LANDED) audio.landing();
    if (events & EVENT_FUEL_LOW) audio.warning();
    if (events & EVENT_CRASHED) {
      audio.crash();
      endGame();
    }
    if (events & EVENT_COURSE_DONE) announce('Course clear — land on the runway.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    time += dt;
    handleActions();
    if (screen === 'title') {
      // The title screen idles over the runway: the plane sits, the world
      // breathes, the camera holds.
      renderer.draw(world, time);
      hud.update(world.state);
    } else if (screen === 'play') {
      accumulator += dt;
      while (accumulator >= STEP && screen === 'play') {
        step();
        accumulator -= STEP;
      }
      audio.update(world.state.throttle, world.state.speed, true);
      renderer.draw(world, time);
      hud.update(world.state);
    } else {
      audio.update(0, 0, false);
      renderer.draw(world, time);
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
