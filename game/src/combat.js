// Combat: gun tracers, homing rockets, explosions, contrails and hit
// sparks. Everything is pooled and reused — no meshes are created while
// the game runs. Effects stay restrained on purpose: warm tracer amber,
// a clean orange fireball with grey smoke, thin white contrails. No
// neon, no particle spam.
import * as THREE from 'three';
import { GUN, ROCKET } from './config.js';

const MAX_TRACERS = 96;
const MAX_MISSILES = 8;
const MAX_EXPLOSIONS = 8;
const MAX_CONTRAILS = 80;
const MAX_SPARKS = 8;

export function createCombat(scene, groundHeight) {
  // --- tracers: one LineSegments, two vertices per round ---
  const tracerGeo = new THREE.BufferGeometry();
  const tracerPos = new Float32Array(MAX_TRACERS * 6);
  const tracerCol = new Float32Array(MAX_TRACERS * 6);
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(tracerPos, 3));
  tracerGeo.setAttribute('color', new THREE.BufferAttribute(tracerCol, 3));
  const tracerMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const tracerLines = new THREE.LineSegments(tracerGeo, tracerMat);
  tracerLines.frustumCulled = false;
  scene.add(tracerLines);
  const tracers = [];
  for (let i = 0; i < MAX_TRACERS; i++) {
    tracers.push({
      active: false,
      staged: false,
      from: 'player',
      damage: 1,
      pos: new THREE.Vector3(0, -1000, 0),
      prev: new THREE.Vector3(0, -1000, 0),
      dir: new THREE.Vector3(0, 0, 1),
      speed: GUN.muzzleSpeed,
      life: 0,
    });
  }

  // --- missiles: small dart with a flame ---
  const missiles = [];
  const missileBodyGeo = new THREE.CylinderGeometry(0.22, 0.22, 2.2, 8);
  const missileNoseGeo = new THREE.ConeGeometry(0.22, 0.8, 8);
  const missileBodyMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
  const missileFlameMat = new THREE.MeshBasicMaterial({
    color: 0xffb050,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (let i = 0; i < MAX_MISSILES; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(missileBodyGeo, missileBodyMat);
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const nose = new THREE.Mesh(missileNoseGeo, missileBodyMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -1.5;
    g.add(nose);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.6, 8), missileFlameMat);
    flame.rotation.x = Math.PI / 2;
    flame.position.z = 1.8;
    g.add(flame);
    g.visible = false;
    scene.add(g);
    missiles.push({
      active: false,
      group: g,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      target: null,
      life: 0,
    });
  }

  // --- explosions: fireball + smoke + debris ---
  const explosions = [];
  const fireGeo = new THREE.SphereGeometry(1, 12, 10);
  const smokeGeo = new THREE.SphereGeometry(1, 10, 8);
  const debrisGeo = new THREE.BoxGeometry(0.9, 0.25, 0.25);
  for (let i = 0; i < MAX_EXPLOSIONS; i++) {
    const g = new THREE.Group();
    const fireMat = new THREE.MeshBasicMaterial({
      color: 0xff7a22,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const fire = new THREE.Mesh(fireGeo, fireMat);
    g.add(fire);
    const smokes = [];
    for (let j = 0; j < 4; j++) {
      const mat = new THREE.MeshLambertMaterial({
        color: 0x5a5a5a,
        transparent: true,
        opacity: 0,
      });
      const puff = new THREE.Mesh(smokeGeo, mat);
      g.add(puff);
      smokes.push({ mesh: puff, mat, off: new THREE.Vector3() });
    }
    const debris = [];
    for (let j = 0; j < 5; j++) {
      const mat = new THREE.MeshLambertMaterial({
        color: 0x2e2e2e,
        transparent: true,
        opacity: 0,
      });
      const piece = new THREE.Mesh(debrisGeo, mat);
      g.add(piece);
      debris.push({ mesh: piece, mat, vel: new THREE.Vector3() });
    }
    g.visible = false;
    scene.add(g);
    explosions.push({ active: false, group: g, fire, fireMat, smokes, debris, t: 0, life: 2.6 });
  }

  // --- contrails: small white puffs that grow and fade ---
  const contrails = [];
  const contrailGeo = new THREE.SphereGeometry(1, 8, 6);
  for (let i = 0; i < MAX_CONTRAILS; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const puff = new THREE.Mesh(contrailGeo, mat);
    puff.visible = false;
    scene.add(puff);
    contrails.push({ active: false, mesh: puff, mat, t: 0, life: 1.4 });
  }

  // --- hit sparks: a brief bright flash where a round lands ---
  const sparks = [];
  const sparkGeo = new THREE.SphereGeometry(1, 8, 6);
  for (let i = 0; i < MAX_SPARKS; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffe9a0,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const s = new THREE.Mesh(sparkGeo, mat);
    s.visible = false;
    scene.add(s);
    sparks.push({ active: false, mesh: s, mat, t: 0, life: 0.09 });
  }

  // --- muzzle flash at the player's gun ---
  const muzzleMat = new THREE.MeshBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), muzzleMat);
  muzzleFlash.visible = false;
  scene.add(muzzleFlash);
  let muzzleTime = 1;

  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  const tmpV3 = new THREE.Vector3();

  function nearestOnSegment(px, py, pz, ax, ay, az, bx, by, bz) {
    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const len2 = abx * abx + aby * aby + abz * abz;
    let t = 0;
    if (len2 > 0) {
      t = ((px - ax) * abx + (py - ay) * aby + (pz - az) * abz) / len2;
      t = Math.max(0, Math.min(1, t));
    }
    const cx = ax + abx * t;
    const cy = ay + aby * t;
    const cz = az + abz * t;
    const dx = px - cx;
    const dy = py - cy;
    const dz = pz - cz;
    return dx * dx + dy * dy + dz * dz;
  }

  function spawnTracer(origin, dir, from, damage, speed) {
    for (const t of tracers) {
      if (t.active) continue;
      t.active = true;
      t.from = from;
      t.damage = damage;
      t.pos.copy(origin);
      t.prev.copy(origin);
      t.dir.copy(dir);
      t.speed = speed;
      t.life = GUN.range / speed;
      return t;
    }
    return null;
  }

  // Paint one explosion's visuals for its age `e.t`, advancing the smoke
  // and debris by `dt`. Shared by the live step and staged screenshots.
  function paintExplosion(e, dt) {
    const t = e.t;
    const fireScale = t < 0.35 ? 2 + (t / 0.35) * 13 : 15 * (1 - (t - 0.35) / 0.5);
    e.fire.scale.set(Math.max(0.1, fireScale), Math.max(0.1, fireScale), Math.max(0.1, fireScale));
    e.fireMat.opacity = Math.max(0, 0.95 * (1 - t / 0.85));
    for (const s of e.smokes) {
      s.mesh.position.y += dt * 9;
      const sc = 2 + t * 4;
      s.mesh.scale.set(sc, sc, sc);
      s.mat.opacity = Math.max(0, 0.75 * (1 - t / 2.6));
    }
    for (const d of e.debris) {
      d.vel.y -= 22 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += dt * 7;
      d.mesh.rotation.z += dt * 5;
      d.mat.opacity = Math.max(0, 0.95 * (1 - t / 1.5));
    }
  }

  return {
    get missiles() {
      return missiles;
    },
    fireGun(origin, dir) {
      const t = spawnTracer(origin, dir, 'player', GUN.damage, GUN.muzzleSpeed);
      if (t) {
        muzzleFlash.position.copy(origin);
        muzzleFlash.visible = true;
        muzzleMat.opacity = 0.95;
        muzzleTime = 0;
      }
    },
    fireEnemyShot(origin, aimPoint) {
      tmpV.subVectors(aimPoint, origin).normalize();
      // A touch of spread so a burst is a burst, not a laser.
      tmpV.x += (Math.random() - 0.5) * 0.02;
      tmpV.y += (Math.random() - 0.5) * 0.02;
      tmpV.z += (Math.random() - 0.5) * 0.02;
      tmpV.normalize();
      spawnTracer(origin, tmpV, 'enemy', 6, GUN.muzzleSpeed * 0.9);
    },
    fireMissile(origin, dir, target) {
      for (const m of missiles) {
        if (m.active) continue;
        m.active = true;
        m.group.visible = true;
        m.pos.copy(origin);
        m.vel.copy(dir).multiplyScalar(ROCKET.speed);
        m.target = target;
        m.life = 7;
        m.group.position.copy(origin);
        return true;
      }
      return false;
    },
    explode(pos) {
      for (const e of explosions) {
        if (e.active) continue;
        e.active = true;
        e.group.visible = true;
        e.group.position.copy(pos);
        e.t = 0;
        e.fireMat.opacity = 0.95;
        e.fire.scale.set(1, 1, 1);
        for (let j = 0; j < e.smokes.length; j++) {
          const s = e.smokes[j];
          s.off.set((Math.random() - 0.5) * 10, Math.random() * 6, (Math.random() - 0.5) * 10);
          s.mesh.position.copy(s.off);
          s.mesh.scale.set(2, 2, 2);
          s.mat.opacity = 0.75;
        }
        for (let j = 0; j < e.debris.length; j++) {
          const d = e.debris[j];
          d.vel.set((Math.random() - 0.5) * 60, Math.random() * 40 + 10, (Math.random() - 0.5) * 60);
          d.mesh.position.set(0, 0, 0);
          d.mesh.scale.set(1, 1, 1);
          d.mat.opacity = 0.95;
        }
        return e;
      }
      return null;
    },
    spawnContrail(pos) {
      for (const c of contrails) {
        if (c.active) continue;
        c.active = true;
        c.mesh.visible = true;
        c.mesh.position.copy(pos);
        c.t = 0;
        c.mat.opacity = 0.5;
        c.mesh.scale.set(0.7, 0.7, 0.7);
        return;
      }
    },
    hitSpark(pos) {
      for (const s of sparks) {
        if (s.active) continue;
        s.active = true;
        s.mesh.visible = true;
        s.mesh.position.copy(pos);
        s.t = 0;
        s.mat.opacity = 0.95;
        s.mesh.scale.set(1.4, 1.4, 1.4);
        return;
      }
    },
    // Staged-scene helpers: paint a frozen tracer and a frozen explosion
    // for screenshots. The live step never touches staged tracers, and
    // clearStaged() removes them when real play starts.
    stageTracer(from, to, fromSide = 'player') {
      for (let i = 0; i < tracers.length; i++) {
        const t = tracers[i];
        if (t.active || t.staged) continue;
        t.staged = true;
        tracerPos[i * 6] = to.x;
        tracerPos[i * 6 + 1] = to.y;
        tracerPos[i * 6 + 2] = to.z;
        tracerPos[i * 6 + 3] = from.x;
        tracerPos[i * 6 + 4] = from.y;
        tracerPos[i * 6 + 5] = from.z;
        const bright = fromSide === 'player' ? [1.0, 0.72, 0.25] : [1.0, 0.32, 0.16];
        tracerCol[i * 6] = bright[0]; tracerCol[i * 6 + 1] = bright[1]; tracerCol[i * 6 + 2] = bright[2];
        tracerCol[i * 6 + 3] = bright[0] * 0.25; tracerCol[i * 6 + 4] = bright[1] * 0.25; tracerCol[i * 6 + 5] = bright[2] * 0.25;
        tracerGeo.attributes.position.needsUpdate = true;
        tracerGeo.attributes.color.needsUpdate = true;
        return;
      }
    },
    stageExplosion(pos, t) {
      const e = this.explode(pos);
      if (!e) return;
      e.t = t;
      paintExplosion(e, 0);
    },
    clearStaged() {
      for (let i = 0; i < tracers.length; i++) {
        const t = tracers[i];
        if (!t.staged) continue;
        t.staged = false;
        tracerPos[i * 6] = 0; tracerPos[i * 6 + 1] = -1000; tracerPos[i * 6 + 2] = 0;
        tracerPos[i * 6 + 3] = 0; tracerPos[i * 6 + 4] = -1000; tracerPos[i * 6 + 5] = 0;
      }
      tracerGeo.attributes.position.needsUpdate = true;
    },
    // One step for every projectile and effect. `ctx` carries the player
    // position, the live enemies, and the callbacks the world handles.
    step(dt, ctx) {
      // --- tracers ---
      for (let i = 0; i < tracers.length; i++) {
        const t = tracers[i];
        if (t.staged) continue;
        if (!t.active) {
          tracerPos[i * 6] = 0; tracerPos[i * 6 + 1] = -1000; tracerPos[i * 6 + 2] = 0;
          tracerPos[i * 6 + 3] = 0; tracerPos[i * 6 + 4] = -1000; tracerPos[i * 6 + 5] = 0;
          continue;
        }
        t.prev.copy(t.pos);
        t.pos.addScaledVector(t.dir, t.speed * dt);
        t.life -= dt;
        let dead = t.life <= 0;
        if (!dead) {
          if (t.from === 'player') {
            for (const enemy of ctx.enemies) {
              if (!enemy.state.alive) continue;
              const d2 = nearestOnSegment(
                enemy.state.pos.x, enemy.state.pos.y, enemy.state.pos.z,
                t.prev.x, t.prev.y, t.prev.z, t.pos.x, t.pos.y, t.pos.z,
              );
              if (d2 < 9 * 9) {
                tmpV.copy(t.pos);
                ctx.onEnemyHit(enemy, t.damage, tmpV, false);
                this.hitSpark(tmpV);
                dead = true;
                break;
              }
            }
          } else {
            const d2 = nearestOnSegment(
              ctx.playerPos.x, ctx.playerPos.y, ctx.playerPos.z,
              t.prev.x, t.prev.y, t.prev.z, t.pos.x, t.pos.y, t.pos.z,
            );
            if (d2 < 7 * 7) {
              tmpV.copy(t.pos);
              ctx.onPlayerHit(t.damage, tmpV);
              this.hitSpark(tmpV);
              dead = true;
            }
          }
          if (!dead && t.pos.y < groundHeight(t.pos.x, t.pos.z)) {
            tmpV.copy(t.pos);
            tmpV.y = groundHeight(t.pos.x, t.pos.z) + 0.5;
            this.hitSpark(tmpV);
            dead = true;
          }
        }
        if (dead) {
          t.active = false;
          tracerPos[i * 6] = 0; tracerPos[i * 6 + 1] = -1000; tracerPos[i * 6 + 2] = 0;
          tracerPos[i * 6 + 3] = 0; tracerPos[i * 6 + 4] = -1000; tracerPos[i * 6 + 5] = 0;
          continue;
        }
        // Tail behind the head, longer when fast.
        const tail = Math.min(26, t.speed * 0.035);
        tracerPos[i * 6] = t.pos.x;
        tracerPos[i * 6 + 1] = t.pos.y;
        tracerPos[i * 6 + 2] = t.pos.z;
        tracerPos[i * 6 + 3] = t.pos.x - t.dir.x * tail;
        tracerPos[i * 6 + 4] = t.pos.y - t.dir.y * tail;
        tracerPos[i * 6 + 5] = t.pos.z - t.dir.z * tail;
        const bright = t.from === 'player' ? [1.0, 0.72, 0.25] : [1.0, 0.32, 0.16];
        tracerCol[i * 6] = bright[0]; tracerCol[i * 6 + 1] = bright[1]; tracerCol[i * 6 + 2] = bright[2];
        tracerCol[i * 6 + 3] = bright[0] * 0.25; tracerCol[i * 6 + 4] = bright[1] * 0.25; tracerCol[i * 6 + 5] = bright[2] * 0.25;
      }
      tracerGeo.attributes.position.needsUpdate = true;
      tracerGeo.attributes.color.needsUpdate = true;

      // --- missiles ---
      for (const m of missiles) {
        if (!m.active) continue;
        m.life -= dt;
        let boom = m.life <= 0;
        const target = m.target;
        if (!boom && target && target.state.alive) {
          // Steer toward where the bandit will be.
          tmpV2.subVectors(target.state.pos, m.pos);
          const dist = tmpV2.length();
          tmpV2.normalize();
          const lead = Math.min(1.5, dist / ROCKET.speed);
          tmpV3.copy(target.state.pos);
          // Lead by the target's velocity, approximated from its nose.
          target.noseDir(tmpV);
          tmpV3.addScaledVector(tmpV, target.state.speed * lead);
          tmpV2.subVectors(tmpV3, m.pos).normalize();
          const cur = tmpV.copy(m.vel).normalize();
          const angle = cur.angleTo(tmpV2);
          const maxTurn = ROCKET.turnRate * dt;
          if (angle > 0.001) {
            const turn = Math.min(angle, maxTurn);
            cur.lerp(tmpV2, turn / angle);
            cur.normalize();
          }
          m.vel.copy(cur).multiplyScalar(ROCKET.speed);
          if (dist < ROCKET.fuseRadius) boom = true;
        } else if (!boom && target && !target.state.alive) {
          m.target = null;
        }
        if (!boom) {
          m.pos.addScaledVector(m.vel, dt);
          if (m.pos.y < groundHeight(m.pos.x, m.pos.z)) boom = true;
          if (!boom) {
            for (const enemy of ctx.enemies) {
              if (!enemy.state.alive || enemy === target) continue;
              if (m.pos.distanceTo(enemy.state.pos) < ROCKET.fuseRadius + 3) {
                ctx.onEnemyHit(enemy, 4, m.pos, true);
                boom = true;
                break;
              }
            }
          }
        }
        if (boom) {
          tmpV.copy(m.pos);
          this.explode(tmpV);
          if (target && target.state.alive && m.pos.distanceTo(target.state.pos) < ROCKET.fuseRadius + 8) {
            ctx.onEnemyHit(target, ROCKET.damage, tmpV, true);
          }
          m.active = false;
          m.group.visible = false;
          m.target = null;
          continue;
        }
        m.group.position.copy(m.pos);
        tmpV.copy(m.vel).normalize();
        m.group.lookAt(tmpV2.copy(m.pos).add(tmpV));
      }

      // --- explosions ---
      for (const e of explosions) {
        if (!e.active) continue;
        e.t += dt;
        paintExplosion(e, dt);
        if (e.t >= e.life) {
          e.active = false;
          e.group.visible = false;
        }
      }

      // --- contrails ---
      for (const c of contrails) {
        if (!c.active) continue;
        c.t += dt;
        const k = c.t / c.life;
        c.mat.opacity = Math.max(0, 0.5 * (1 - k));
        const sc = 0.7 + k * 2.2;
        c.mesh.scale.set(sc, sc, sc);
        if (c.t >= c.life) {
          c.active = false;
          c.mesh.visible = false;
        }
      }

      // --- sparks ---
      for (const s of sparks) {
        if (!s.active) continue;
        s.t += dt;
        s.mat.opacity = Math.max(0, 0.95 * (1 - s.t / s.life));
        if (s.t >= s.life) {
          s.active = false;
          s.mesh.visible = false;
        }
      }

      // --- muzzle flash ---
      if (muzzleTime < 0.06) {
        muzzleTime += dt;
        muzzleMat.opacity = Math.max(0, 0.95 * (1 - muzzleTime / 0.06));
        const sc = 1 + muzzleTime * 8;
        muzzleFlash.scale.set(sc, sc, sc);
        if (muzzleTime >= 0.06) muzzleFlash.visible = false;
      }
    },
  };
}
