import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { haversine } from './graph.js';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'SafeRoutesForWomen/1.0 (pedestrian safety routing; contact: local dev)';

/** Nominatim asks for one call a second, so answers are reused across a ~5 km tile. */
const TILE = 0.05;
const REVERSE_GAP_MS = 1100;
const REVERSE_TIMEOUT_MS = 4000;

let statesFile = null;
let citiesFile = null;

function states() {
  if (!statesFile) statesFile = JSON.parse(readFileSync(join(dataDir, 'ncrb-states.json'), 'utf8'));
  return statesFile;
}

function cities() {
  if (!citiesFile) citiesFile = JSON.parse(readFileSync(join(dataDir, 'ncrb-cities.json'), 'utf8'));
  return citiesFile;
}

export const nationalRate = () => states().national.rate2024;

/** NCRB publishes a 2024 rate for some states only; older ones are rebased to the 2024 national level. */
export function stateRate(entry) {
  if (!entry) return nationalRate();
  if (entry.rate2024 != null) return entry.rate2024;
  const n = states().national;
  return entry.rate2022 * (n.rate2024 / n.rate2022);
}

export function stateByName(name) {
  if (!name) return null;
  const wanted = name.toLowerCase().replace(/\band\b|&/g, 'and').replace(/[^a-z ]/g, '').trim();
  return (
    states().states.find((s) => s.name.toLowerCase() === wanted) ??
    states().states.find((s) => wanted.includes(s.name.toLowerCase())) ??
    null
  );
}

/**
 * Fallback when reverse geocoding is unavailable. Inside a metropolitan city the answer is
 * known outright; elsewhere the nearest state centroid is the best cheap guess.
 */
export function nearestState(lat, lng) {
  const city = cityAt(lat, lng);
  if (city) {
    const owner = stateByName(city.state);
    if (owner) return owner;
  }
  let best = null;
  let bestDistance = Infinity;
  for (const s of states().states) {
    const d = haversine(lat, lng, s.lat, s.lng);
    if (d < bestDistance) {
      bestDistance = d;
      best = s;
    }
  }
  return best;
}

/** Metropolitan city whose NCRB reporting area covers this point, if any. */
export function cityAt(lat, lng) {
  let best = null;
  let bestDistance = Infinity;
  for (const c of cities().cities) {
    const d = haversine(lat, lng, c.lat, c.lng);
    if (d <= c.radiusKm * 1000 && d < bestDistance) {
      bestDistance = d;
      best = { ...c, distance: d };
    }
  }
  return best;
}

/** Distance to the nearest metropolitan centre, whether or not the point falls inside it. */
export function nearestCity(lat, lng) {
  let best = null;
  let bestDistance = Infinity;
  for (const c of cities().cities) {
    const d = haversine(lat, lng, c.lat, c.lng);
    if (d < bestDistance) {
      bestDistance = d;
      best = { ...c, distance: d };
    }
  }
  return best;
}

/**
 * Rough 0..1 sense of how built-up a place is, from its distance to a big city centre.
 * Used only when live street data is unavailable, to avoid calling a village high street
 * and a national highway shoulder equally lonely.
 */
export function urbanity(lat, lng) {
  const city = nearestCity(lat, lng);
  if (!city) return 0.25;
  const km = city.distance / 1000;
  if (km <= city.radiusKm * 0.35) return 1;
  if (km >= 90) return 0.12;
  const span = 90 - city.radiusKm * 0.35;
  return Math.max(0.12, 1 - (km - city.radiusKm * 0.35) / span);
}

const tileKey = (lat, lng) => `${Math.floor(lat / TILE)}:${Math.floor(lng / TILE)}`;

const regionCache = new Map();
const pending = new Map();
let lastReverseAt = 0;

async function reverse(lat, lng) {
  const wait = Math.max(0, lastReverseAt + REVERSE_GAP_MS - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastReverseAt = Date.now();

  const url = `${NOMINATIM}?format=jsonv2&zoom=10&lat=${lat}&lon=${lng}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REVERSE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
    if (!res.ok) return null;
    const json = await res.json();
    const a = json.address ?? {};
    return {
      state: a.state ?? a['state_district'] ?? null,
      district: a.county ?? a.state_district ?? null,
      place: a.city ?? a.town ?? a.municipality ?? a.village ?? null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Which administrative area a point sits in, and the NCRB numbers attached to it.
 * Reverse geocoding is best-effort: on failure the nearest state centroid is used, so a
 * route is always scored against real crime statistics rather than a flat guess.
 */
export async function regionAt(lat, lng) {
  const key = tileKey(lat, lng);
  const cached = regionCache.get(key);
  if (cached) return cached;
  if (pending.has(key)) return pending.get(key);

  const work = (async () => {
    const named = await reverse(lat, lng);
    const state = (named && stateByName(named.state)) ?? nearestState(lat, lng);
    const city = cityAt(lat, lng);
    const region = {
      state: state?.name ?? null,
      district: named?.district ?? null,
      place: named?.place ?? null,
      city: city?.name ?? null,
      stateRate: stateRate(state),
      cityRate: city?.rate2024 ?? null,
      resolved: Boolean(named),
    };
    regionCache.set(key, region);
    pending.delete(key);
    return region;
  })();

  pending.set(key, work);
  return work;
}

/** Synchronous view used while scoring many points: centroid state plus metro city overlay. */
export function regionAtSync(lat, lng) {
  const cached = regionCache.get(tileKey(lat, lng));
  if (cached) return cached;
  const state = nearestState(lat, lng);
  const city = cityAt(lat, lng);
  return {
    state: state?.name ?? null,
    district: null,
    place: null,
    city: city?.name ?? null,
    stateRate: stateRate(state),
    cityRate: city?.rate2024 ?? null,
    resolved: false,
  };
}

export function crimeStats() {
  return { states: states().states.length, cities: cities().cities.length, national: nationalRate() };
}
