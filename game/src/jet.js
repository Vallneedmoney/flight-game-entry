// The player jet: a single-seat fighter in a restrained grey scheme with
// a red-and-white tail flash, built from primitives. Swept delta wing,
// twin canted tails, twin intakes and a nozzle whose afterburner glows
// when the burner is lit. Nothing here copies another game.
import * as THREE from 'three';

export function createJet() {
  const group = new THREE.Group();
  const grey = new THREE.MeshLambertMaterial({ color: 0x8b939c });
  const darkGrey = new THREE.MeshLambertMaterial({ color: 0x4c545c });
  const lightGrey = new THREE.MeshLambertMaterial({ color: 0xb9c0c7 });
  const red = new THREE.MeshLambertMaterial({ color: 0xc22e24 });
  const white = new THREE.MeshLambertMaterial({ color: 0xf2ede2 });
  const glass = new THREE.MeshPhongMaterial({
    color: 0x8fc4d8,
    shininess: 160,
    specular: 0xffffff,
  });

  // Fuselage: a long tube, wide at the intakes, tapering to the nozzle.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 7.2, 12), grey);
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.6, 12), lightGrey);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.9;
  group.add(nose);
  // Radome tip.
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 8), darkGrey);
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = -6.6;
  group.add(tip);

  // Canopy: a low glass bubble the pilot sits under.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), glass);
  canopy.scale.set(0.85, 0.7, 1.9);
  canopy.position.set(0, 0.62, -1.9);
  group.add(canopy);

  // Swept delta wing: one extruded planform, thin, swept back.
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -1.2);
  wingShape.lineTo(5.4, 2.4);
  wingShape.lineTo(5.4, 3.2);
  wingShape.lineTo(0.9, 3.4);
  wingShape.lineTo(0, 2.2);
  wingShape.lineTo(0, -1.2);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.18, bevelEnabled: false });
  const wing = new THREE.Mesh(wingGeo, grey);
  wing.rotation.x = Math.PI / 2;
  wing.position.set(0, 0.1, 0);
  group.add(wing);
  // Mirror the same planform to the left.
  const wingL = new THREE.Mesh(wingGeo, grey);
  wingL.rotation.x = Math.PI / 2;
  wingL.scale.x = -1;
  wingL.position.set(0, 0.1, 0);
  group.add(wingL);
  // Red wingtip rails, small and quiet.
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 1.6), red);
    rail.position.set(side * 5.35, 0.12, 2.6);
    group.add(rail);
  }

  // Twin tail fins, canted outward, with a red-and-white flash.
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.1, 1.9), grey);
    fin.position.set(side * 0.85, 1.15, 3.9);
    fin.rotation.z = -side * 0.28;
    fin.rotation.y = side * 0.12;
    group.add(fin);
    const flash = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 1.1), side < 0 ? red : white);
    flash.position.set(side * 0.95, 1.75, 3.95);
    flash.rotation.z = -side * 0.28;
    flash.rotation.y = side * 0.12;
    group.add(flash);
  }
  // All-moving tailplanes.
  for (const side of [-1, 1]) {
    const stab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 1.1), darkGrey);
    stab.position.set(side * 1.5, 0.15, 3.7);
    stab.rotation.y = -side * 0.35;
    group.add(stab);
  }

  // Twin intakes under the wing roots.
  for (const side of [-1, 1]) {
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 2.6), darkGrey);
    intake.position.set(side * 1.05, -0.55, -1.2);
    group.add(intake);
  }

  // Gun muzzle: a small barrel under the nose, right side.
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.8, 6), darkGrey);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0.55, -0.5, -4.4);
  group.add(muzzle);

  // Afterburner nozzle and its glow: a cone that stretches and brightens
  // with the burner, flickering just enough to read as flame.
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.42, 0.9, 10),
    darkGrey,
  );
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.z = 3.9;
  group.add(nozzle);
  const burnerMat = new THREE.MeshBasicMaterial({
    color: 0xff9a3c,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const burner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 3.4, 10), burnerMat);
  burner.rotation.x = Math.PI / 2;
  burner.position.z = 5.4;
  group.add(burner);

  // Navigation lights: red left, green right, white tail.
  const navLights = [];
  const navColors = [[-5.4, 0xff2a1a], [5.4, 0x2aff5a], [0, 0xffffff]];
  for (const [x, color] of navColors) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshBasicMaterial({ color }),
    );
    lamp.position.set(x, 0.12, x === 0 ? 4.4 : 2.6);
    group.add(lamp);
    navLights.push(lamp);
  }

  // Wingtip offsets (local) where contrails start.
  const wingtips = [new THREE.Vector3(-5.4, 0.12, 2.8), new THREE.Vector3(5.4, 0.12, 2.8)];

  return {
    group,
    wingtips,
    muzzleLocal: new THREE.Vector3(0.55, -0.5, -4.8),
    update(dt, throttle, afterburner, time) {
      // The burner stretches with throttle and flares when lit.
      const target = afterburner ? 0.9 : throttle * 0.22;
      burnerMat.opacity += (target - burnerMat.opacity) * Math.min(1, dt * 8);
      const flicker = 1 + Math.sin(time * 43) * 0.06 + Math.sin(time * 27) * 0.04;
      const len = (afterburner ? 3.4 : 1.4) * flicker;
      burner.scale.set(1, len / 3.4, 1);
      for (const lamp of navLights) {
        lamp.visible = Math.sin(time * 6) > -0.2;
      }
    },
  };
}
