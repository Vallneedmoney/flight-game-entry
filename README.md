# Langit Nusantara — Island Hopper

[![make.fun](https://make.fun/api/competitions/best-flight-game-20261126-0057/badge.svg)](https://make.fun/c/best-flight-game-20261126-0057) [![rank](https://make.fun/api/competitions/best-flight-game-20261126-0057/repo/Vallneedmoney/flight-game-entry/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057) [![reward](https://make.fun/api/competitions/best-flight-game-20261126-0057/repo/Vallneedmoney/flight-game-entry/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

A flight game built for the [make.fun](https://make.fun) bounty
**Make the best flight game** (`best-flight-game-20261126-0057`).

Fly a red-and-white bush plane over a golden-hour Indonesian archipelago:
five islands, a smoking volcano, a lighthouse, palm groves and one lit
runway. Thread the glowing green rings, watch your fuel, and put her down
on the runway to refuel and fly the next course — each one tighter and
windier than the last.

## Play

Open `game/index.html` in a desktop browser (or serve `game/` with any
static server — no build step, no network at runtime).

- **Arrow Up / Down** — pitch
- **Arrow Left / Right** — bank
- **W / S** — throttle
- **A / D** — rudder
- **C** — chase / cockpit camera
- **P** — pause · **M** — sound on/off
- **Space / click** — start, restart

Stall below minimum speed and the nose sags. Land gently on the runway
(low, slow, wings level) to refuel and score. Hit the hills or ditch in
the sea and the flight is over.

## How it is built

- [three.js](https://threejs.org/) r160, vendored as
  `game/vendor/three.module.min.js` — the only library in the game.
- Everything else is original code in `game/src/`, one file per job:
  `main.js` (boot and loop), `world.js` (flight model, rings, missions),
  `terrain.js` (archipelago, volcano, lighthouse, runway),
  `plane.js` (the aircraft), `render.js` (scene and cameras),
  `hud.js` (instruments), `input.js`, `audio.js` (WebAudio synth sounds),
  `random.js` (seeded layout), `shots.js` (staged screenshots).
- `main.ts` (Node 22, standard library only) hands the game in: it copies
  `game/` and `screenshots/` to `/output` and writes `dossier.json`.

Screenshots are real renders of the game's own code, staged with
`?shot=start|play|cockpit|end&seed=1` (see `shots.json`).
