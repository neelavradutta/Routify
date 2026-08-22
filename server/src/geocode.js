import { Router } from 'express';
import { z } from 'zod';
import { inBbox } from './graph.js';
import { coverageBbox } from './corridor.js';

const USER_AGENT = 'SafeRoutesForWomen/1.0 (pedestrian safety routing; contact: local dev)';
const BASE = 'https://nominatim.openstreetmap.org';

const cache = new Map();
const MAX_CACHE = 200;
let queue = Promise.resolve();
let lastCall = 0;

function remember(key, value) {
  cache.set(key, value);
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
  return value;
}

function throttled(url) {
  queue = queue.then(async () => {
    const wait = 1100 - (Date.now() - lastCall);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
    return res.json();
  });
  return queue;
}

const tidy = (display) => {
  const parts = display.split(',').map((p) => p.trim());
  return { label: parts[0], context: parts.slice(1, 4).join(', ') };
};

export const geocodeRouter = Router();

const searchQuery = z.object({ q: z.string().trim().min(3).max(120) });

geocodeRouter.get('/search', async (req, res) => {
  const parsed = searchQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Type at least 3 characters' });

  const bbox = coverageBbox();
  const key = `s:${parsed.data.q.toLowerCase()}`;
  if (cache.has(key)) return res.json({ results: cache.get(key) });

  const url =
    `${BASE}/search?format=jsonv2&limit=6&addressdetails=0&countrycodes=in` +
    `&q=${encodeURIComponent(parsed.data.q)}`;

  try {
    const raw = await throttled(url);
    const results = raw
      .map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), ...tidy(r.display_name) }))
      .filter((r) => inBbox(bbox, r.lat, r.lng));
    res.json({ results: remember(key, results) });
  } catch {
    res.status(502).json({ error: 'Place search is unavailable right now' });
  }
});

const reverseQuery = z.object({ lat: z.coerce.number(), lng: z.coerce.number() });

geocodeRouter.get('/reverse', async (req, res) => {
  const parsed = reverseQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid coordinates' });

  const { lat, lng } = parsed.data;
  const bbox = coverageBbox();
  if (!inBbox(bbox, lat, lng)) return res.status(400).json({ error: 'Point is outside India' });

  const key = `r:${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache.has(key)) return res.json({ result: cache.get(key) });

  try {
    const raw = await throttled(`${BASE}/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`);
    const result = raw?.display_name
      ? { lat, lng, ...tidy(raw.display_name) }
      : { lat, lng, label: 'Dropped pin', context: '' };
    res.json({ result: remember(key, result) });
  } catch {
    res.json({ result: { lat, lng, label: 'Dropped pin', context: '' } });
  }
});
