import { loadGraph, snap, haversine, inBbox, sameWalkNetwork } from './graph.js';
import {
  PROFILES,
  buildCostTable,
  edgeCost,
  heuristicRate,
  edgeFactors,
  segmentScore,
} from './score.js';

/** Min-heap keyed by f-score; plain arrays keep the hot loop allocation-free. */
class Heap {
  constructor() {
    this.keys = [];
    this.values = [];
  }
  get size() {
    return this.keys.length;
  }
  push(key, value) {
    this.keys.push(key);
    this.values.push(value);
    let i = this.keys.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= this.keys[i]) break;
      this.#swap(i, parent);
      i = parent;
    }
  }
  pop() {
    const top = this.values[0];
    const key = this.keys.pop();
    const value = this.values.pop();
    if (this.keys.length) {
      this.keys[0] = key;
      this.values[0] = value;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let small = i;
        if (l < this.keys.length && this.keys[l] < this.keys[small]) small = l;
        if (r < this.keys.length && this.keys[r] < this.keys[small]) small = r;
        if (small === i) break;
        this.#swap(i, small);
        i = small;
      }
    }
    return top;
  }
  #swap(a, b) {
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
    [this.values[a], this.values[b]] = [this.values[b], this.values[a]];
  }
}

/** A* over the walk graph. The heuristic is straight-line distance times the cheapest cost per metre. */
function search(graph, table, profile, start, goal) {
  const { nodes, edges, adjacency } = graph;
  const rate = heuristicRate(profile);
  const target = nodes[goal];
  const h = (n) => haversine(nodes[n].lat, nodes[n].lng, target.lat, target.lng) * rate;

  const g = new Float64Array(nodes.length).fill(Infinity);
  const cameFrom = new Int32Array(nodes.length).fill(-1);
  const cameEdge = new Int32Array(nodes.length).fill(-1);
  const closed = new Uint8Array(nodes.length);

  g[start] = 0;
  const open = new Heap();
  open.push(h(start), start);

  while (open.size) {
    const current = open.pop();
    if (current === goal) break;
    if (closed[current]) continue;
    closed[current] = 1;

    for (const edgeId of adjacency[current]) {
      const edge = edges[edgeId];
      const next = edge.a === current ? edge.b : edge.a;
      if (closed[next]) continue;
      const tentative = g[current] + edgeCost(edge, edgeId, table, profile);
      if (tentative < g[next]) {
        g[next] = tentative;
        cameFrom[next] = current;
        cameEdge[next] = edgeId;
        open.push(tentative + h(next), next);
      }
    }
  }

  if (g[goal] === Infinity) return null;

  const path = [];
  for (let n = goal; n !== start; n = cameFrom[n]) {
    path.push({ edge: cameEdge[n], to: n });
    if (cameFrom[n] === -1) return null;
  }
  return path.reverse();
}

function orientedCoords(edge, arriveAt) {
  const points = [];
  for (let i = 0; i < edge.geom.length; i += 2) points.push([edge.geom[i], edge.geom[i + 1]]);
  return edge.b === arriveAt ? points : points.reverse();
}

const bucket = (score) => Math.round(score / 12);

/** Turns a raw edge path into UI segments: consecutive stretches of the same street and score band. */
function assemble(graph, table, path, profile, night) {
  const segments = [];
  let distance = 0;
  let duration = 0;
  let riskLength = 0;
  const totals = { light: 0, isolation: 0, crime: 0, camera: 0 };

  for (const step of path) {
    const edge = graph.edges[step.edge];
    const factors = edgeFactors(edge, night);
    const risk = table.risk[step.edge];
    const score = segmentScore(risk);
    const coords = orientedCoords(edge, step.to);

    distance += edge.len;
    duration += edge.seconds;
    riskLength += risk * edge.len;
    for (const key of Object.keys(totals)) totals[key] += factors[key] * edge.len;

    const last = segments[segments.length - 1];
    if (last && last.name === edge.street && bucket(last.score) === bucket(score)) {
      last.coords.push(...coords.slice(1));
      last.length += edge.len;
      last.score = Math.round((last.score * (last.length - edge.len) + score * edge.len) / last.length);
      for (const key of Object.keys(totals)) {
        last.factors[key] = (last.factors[key] * (last.length - edge.len) + factors[key] * edge.len) / last.length;
      }
    } else {
      segments.push({
        name: edge.street,
        kind: edge.cls,
        coords,
        length: edge.len,
        score,
        factors: { ...factors },
      });
    }
  }

  const routeRisk = distance > 0 ? riskLength / distance : 0;
  const round2 = (n) => +(n / Math.max(1, distance)).toFixed(2);

  for (const s of segments) {
    s.length = Math.round(s.length);
    for (const key of Object.keys(s.factors)) s.factors[key] = +s.factors[key].toFixed(2);
  }

  const weakest = [...segments]
    .filter((s) => s.length > 40)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((s) => ({ name: s.name ?? `unnamed ${s.kind ?? 'path'}`, score: s.score, length: s.length }));

  return {
    id: profile.id,
    label: profile.label,
    distance: Math.round(distance),
    duration: Math.round(duration / 60),
    safety: segmentScore(routeRisk),
    factors: {
      light: round2(totals.light),
      isolation: round2(totals.isolation),
      crime: round2(totals.crime),
      camera: round2(totals.camera),
    },
    weakest,
    segments,
    signature: path.map((s) => s.edge).join(','),
  };
}

/** Clusters high-risk edges around the routes into circles the map can highlight. */
function unsafeZones(graph, table, routes, night) {
  const lats = [];
  const lngs = [];
  for (const route of routes) {
    for (const segment of route.segments) {
      for (const [lat, lng] of segment.coords) {
        lats.push(lat);
        lngs.push(lng);
      }
    }
  }
  if (!lats.length) return [];

  const pad = 0.004;
  const box = {
    south: Math.min(...lats) - pad,
    north: Math.max(...lats) + pad,
    west: Math.min(...lngs) - pad,
    east: Math.max(...lngs) + pad,
  };

  const cell = 0.0027; // ~300 m
  const cells = new Map();
  const threshold = night ? 0.55 : 0.5;

  for (let i = 0; i < graph.edges.length; i++) {
    if (table.risk[i] < threshold) continue;
    const { lat, lng } = graph.edges[i].mid;
    if (!inBbox(box, lat, lng)) continue;

    const key = `${Math.floor(lat / cell)}:${Math.floor(lng / cell)}`;
    const entry = cells.get(key) ?? { lat: 0, lng: 0, weight: 0, risk: 0, factors: { light: 0, isolation: 0, crime: 0 }, names: new Map() };
    const edge = graph.edges[i];
    const factors = edgeFactors(edge, night);
    const w = edge.len;

    entry.lat += lat * w;
    entry.lng += lng * w;
    entry.weight += w;
    entry.risk += table.risk[i] * w;
    entry.factors.light += (1 - factors.light) * w;
    entry.factors.isolation += factors.isolation * w;
    entry.factors.crime += factors.crime * w;
    if (edge.street) entry.names.set(edge.street, (entry.names.get(edge.street) ?? 0) + w);
    cells.set(key, entry);
  }

  const zones = [];
  for (const entry of cells.values()) {
    if (entry.weight < 120) continue;
    const risk = entry.risk / entry.weight;
    const factors = {
      darkness: entry.factors.light / entry.weight,
      isolation: entry.factors.isolation / entry.weight,
      crime: entry.factors.crime / entry.weight,
    };
    const reason = Object.entries(factors).sort((a, b) => b[1] - a[1])[0][0];
    const name = [...entry.names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    zones.push({
      lat: entry.lat / entry.weight,
      lng: entry.lng / entry.weight,
      radius: 170,
      score: segmentScore(risk),
      reason,
      name,
    });
  }

  return zones.sort((a, b) => a.score - b.score).slice(0, 45);
}

export function planRoutes({ from, to, night, filters }) {
  const graph = loadGraph();

  if (!inBbox(graph.bbox, from.lat, from.lng)) return { error: 'START_OUT_OF_AREA' };
  if (!inBbox(graph.bbox, to.lat, to.lng)) return { error: 'END_OUT_OF_AREA' };

  const start = snap(graph, from.lat, from.lng);
  const goal = snap(graph, to.lat, to.lng);
  if (!start || !goal) return { error: 'NO_WALKABLE_START' };
  if (start.node === goal.node) return { error: 'TOO_CLOSE' };
  if (!sameWalkNetwork(graph, start.node, goal.node)) return { error: 'DISCONNECTED' };

  const table = buildCostTable(graph, night, filters);
  const routes = [];
  for (const profile of [PROFILES.fast, PROFILES.balanced, PROFILES.safest]) {
    const path = search(graph, table, profile, start.node, goal.node);
    if (!path) continue;
    routes.push(assemble(graph, table, path, profile, night));
  }
  if (!routes.length) return { error: 'NO_ROUTE' };

  const seen = new Map();
  for (const route of routes) {
    const first = seen.get(route.signature);
    route.duplicateOf = first ?? null;
    if (!first) seen.set(route.signature, route.id);
    delete route.signature;
  }

  return {
    routes,
    zones: unsafeZones(graph, table, routes, night),
    snapped: { from: Math.round(start.distance), to: Math.round(goal.distance) },
    night,
    filters,
  };
}
