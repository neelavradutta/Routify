import { haversine, loadCrime } from './graph.js';
import { segmentScore } from './score.js';
import { factorsAt, prepareRisk, reasonFor, riskFrom } from './risk.js';

const USER_AGENT = 'SafeRoutesForWomen/1.0 (pedestrian safety routing; contact: local dev)';
const OSRM = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';

function toLatLng(coords) {
  return coords.map(([lng, lat]) => [lat, lng]);
}

/** Average of the safety factors along a line, sampled evenly. */
function sampleRisk(coords, night, context) {
  if (!coords.length) return { safety: 60, crime: 0.2, light: night ? 0.45 : 0.72, isolation: 0.35, camera: 0 };
  const step = Math.max(1, Math.floor(coords.length / 24));
  const total = { light: 0, isolation: 0, crime: 0, camera: 0 };
  let n = 0;
  for (let i = 0; i < coords.length; i += step) {
    const f = factorsAt(coords[i][0], coords[i][1], night, context);
    total.light += f.light;
    total.isolation += f.isolation;
    total.crime += f.crime;
    total.camera += f.camera;
    n++;
  }
  const mean = {
    light: total.light / n,
    isolation: total.isolation / n,
    crime: total.crime / n,
    camera: total.camera / n,
  };
  return { ...mean, safety: segmentScore(riskFrom(mean, night)) };
}

function segmentsFromLine(coords, night, context) {
  if (coords.length < 2) return [];
  const chunks = [];
  const size = Math.max(8, Math.ceil(coords.length / 12));
  for (let i = 0; i < coords.length - 1; i += size) {
    const slice = coords.slice(i, Math.min(coords.length, i + size + 1));
    let length = 0;
    for (let k = 1; k < slice.length; k++) {
      length += haversine(slice[k - 1][0], slice[k - 1][1], slice[k][0], slice[k][1]);
    }
    const f = sampleRisk(slice, night, context);
    chunks.push({
      name: null,
      kind: 'footway',
      coords: slice,
      length: Math.round(length),
      score: f.safety,
      factors: {
        light: +f.light.toFixed(2),
        isolation: +f.isolation.toFixed(2),
        crime: +f.crime.toFixed(2),
        camera: +f.camera.toFixed(2),
      },
    });
  }
  return chunks;
}

function spaced(zones, minMetres) {
  const kept = [];
  for (const z of zones) {
    if (kept.some((k) => haversine(k.lat, k.lng, z.lat, z.lng) < minMetres)) continue;
    kept.push(z);
  }
  return kept;
}

/**
 * Weak points to draw on the map: known hotspots the walk passes, plus the places along it
 * that the model itself scores worst.
 */
function zonesAlong(coords, night, context) {
  const fromSeeds = [];
  for (const h of loadCrime()) {
    const hit = coords.some(([lat, lng]) => haversine(lat, lng, h.lat, h.lng) < Math.max(h.radius, 350));
    if (!hit) continue;
    fromSeeds.push({
      lat: h.lat,
      lng: h.lng,
      radius: 170,
      score: segmentScore(h.weight),
      reason: 'crime',
      name: h.name,
    });
  }

  const samples = [];
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    acc += haversine(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    if (acc < 160 && i !== coords.length - 1) continue;
    acc = 0;
    const [lat, lng] = coords[i];
    const f = factorsAt(lat, lng, night, context);
    samples.push({
      lat,
      lng,
      radius: 170,
      score: segmentScore(riskFrom(f, night)),
      reason: reasonFor(f, night),
      name: f.region.place ?? f.region.city ?? null,
    });
  }

  samples.sort((a, b) => a.score - b.score);
  const fromLine = spaced(samples, 240).slice(0, 14);
  const merged = spaced([...fromSeeds, ...fromLine], 140);
  return merged.sort((a, b) => a.score - b.score).slice(0, 24);
}

function packRoute(raw, profile, night, context) {
  const coords = toLatLng(raw.geometry.coordinates);
  const factors = sampleRisk(coords, night, context);
  const segs = segmentsFromLine(coords, night, context);
  const weakest = [...segs]
    .filter((s) => s.length > 40)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((s) => ({ name: s.name ?? 'this stretch', score: s.score, length: s.length }));

  const packed = {
    light: +factors.light.toFixed(2),
    isolation: +factors.isolation.toFixed(2),
    crime: +factors.crime.toFixed(2),
    camera: +factors.camera.toFixed(2),
  };

  return {
    id: profile.id,
    label: profile.label,
    distance: Math.round(raw.distance),
    duration: Math.round(raw.duration / 60),
    safety: factors.safety,
    factors: packed,
    weakest,
    segments: segs.length
      ? segs
      : [
          {
            name: null,
            kind: 'footway',
            coords,
            length: Math.round(raw.distance),
            score: factors.safety,
            factors: packed,
          },
        ],
    signature: coords.filter((_, i) => i % 12 === 0).map((p) => p.join(',')).join('|'),
  };
}

/**
 * What the user asked to avoid, expressed as points off a route's safety score, so the
 * filters change which walk is offered instead of only shading the map.
 */
export function filterPenalty(route, filters = {}) {
  let penalty = 0;
  if (filters.avoidUnlit) penalty += 30 * (1 - route.factors.light);
  if (filters.avoidIsolated) penalty += 30 * route.factors.isolation;
  return penalty;
}

async function fetchOsrm(from, to) {
  const path = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${OSRM}/${path}?overview=full&geometries=geojson&alternatives=true&steps=false`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const json = await res.json();
    if (json.code !== 'Ok' || !json.routes?.length) throw new Error('OSRM empty');
    return json.routes;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * India-wide walk routes from public OSRM foot, scored with the live safety model.
 */
export async function planOsrm({ from, to, night, filters }) {
  let raw;
  try {
    raw = await fetchOsrm(from, to);
  } catch (err) {
    console.warn('OSRM failed:', err.message);
    return null;
  }

  const everyPoint = raw.flatMap((r) => toLatLng(r.geometry.coordinates));
  const context = await prepareRisk(everyPoint);

  const scored = raw.map((r) => packRoute(r, { id: 'tmp', label: 'tmp' }, night, context));
  const preference = (route) => route.safety - filterPenalty(route, filters);
  const byTime = [...scored].sort((a, b) => a.duration - b.duration || a.distance - b.distance);
  const bySafe = [...scored].sort((a, b) => preference(b) - preference(a) || a.duration - b.duration);

  const fast = { ...byTime[0], id: 'fast', label: 'Fastest' };
  const safest = { ...bySafe[0], id: 'safest', label: 'Safest' };
  const mid =
    scored.find((r) => r.signature !== fast.signature && r.signature !== safest.signature) ??
    byTime[Math.min(1, byTime.length - 1)];
  const balanced = { ...mid, id: 'balanced', label: 'Balanced' };

  const routes = [fast, balanced, safest];
  const seen = new Map();
  for (const route of routes) {
    const first = seen.get(route.signature);
    route.duplicateOf = first ?? null;
    if (!first) seen.set(route.signature, route.id);
    delete route.signature;
  }

  const line = routes.flatMap((r) => r.segments.flatMap((s) => s.coords));
  return {
    routes,
    zones: zonesAlong(line, night, context),
    snapped: { from: 0, to: 0 },
    night,
    filters,
    evidence: { streetContext: Boolean(context), pointsOfInterest: context?.counts ?? null },
  };
}
