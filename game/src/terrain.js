// The archipelago: sea, five islands with seeded heightfields, a smoking
// volcano, palm groves, a lighthouse, drifting clouds and a golden-hour sky.
// Also owns groundHeight(x, z), the one function the flight model trusts
// for terrain collisions and landings.
import * as THREE from 'three';
import { ISLANDS, RUNWAY, WORLD } from './config.js';
import { makeNoise2D } from './random.js';

export function createTerrain(seed) {
  const noise = makeNoise2D(seed + 7);
  const group = new THREE.Group();

  // Height of the land at (x, z): the tallest island bump there, plus
  // rolling noise. Below -3 is open sea. The runway strip is flattened.
  function groundHeight(x, z) {
    let h = -4;
    for (const [ix, iz, radius, height] of ISLANDS) {
      const dx = x - ix;
      const dz = z - iz;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < radius) {
        const fall = Math.cos((d / radius) * Math.PI * 0.5);
        const bump = height * fall * fall;
        const rough = 1 + noise(x * 0.012, z * 0.012) * 0.22;
        h = Math.max(h, bump * rough - 2);
      }
    }
    // Flatten the runway shelf so landings read as landings.
    const rdx = Math.abs(x - RUNWAY.x);
    const rdz = Math.abs(z - RUNWAY.z);
    if (rdx < RUNWAY.length / 2 + 30 && rdz < RUNWAY.width / 2 + 30) {
      h = Math.max(h, 6);
      if (rdx < RUNWAY.length / 2 + 6 && rdz < RUNWAY.width / 2 + 6) h = 6;
    }
    return h;
  }

  // One heightfield mesh for all the land, coloured by height: sand at the
  // shore, grass above it, rock and snow near the peaks.
  const size = WORLD.radius * 2 + 400;
  const segments = 180;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(0xe8d29a);
  const grass = new THREE.Color(0x5d9b4a);
  const forest = new THREE.Color(0x2f6b33);
  const rock = new THREE.Color(0x8a7f72);
  const snow = new THREE.Color(0xf2f0ea);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = groundHeight(x, z);
    pos.setY(i, h);
    if (h < 0.5) c.copy(sand);
    else if (h < 18) c.copy(grass);
    else if (h < 42) c.copy(forest);
    else if (h < 62) c.copy(rock);
    else c.copy(snow);
    // A little noise in the colour so the slopes do not look flat.
    const shade = 0.92 + noise(x * 0.05, z * 0.05) * 0.08;
    colors[i * 3] = c.r * shade;
    colors[i * 3 + 1] = c.g * shade;
    colors[i * 3 + 2] = c.b * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const land = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  group.add(land);

  // The sea: a big translucent plane that catches the sun.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 2, size * 2),
    new THREE.MeshPhongMaterial({
      color: 0x1d6f8e,
      transparent: true,
      opacity: 0.94,
      shininess: 50,
      specular: 0xcc9955,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0;
  group.add(sea);

  // The runway: dark asphalt, white centre line, amber edge lights.
  const runway = new THREE.Group();
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY.length, RUNWAY.width),
    new THREE.MeshLambertMaterial({ color: 0x2b2f36 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.rotation.z = -Math.PI / 2;
  strip.position.set(RUNWAY.x, 6.15, RUNWAY.z);
  runway.add(strip);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = -5; i <= 5; i++) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.6), lineMat);
    dash.rotation.x = -Math.PI / 2;
    dash.rotation.z = -Math.PI / 2;
    dash.position.set(RUNWAY.x + i * 22, 6.25, RUNWAY.z);
    runway.add(dash);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffb020 });
  for (let i = -6; i <= 6; i++) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), lightMat);
      lamp.position.set(RUNWAY.x + i * 21, 6.6, RUNWAY.z + side * (RUNWAY.width / 2 - 1));
      runway.add(lamp);
    }
  }
  // Threshold chevrons and a windsock so the strip reads from the air.
  const sockPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 9, 6),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
  );
  sockPole.position.set(RUNWAY.x - RUNWAY.length / 2 - 12, 10.5, RUNWAY.z + 18);
  runway.add(sockPole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 4.5, 8),
    new THREE.MeshLambertMaterial({ color: 0xff5a2a }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(RUNWAY.x - RUNWAY.length / 2 - 9, 14.2, RUNWAY.z + 18);
  runway.add(sock);
  group.add(runway);

  // The volcano: a dark cone with a glowing crater and a smoke column made
  // of slowly rising transparent spheres.
  const volcano = ISLANDS[1];
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(150, 95, 24),
    new THREE.MeshLambertMaterial({ color: 0x4a3a32 }),
  );
  cone.position.set(volcano[0], 42, volcano[1]);
  group.add(cone);
  const crater = new THREE.Mesh(
    new THREE.CircleGeometry(18, 24),
    new THREE.MeshBasicMaterial({ color: 0xd84a00 }),
  );
  crater.rotation.x = -Math.PI / 2;
  crater.position.set(volcano[0], 89.5, volcano[1]);
  group.add(crater);
  const smoke = [];
  const smokeMat = new THREE.MeshLambertMaterial({
    color: 0x9a9a9a,
    transparent: true,
    opacity: 0.45,
  });
  for (let i = 0; i < 9; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(7 + i * 1.2, 10, 8), smokeMat);
    puff.position.set(volcano[0] + (i % 3 - 1) * 6, 96 + i * 9, volcano[1] + (i % 2) * 5);
    group.add(puff);
    smoke.push(puff);
  }

  // The lighthouse on the rocky islet: white tower, red top, warm lamp.
  const rockIslet = ISLANDS[4];
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 5.5, 34, 12),
    new THREE.MeshLambertMaterial({ color: 0xf5f0e6 }),
  );
  tower.position.set(rockIslet[0], 34, rockIslet[1]);
  group.add(tower);
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(4.6, 4.6, 5, 12),
    new THREE.MeshBasicMaterial({ color: 0xffc860 }),
  );
  lampRoom.position.set(rockIslet[0], 53, rockIslet[1]);
  group.add(lampRoom);
  const lampTop = new THREE.Mesh(
    new THREE.ConeGeometry(5.4, 5, 12),
    new THREE.MeshLambertMaterial({ color: 0xc03028 }),
  );
  lampTop.position.set(rockIslet[0], 58, rockIslet[1]);
  group.add(lampTop);

  // Palm groves on the home and palm islands: trunk + crossed fronds.
  const palmSpots = [];
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f7d32 });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 9, 6), trunkMat);
    trunk.position.y = 4.5;
    trunk.rotation.z = 0.12;
    g.add(trunk);
    for (let i = 0; i < 5; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7, 4), frondMat);
      frond.position.y = 9.4;
      frond.rotation.z = Math.PI / 2.4;
      frond.rotation.y = (i / 5) * Math.PI * 2;
      frond.translateY(2.4);
      g.add(frond);
    }
    g.position.set(x, groundHeight(x, z), z);
    palmSpots.push(g);
    group.add(g);
  }
  const spots = [
    [60, 210], [120, 260], [-90, 230], [180, 150], [-160, 60],
    [-380, 700], [-460, 600], [-340, 560], [90, 40], [-40, 300],
  ];
  for (const [x, z] of spots) palm(x, z);

  // Clouds: flat-shaded puffs drifting slowly across the sky.
  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
  });
  const cloudRand = [0.11, 0.37, 0.62, 0.83, 0.29, 0.51, 0.74, 0.95, 0.18, 0.44, 0.68, 0.9, 0.25, 0.58, 0.79, 0.33, 0.06, 0.47, 0.71, 0.88];
  for (let i = 0; i < 20; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + (i % 3);
    for (let j = 0; j < puffs; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(14 + j * 5, 10, 8), cloudMat);
      puff.position.set(j * 16 - puffs * 7, (j % 2) * 4, (j % 3) * 6 - 6);
      puff.scale.y = 0.55;
      cloud.add(puff);
    }
    cloud.position.set(
      (cloudRand[i] - 0.5) * 2600,
      200 + ((i * 37) % 90),
      (cloudRand[(i + 7) % 20] - 0.5) * 2600,
    );
    clouds.push(cloud);
    group.add(cloud);
  }

  // Golden-hour sky dome: a gradient shader, warm at the horizon.
  const skyGeo = new THREE.SphereGeometry(4200, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2f6fb2) },
      mid: { value: new THREE.Color(0x9fc8e8) },
      low: { value: new THREE.Color(0xffc27a) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){ float h = normalize(vP).y; vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h)); gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  group.add(sky);

  // A low sun disc so the light has a source in the frame.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(90, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false }),
  );
  sun.position.set(-2600, 420, -2600);
  sun.lookAt(0, 0, 0);
  group.add(sun);

  return {
    group,
    groundHeight,
    update(dt, time) {
      for (let i = 0; i < smoke.length; i++) {
        const puff = smoke[i];
        puff.position.y += dt * 3;
        puff.position.x += Math.sin(time * 0.4 + i) * dt * 1.5;
        if (puff.position.y > 190) puff.position.y = 96;
      }
      for (let i = 0; i < clouds.length; i++) {
        clouds[i].position.x += dt * (2 + (i % 3));
        if (clouds[i].position.x > 1500) clouds[i].position.x = -1500;
      }
      lampRoom.material.color.setHSL(0.1, 0.9, 0.55 + Math.sin(time * 2.4) * 0.12);
    },
  };
}
