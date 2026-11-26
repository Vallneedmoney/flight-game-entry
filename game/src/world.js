// The flight model and the combat around it: a forgiving jet that banks
// to turn, auto-levels gently with no stick input, stalls when slow, and
// burns fuel fast on the afterburner; bandits that hunt in waves, a gun
// with heat, lock-on rockets, and a runway to land on for fuel, repairs
// and rockets. Pure numbers in, pure numbers out: nothing here touches
// the DOM or three.js, so the model can be driven by the loop or by a shot.
import * as THREE from 'three';
import { ENEMY, GUN, JET, ROCKET, RUNWAY, STEP, WAVES, WORLD } from './config.js';
import { createRandom } from './random.js';
import { createEnemy } from './enemy.js';

export const EVENT_KILL = 1;
export const EVENT_WAVE_CLEAR = 2;
export const EVENT_LANDED = 4;
export const EVENT_CRASHED = 8;
export const EVENT_FUEL_LOW = 16;
export const EVENT_ROCKET = 32;
export const EVENT_PLAYER_HIT = 64;
export const EVENT_LOCK = 128;

export function createWorld(random, groundHeight, combat) {
  const state = {
    // Flight state
    pos: new THREE.Vector3(0, 40, 320),
    heading: Math.PI / 2, // east, down the runway
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0.35,
    afterburner: false,
    verticalSpeed: 0,
    // Resources and score
    fuel: JET.fuelStart,
    health: JET.health,
    rockets: ROCKET.startCount,
    gunHeat: 0,
    gunOverheated: false,
    score: 0,
    best: 0,
    kills: 0,
    wave: 1,
    enemiesLeft: 0,
    time: 0,
    wind: 0,
    alive: true,
    crashed: false,
    crashReason: '',
    message: '',
    messageTime: 0,
    fuelWarned: false,
    // True once the jet has been properly airborne since the last
    // takeoff: a landing only counts when it was flying before it.
    wasAirborne: false,
    // Lock-on state: the bandit under the nose, and how long the track
    // has held steady.
    lockTarget: null,
    lockTime: 0,
    locked: false,
    waveBreak: 0,
    // Hit feedback: when the last round landed and the last kill happened,
    // so the HUD can flash its hitmarker.
    lastHitAt: -99,
    lastKillAt: -99,
  };

  let enemies = [];
  let gunTimer = 0;
  const noseDir = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();

  function computeNoseDir() {
    noseDir.set(
      -Math.sin(state.heading) * Math.cos(state.pitch),
      Math.sin(state.pitch),
      -Math.cos(state.heading) * Math.cos(state.pitch),
    );
    return noseDir;
  }

  function spawnWave(n) {
    const count = Math.min(2 + n, 6);
    const rand = createRandom(5000 + n * 131);
    enemies = [];
    for (let i = 0; i < count; i++) {
      const bearing = rand.range(0, Math.PI * 2);
      const dist = WAVES.spawnDistance + rand.range(-120, 220);
      const x = state.pos.x + Math.sin(bearing) * dist;
      const z = state.pos.z + Math.cos(bearing) * dist;
      const y = Math.max(
        rand.range(WAVES.spawnAltitude[0], WAVES.spawnAltitude[1]),
        groundHeight(x, z) + 80,
      );
      const heading = Math.atan2(-(state.pos.x - x), -(state.pos.z - z));
      const health = ENEMY.baseHealth + (n - 1) * ENEMY.healthPerWave;
      enemies.push(createEnemy(rand, groundHeight, new THREE.Vector3(x, y, z), heading, health));
    }
    state.enemiesLeft = count;
    setMessage(`Wave ${n}: ${count} bandit${count > 1 ? 's' : ''} inbound — guns free.`);
  }

  function reset(keepScore) {
    state.pos.set(0, 8, 120);
    state.heading = RUNWAY.heading;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.throttle = 0.35;
    state.afterburner = false;
    state.verticalSpeed = 0;
    state.fuel = JET.fuelStart;
    state.health = JET.health;
    state.rockets = ROCKET.startCount;
    state.gunHeat = 0;
    state.gunOverheated = false;
    state.alive = true;
    state.crashed = false;
    state.crashReason = '';
    state.time = 0;
    state.wind = 0;
    state.fuelWarned = false;
    state.wasAirborne = false;
    state.lockTarget = null;
    state.lockTime = 0;
    state.locked = false;
    state.waveBreak = 0;
    gunTimer = 0;
    combat.clearStaged();
    if (!keepScore) {
      state.score = 0;
      state.kills = 0;
      state.wave = 1;
    }
    spawnWave(state.wave);
    setMessage('Wave 1: bandits inbound — guns free. Space fires, F launches a rocket.');
  }

  function setMessage(text) {
    state.message = text;
    state.messageTime = 4;
  }

  function crash(reason) {
    if (!state.alive) return;
    state.alive = false;
    state.crashed = true;
    state.crashReason = reason;
    setMessage(reason);
  }

  function onRunway(x, z) {
    const dx = x - RUNWAY.x;
    const dz = z - RUNWAY.z;
    return Math.abs(dx) < RUNWAY.length / 2 && Math.abs(dz) < RUNWAY.width / 2;
  }

  // One fixed step. Returns an event bitmask for the loop to announce.
  function step(dt, input) {
    let events = 0;
    if (!state.alive) return events;
    state.time += dt;
    if (state.messageTime > 0) state.messageTime -= dt;

    // Throttle, then speed eases toward what the throttle can hold.
    // The burner only lights above 70% throttle.
    state.throttle = Math.max(
      0,
      Math.min(1, state.throttle + input.throttleAxis() * JET.throttleRate * dt),
    );
    state.afterburner = input.afterburner() && state.throttle > 0.7 && state.fuel > 0;
    const topSpeed = state.afterburner ? JET.afterburnerSpeed : JET.maxSpeed;
    // On the ground the jet rolls with the throttle and brakes to a stop
    // when it is cut; in the air it cannot fly slower than its minimum
    // speed, so a landing approach holds about 70 m/s on idle.
    const targetSpeed = state.wasAirborne
      ? JET.minSpeed + state.throttle * (topSpeed - JET.minSpeed)
      : state.throttle * topSpeed;
    state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 0.7);
    state.fuel = Math.max(
      0,
      state.fuel -
        (JET.fuelBurn * (0.25 + state.throttle) + (state.afterburner ? JET.afterburnerBurn : 0)) * dt,
    );
    if (state.fuel <= 20 && !state.fuelWarned) {
      state.fuelWarned = true;
      events |= EVENT_FUEL_LOW;
      setMessage('Fuel low — land on the runway soon.');
    }
    if (state.fuel <= 0) {
      state.throttle = 0;
      state.afterburner = false;
      crash('Out of fuel — the engine quit over the sea.');
      return events | EVENT_CRASHED;
    }

    // Attitude: bank toward the stick, pitch toward the stick, both
    // eased. With no stick input the jet gently levels itself, so a new
    // pilot can fly straight within a minute of starting.
    const rollInput = input.roll();
    const pitchInput = input.pitch();
    const targetRoll = rollInput * JET.maxBank;
    let targetPitch = pitchInput * JET.maxPitch;
    // Landing flare assist: low and slow near the ground, the flight
    // controls cap the nose-down angle, so a landing approach cannot
    // turn into a lawn dart by holding the stick down.
    const groundHere = groundHeight(state.pos.x, state.pos.z);
    if (state.pos.y - groundHere < 40 && state.speed < 110) {
      targetPitch = Math.max(-0.1, Math.min(0.1, targetPitch));
    }
    if (rollInput === 0) {
      const level = Math.max(-JET.autoLevelRoll * dt, Math.min(JET.autoLevelRoll * dt, -state.roll));
      state.roll += level;
    } else {
      state.roll += (targetRoll - state.roll) * Math.min(1, dt * JET.rollRate);
    }
    if (pitchInput === 0) {
      const level = Math.max(-JET.autoLevelPitch * dt, Math.min(JET.autoLevelPitch * dt, -state.pitch));
      state.pitch += level;
    } else {
      state.pitch += (targetPitch - state.pitch) * Math.min(1, dt * 3.2);
    }
    // A stalled wing cannot hold the nose up.
    if (state.speed < JET.stallSpeed) {
      state.pitch += (0 - state.pitch) * dt * 0.4;
      state.pitch -= dt * 0.25;
    }
    // Heading follows the bank, plus a touch of rudder.
    state.heading +=
      (-state.roll * JET.turnRate + input.rudder() * 0.25) * dt * (0.4 + state.speed / JET.maxSpeed);

    // Move along the nose direction, then let the nose set the climb.
    // The mesh nose points at local -z, so with heading h the nose is
    // (-sin h, -cos h) in the x/z plane.
    const forward = computeNoseDir();
    const prevY = state.pos.y;
    state.pos.addScaledVector(forward, state.speed * dt);
    state.verticalSpeed = (state.pos.y - prevY) / dt;

    // Soft boundary: past the edge the sea haze turns the jet home.
    const dist = Math.sqrt(state.pos.x * state.pos.x + state.pos.z * state.pos.z);
    if (dist > WORLD.radius) {
      const home = Math.atan2(-state.pos.x, -state.pos.z) + Math.PI;
      let diff = home - state.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      state.heading += Math.max(-1, Math.min(1, diff)) * dt * 0.8;
      setMessage('Edge of the chart — turning back.');
    }

    // --- lock-on: the nearest bandit inside the nose cone ---
    // The lock sticks to its bandit while it stays in the cone: if a
    // second bandit crosses the cone the lock must not flicker between
    // targets and reset, or a firing pass never gets a tone.
    const inCone = (enemy) => {
      if (!enemy.state.alive) return false;
      tmpV.subVectors(enemy.state.pos, state.pos);
      const d = tmpV.length();
      if (d > ROCKET.lockRange) return false;
      tmpV.normalize();
      return Math.acos(Math.max(-1, Math.min(1, tmpV.dot(forward)))) <= ROCKET.lockAngle;
    };
    let bestLock =
      state.lockTarget && inCone(state.lockTarget) ? state.lockTarget : null;
    if (!bestLock) {
      let bestLockScore = Infinity;
      for (const enemy of enemies) {
        if (!enemy.state.alive) continue;
        tmpV.subVectors(enemy.state.pos, state.pos);
        const d = tmpV.length();
        if (d < bestLockScore && inCone(enemy)) {
          bestLockScore = d;
          bestLock = enemy;
        }
      }
    }
    const wasLocked = state.locked;
    if (bestLock) {
      if (state.lockTarget === bestLock) state.lockTime += dt;
      else {
        state.lockTarget = bestLock;
        state.lockTime = 0;
      }
      state.locked = state.lockTime >= ROCKET.lockTime;
    } else {
      state.lockTarget = null;
      state.lockTime = Math.max(0, state.lockTime - dt * 2);
      state.locked = false;
    }
    if (state.locked && !wasLocked) events |= EVENT_LOCK;

    // --- the gun: hold Space or the mouse, watch the heat ---
    state.gunHeat = Math.max(0, state.gunHeat - GUN.coolPerSecond * dt);
    if (state.gunOverheated && state.gunHeat <= GUN.coolTo) state.gunOverheated = false;
    gunTimer -= dt;
    if (input.fire() && !state.gunOverheated && gunTimer <= 0) {
      gunTimer = 1 / GUN.roundsPerSecond;
      state.gunHeat += GUN.heatPerRound;
      if (state.gunHeat >= GUN.overheatAt) {
        state.gunOverheated = true;
        setMessage('Gun overheated — let it cool.');
      }
      tmpV.copy(forward);
      tmpV.x += (Math.random() - 0.5) * GUN.spread * 2;
      tmpV.y += (Math.random() - 0.5) * GUN.spread * 2;
      tmpV.z += (Math.random() - 0.5) * GUN.spread * 2;
      tmpV.normalize();
      tmpV2.copy(state.pos).addScaledVector(forward, 8);
      tmpV2.y -= 0.5;
      combat.fireGun(tmpV2, tmpV);
    }

    // --- rockets: F fires at the locked bandit, or straight ahead ---
    if (input.rocket() && state.rockets > 0) {
      const target = state.locked ? state.lockTarget : null;
      tmpV2.copy(state.pos).addScaledVector(forward, 10);
      tmpV.copy(forward);
      if (combat.fireMissile(tmpV2, tmpV, target)) {
        state.rockets -= 1;
        events |= EVENT_ROCKET;
        setMessage(target ? 'Fox two — missile away.' : 'Rocket away — no lock.');
      }
    }

    // --- the bandits fly, evade and shoot back ---
    const missileThreat = new Set();
    for (const m of combat.missiles) {
      if (m.active && m.target) missileThreat.add(m.target);
    }
    for (const enemy of enemies) {
      if (!enemy.state.alive) continue;
      enemy.step(dt, state, missileThreat.has(enemy), state.time);
      if (enemy.state.wantFire) {
        // Lead the player by the tracer's flight time.
        const toPlayer = tmpV.subVectors(state.pos, enemy.state.pos);
        const flightTime = toPlayer.length() / (GUN.muzzleSpeed * 0.9);
        tmpV2.copy(state.pos).addScaledVector(forward, state.speed * flightTime);
        combat.fireEnemyShot(enemy.state.pos, tmpV2);
      }
    }

    // --- ramming: a mid-air collision hurts both sides ---
    for (const enemy of enemies) {
      if (!enemy.state.alive) continue;
      if (enemy.state.pos.distanceTo(state.pos) < 9) {
        const killed = enemy.damage(999);
        combat.explode(enemy.state.pos);
        state.health -= ENEMY.ramDamage;
        events |= EVENT_PLAYER_HIT;
        setMessage('Mid-air collision — the bandit is gone, your jet is hurt.');
        if (killed) {
          state.kills += 1;
          state.score += WAVES.killScoreGun;
          events |= EVENT_KILL;
        }
        if (state.health <= 0) {
          crash('Rammed by a bandit over the islands.');
          return events | EVENT_CRASHED;
        }
      }
    }

    // --- projectiles and effects ---
    combat.step(dt, {
      playerPos: state.pos,
      enemies,
      onPlayerHit(damage) {
        state.health -= damage;
        events |= EVENT_PLAYER_HIT;
        if (state.health <= 0) {
          crash('Shot down — a bandit got the better of you.');
        }
      },
      onEnemyHit(enemy, damage, _point, byRocket) {
        state.lastHitAt = state.time;
        const killed = enemy.damage(damage);
        if (killed) {
          state.lastKillAt = state.time;
          combat.explode(enemy.state.pos);
          state.kills += 1;
          state.score += byRocket ? WAVES.killScoreRocket : WAVES.killScoreGun;
          events |= EVENT_KILL;
          setMessage(
            byRocket
              ? `Splash — bandit down. +${WAVES.killScoreRocket}.`
              : `Bandit down. +${WAVES.killScoreGun}.`,
          );
        }
      },
    });

    // --- waves: clear the sky, earn a bonus, face the next ---
    state.enemiesLeft = enemies.filter((e) => e.state.alive).length;
    if (state.enemiesLeft === 0 && state.waveBreak <= 0) {
      state.score += WAVES.waveClearScore;
      state.rockets = Math.min(ROCKET.maxCount, state.rockets + WAVES.rocketsPerWave);
      state.wave += 1;
      state.waveBreak = 3;
      events |= EVENT_WAVE_CLEAR;
      setMessage(`Wave clear — +${WAVES.waveClearScore}. Next wave inbound.`);
    }
    if (state.waveBreak > 0) {
      state.waveBreak -= dt;
      if (state.waveBreak <= 0) spawnWave(state.wave);
    }

    // Ground and water: a good landing refuels, repairs and re-arms; a
    // runway roll lets the jet gather speed for takeoff, anything else
    // is a crash.
    const ground = groundHeight(state.pos.x, state.pos.z);
    const clearance = state.pos.y - ground;
    if (clearance > 15) state.wasAirborne = true;
    if (clearance <= JET.gearHeight) {
      const onStrip = onRunway(state.pos.x, state.pos.z) && Math.abs(ground - 6) < 1;
      const gentle =
        state.verticalSpeed > -JET.landingSinkMax &&
        state.speed < JET.landingSpeedMax &&
        Math.abs(state.roll) < 0.3;
      if (onStrip && gentle && state.wasAirborne && state.pos.y - 6 < 4) {
        state.pos.y = 6 + JET.gearHeight;
        state.score += WAVES.landingScore;
        state.fuel = JET.fuelStart;
        state.fuelWarned = false;
        state.health = JET.health;
        state.rockets = ROCKET.maxCount;
        state.gunHeat = 0;
        state.gunOverheated = false;
        state.wasAirborne = false;
        state.speed = 0;
        // Brakes on: the jet stays put until the pilot throttles up
        // again, instead of rolling off the end of the strip by itself.
        state.throttle = 0;
        state.afterburner = false;
        events |= EVENT_LANDED;
        setMessage(`On the deck — refuelled, repaired, re-armed. +${WAVES.landingScore}.`);
        return events;
      }
      if (onStrip) {
        // A touchdown that was too hard, too fast or banked is a crash,
        // with a reason that says what to fix next time.
        if (state.wasAirborne && state.verticalSpeed <= -JET.landingSinkMax) {
          crash('Landed too hard — flare before touchdown.');
          return events | EVENT_CRASHED;
        }
        if (state.wasAirborne && state.speed >= JET.landingSpeedMax) {
          crash('Too fast for the runway — slow down to land.');
          return events | EVENT_CRASHED;
        }
        if (state.wasAirborne && Math.abs(state.roll) >= 0.3) {
          crash('Wings not level on touchdown.');
          return events | EVENT_CRASHED;
        }
        // Rolling on the runway: hold the wheels on the strip and let
        // the jet lift off when it is fast and pulling up.
        state.pos.y = ground + JET.gearHeight;
        if (state.speed > 85 && state.pitch > 0.1) {
          state.pos.y += 0.6;
          state.wasAirborne = true;
        }
        return events;
      }
      if (ground <= 0.5) crash('Ditched in the sea — the islands are not forgiving.');
      else if (state.speed > 35) crash('Ran off the end of the runway.');
      else crash('Crashed into the hillside — watch your altitude.');
      return events | EVENT_CRASHED;
    }
    return events;
  }

  reset(false);

  return {
    state,
    step,
    reset,
    setMessage,
    get enemies() {
      return enemies;
    },
    get waveBreak() {
      return state.waveBreak;
    },
  };
}
