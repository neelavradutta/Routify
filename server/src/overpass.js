const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

export const USER_AGENT = 'SafeRoutesForWomen/1.0 (pedestrian safety routing; contact: local dev)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let queue = Promise.resolve();

/**
 * Serialised Overpass queue with mirror rotation. Public instances 429 hard;
 * one in-flight request keeps this app a decent neighbour.
 */
export function overpass(query, attempts = 2, baseWait = 1500) {
  queue = queue.then(() => run(query, attempts, baseWait));
  return queue;
}

async function run(query, attempts, baseWait) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const body = (await res.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        throw new Error(`${res.status} ${body.slice(0, 160)}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
      console.warn(`Overpass ${endpoint} failed (${err.message}); retry ${attempt + 1}/${attempts}`);
      const wait = baseWait * (attempt + 1);
      await sleep(wait);
    }
  }
  const error = new Error(lastError?.message ?? 'Overpass unavailable');
  error.code = 'OVERPASS';
  throw error;
}
