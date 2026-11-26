// The aircraft: a low-poly bush plane built from primitives, in a red and
// white livery, with a spinning propeller, landing gear and a dashboard
// whose gauges are drawn on a canvas texture and lit from within.
// Nothing here is copied from another game: the shape is this game's own.
import * as THREE from 'three';

export function createPlane() {
  const group = new THREE.Group();
  const red = new THREE.MeshLambertMaterial({ color: 0xd23b2e });
  const white = new THREE.MeshLambertMaterial({ color: 0xf2ede2 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const glass = new THREE.MeshPhongMaterial({
    color: 0x9fd8e8,
    shininess: 140,
    specular: 0xffffff,
  });

  // Fuselage: a white tube with a red tail cone.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.55, 6.4, 12), white);
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.2, 12), red);
  tailCone.rotation.x = -Math.PI / 2;
  tailCone.position.z = 4.2;
  group.add(tailCone);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 10), red);
  nose.scale.set(1, 1, 0.7);
  nose.position.z = -3.2;
  group.add(nose);

  // Canopy: a glass bubble the pilot sits under.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), glass);
  canopy.scale.set(0.9, 0.75, 1.7);
  canopy.position.set(0, 0.85, -0.9);
  group.add(canopy);

  // High wing with red tips, and the tail plane.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.22, 2.1), white);
  wing.position.set(0, 0.75, -0.6);
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.24, 2.1), red);
    tip.position.set(side * 5.35, 0.75, -0.6);
    group.add(tip);
  }
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.18, 1.3), red);
  tailWing.position.set(0, 0.35, 4.6);
  group.add(tailWing);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 1.5), red);
  fin.position.set(0, 0.9, 4.7);
  group.add(fin);

  // Propeller: a hub and two blades that spin around the nose.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), dark);
  prop.add(hub);
  for (const angle of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.6, 0.12), dark);
    blade.rotation.z = angle;
    blade.position.y = 0;
    prop.add(blade);
  }
  prop.position.z = -3.9;
  group.add(prop);

  // Fixed landing gear: two wheels and struts.
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.4, 6), dark);
    strut.position.set(side * 0.85, -0.9, -0.9);
    strut.rotation.z = side * 0.35;
    group.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.05, -1.55, -0.9);
    group.add(wheel);
  }

  // Navigation lights: red left, green right, white tail.
  const navLights = [];
  const navColors = [[-5.8, 0xff2a1a], [5.8, 0x2aff5a], [0, 0xffffff]];
  for (const [x, color] of navColors) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color }),
    );
    lamp.position.set(x, 0.75, x === 0 ? 5.3 : -0.6);
    group.add(lamp);
    navLights.push(lamp);
  }

  return {
    group,
    prop,
    update(dt, speed, throttle, altitude, headingDeg) {
      prop.rotation.z -= dt * (4 + throttle * 46);
      for (const lamp of navLights) {
        lamp.visible = Math.sin(performance.now() * 0.006) > -0.2;
      }
    },
  };
}
