// The bandit: a smaller, darker jet with a single tail fin and a red
// tail band, easy to tell from the player's grey fighter at a glance.
// This file also holds the bandit's pilot: a small state machine that
// hunts, attacks and breaks away, and never forgets the ground.
import * as THREE from 'three';
import { ENEMY, WORLD } from './config.js';

export function createEnemyMesh() {
  const group = new THREE.Group();
  const slate = new THREE.MeshLambertMaterial({ color: 0x5a6558 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x333a33 });
  const red = new THREE.MeshLambertMaterial({ color: 0xa32a22 });
  const glass = new THREE.MeshPhongMaterial({
    color: 0x7fb2c4,
    shininess: 120,
    specular: 0xffffff,
  });
  const mats = [slate, dark, red];

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.5, 6.4, 10), slate);
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.2, 10), dark);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.3;
  group.add(nose);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), glass);
  canopy.scale.set(0.85, 0.65, 1.7);
  canopy.position.set(0, 0.55, -1.4);
  group.add(canopy);
  // Swept wing, one piece.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.18, 2.0), slate);
  wing.position.set(0, 0.05, 0.6);
  wing.rotation.y = 0.0;
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 2.0), red);
    tip.position.set(side * 4.5, 0.05, 0.6);
    group.add(tip);
  }
  // Single tail fin with a red band.
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 1.6), slate);
  fin.position.set(0, 1.0, 3.5);
  group.add(fin);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 1.0), red);
  band.position.set(0, 1.5, 3.55);
  group.add(band);
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 1.2), dark);
  tailWing.position.set(0, 0.2, 3.6);
  group.add(tailWing);
  // Afterburner glow, dimmer than the player's.
  const burnerMat = new THREE.MeshBasicMaterial({
    color: 0xff8a2a,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const burner = new THREE.Mesh(new THREE.ConeGeometry(0.36, 2.2, 8), burnerMat);
  burner.rotation.x = Math.PI / 2;
  burner.position.z = 4.4;
  group.add(burner);

  return { group, mats, burnerMat };
}

// One bandit. `random` is a seeded generator so a staged scene is stable.
export function createEnemy(random, groundHeight, spawnPos, heading, health) {
  const mesh = createEnemyMesh();
  const state = {
    pos: spawnPos.clone(),
    heading,
    pitch: 0,
    roll: 0,
    speed: ENEMY.cruiseSpeed,
    health,
    alive: true,
    mode: 'hunt',
    modeTime: 0,
    burstLeft: 0,
    burstTimer: 0,
    cooldown: random.range(0.5, 1.5),
    wantFire: false,
    evadeDir: 1,
    flashTime: 0, // >0 while the hit flash shows
  };
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  function angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  return {
    state,
    mesh: mesh.group,
    // Called every fixed step. `player` is the player's flight state,
    // `threat` is true while the player's missile is tracking this bandit.
    step(dt, player, threat, time) {
      if (!state.alive) return;
      state.modeTime += dt;
      if (state.flashTime > 0) state.flashTime -= dt;
      state.wantFire = false;

      // --- decide the mode ---
      const toPlayer = tmp.subVectors(player.pos, state.pos);
      const dist = toPlayer.length();
      if (threat && state.mode !== 'evade') {
        state.mode = 'evade';
        state.modeTime = 0;
        state.evadeDir = random.next() < 0.5 ? -1 : 1;
      } else if (state.mode === 'evade' && state.modeTime > 1.6) {
        state.mode = 'hunt';
        state.modeTime = 0;
      } else if (state.mode !== 'evade') {
        state.mode = dist < ENEMY.gunRange && state.modeTime > 0.5 ? 'attack' : 'hunt';
      }

      // --- steer ---
      let targetHeading = state.heading;
      let targetPitch = 0;
      let targetSpeed = ENEMY.cruiseSpeed;
      if (state.mode === 'evade') {
        // Break hard away from the threat and change altitude.
        targetHeading = state.heading + state.evadeDir * 1.4;
        targetPitch = state.evadeDir > 0 ? 0.35 : -0.3;
        targetSpeed = ENEMY.maxSpeed;
      } else {
        // Intercept: aim at where the player will be, not where it is.
        const lead = Math.min(2.2, dist / Math.max(60, player.speed));
        tmp2.copy(player.pos).addScaledVector(
          new THREE.Vector3(
            -Math.sin(player.heading) * Math.cos(player.pitch),
            Math.sin(player.pitch),
            -Math.cos(player.heading) * Math.cos(player.pitch),
          ),
          player.speed * lead,
        );
        const dx = tmp2.x - state.pos.x;
        const dz = tmp2.z - state.pos.z;
        targetHeading = Math.atan2(-dx, -dz);
        const altErr = tmp2.y - state.pos.y;
        targetPitch = Math.max(-0.4, Math.min(0.4, altErr * 0.004));
        targetSpeed = dist > 500 ? ENEMY.maxSpeed : ENEMY.cruiseSpeed;
      }
      // Never fly into the ground: pull up hard when the clearance shrinks.
      const ground = groundHeight(state.pos.x, state.pos.z);
      const clearance = state.pos.y - ground;
      if (clearance < 70) {
        targetPitch = Math.max(targetPitch, 0.45);
        targetSpeed = ENEMY.maxSpeed;
      }
      // Turn back inside the chart's edge.
      const radial = Math.sqrt(state.pos.x * state.pos.x + state.pos.z * state.pos.z);
      if (radial > WORLD.radius) {
        targetHeading = Math.atan2(-state.pos.x, -state.pos.z) + Math.PI;
      }

      // Ease attitude toward the target, then move along the nose.
      const headErr = angleDiff(state.heading, targetHeading);
      const targetRoll = Math.max(-1.0, Math.min(1.0, headErr * 1.4));
      state.roll += (targetRoll - state.roll) * Math.min(1, dt * 2.4);
      state.pitch += (targetPitch - state.pitch) * Math.min(1, dt * 2.2);
      state.heading += -state.roll * ENEMY.turnRate * dt * (0.5 + state.speed / ENEMY.maxSpeed);
      state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 0.8);
      const forward = new THREE.Vector3(
        -Math.sin(state.heading) * Math.cos(state.pitch),
        Math.sin(state.pitch),
        -Math.cos(state.heading) * Math.cos(state.pitch),
      );
      state.pos.addScaledVector(forward, state.speed * dt);
      if (state.pos.y < ground + 12) state.pos.y = ground + 12;

      // --- fire control: short bursts when the player is in front ---
      state.cooldown -= dt;
      if (state.burstLeft > 0) {
        state.burstTimer -= dt;
        if (state.burstTimer <= 0) {
          state.wantFire = true;
          state.burstLeft -= 1;
          state.burstTimer = 0.09;
        }
      } else if (state.mode === 'attack' && state.cooldown <= 0 && dist < ENEMY.gunRange) {
        // Only open fire when the nose is roughly on the player.
        const nose = new THREE.Vector3(
          -Math.sin(state.heading) * Math.cos(state.pitch),
          Math.sin(state.pitch),
          -Math.cos(state.heading) * Math.cos(state.pitch),
        );
        const toP = tmp.copy(player.pos).sub(state.pos).normalize();
        if (nose.dot(toP) > 0.86) {
          state.burstLeft = ENEMY.gunBurst;
          state.burstTimer = 0;
          state.cooldown = ENEMY.gunCooldown + random.range(0, 0.8);
        }
      }

      // --- paint the mesh ---
      mesh.group.position.copy(state.pos);
      mesh.group.quaternion.setFromEuler(new THREE.Euler(state.pitch, state.heading, state.roll, 'YXZ'));
      const flashing = state.flashTime > 0;
      for (const m of mesh.mats) {
        m.emissive.setHex(flashing ? 0x881111 : 0x000000);
      }
      mesh.burnerMat.opacity = 0.25 + Math.sin(time * 31) * 0.08;
    },
    damage(amount) {
      if (!state.alive) return false;
      state.health -= amount;
      state.flashTime = 0.09;
      if (state.health <= 0) {
        state.alive = false;
        return true;
      }
      return false;
    },
    noseDir(out) {
      out.set(
        -Math.sin(state.heading) * Math.cos(state.pitch),
        Math.sin(state.pitch),
        -Math.cos(state.heading) * Math.cos(state.pitch),
      );
      return out;
    },
  };
}
