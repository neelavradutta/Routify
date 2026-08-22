import { test } from 'node:test';
import assert from 'node:assert/strict';
import { corridorBbox, coverageBbox, tileKey, tilesAlong, tilesCovering, INDIA_BBOX } from '../src/corridor.js';
import { inBbox } from '../src/graph.js';

test('coverage is India, not a city box', () => {
  const b = coverageBbox();
  assert.ok(b.south < 8 && b.north > 35);
  assert.ok(b.west < 70 && b.east > 90);
  assert.ok(inBbox(b, 19.076, 72.877)); // Mumbai
  assert.ok(inBbox(b, 12.9716, 77.5946)); // Bengaluru
  assert.ok(inBbox(b, 28.6139, 77.209)); // Delhi
  assert.ok(inBbox(b, 13.0827, 80.2707)); // Chennai
  assert.equal(inBbox(b, 51.5, -0.12), false); // London
});

test('corridor pad stays small; long trips still get tiles', () => {
  const near = corridorBbox({ lat: 19.07, lng: 72.87 }, { lat: 19.08, lng: 72.88 });
  assert.ok(near.dist < 2000);
  assert.ok(near.north - near.south < 0.1);

  const farFrom = { lat: 28.61, lng: 77.21 };
  const farTo = { lat: 19.07, lng: 72.87 };
  const far = corridorBbox(farFrom, farTo);
  assert.ok(far.dist > 100_000);
  const tiles = tilesAlong(farFrom, farTo);
  assert.ok(tiles.length > 10);
  const rect = tilesCovering(far);
  assert.ok(tiles.length < rect.length, 'line tiles should be fewer than the full rectangle');
});

test('tile keys are stable and cover a bbox', () => {
  assert.equal(tileKey(28.6139, 77.209), tileKey(28.6139, 77.209));
  const tiles = tilesCovering({ south: 28.61, west: 77.20, north: 28.62, east: 77.21 });
  assert.ok(tiles.length >= 1);
  assert.ok(tiles.length <= 4);
  assert.deepEqual(INDIA_BBOX, coverageBbox());
});
