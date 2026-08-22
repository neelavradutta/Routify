import { GridIndex, haversine } from './graph.js';
import { overpass } from './overpass.js';

/**
 * Live street context from OpenStreetMap: what is actually on the ground around a point.
 * Lamps and lit ways drive the light score, shops and amenities drive footfall, and
 * police posts and cameras pull risk back down.
 *
 * Everything here is best-effort. If Overpass is slow or refuses, scoring falls back to
 * statistics alone rather than making the user wait.
 */

const BUDGET_MS = 8000;
const MAX_AREA_DEG2 = 0.45;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_LIMIT = 24;

const LAMP_RADIUS = 130;
const POI_RADIUS = 200;
const CAMERA_RADIUS = 160;
const POLICE_RADIUS = 700;

const cache = new Map();

/**
 * Public Overpass mirrors rate-limit hard. After a failure the next few minutes of
 * requests skip the live lookup outright rather than making every walker wait for a
 * timeout that is already known to be coming.
 */
const COOLDOWN_MS = 3 * 60 * 1000;
let coolingUntil = 0;

const round = (n, step) => Math.round(n / step) * step;

function cacheKey(bbox) {
  return [
    round(bbox.south, 0.02),
    round(bbox.west, 0.02),
    round(bbox.north, 0.02),
    round(bbox.east, 0.02),
  ].join(',');
}

function query(bbox) {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  return `[out:json][timeout:20];
(
  node["highway"="street_lamp"](${box});
  node["man_made"="surveillance"](${box});
  node["amenity"="police"](${box});
  node["shop"](${box});
  node["amenity"~"^(restaurant|cafe|fast_food|bar|pub|pharmacy|hospital|clinic|bank|atm|marketplace|bus_station|fuel|school|college|place_of_worship)$"](${box});
  way["lit"="yes"](${box});
);
out center 6000;`;
}

function classify(element) {
  const tags = element.tags ?? {};
  if (tags.highway === 'street_lamp') return 'lamp';
  if (tags.man_made === 'surveillance') return 'camera';
  if (tags.amenity === 'police') return 'police';
  if (tags.lit === 'yes') return 'lit';
  return 'poi';
}

function toPoints(json) {
  const points = [];
  for (const el of json.elements ?? []) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;
    points.push({ lat, lng, kind: classify(el) });
  }
  return points;
}

export function corridorBbox(coords, padDegrees = 0.004) {
  let south = 90;
  let west = 180;
  let north = -90;
  let east = -180;
  for (const [lat, lng] of coords) {
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
  }
  return {
    south: south - padDegrees,
    west: west - padDegrees,
    north: north + padDegrees,
    east: east + padDegrees,
  };
}

const area = (bbox) => (bbox.north - bbox.south) * (bbox.east - bbox.west);

function areaKm2(bbox) {
  const height = (bbox.north - bbox.south) * 111.32;
  const midLat = ((bbox.north + bbox.south) / 2) * (Math.PI / 180);
  const width = (bbox.east - bbox.west) * 111.32 * Math.cos(midLat);
  return Math.max(0.01, height * width);
}

/**
 * Street lamps are mapped patchily across India, so "no lamp nearby" usually means
 * nobody surveyed it rather than an unlit street. Below these densities the lamp and
 * lit-way readings are treated as unknown instead of as evidence of darkness.
 */
const LAMPS_MAPPED_PER_KM2 = 4;
const LIT_WAYS_MAPPED_PER_KM2 = 2;

/**
 * Fetches street furniture for a corridor once and indexes it for point lookups.
 * Returns null when the area is too big to be worth asking for, or the fetch fails.
 */
export async function loadContext(coords) {
  if (coords.length < 2) return null;
  const bbox = corridorBbox(coords);
  if (area(bbox) > MAX_AREA_DEG2) return null;

  const key = cacheKey(bbox);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  if (Date.now() < coolingUntil) return null;

  let json;
  try {
    json = await Promise.race([
      overpass(query(bbox), 2, 300),
      new Promise((_, reject) => setTimeout(() => reject(new Error('context budget')), BUDGET_MS)),
    ]);
  } catch (err) {
    coolingUntil = Date.now() + COOLDOWN_MS;
    console.warn('Street context unavailable, pausing live lookups:', err.message);
    return null;
  }

  const points = toPoints(json);
  const value = points.length ? buildContext(points, areaKm2(bbox)) : null;

  cache.set(key, { at: Date.now(), value });
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  return value;
}

function buildContext(points, km2) {
  const byKind = { lamp: [], camera: [], police: [], poi: [], lit: [] };
  for (const p of points) byKind[p.kind].push(p);

  const mapped = {
    lamps: byKind.lamp.length / km2 >= LAMPS_MAPPED_PER_KM2,
    litWays: byKind.lit.length / km2 >= LIT_WAYS_MAPPED_PER_KM2,
  };

  const index = {
    lamp: new GridIndex(byKind.lamp, 300),
    camera: new GridIndex(byKind.camera, 300),
    police: new GridIndex(byKind.police, 1000),
    poi: new GridIndex(byKind.poi, 400),
    lit: new GridIndex(byKind.lit, 300),
  };

  const counts = Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, v.length]));

  return {
    counts,
    mapped,
    /** Raw neighbourhood readings for one point; the risk model turns these into 0..1 factors. */
    at(lat, lng) {
      const near = (kind, radius) => index[kind].near(lat, lng, radius).length;
      const litWay = index.lit.near(lat, lng, LAMP_RADIUS).length > 0;
      const police = index.police.near(lat, lng, POLICE_RADIUS);
      let policeDistance = Infinity;
      for (const p of police) {
        policeDistance = Math.min(policeDistance, haversine(lat, lng, p.lat, p.lng));
      }
      return {
        lamps: mapped.lamps ? near('lamp', LAMP_RADIUS) : null,
        cameras: near('camera', CAMERA_RADIUS),
        poi: near('poi', POI_RADIUS),
        litWay: mapped.litWays ? litWay : null,
        policeDistance,
      };
    },
  };
}
