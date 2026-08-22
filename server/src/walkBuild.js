import { haversine, GridIndex } from './graph.js';

export const WALKABLE =
  '^(footway|pedestrian|path|steps|living_street|residential|service|unclassified|tertiary|tertiary_link|secondary|secondary_link|primary|primary_link)$';

/** Higher means busier and more overlooked; used as an isolation prior when POI data is thin. */
export const CLASS_EXPOSURE = {
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

export function ingestNetwork(elements, nodes, ways) {
  for (const el of elements) {
    if (el.type === 'node') nodes.set(el.id, { lat: el.lat, lng: el.lon });
    else if (el.type === 'way' && !ways.has(el.id)) ways.set(el.id, el);
  }
}

export function ingestSignals(elements, lamps, cameras, pois) {
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat === undefined || lng === undefined) continue;
    const tags = el.tags ?? {};
    if (tags.highway === 'street_lamp') lamps.push({ lat, lng });
    else if (tags.man_made === 'surveillance' || tags.amenity === 'surveillance') cameras.push({ lat, lng });
    else pois.push({ lat, lng });
  }
}

/** Way node refs collapse into segments that run junction-to-junction, so an edge is a street stretch. */
export function buildSegments(nodes, ways) {
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

const round = (n) => Math.round(n * 1e5) / 1e5;

/** Turns OSM ways + nearby lamps/cameras/POIs into the compact graph.json shape. */
export function assembleRawGraph({ nodes, ways, lamps, cameras, pois, bbox }) {
  const lampIndex = new GridIndex(lamps, 100);
  const cameraIndex = new GridIndex(cameras, 150);
  const poiIndex = new GridIndex(pois, 150);
  const segments = buildSegments(nodes, ways);

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

  return {
    bbox,
    builtAt: new Date().toISOString(),
    names,
    nodes: flatNodes,
    edges,
  };
}

export function networkQuery(box) {
  return `[out:json][timeout:90];
way["highway"~"${WALKABLE}"]["foot"!="no"]["access"!~"^(private|no)$"](${box});
out body;
>;
out skel qt;`;
}

export function signalsQuery(box) {
  return `[out:json][timeout:90];
(
  node["highway"="street_lamp"](${box});
  node["man_made"="surveillance"](${box});
  way["man_made"="surveillance"](${box});
  node["amenity"="surveillance"](${box});
  node["shop"](${box});
  node["amenity"](${box});
  node["office"](${box});
  node["tourism"](${box});
  node["public_transport"](${box});
);
out center;`;
}
