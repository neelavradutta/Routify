import { crimeAt } from './graph.js';
import { regionAt, regionAtSync, nationalRate, urbanity } from './regions.js';
import { loadContext } from './context.js';
import { QUIET_VISITS_PER_DAY, isolationFromVisits } from './score.js';

/**
 * The safety model for a point on a walk.
 *
 * Three independent sources are combined, strongest evidence first:
 *   1. Live OpenStreetMap context — lamps, shops, cameras, police within a few hundred metres.
 *   2. NCRB reported crime against women — metropolitan city rate where one exists, else the
 *      state rate, normalised against the national rate of 64.6 per lakh women.
 *   3. Curated local hotspots from data/crime.geojson, which bump specific known stretches.
 *
 * Where live context is missing the model leans on statistics, so a route is always scored.
 */

const NIGHT_WEIGHTS = { light: 0.38, isolation: 0.3, crime: 0.25, camera: 0.07 };
const DAY_WEIGHTS = { light: 0.14, isolation: 0.31, crime: 0.44, camera: 0.11 };

/** Reported rate that counts as "half as risky as it gets"; national average is 64.6. */
const RATE_HALFWAY = 150;
/** City rates use 2011 population so they sit higher than state rates and need their own scale. */
const CITY_RATE_HALFWAY = 210;

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const saturate = (value, scale) => 1 - Math.exp(-value / scale);

/** Reported crime per lakh women to a 0..1 prior. */
export function rateToPrior(rate, halfway = RATE_HALFWAY) {
  if (!Number.isFinite(rate) || rate <= 0) return 0.15;
  return clamp01(rate / (rate + halfway));
}

/**
 * Statistical crime prior for a point. A metropolitan city rate describes the streets a
 * walker is actually on, so it outweighs the state figure when both are available.
 */
export function statisticalCrime(region) {
  const state = rateToPrior(region.stateRate ?? nationalRate());
  if (region.cityRate == null) return state;
  const city = rateToPrior(region.cityRate, CITY_RATE_HALFWAY);
  return clamp01(0.7 * city + 0.3 * state);
}

/**
 * Shops and amenities nearby stand in for how many people pass in a day. A stretch with
 * nothing open along it sits near the ten-a-day mark that counts as isolated.
 */
function visitsFromContext(poiCount, night) {
  const day = 8 + 300 * saturate(poiCount, 6);
  return night ? day * 0.2 : day;
}

/**
 * Point safety factors on the 0..1 scale the API already speaks:
 * light and camera are "more is better", isolation and crime are "more is worse".
 */
export function factorsAt(lat, lng, night, context) {
  const region = regionAtSync(lat, lng);
  const stats = statisticalCrime(region);
  const seeded = crimeAt(lat, lng);
  const crime = clamp01(Math.max(stats, seeded) + 0.35 * Math.min(stats, seeded));

  const local = context?.at(lat, lng) ?? null;

  let light;
  let isolation;
  let camera;

  if (local) {
    // Busy frontages spill light onto the footpath even where lamps are unmapped.
    const spill = clamp01(0.25 + 0.55 * saturate(local.poi, 6));
    const surveyed = local.lamps != null || local.litWay != null;
    const lampLight = local.lamps != null ? saturate(local.lamps, 2.5) : 0;
    const base = local.litWay ? Math.max(0.7, lampLight) : lampLight;
    // Where lamps are surveyed, finding none is real evidence of a dark stretch.
    // Where nobody surveyed them, absence says nothing, so only the shopfront spill counts.
    light = surveyed ? clamp01(Math.max(base, 0.6 * spill)) : spill;
    if (!night) light = clamp01(Math.max(0.6, light));
    isolation = isolationFromVisits(visitsFromContext(local.poi, night));
    camera = clamp01(saturate(local.cameras, 2));
    if (Number.isFinite(local.policeDistance)) {
      camera = clamp01(camera + 0.25 * (1 - local.policeDistance / 700));
    }
  } else {
    // No live survey: fall back to how built-up the area is, so a city high street and a
    // village lane are not treated as the same walk.
    const built = urbanity(lat, lng);
    const visits = QUIET_VISITS_PER_DAY * (1.2 + 26 * built);
    isolation = isolationFromVisits(night ? visits * 0.2 : visits);
    light = clamp01((night ? 0.22 : 0.6) + 0.45 * built);
    camera = 0;
  }

  return { light, isolation, crime, camera, region, live: Boolean(local) };
}

export function riskFrom(factors, night) {
  const w = night ? NIGHT_WEIGHTS : DAY_WEIGHTS;
  return clamp01(
    w.light * (1 - factors.light) +
      w.isolation * factors.isolation +
      w.crime * factors.crime +
      w.camera * (1 - factors.camera),
  );
}

/** Why a place scores badly, so the map can label the circle it draws. */
export function reasonFor(factors, night) {
  const w = night ? NIGHT_WEIGHTS : DAY_WEIGHTS;
  const parts = [
    ['darkness', w.light * (1 - factors.light)],
    ['isolation', w.isolation * factors.isolation],
    ['crime', w.crime * factors.crime],
  ];
  parts.sort((a, b) => b[1] - a[1]);
  return parts[0][0];
}

/**
 * Prepares scoring for one route corridor: warms the region lookup for the ends and pulls
 * street context once, so every later point lookup is synchronous and cheap.
 */
export async function prepareRisk(coords) {
  const ends = [coords[0], coords[coords.length - 1]].filter(Boolean);
  const [context] = await Promise.all([
    loadContext(coords),
    Promise.all(ends.map(([lat, lng]) => regionAt(lat, lng).catch(() => null))),
  ]);
  return context;
}

export function coverageOf(lat, lng) {
  const region = regionAtSync(lat, lng);
  return {
    state: region.state,
    city: region.city,
    stateRate: region.stateRate,
    cityRate: region.cityRate,
  };
}
