/**
 * Optional city pack: pulls a pedestrian network from Overpass into data/graph.json.
 * Live routing for India does not need this — corridors fetch OSM tiles on demand.
 *
 *   npm run build:graph
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { haversine, GridIndex } from '../src/graph.js';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

/** National Capital Territory of Delhi — full urban extent, not just central Delhi. */
const BBOX = { south: 28.4, west: 76.84, north: 28.88, east: 77.35 };
const TILES = 12;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// Overpass rejects requests without a descriptive User-Agent.
const USER_AGENT = 'SafeRoutesForWomen/1.0 (pedestrian safety routing; contact: local dev)';

const WALKABLE =
  '^(footway|pedestrian|path|steps|living_street|residential|service|unclassified|tertiary|tertiary_link|secondary|secondary_link|primary|primary_link)$';

/** Higher means busier and more overlooked; used as an isolation prior when POI data is thin. */
const CLASS_EXPOSURE = {
  primary: 0.9,
  primary_link: 0.9,
  secondary: 0.85,
  secondary_link: 0.85,
  tertiary: 0.75,
  tertiary_link: 0.75,
  residential: 0.6,
  living_street: 0.6,
  unclassified: 0.55,
  pedestrian: 0.7,
  service: 0.4,
  footway: 0.35,
  steps: 0.3,
  path: 0.2,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Public Overpass instances throttle hard, so retries back off and rotate between mirrors. */
async function overpass(query, attempts = 4, baseWait = 12000) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT },
        body: new URLSearchParams({ data: query }),
      });
      if (!res.ok) {
        const body = (await res.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        throw new Error(`${res.status} ${body.slice(0, 160)}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
      const wait = baseWait * (attempt + 1);
      console.log(`    ${endpoint} failed (${err.message}); retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
  throw lastError;
}

/**
 * Tile responses are cached on disk so an interrupted build resumes instead of refetching.
 * The cache key includes a hash of the query, so editing a query invalidates its tiles.
 */
async function cachedOverpass(name, query, { optional = false } = {}) {
  const cacheDir = join(dataDir, '.cache');
  const digest = createHash('sha1').update(query).digest('hex').slice(0, 8);
  const file = join(cacheDir, `${name}-${digest}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  mkdirSync(cacheDir, { recursive: true });
  try {
    const data = await overpass(query);
    writeFileSync(file, JSON.stringify(data));
    await sleep(4000);
    return data;
  } catch (err) {
    if (!optional) throw err;
    console.log(`  ${name}: ${err.message}; using empty tile so the graph can still be written`);
    const empty = { elements: [] };
    writeFileSync(file, JSON.stringify(empty));
    return empty;
  }
}

function tiles() {
  const out = [];
  const dLat = (BBOX.north - BBOX.south) / TILES;
  const dLng = (BBOX.east - BBOX.west) / TILES;
  for (let y = 0; y < TILES; y++) {
    for (let x = 0; x < TILES; x++) {
      out.push({
        south: BBOX.south + y * dLat,
        west: BBOX.west + x * dLng,
        north: BBOX.south + (y + 1) * dLat,
        east: BBOX.west + (x + 1) * dLng,
      });
    }
  }
  return out;
}

const box = (t) => `${t.south},${t.west},${t.north},${t.east}`;

async function fetchNetwork() {
  const nodes = new Map();
  const ways = new Map();
  const list = tiles();

  for (const [i, tile] of list.entries()) {
    const data = await cachedOverpass(
      `network-${i}`,
      `[out:json][timeout:180];
way["highway"~"${WALKABLE}"]["foot"!="no"]["access"!~"^(private|no)$"](${box(tile)});
out body;
>;
out skel qt;`,
    );

    for (const el of data.elements) {
      if (el.type === 'node') nodes.set(el.id, { lat: el.lat, lng: el.lon });
      else if (el.type === 'way' && !ways.has(el.id)) ways.set(el.id, el);
    }
    console.log(`  network tile ${i + 1}/${list.length}: ${ways.size} ways, ${nodes.size} nodes`);
  }
  return { nodes, ways };
}

async function fetchSignals() {
  const lamps = [];
  const cameras = [];
  const pois = [];
  const list = tiles();

  for (const [i, tile] of list.entries()) {
    const b = box(tile);
    const data = await cachedOverpass(
      `signals-${i}`,
      `[out:json][timeout:180];
(
  node["highway"="street_lamp"](${b});
  node["man_made"="surveillance"](${b});
  way["man_made"="surveillance"](${b});
  node["amenity"="surveillance"](${b});
  node["shop"](${b});
  node["amenity"](${b});
  node["office"](${b});
  node["tourism"](${b});
  node["public_transport"](${b});
);
out center;`,
      { optional: true },
    );

    for (const el of data.elements) {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat === undefined || lng === undefined) continue;
      const tags = el.tags ?? {};
      if (tags.highway === 'street_lamp') lamps.push({ lat, lng });
      else if (tags.man_made === 'surveillance' || tags.amenity === 'surveillance') cameras.push({ lat, lng });
      else pois.push({ lat, lng });
    }
    console.log(
      `  signal tile ${i + 1}/${list.length}: ${lamps.length} lamps, ${cameras.length} cameras, ${pois.length} POIs`,
    );
  }
  return { lamps, cameras, pois };
}

/** Way node refs collapse into segments that run junction-to-junction, so an edge is a street stretch. */
function buildSegments(nodes, ways) {
  const usage = new Map();
  for (const way of ways.values()) {
    for (const [i, ref] of way.nodes.entries()) {
      if (!nodes.has(ref)) continue;
      const terminal = i === 0 || i === way.nodes.length - 1;
      usage.set(ref, (usage.get(ref) ?? 0) + (terminal ? 2 : 1));
    }
  }
  const isJunction = (ref) => (usage.get(ref) ?? 0) >= 2;

  const segments = [];
  for (const way of ways.values()) {
    const refs = way.nodes.filter((r) => nodes.has(r));
    if (refs.length < 2) continue;

    let chain = [refs[0]];
    for (let i = 1; i < refs.length; i++) {
      chain.push(refs[i]);
      if (isJunction(refs[i]) || i === refs.length - 1) {
        if (chain.length >= 2 && chain[0] !== chain[chain.length - 1]) {
          segments.push({ refs: chain, tags: way.tags ?? {} });
        }
        chain = [refs[i]];
      }
    }
  }
  return segments;
}

function round(n) {
  return Math.round(n * 1e5) / 1e5;
}

async function main() {
  console.log('Fetching pedestrian network from OpenStreetMap...');
  const { nodes, ways } = await fetchNetwork();
  console.log('Fetching lighting, surveillance and activity signals...');
  const signals = await fetchSignals();

  const lampIndex = new GridIndex(signals.lamps, 100);
  const cameraIndex = new GridIndex(signals.cameras, 150);
  const poiIndex = new GridIndex(signals.pois, 150);

  const segments = buildSegments(nodes, ways);
  console.log(`Collapsed ${ways.size} ways into ${segments.length} segments.`);

  const nodeIds = new Map();
  const flatNodes = [];
  const takeNode = (ref) => {
    let id = nodeIds.get(ref);
    if (id === undefined) {
      id = flatNodes.length / 2;
      const n = nodes.get(ref);
      flatNodes.push(round(n.lat), round(n.lng));
      nodeIds.set(ref, id);
    }
    return id;
  };

  const names = [];
  const nameIds = new Map();
  const takeName = (name) => {
    if (!name) return -1;
    let id = nameIds.get(name);
    if (id === undefined) {
      id = names.length;
      names.push(name);
      nameIds.set(name, id);
    }
    return id;
  };

  const edges = [];
  for (const seg of segments) {
    const coords = seg.refs.map((r) => nodes.get(r));
    let len = 0;
    for (let i = 1; i < coords.length; i++) {
      len += haversine(coords[i - 1].lat, coords[i - 1].lng, coords[i].lat, coords[i].lng);
    }
    if (len < 1) continue;

    // Sample a handful of points along the stretch instead of only the midpoint.
    const samples = [];
    const steps = Math.min(5, coords.length);
    for (let s = 0; s < steps; s++) {
      samples.push(coords[Math.round((s * (coords.length - 1)) / Math.max(1, steps - 1))]);
    }

    let lamp = 0;
    let camera = 0;
    let poi = 0;
    for (const p of samples) {
      lamp += lampIndex.near(p.lat, p.lng, 40).length;
      camera += cameraIndex.near(p.lat, p.lng, 60).length;
      poi += poiIndex.near(p.lat, p.lng, 80).length;
    }

    const highway = seg.tags.highway;
    const litTag = seg.tags.lit === 'yes' ? 1 : seg.tags.lit === 'no' ? 0 : -1;

    const geom = [];
    const keep = Math.min(8, coords.length);
    for (let s = 0; s < keep; s++) {
      const c = coords[Math.round((s * (coords.length - 1)) / Math.max(1, keep - 1))];
      geom.push(round(c.lat), round(c.lng));
    }

    edges.push({
      a: takeNode(seg.refs[0]),
      b: takeNode(seg.refs[seg.refs.length - 1]),
      len: Math.round(len),
      geom,
      lamp: +(lamp / samples.length).toFixed(2),
      cam: camera > 0 ? 1 : 0,
      poi: +(poi / samples.length).toFixed(2),
      lit: litTag,
      exp: CLASS_EXPOSURE[highway] ?? 0.5,
      cls: highway,
      name: takeName(seg.tags.name),
    });
  }

  const graph = {
    bbox: BBOX,
    builtAt: new Date().toISOString(),
    names,
    nodes: flatNodes,
    edges,
  };

  mkdirSync(dataDir, { recursive: true });
  const file = join(dataDir, 'graph.json');
  writeFileSync(file, JSON.stringify(graph));
  console.log(`Wrote ${file}: ${flatNodes.length / 2} nodes, ${edges.length} edges.`);
}

main().catch((err) => {
  console.error('Graph build failed:', err.message);
  process.exit(1);
});
