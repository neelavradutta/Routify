import { WALK_SPEED_MS } from './graph.js';

/**
 * Safety model. Every signal is normalised to 0..1 and combined into a single `risk`,
 * which the router multiplies by distance so safety is part of the cost, not an overlay.
 */

const NIGHT_WEIGHTS = { light: 0.38, isolation: 0.3, crime: 0.25, camera: 0.07 };
const DAY_WEIGHTS = { light: 0.14, isolation: 0.31, crime: 0.44, camera: 0.11 };

/**
 * wF weights "flow": how freely a pedestrian actually moves along the edge.
 * Fastest leans on it (busy corridors, unobstructed footpaths), safest ignores it,
 * balanced takes half of each side.
 */
export const PROFILES = {
  fast: { id: 'fast', label: 'Fastest', wD: 1.0, wT: 0.35, wS: 0.05, wF: 1.1 },
  balanced: { id: 'balanced', label: 'Balanced', wD: 0.45, wT: 0.35, wS: 2.2, wF: 0.55 },
  safest: { id: 'safest', label: 'Safest', wD: 0.15, wT: 0.15, wS: 6.5, wF: 0 },
};

/**
 * How likely the walking surface is pinched or obstructed: stairs, dirt tracks, service
 * lanes with parked vehicles, and unwatched footways that get encroached in Indian cities.
 */
const BLOCKED_PRIOR = {
  steps: 0.85,
  path: 0.7,
  service: 0.5,
  track: 0.7,
  footway: 0.28,
  unclassified: 0.22,
  residential: 0.14,
  living_street: 0.12,
  pedestrian: 0.05,
};

const saturate = (value, scale) => 1 - Math.exp(-value / scale);
const clamp01 = (n) => Math.max(0, Math.min(1, n));

/** Typical daily walkers on this kind of street. Path/track ≈ 10 people — the isolation bar. */
const DAILY_BY_CLASS = {
  primary: 3500,
  primary_link: 2800,
  secondary: 2200,
  secondary_link: 1800,
  tertiary: 900,
  tertiary_link: 700,
  residential: 220,
  living_street: 160,
  unclassified: 90,
  pedestrian: 700,
  service: 28,
  footway: 18,
  steps: 12,
  path: 10,
  track: 8,
};

export const QUIET_VISITS_PER_DAY = 10;

/** Estimated people on this edge in a day. Night is ~1/5 of daytime footfall. */
export function dailyVisits(edge, night = false) {
  const base = DAILY_BY_CLASS[edge.cls] ?? 80;
  const fromPoi = 1 + 1.6 * saturate(edge.poi ?? 0, 4);
  let visits = base * fromPoi;
  if (night) visits *= 0.2;
  return visits;
}

export function isolationFromVisits(visits) {
  return clamp01(1 - visits / (visits + QUIET_VISITS_PER_DAY));
}

export function isIsolatedPlace(visits) {
  return visits <= QUIET_VISITS_PER_DAY * 1.3;
}

/** 1 = about 10 people a day or fewer. Busy roads and shop streets sit near 0. */
export function isolationScore(edge, night = false) {
  return isolationFromVisits(dailyVisits(edge, night));
}
export function lightScore(edge) {
  if (edge.lit === 0) return 0.08;
  const fromLamps = saturate(edge.lamp, 2);
  const prior = 0.45 * edge.exp;
  const base = Math.max(fromLamps, prior);
  return edge.lit === 1 ? Math.max(0.75, base) : clamp01(base);
}

/** 1 = busy corridor: main-road class plus shops and amenities feeding it. */
export function trafficScore(edge) {
  return clamp01(0.65 * edge.exp + 0.35 * saturate(edge.poi, 4));
}

/** 1 = the footpath is likely blocked or unwalkable end to end. */
export function blockedScore(edge) {
  const prior = BLOCKED_PRIOR[edge.cls] ?? 0.2;
  // A quiet, low-class link with nothing around it is the classic encroached stretch.
  const unwatched = clamp01(1 - (0.6 * saturate(edge.poi, 4) + 0.4 * edge.exp));
  return clamp01(prior + 0.35 * prior * unwatched);
}

/** Cost per metre for the "flow" term: obstruction hurts, traffic around you helps. */
export function flowPenalty(edge) {
  return clamp01(0.6 * blockedScore(edge) + 0.4 * (1 - trafficScore(edge)));
}

export function edgeFactors(edge, night = false) {
  return {
    light: lightScore(edge),
    isolation: isolationScore(edge, night),
    crime: clamp01(edge.crime),
    camera: edge.cam ? 1 : 0,
  };
}

export function edgeRisk(edge, night) {
  const f = edgeFactors(edge, night);
  const w = night ? NIGHT_WEIGHTS : DAY_WEIGHTS;
  return clamp01(
    w.light * (1 - f.light) + w.isolation * f.isolation + w.crime * f.crime + w.camera * (1 - f.camera),
  );
}

/**
 * Filters are cost multipliers, not hard bans: a dim alley stays reachable if it is the
 * only way through, but the router will pay a lot to avoid it.
 */
export function filterMultiplier(edge, filters, night = false) {
  let multiplier = 1;
  if (filters.avoidUnlit && lightScore(edge) < 0.4) multiplier *= 4;
  if (filters.avoidIsolated && isolationScore(edge, night) >= 0.5) multiplier *= 4;
  return multiplier;
}

/** Precomputes per-edge risk and cost once per request so the three searches share the work. */
export function buildCostTable(graph, night, filters) {
  const risk = new Float32Array(graph.edges.length);
  const multiplier = new Float32Array(graph.edges.length);
  const flow = new Float32Array(graph.edges.length);
  for (let i = 0; i < graph.edges.length; i++) {
    risk[i] = edgeRisk(graph.edges[i], night);
    multiplier[i] = filterMultiplier(graph.edges[i], filters, night);
    flow[i] = flowPenalty(graph.edges[i]);
  }
  return { risk, multiplier, flow };
}

export function edgeCost(edge, index, table, profile) {
  const wF = profile.wF ?? 0;
  const base =
    profile.wD * edge.len +
    profile.wT * edge.seconds +
    profile.wS * table.risk[index] * edge.len +
    wF * table.flow[index] * edge.len;
  return base * table.multiplier[index];
}

/** Lower bound on cost per metre, so A* stays admissible. */
export function heuristicRate(profile) {
  return profile.wD + profile.wT / WALK_SPEED_MS;
}

export const segmentScore = (risk) => Math.round(100 * (1 - risk));
