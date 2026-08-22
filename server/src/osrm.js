import { crimeAt, haversine, loadCrime } from './graph.js';
import { segmentScore } from './score.js';

const USER_AGENT = 'SafeRoutesForWomen/1.0 (pedestrian safety routing; contact: local dev)';
const OSRM = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';

function toLatLng(coords) {
  return coords.map(([lng, lat]) => [lat, lng]);
}

function sampleRisk(coords, night) {
  if (!coords.length) return { safety: 60, crime: 0.2, light: night ? 0.45 : 0.72, isolation: 0.35, camera: 0 };
  let crime = 0;
  const step = Math.max(1, Math.floor(coords.length / 24));
  let n = 0;
  for (let i = 0; i < coords.length; i += step) {
    crime += crimeAt(coords[i][0], coords[i][1]);
    n++;
  }
  crime = Math.min(1, crime / Math.max(1, n));
  const light = night ? 0.42 : 0.7;
  const isolation = 0.32 + 0.15 * crime;
  const camera = 0;
  const w = night
    ? { light: 0.38, isolation: 0.3, crime: 0.25, camera: 0.07 }
    : { light: 0.14, isolation: 0.31, crime: 0.44, camera: 0.11 };
  const risk = Math.max(
    0,
    Math.min(
      1,
      w.light * (1 - light) + w.isolation * isolation + w.crime * crime + w.camera * (1 - camera),
    ),
  );
  return { safety: segmentScore(risk), crime, light, isolation, camera };
}

function segmentsFromLine(coords, night) {
  if (coords.length < 2) return [];
  const chunks = [];
  const size = Math.max(8, Math.ceil(coords.length / 12));
  for (let i = 0; i < coords.length - 1; i += size) {
    const slice = coords.slice(i, Math.min(coords.length, i + size + 1));
    let length = 0;
    for (let k = 1; k < slice.length; k++) {
      length += haversine(slice[k - 1][0], slice[k - 1][1], slice[k][0], slice[k][1]);
    }
    const mid = slice[Math.floor(slice.length / 2)];
    const f = sampleRisk([mid], night);
    chunks.push({
      name: null,
      kind: 'footway',
      coords: slice,
      length: Math.round(length),
      score: f.safety,
      factors: { light: +f.light.toFixed(2), isolation: +f.isolation.toFixed(2), crime: +f.crime.toFixed(2), camera: f.camera },
    });
  }
  return chunks;
}

function reasonOf(crime, night) {
  if (crime >= 0.28) return 'crime';
  if (night) return 'darkness';
  return 'isolation';
}

function spaced(zones, minMetres) {
  const kept = [];
  for (const z of zones) {
    if (kept.some((k) => haversine(k.lat, k.lng, z.lat, z.lng) < minMetres)) continue;
    kept.push(z);
  }
  return kept;
}

function zonesAlong(coords, night = false) {
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
    const crime = crimeAt(lat, lng);
    const light = night ? 0.42 : 0.7;
    const isolation = 0.32 + 0.2 * crime;
    const w = night
      ? { light: 0.38, isolation: 0.3, crime: 0.25 }
      : { light: 0.14, isolation: 0.31, crime: 0.44 };
    const risk = Math.min(1, w.light * (1 - light) + w.isolation * isolation + w.crime * crime);
    samples.push({
      lat,
      lng,
      radius: 170,
      score: segmentScore(risk),
      reason: reasonOf(crime, night),
      name: null,
      risk,
    });
  }

  samples.sort((a, b) => a.score - b.score);
  const fromLine = spaced(samples, 240).slice(0, 14);
  const merged = spaced([...fromSeeds, ...fromLine], 140);
  return merged.sort((a, b) => a.score - b.score).slice(0, 24);
}

function packRoute(raw, profile, night) {
  const coords = toLatLng(raw.geometry.coordinates);
  const factors = sampleRisk(coords, night);
  const segs = segmentsFromLine(coords, night);
  const weakest = [...segs]
    .filter((s) => s.length > 40)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((s) => ({ name: s.name ?? 'this stretch', score: s.score, length: s.length }));

  return {
    id: profile.id,
    label: profile.label,
    distance: Math.round(raw.distance),
    duration: Math.round(raw.duration / 60),
    safety: factors.safety,
    factors: {
      light: +factors.light.toFixed(2),
      isolation: +factors.isolation.toFixed(2),
      crime: +factors.crime.toFixed(2),
      camera: factors.camera,
    },
    weakest,
    segments: segs.length ? segs : [{
      name: null,
      kind: 'footway',
      coords,
      length: Math.round(raw.distance),
      score: factors.safety,
      factors: {
        light: +factors.light.toFixed(2),
        isolation: +factors.isolation.toFixed(2),
        crime: +factors.crime.toFixed(2),
        camera: factors.camera,
      },
    }],
    signature: coords.filter((_, i) => i % 12 === 0).map((p) => p.join(',')).join('|'),
  };
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
 * Fast India-wide walk routes via public OSRM foot. Safety is scored along the
 * returned line (crime priors + day/night light). Avoids hanging on Overpass.
 */
export async function planOsrm({ from, to, night, filters }) {
  let raw;
  try {
    raw = await fetchOsrm(from, to);
  } catch (err) {
    console.warn('OSRM failed:', err.message);
    return null;
  }

  const scored = raw.map((r) => packRoute(r, { id: 'tmp', label: 'tmp' }, night));
  const byTime = [...scored].sort((a, b) => a.duration - b.duration || a.distance - b.distance);
  const bySafe = [...scored].sort((a, b) => b.safety - a.safety || a.duration - b.duration);

  const fast = { ...byTime[0], id: 'fast', label: 'Fastest' };
  const safest = { ...bySafe[0], id: 'safest', label: 'Safest' };
  const mid = scored.find((r) => r.signature !== fast.signature && r.signature !== safest.signature) ?? byTime[Math.min(1, byTime.length - 1)];
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
  void filters;
  return {
    routes,
    zones: zonesAlong(line, night),
    snapped: { from: 0, to: 0 },
    night,
    filters,
  };
}
