// The three.js scene: golden-hour light, the terrain, the plane, the rings,
// and two cameras — a chase camera that never fights the pilot, and a
// cockpit camera that sits where the pilot sits. The renderer owns no game
// rules; it only paints what the world says is there.
import * as THREE from 'three';
import { COURSE } from './config.js';
import { createTerrain } from './terrain.js';
import { createPlane } from './plane.js';

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

  const plane = createPlane();
  scene.add(plane.group);

  // The rings: glowing torus gates, green for the next one, amber for the
  // rest, grey once flown. A thin beam marks the next ring's centre.
  const ringGroup = new THREE.Group();
  scene.add(ringGroup);
  const ringMeshes = [];
  const nextMat = new THREE.MeshBasicMaterial({ color: 0x2aff7a });
  const laterMat = new THREE.MeshBasicMaterial({ color: 0xffb020 });
  const doneMat = new THREE.MeshBasicMaterial({ color: 0x8a8f96 });
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x2aff7a,
    transparent: true,
    opacity: 0.22,
  });
  for (let i = 0; i < COURSE.ringsPerCourse; i++) {
    const torus = new THREE.Mesh(new THREE.TorusGeometry(COURSE.ringRadius, 0.9, 10, 40), laterMat);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 60, 8), beamMat);
    beam.rotation.x = Math.PI / 2;
    const g = new THREE.Group();
    g.add(torus);
    g.add(beam);
    ringGroup.add(g);
    ringMeshes.push({ group: g, torus, beam });
  }

  const chaseCam = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 9000);
  const cockpitCam = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 9000);
  let cameraMode = 'chase';

  const chaseOffset = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

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
    plane,
    setCameraMode(mode) {
      cameraMode = mode;
    },
    get cameraMode() {
      return cameraMode;
    },
    draw(world, time, snap = false) {
      const s = world.state;
      const dt = 1 / 60;

      // The plane mesh follows the model's attitude, banking and pitching
      // with it; the propeller spins with the throttle.
      plane.group.position.copy(s.pos);
      tmpQ.setFromEuler(new THREE.Euler(s.pitch, s.heading, s.roll, 'YXZ'));
      plane.group.quaternion.copy(tmpQ);
      plane.update(dt, s.speed, s.throttle, s.pos.y, 0);

      // Rings sit where the world put them; the next one pulses green.
      const rings = world.rings;
      for (let i = 0; i < ringMeshes.length; i++) {
        const data = rings[i];
        const mesh = ringMeshes[i];
        if (!data) {
          mesh.group.visible = false;
          continue;
        }
        mesh.group.visible = true;
        mesh.group.position.copy(data.pos);
        mesh.torus.material = data.passed ? doneMat : i === s.ringIndex ? nextMat : laterMat;
        mesh.beam.visible = i === s.ringIndex;
        if (i === s.ringIndex) {
          const pulse = 1 + Math.sin(time * 4) * 0.06;
          mesh.torus.scale.set(pulse, pulse, pulse);
        } else {
          mesh.torus.scale.set(1, 1, 1);
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
        tmpV.copy(s.pos).addScaledVector(forward, 2.6);
        tmpV.y += 1.7;
        cockpitCam.position.copy(tmpV);
        lookAt.copy(s.pos).addScaledVector(forward, 60);
        lookAt.y += 1.2;
        cockpitCam.up.copy(up);
        cockpitCam.lookAt(lookAt);
        renderer.render(scene, cockpitCam);
      } else {
        chaseOffset.copy(forward).multiplyScalar(-22);
        chaseOffset.y += 9;
        tmpV.copy(s.pos).add(chaseOffset);
        const ground = terrain.groundHeight(tmpV.x, tmpV.z);
        if (tmpV.y < ground + 3) tmpV.y = ground + 3;
        // A staged screenshot gets the camera snapped to its spot at once;
        // live play eases toward it so the camera never snaps.
        if (snap) chaseCam.position.copy(tmpV);
        else chaseCam.position.lerp(tmpV, 0.12);
        // Look well ahead and slightly above the nose, so the sightline
        // stays near level and the horizon stays in the frame.
        lookAt.copy(s.pos).addScaledVector(forward, 60);
        lookAt.y += 4;
        chaseCam.up.copy(up);
        chaseCam.lookAt(lookAt);
        renderer.render(scene, chaseCam);
      }

      terrain.update(dt, time);
    },
  };
}
