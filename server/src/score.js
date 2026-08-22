import { WALK_SPEED_MS } from './graph.js';

/**
 * Safety model. Every signal is normalised to 0..1 and combined into a single `risk`,
 * which the router multiplies by distance so safety is part of the cost, not an overlay.
 */

const NIGHT_WEIGHTS = { light: 0.38, isolation: 0.3, crime: 0.25, camera: 0.07 };
const DAY_WEIGHTS = { light: 0.14, isolation: 0.31, crime: 0.44, camera: 0.11 };

export const PROFILES = {
  fast: { id: 'fast', label: 'Fastest', wD: 1.0, wT: 0.35, wS: 0.05 },
  balanced: { id: 'balanced', label: 'Balanced', wD: 0.45, wT: 0.35, wS: 2.2 },
  safest: { id: 'safest', label: 'Safest', wD: 0.15, wT: 0.15, wS: 6.5 },
};

const saturate = (value, scale) => 1 - Math.exp(-value / scale);
const clamp01 = (n) => Math.max(0, Math.min(1, n));

/** 1 = well lit. OSM lamp coverage in Delhi is patchy, so road class acts as a prior. */
export function lightScore(edge) {
  if (edge.lit === 0) return 0.08;
  const fromLamps = saturate(edge.lamp, 2);
  const prior = 0.45 * edge.exp;
  const base = Math.max(fromLamps, prior);
  return edge.lit === 1 ? Math.max(0.75, base) : clamp01(base);
}

/** 1 = nobody around: few shops or amenities and a road class that carries little footfall. */
export function isolationScore(edge, night = false) {
  const activity = saturate(edge.poi, 4);
  let score = clamp01(1 - (0.6 * activity + 0.4 * edge.exp));
  if (night && (edge.cls === 'footway' || edge.cls === 'path' || edge.cls === 'steps' || edge.cls === 'service')) {
    score = clamp01(score + 0.18);
  }
  return score;
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
  if (filters.avoidIsolated && isolationScore(edge, night) > 0.6) multiplier *= 4;
  return multiplier;
}

/** Precomputes per-edge risk and cost once per request so the three searches share the work. */
export function buildCostTable(graph, night, filters) {
  const risk = new Float32Array(graph.edges.length);
  const multiplier = new Float32Array(graph.edges.length);
  for (let i = 0; i < graph.edges.length; i++) {
    risk[i] = edgeRisk(graph.edges[i], night);
    multiplier[i] = filterMultiplier(graph.edges[i], filters, night);
  }
  return { risk, multiplier };
}

export function edgeCost(edge, index, table, profile) {
  const base = profile.wD * edge.len + profile.wT * edge.seconds + profile.wS * table.risk[index] * edge.len;
  return base * table.multiplier[index];
}

/** Lower bound on cost per metre, so A* stays admissible. */
export function heuristicRate(profile) {
  return profile.wD + profile.wT / WALK_SPEED_MS;
}

export const segmentScore = (risk) => Math.round(100 * (1 - risk));
