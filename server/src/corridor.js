import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversine, hydrateGraph, inBbox } from './graph.js';
import { overpass } from './overpass.js';
import { assembleRawGraph, ingestNetwork, ingestSignals, networkQuery, signalsQuery } from './walkBuild.js';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const tileDir = join(dataDir, 'tiles');

/** Mainland + islands + claimed north. Pedestrian routing, not a political statement. */
export const INDIA_BBOX = { south: 6.5, west: 68.0, north: 37.1, east: 97.5 };

export const TILE_DEG = 0.04;

const GRAPH_LRU = 8;
const graphs = new Map();

export function coverageBbox() {
  return INDIA_BBOX;
}

export function tileKey(lat, lng) {
  return `${Math.floor(lat / TILE_DEG)}:${Math.floor(lng / TILE_DEG)}`;
}

export function tilesCovering(bbox) {
  const y0 = Math.floor(bbox.south / TILE_DEG);
  const y1 = Math.floor((bbox.north - 1e-12) / TILE_DEG);
  const x0 = Math.floor(bbox.west / TILE_DEG);
  const x1 = Math.floor((bbox.east - 1e-12) / TILE_DEG);
  const out = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) out.push(`${y}:${x}`);
  }
  return out;
}

/** Tiles along the walk line plus a 1-cell halo — long trips stay linear, not a giant rectangle. */
export function tilesAlong(from, to) {
  const dist = haversine(from.lat, from.lng, to.lat, to.lng);
  const stepM = TILE_DEG * 111320 * 0.45;
  const steps = Math.max(2, Math.ceil(dist / stepM));
  const keys = new Set();
  const add = (lat, lng) => {
    const y = Math.floor(lat / TILE_DEG);
    const x = Math.floor(lng / TILE_DEG);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) keys.add(`${y + dy}:${x + dx}`);
    }
  };
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    add(from.lat + (to.lat - from.lat) * t, from.lng + (to.lng - from.lng) * t);
  }
  return [...keys];
}

export function corridorBbox(from, to) {
  const dist = haversine(from.lat, from.lng, to.lat, to.lng);
  const pad = Math.max(0.012, Math.min(0.04, (dist / 111320) * 0.08 + 0.012));
  return {
    south: Math.min(from.lat, to.lat) - pad,
    north: Math.max(from.lat, to.lat) + pad,
    west: Math.min(from.lng, to.lng) - pad,
    east: Math.max(from.lng, to.lng) + pad,
    dist,
  };
}

const boxStr = (t) => `${t.south},${t.west},${t.north},${t.east}`;

function tileBbox(key) {
  const [y, x] = key.split(':').map(Number);
  return {
    south: y * TILE_DEG,
    north: (y + 1) * TILE_DEG,
    west: x * TILE_DEG,
    east: (x + 1) * TILE_DEG,
  };
}

function rememberGraph(key, graph) {
  if (graphs.has(key)) graphs.delete(key);
  graphs.set(key, graph);
  while (graphs.size > GRAPH_LRU) {
    const oldest = graphs.keys().next().value;
    graphs.delete(oldest);
  }
  return graph;
}

function readTile(kind, key) {
  const file = join(tileDir, `${kind}-${key.replace(':', '_')}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeTile(kind, key, data) {
  mkdirSync(tileDir, { recursive: true });
  writeFileSync(join(tileDir, `${kind}-${key.replace(':', '_')}.json`), JSON.stringify(data));
}

async function loadTile(kind, key) {
  const hit = readTile(kind, key);
  if (hit) return hit;
  const bbox = tileBbox(key);
  const query = kind === 'n' ? networkQuery(boxStr(bbox)) : signalsQuery(boxStr(bbox));
  try {
    const data = await overpass(query);
    writeTile(kind, key, data);
    return data;
  } catch (err) {
    if (kind === 's') {
      const empty = { elements: [] };
      writeTile(kind, key, empty);
      return empty;
    }
    throw err;
  }
}

/**
 * Same path for every Indian city: OSM tiles along the walk, cached on disk.
 * No distance cap — long walks fetch more tiles along the line.
 */
export async function getCorridorGraph(from, to) {
  if (!inBbox(INDIA_BBOX, from.lat, from.lng)) return { error: 'START_OUT_OF_AREA' };
  if (!inBbox(INDIA_BBOX, to.lat, to.lng)) return { error: 'END_OUT_OF_AREA' };

  const box = corridorBbox(from, to);
  const tiles = tilesAlong(from, to);
  const cacheKey = tiles.slice().sort().join('|');
  if (graphs.has(cacheKey)) return { graph: graphs.get(cacheKey) };

  const nodes = new Map();
  const ways = new Map();
  const lamps = [];
  const cameras = [];
  const pois = [];

  try {
    for (const key of tiles) {
      const network = await loadTile('n', key);
      ingestNetwork(network.elements ?? [], nodes, ways);
      const signals = await loadTile('s', key);
      ingestSignals(signals.elements ?? [], lamps, cameras, pois);
    }
  } catch (err) {
    console.error('Overpass network failed:', err.message);
    return { error: 'GRAPH_FETCH' };
  }

  if (!ways.size) return { error: 'NO_WALKABLE_START' };

  const raw = assembleRawGraph({ nodes, ways, lamps, cameras, pois, bbox: box });
  if (!raw.edges.length) return { error: 'NO_WALKABLE_START' };

  const graph = hydrateGraph(raw);
  return { graph: rememberGraph(cacheKey, graph) };
}
