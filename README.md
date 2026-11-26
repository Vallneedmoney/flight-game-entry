# Langit Nusantara — Jet Tempur

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Vallneedmoney/flight-game-entry/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Vallneedmoney/flight-game-entry/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A flight game built for the [make.fun](https://make.fun) bounty
**Make the best flight game** (`best-flight-game-20261126-0057`).

Fly a grey jet fighter over a golden-hour Indonesian archipelago: five
islands, a smoking volcano, a lighthouse, palm groves and one lit runway.
Bandits come in waves — get on their tail with the machine gun, hold the
lock diamond steady and send a rocket, then land on the runway to refuel,
repair and re-arm. The jet is forgiving to fly (gentle auto-leveling, a
wide landing envelope) and the fight starts within a minute.

## Play

Open `game/index.html` in a desktop browser (or serve `game/` with any
static server — no build step, no network at runtime).

- **Arrow Up / Down** — pitch
- **Arrow Left / Right** — bank
- **W / S** — throttle · **Shift** — afterburner
- **Space / click** — machine gun (watch the heat)
- **F / right-click** — rocket, needs a lock first
- **A / D** — rudder
- **C** — chase / cockpit camera
- **P** — pause · **M** — sound on/off
- **Space / click** — start, restart

Stall below minimum speed and the nose sags. The gun overheats if you
hold it too long. Land gently on the runway (slow, level, low sink) to
refuel, repair and re-arm. Hit the hills, ditch in the sea or take too
many bandit rounds and the flight is over.

## How it is built

- [three.js](https://threejs.org/) r160, vendored as
  `game/vendor/three.module.min.js` — the only library in the game.
- Everything else is original code in `game/src/`, one file per job:
  `main.js` (boot and loop), `world.js` (jet flight model, waves, lock-on,
  landing), `enemy.js` (bandit model and AI), `combat.js` (tracers,
  rockets, explosions, contrails), `terrain.js` (archipelago, volcano,
  lighthouse, runway), `jet.js` (the player fighter), `render.js`
  (scene and cameras), `hud.js` (instruments, radar, lock diamond),
  `input.js`, `audio.js` (WebAudio synth sounds), `random.js` (seeded
  layout), `shots.js` (staged screenshots).
- `main.ts` (Node 22, standard library only) hands the game in: it copies
  `game/` and `screenshots/` to `/output` and writes `dossier.json`.

Screenshots are real renders of the game's own code, staged with
`?shot=start|play|cockpit|end&seed=1` (see `shots.json`).
