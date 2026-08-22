import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

export const WALK_SPEED_MS = 1.25;

/** Walking is not uniform: stairs, rough paths and big-road crossings all cost extra time. */
const SPEED_FACTOR = {
  steps: 0.45,
  path: 0.8,
  service: 0.95,
  primary: 0.85,
  primary_link: 0.85,
  secondary: 0.9,
  secondary_link: 0.9,
  tertiary: 0.95,
  tertiary_link: 0.95,
};

export function haversine(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Uniform lat/lng bucket index. Cell size is given in metres at the equator-ish scale of the bbox. */
export class GridIndex {
  constructor(points, cellMetres) {
    this.cell = cellMetres / 111320;
    this.buckets = new Map();
    this.points = points;
    for (let i = 0; i < points.length; i++) {
      const key = this.#key(points[i].lat, points[i].lng);
      const bucket = this.buckets.get(key);
      if (bucket) bucket.push(i);
      else this.buckets.set(key, [i]);
    }
  }

  #key(lat, lng) {
    return `${Math.floor(lat / this.cell)}:${Math.floor(lng / this.cell)}`;
  }

  /** Points whose bucket touches the square around (lat,lng); caller filters by true distance. */
  near(lat, lng, radiusMetres) {
    const span = Math.max(1, Math.ceil(radiusMetres / 111320 / this.cell));
    const cy = Math.floor(lat / this.cell);
    const cx = Math.floor(lng / this.cell);
    const out = [];
    for (let y = cy - span; y <= cy + span; y++) {
      for (let x = cx - span; x <= cx + span; x++) {
        const bucket = this.buckets.get(`${y}:${x}`);
        if (!bucket) continue;
        for (const i of bucket) {
          const p = this.points[i];
          if (haversine(lat, lng, p.lat, p.lng) <= radiusMetres) out.push(p);
        }
      }
    }
    return out;
  }
}

let cache = null;

/**
 * Loads the prebuilt walk graph once and derives adjacency plus a node index for snapping.
 * Edge crime exposure is computed here (not at build time) so the seed file stays editable.
 */
export function loadGraph() {
  if (cache) return cache;

  const raw = JSON.parse(readFileSync(join(dataDir, 'graph.json'), 'utf8'));
  const crime = JSON.parse(readFileSync(join(dataDir, 'crime.geojson'), 'utf8'));

  const nodes = [];
  for (let i = 0; i < raw.nodes.length; i += 2) {
    nodes.push({ lat: raw.nodes[i], lng: raw.nodes[i + 1] });
  }

  const hotspots = crime.features.map((f) => ({
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    name: f.properties.name,
    weight: f.properties.weight,
    radius: f.properties.radius,
  }));
  const crimeIndex = new GridIndex(hotspots, 1200);

  const adjacency = Array.from({ length: nodes.length }, () => []);
  for (let i = 0; i < raw.edges.length; i++) {
    const e = raw.edges[i];
    const m = Math.floor(e.geom.length / 4) * 2;
    e.mid = { lat: e.geom[m], lng: e.geom[m + 1] };
    e.crime = crimeExposure(crimeIndex, e.mid.lat, e.mid.lng);
    e.seconds = e.len / (WALK_SPEED_MS * (SPEED_FACTOR[e.cls] ?? 1));
    e.street = e.name >= 0 ? raw.names[e.name] : null;
    adjacency[e.a].push(i);
    adjacency[e.b].push(i);
  }

  const nodeIndex = new GridIndex(
    nodes.map((n, i) => ({ ...n, id: i })),
    250,
  );

  const components = buildComponents(nodes.length, raw.edges);

  cache = {
    bbox: raw.bbox,
    nodes,
    edges: raw.edges,
    adjacency,
    nodeIndex,
    hotspots,
    builtAt: raw.builtAt,
    components,
  };
  return cache;
}

/** Labels each node with its connected footpath cluster; the main cluster covers most of central Delhi. */
function buildComponents(nodeCount, edges) {
  const parent = new Int32Array(nodeCount);
  for (let i = 0; i < nodeCount; i++) parent[i] = i;

  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }

  function unite(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (const e of edges) unite(e.a, e.b);

  const componentOf = new Int32Array(nodeCount);
  const sizes = new Map();
  for (let i = 0; i < nodeCount; i++) {
    const root = find(i);
    componentOf[i] = root;
    sizes.set(root, (sizes.get(root) ?? 0) + 1);
  }

  let mainRoot = 0;
  let mainSize = 0;
  for (const [root, size] of sizes) {
    if (size > mainSize) {
      mainSize = size;
      mainRoot = root;
    }
  }

  return { componentOf, mainRoot, mainSize, clusterCount: sizes.size };
}

/** 0..1 exposure from seeded hotspots, decaying with distance and saturating when several overlap. */
function crimeExposure(index, lat, lng) {
  const candidates = index.near(lat, lng, 1500);
  let sum = 0;
  for (const h of candidates) {
    const d = haversine(lat, lng, h.lat, h.lng);
    if (d > h.radius * 2) continue;
    sum += h.weight / (1 + (d / h.radius) ** 2);
  }
  return Math.min(1, sum);
}

/**
 * Nearest walk-network node. Prefers the main street cluster over tiny isolated footpath
 * islands (common when clicking parks, lawns, or building centres).
 */
export function snap(graph, lat, lng, maxMetres = 300) {
  const { componentOf, mainRoot } = graph.components;

  let nearestAny = null;
  let nearestAnyDist = Infinity;
  let nearestMain = null;
  let nearestMainDist = Infinity;

  for (const radius of [100, 200, maxMetres]) {
    for (const p of graph.nodeIndex.near(lat, lng, radius)) {
      const d = haversine(lat, lng, p.lat, p.lng);
      if (d < nearestAnyDist) {
        nearestAnyDist = d;
        nearestAny = p.id;
      }
      if (componentOf[p.id] === mainRoot && d < nearestMainDist) {
        nearestMainDist = d;
        nearestMain = p.id;
      }
    }
    if (nearestMain !== null && nearestMainDist <= maxMetres) break;
  }

  const onMain = nearestMain !== null && nearestMainDist <= maxMetres;
  const node = onMain ? nearestMain : nearestAny;
  const distance = onMain ? nearestMainDist : nearestAnyDist;

  if (node === null || distance > maxMetres) return null;
  return { node, distance, onMainNetwork: componentOf[node] === mainRoot };
}

export function sameWalkNetwork(graph, nodeA, nodeB) {
  return graph.components.componentOf[nodeA] === graph.components.componentOf[nodeB];
}

export function inBbox(bbox, lat, lng) {
  return lat >= bbox.south && lat <= bbox.north && lng >= bbox.west && lng <= bbox.east;
}
