export const TURDANOID_BALANCE = {
  launch: {
    baseSpeed: 5.95,
    perLevel: 0.41,
    earlyFloorLevel: 5,
    earlyFloorSpeed: 7.25,
    maxSpeed: 12.45,
    minHorizontal: 1.32
  },
  drops: {
    baseChance: 0.088,
    perLevel: 0.0036,
    perDroughtBrick: 0.015,
    droughtCap: 0.24,
    maxChance: 0.36,
    forceDropBricks: 16,
    forceDropLevelScale: 9
  },
  power: {
    maxDropSlotsLow: 1,
    maxDropSlotsHigh: 2,
    highDropLevel: 18,
    bigPaddleMaxStacks: 5,
    bigPaddleDurationGain: 560,
    bigPaddleDurationCap: 3000,
    extraLifeMaxLives: 5,
    extraLifeEarlyLifeCap: 3,
    extraLifeCooldownFrames: 3200
  }
};

export function computeBallSpeed(level) {
  let speed = TURDANOID_BALANCE.launch.baseSpeed + (level - 1) * TURDANOID_BALANCE.launch.perLevel;
  if (level <= TURDANOID_BALANCE.launch.earlyFloorLevel) {
    speed = Math.max(speed, TURDANOID_BALANCE.launch.earlyFloorSpeed);
  }
  return Math.min(speed, TURDANOID_BALANCE.launch.maxSpeed);
}

export function shouldDropPowerUp(bricksSinceDrop, currentLevel) {
  const base = TURDANOID_BALANCE.drops.baseChance + (currentLevel * TURDANOID_BALANCE.drops.perLevel);
  const droughtBonus = bricksSinceDrop * TURDANOID_BALANCE.drops.perDroughtBrick;
  const chance = Math.min(base + Math.min(droughtBonus, TURDANOID_BALANCE.drops.droughtCap), TURDANOID_BALANCE.drops.maxChance);
  
  // Force drop logic
  const forceThreshold = TURDANOID_BALANCE.drops.forceDropBricks + (currentLevel * TURDANOID_BALANCE.drops.forceDropLevelScale);
  if (bricksSinceDrop >= forceThreshold) return true;
  
  return Math.random() < chance;
}

export const POWER_UP_TYPES = {
  BIG_PADDLE: "BIG_PADDLE",
  MULTI_BALL: "MULTI_BALL",
  FAST_BALL: "FAST_BALL",
  EXTRA_LIFE: "EXTRA_LIFE",
  SHIELD: "SHIELD",
  LASER_PADDLE: "LASER_PADDLE",
  SLOW_BALL: "SLOW_BALL"
};

export function selectPowerUpType(level) {
  const weights = {
    [POWER_UP_TYPES.BIG_PADDLE]: 30,
    [POWER_UP_TYPES.MULTI_BALL]: 20,
    [POWER_UP_TYPES.FAST_BALL]: 10,
    [POWER_UP_TYPES.EXTRA_LIFE]: level < 5 ? 5 : 10,
    [POWER_UP_TYPES.SHIELD]: 10,
    [POWER_UP_TYPES.LASER_PADDLE]: 10,
    [POWER_UP_TYPES.SLOW_BALL]: 10
  };

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  
  for (const [type, weight] of Object.entries(weights)) {
    if (random < weight) return type;
    random -= weight;
  }
  return POWER_UP_TYPES.BIG_PADDLE;
}
