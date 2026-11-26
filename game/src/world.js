// The flight model and the game around it: an arcade plane that banks to
// turn, stalls when slow, burns fuel, flies ring courses, and lands on the
// runway to refuel. Pure numbers in, pure numbers out: nothing here touches
// the DOM or three.js, so the model can be driven by the loop or by a shot.
import * as THREE from 'three';
import { COURSE, PLANE, RUNWAY, STEP, WORLD } from './config.js';
import { createRandom } from './random.js';

export const EVENT_RING = 1;
export const EVENT_LANDED = 2;
export const EVENT_CRASHED = 4;
export const EVENT_COURSE_DONE = 8;
export const EVENT_FUEL_LOW = 16;

export function createWorld(random, groundHeight) {
  const state = {
    // Flight state
    pos: new THREE.Vector3(0, 40, 320),
    heading: Math.PI / 2, // east, down the runway
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0.35,
    verticalSpeed: 0,
    // Resources and score
    fuel: PLANE.fuelStart,
    score: 0,
    best: 0,
    ringsHit: 0,
    landings: 0,
    course: 1,
    ringIndex: 0,
    time: 0,
    wind: 0,
    alive: true,
    crashed: false,
    crashReason: '',
    message: '',
    messageTime: 0,
    fuelWarned: false,
    // True once the plane has been properly airborne since the last
    // takeoff: a landing only counts when it was flying before it.
    wasAirborne: false,
  };

  let rings = [];
  let ringMeshData = [];
  let prevRingSide = 0;

  function placeRings() {
    const rand = createRandom(1000 + state.course * 77);
    rings = [];
    ringMeshData = [];
    // A course weaves across the archipelago: start over the home island,
    // out past the volcano, around the lighthouse islet and back to the
    // runway. Heights stay between 40 and 160 m so the rings are reachable.
    const waypoints = [
      [0, 90, -40],
      [260, 120, -320],
      [-160, 80, -620],
      [-620, 140, -420],
      [-180, 100, 60],
      [560, 130, -520],
      [700, 90, 480],
      [120, 70, 330],
    ];
    for (let i = 0; i < COURSE.ringsPerCourse; i++) {
      const [wx, alt, wz] = waypoints[i % waypoints.length];
      const x = wx + rand.range(-60, 60);
      const z = wz + rand.range(-60, 60);
      const y = Math.max(alt + rand.range(-15, 15), groundHeight(x, z) + 35);
      rings.push(new THREE.Vector3(x, y, z));
      ringMeshData.push({ pos: rings[i], passed: false });
    }
    state.ringIndex = 0;
    prevRingSide = 0;
  }

  function reset(keepScore) {
    state.pos.set(0, 8, 120);
    state.heading = RUNWAY.heading;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.throttle = 0.35;
    state.verticalSpeed = 0;
    state.fuel = PLANE.fuelStart;
    state.alive = true;
    state.crashed = false;
    state.crashReason = '';
    state.time = 0;
    state.wind = (state.course - 1) * COURSE.windPerCourse;
    state.fuelWarned = false;
    state.wasAirborne = false;
    if (!keepScore) {
      state.score = 0;
      state.ringsHit = 0;
      state.landings = 0;
      state.course = 1;
    }
    placeRings();
    setMessage('Course 1: fly the rings, then land on the runway.');
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
    state.throttle = Math.max(
      0,
      Math.min(1, state.throttle + input.throttleAxis() * PLANE.throttleRate * dt),
    );
    const targetSpeed = PLANE.minSpeed + state.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 0.7);
    state.fuel = Math.max(0, state.fuel - PLANE.fuelBurn * (0.25 + state.throttle) * dt);
    if (state.fuel <= 20 && !state.fuelWarned) {
      state.fuelWarned = true;
      events |= EVENT_FUEL_LOW;
      setMessage('Fuel low — land on the runway soon.');
    }
    if (state.fuel <= 0) {
      state.throttle = 0;
      crash('Out of fuel — the engine quit over the sea.');
      return events | EVENT_CRASHED;
    }

    // Attitude: bank toward the stick, pitch toward the stick, both eased.
    const targetRoll = input.roll() * PLANE.maxBank;
    const targetPitch = input.pitch() * PLANE.maxPitch;
    state.roll += (targetRoll - state.roll) * Math.min(1, dt * PLANE.rollRate);
    state.pitch += (targetPitch - state.pitch) * Math.min(1, dt * 3.2);
    // A stalled wing cannot hold the nose up.
    if (state.speed < PLANE.stallSpeed) {
      state.pitch += (0 - state.pitch) * dt * 0.4;
      state.pitch -= dt * 0.25;
    }
    // Heading follows the bank, plus a touch of rudder.
    state.heading +=
      (-state.roll * PLANE.turnRate + input.rudder() * 0.25) * dt * (0.4 + state.speed / PLANE.maxSpeed);

    // Wind pushes the plane sideways, stronger on later courses.
    const windX = Math.sin(state.time * 0.05) * state.wind;
    const windZ = Math.cos(state.time * 0.04) * state.wind;

    // Move along the nose direction, then let the nose set the climb.
    // The mesh nose points at local -z, so with heading h the nose is
    // (-sin h, -cos h) in the x/z plane.
    const forward = new THREE.Vector3(
      -Math.sin(state.heading) * Math.cos(state.pitch),
      Math.sin(state.pitch),
      -Math.cos(state.heading) * Math.cos(state.pitch),
    );
    const prevY = state.pos.y;
    state.pos.addScaledVector(forward, state.speed * dt);
    state.pos.x += windX * dt;
    state.pos.z += windZ * dt;
    state.verticalSpeed = (state.pos.y - prevY) / dt;

    // Soft boundary: past the edge the sea haze turns the plane home.
    const dist = Math.sqrt(state.pos.x * state.pos.x + state.pos.z * state.pos.z);
    if (dist > WORLD.radius) {
      const home = Math.atan2(-state.pos.x, -state.pos.z) + Math.PI;
      let diff = home - state.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      state.heading += Math.max(-1, Math.min(1, diff)) * dt * 0.8;
      setMessage('Edge of the chart — turning back.');
    }

    // Rings: crossing the ring's plane within its radius scores.
    const ring = rings[state.ringIndex];
    if (ring) {
      const toRing = new THREE.Vector3().subVectors(ring, state.pos);
      const side = Math.sign(toRing.dot(forward));
      if (prevRingSide !== 0 && side !== prevRingSide) {
        const distToRing = state.pos.distanceTo(ring);
        if (distToRing < COURSE.ringRadius) {
          ringMeshData[state.ringIndex].passed = true;
          state.ringsHit += 1;
          state.score += COURSE.ringScore;
          state.fuel = Math.min(100, state.fuel + PLANE.ringFuel);
          events |= EVENT_RING;
          setMessage(`Ring ${state.ringIndex + 1} of ${COURSE.ringsPerCourse} — +${COURSE.ringScore}.`);
          state.ringIndex += 1;
          if (state.ringIndex >= COURSE.ringsPerCourse) {
            events |= EVENT_COURSE_DONE;
            setMessage('Course clear — land on the runway to refuel.');
          }
        }
      }
      prevRingSide = side;
    }

    // Ground and water: a good landing refuels, a runway roll lets the
    // plane gather speed for takeoff, anything else crashes.
    const ground = groundHeight(state.pos.x, state.pos.z);
    const clearance = state.pos.y - ground;
    if (clearance > 15) state.wasAirborne = true;
    if (clearance <= PLANE.gearHeight) {
      const onStrip = onRunway(state.pos.x, state.pos.z) && Math.abs(ground - 6) < 1;
      const gentle = state.verticalSpeed > -8 && state.speed < 48 && Math.abs(state.roll) < 0.25;
      if (onStrip && gentle && state.wasAirborne && state.pos.y - 6 < 4) {
        state.pos.y = 6 + PLANE.gearHeight;
        state.landings += 1;
        state.score += COURSE.landingScore;
        state.fuel = COURSE.landingFuel;
        state.fuelWarned = false;
        state.course += 1;
        events |= EVENT_LANDED;
        setMessage(`Landed! +${COURSE.landingScore}. Course ${state.course} — wind is up.`);
        reset(true);
        state.pos.set(0, 8, 120);
        state.heading = RUNWAY.heading;
        state.speed = 0;
        state.throttle = 0.35;
        return events;
      }
      if (onStrip) {
        // A touchdown that was too hard, too fast or banked is a crash,
        // with a reason that says what to fix next time.
        if (state.wasAirborne && state.verticalSpeed <= -8) {
          crash('Landed too hard — flare before touchdown.');
          return events | EVENT_CRASHED;
        }
        if (state.wasAirborne && state.speed >= 48) {
          crash('Too fast for the runway — slow down to land.');
          return events | EVENT_CRASHED;
        }
        if (state.wasAirborne && Math.abs(state.roll) >= 0.25) {
          crash('Wings not level on touchdown.');
          return events | EVENT_CRASHED;
        }
        // Rolling on the runway: hold the wheels on the strip and let
        // the plane lift off when it is fast and pulling up.
        state.pos.y = ground + PLANE.gearHeight;
        if (state.speed > 42 && state.pitch > 0.12) {
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
    get rings() {
      return ringMeshData;
    },
    get nextRing() {
      return rings[state.ringIndex] ?? null;
    },
    get courseDone() {
      return state.ringIndex >= COURSE.ringsPerCourse;
    },
  };
}
