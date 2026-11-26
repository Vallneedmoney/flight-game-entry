// Tunables for Langit Nusantara. One place for every number the game
// balances on, so a tweak never means hunting through the flight model.
export const STEP = 1 / 60;
export const BEST_KEY = 'langit-nusantara-best';

export const WORLD = {
  radius: 1500, // playable area, metres from the origin
  seaLevel: 0,
};

export const PLANE = {
  maxSpeed: 82, // m/s at full throttle
  minSpeed: 25, // m/s at idle
  stallSpeed: 28, // below this the nose sags
  climbRate: 9, // m/s of vertical speed at full pitch up
  turnRate: 0.55, // rad/s of heading change at full bank
  rollRate: 2.4, // rad/s toward the commanded bank
  maxBank: 1.1, // rad, about 63 degrees
  maxPitch: 0.5, // rad, about 29 degrees
  throttleRate: 0.55, // per second
  fuelBurn: 1.15, // fuel units per second at full throttle
  fuelStart: 100,
  ringFuel: 8, // fuel back per ring
  gearHeight: 2.2, // metres of clearance the gear gives on the ground
};

export const COURSE = {
  ringsPerCourse: 8,
  ringRadius: 13,
  ringScore: 100,
  landingScore: 500,
  landingFuel: 100,
  windPerCourse: 1.6, // m/s of crosswind added each course
};

// The main island's runway: centre, heading (east), length and width.
export const RUNWAY = {
  x: 0,
  z: 120,
  heading: -Math.PI / 2, // east, down the strip (+x); the nose points -z
  length: 260,
  width: 26,
};

// Fixed island layout: [x, z, radius, height, kind]
export const ISLANDS = [
  [0, 120, 340, 14, 'home'], // main island, holds the runway: low and flat, a coastal airfield
  [-620, -420, 300, 78, 'volcano'], // smoking volcano
  [560, -520, 260, 55, 'green'], // forested island
  [-420, 640, 220, 34, 'palm'], // palm island
  [700, 480, 190, 26, 'rock'], // rocky islet with the lighthouse
];

export const HUD = {
  speedUnit: 'kt', // knots shown on the HUD
  msToKt: 1.94384,
  mToFt: 3.28084,
};
