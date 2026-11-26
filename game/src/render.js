// The three.js scene: golden-hour light, the terrain, the jet, the
// bandits, and two cameras — a chase camera that never fights the pilot,
// and a cockpit camera that sits where the pilot sits. The renderer owns
// no game rules; it only paints what the world says is there.
import * as THREE from 'three';
import { createTerrain } from './terrain.js';
import { createJet } from './jet.js';

export function createRenderer(canvas, seed) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf2c184, 700, 3800);

  // Golden-hour sun: warm, low, from the west, plus a soft sky fill.
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
  sun.position.set(-800, 500, -600);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x8fb8d8, 0.85));
  const hemi = new THREE.HemisphereLight(0x9fc8e8, 0x3d5a3a, 0.7);
  scene.add(hemi);

  const terrain = createTerrain(seed);
  scene.add(terrain.group);

  const jet = createJet();
  scene.add(jet.group);

  const chaseCam = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 9000);
  const cockpitCam = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 9000);
  let cameraMode = 'chase';

  const chaseOffset = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  let contrailTimer = 0;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    chaseCam.aspect = w / h;
    cockpitCam.aspect = w / h;
    chaseCam.updateProjectionMatrix();
    cockpitCam.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  return {
    terrain,
    jet,
    scene,
    setCameraMode(mode) {
      cameraMode = mode;
    },
    get cameraMode() {
      return cameraMode;
    },
    // Project a world point to screen pixels for HUD markers.
    projectToScreen(point) {
      const cam = cameraMode === 'cockpit' ? cockpitCam : chaseCam;
      tmpV.copy(point).project(cam);
      if (tmpV.z > 1) return null;
      return {
        x: (tmpV.x * 0.5 + 0.5) * window.innerWidth,
        y: (-tmpV.y * 0.5 + 0.5) * window.innerHeight,
      };
    },
    draw(world, time, snap = false, combat = null) {
      const s = world.state;
      const dt = 1 / 60;

      // The jet mesh follows the model's attitude, banking and pitching
      // with it; the burner glows with the throttle.
      jet.group.position.copy(s.pos);
      tmpQ.setFromEuler(new THREE.Euler(s.pitch, s.heading, s.roll, 'YXZ'));
      jet.group.quaternion.copy(tmpQ);
      jet.update(dt, s.throttle, s.afterburner, time);

      // Bandit meshes: added to the scene once, hidden when they die.
      for (const enemy of world.enemies) {
        if (!enemy.meshAdded) {
          scene.add(enemy.mesh);
          enemy.meshAdded = true;
        }
        enemy.mesh.visible = enemy.state.alive;
      }

      // Wingtip contrails: thin white puffs when the burner is lit or
      // the jet is pulling hard, never a wall of smoke.
      if (combat && s.alive) {
        contrailTimer -= dt;
        const pulling = Math.abs(s.roll) > 0.45 || s.afterburner;
        if (pulling && contrailTimer <= 0) {
          contrailTimer = 0.055;
          for (const tip of jet.wingtips) {
            tmpV.copy(tip).applyQuaternion(jet.group.quaternion).add(s.pos);
            combat.spawnContrail(tmpV);
          }
        }
      }

      // Chase camera: behind and above, eased toward its spot so it never
      // snaps; it looks a little ahead of the nose, not at the tail.
      const forward = new THREE.Vector3(
        -Math.sin(s.heading) * Math.cos(s.pitch),
        Math.sin(s.pitch),
        -Math.cos(s.heading) * Math.cos(s.pitch),
      );
      if (cameraMode === 'cockpit') {
        // Just ahead of the nose, high enough that the nose is only a
        // sliver at the bottom of the frame.
        tmpV.copy(s.pos).addScaledVector(forward, 3.0);
        tmpV.y += 1.6;
        cockpitCam.position.copy(tmpV);
        lookAt.copy(s.pos).addScaledVector(forward, 60);
        lookAt.y += 1.2;
        cockpitCam.up.copy(up);
        cockpitCam.lookAt(lookAt);
        renderer.render(scene, cockpitCam);
      } else {
        chaseOffset.copy(forward).multiplyScalar(-34);
        chaseOffset.y += 12;
        tmpV.copy(s.pos).add(chaseOffset);
        const ground = terrain.groundHeight(tmpV.x, tmpV.z);
        if (tmpV.y < ground + 3) tmpV.y = ground + 3;
        // A staged screenshot gets the camera snapped to its spot at once;
        // live play eases toward it so the camera never snaps.
        if (snap) chaseCam.position.copy(tmpV);
        else chaseCam.position.lerp(tmpV, 0.12);
        // Look well ahead and slightly above the nose, so the sightline
        // stays near level and the horizon stays in the frame.
        lookAt.copy(s.pos).addScaledVector(forward, 80);
        lookAt.y += 4;
        chaseCam.up.copy(up);
        chaseCam.lookAt(lookAt);
        renderer.render(scene, chaseCam);
      }

      terrain.update(dt, time);
    },
  };
}
