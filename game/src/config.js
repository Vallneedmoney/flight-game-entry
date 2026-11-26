// Tunables for Langit Nusantara — Jet Tempur. One place for every number
// the game balances on, so a tweak never means hunting through the flight
// model or the combat code.
export const STEP = 1 / 60;
export const BEST_KEY = 'langit-nusantara-jet-best';

export const WORLD = {
  radius: 1500, // playable area, metres from the origin
  seaLevel: 0,
};

// The player jet: fast, but forgiving. Gentle auto-leveling and a wide
// landing envelope mean a new pilot can fly and fight within a minute.
export const JET = {
  maxSpeed: 210, // m/s at full military throttle
  afterburnerSpeed: 290, // m/s with Shift held
  minSpeed: 70, // m/s at idle
  stallSpeed: 62, // below this the nose sags
  turnRate: 0.85, // rad/s of heading change at full bank
  rollRate: 3.0, // rad/s toward the commanded bank
  maxBank: 1.15, // rad, about 66 degrees
  maxPitch: 0.55, // rad, about 31 degrees
  throttleRate: 0.6, // per second
  autoLevelRoll: 0.9, // rad/s the wings ease level with no stick input
  autoLevelPitch: 0.35, // rad/s the nose eases level with no stick input
  fuelBurn: 0.9, // fuel units per second at cruise
  afterburnerBurn: 2.4, // extra fuel burn while the burner is lit
  fuelStart: 100,
  gearHeight: 2.2, // metres of clearance the gear gives on the ground
  health: 100,
  landingSpeedMax: 95, // m/s: faster than this and a touchdown is a crash
  landingSinkMax: 10, // m/s of sink: harder than this and it is a crash
};

export const GUN = {
  roundsPerSecond: 12,
  muzzleSpeed: 900, // m/s: short flight time, so a turning bandit can
  // still be hit at 200-300 m — the gun has to feel effective, not hopeful
  range: 900, // m
  damage: 2, // hp per round: a one-second tracking burst drops a wave-1 bandit
  heatPerRound: 3.5,
  coolPerSecond: 28,
  overheatAt: 100,
  coolTo: 30, // heat must fall back here before firing again
  spread: 0.006, // rad of random spread per round
};

export const ROCKET = {
  startCount: 6,
  maxCount: 6,
  speed: 330, // m/s
  turnRate: 2.4, // rad/s the seeker can turn
  fuseRadius: 12, // m proximity fuse
  damage: 12,
  lockAngle: 0.52, // rad (~30 deg) off the nose the target must stay in
  lockRange: 950, // m
  lockTime: 0.6, // s of steady track before the tone goes solid
};

export const ENEMY = {
  cruiseSpeed: 150, // m/s
  maxSpeed: 185,
  minSpeed: 95,
  turnRate: 0.75,
  gunRange: 520, // m: inside this and roughly ahead, it opens fire
  gunDamage: 6,
  gunBurst: 7, // rounds per burst
  gunCooldown: 1.6, // s between bursts
  ramDamage: 35, // damage to the player on a mid-air collision
  // Health by wave: wave 1 bandits are one rocket (12) or a short burst.
  baseHealth: 12,
  healthPerWave: 2,
};

export const WAVES = {
  killScoreGun: 200,
  killScoreRocket: 300,
  waveClearScore: 250,
  landingScore: 400,
  rocketsPerWave: 2, // restocked when a wave is cleared
  spawnDistance: 750, // m from the player when a wave spawns
  spawnAltitude: [160, 340],
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
