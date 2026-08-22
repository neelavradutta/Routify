import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFILES,
  trafficScore,
  blockedScore,
  flowPenalty,
  buildCostTable,
  edgeCost,
  heuristicRate,
} from '../src/score.js';
import { WALK_SPEED_MS } from '../src/graph.js';

/** Minimal edge stub shaped like a graph.json edge. */
function edge(over = {}) {
  return {
    len: 100,
    seconds: 100 / WALK_SPEED_MS,
    lamp: 1,
    cam: 0,
    poi: 2,
    lit: -1,
    exp: 0.6,
    cls: 'residential',
    crime: 0.2,
    ...over,
  };
}

const mainRoad = edge({ cls: 'primary', exp: 0.9, poi: 8 });
const stairs = edge({ cls: 'steps', exp: 0.3, poi: 0 });
const emptyPath = edge({ cls: 'path', exp: 0.2, poi: 0 });
const quietFootway = edge({ cls: 'footway', exp: 0.35, poi: 0 });

test('traffic score rises with road class and activity', () => {
  assert.ok(trafficScore(mainRoad) > trafficScore(edge()));
  assert.ok(trafficScore(edge()) > trafficScore(emptyPath));
  for (const e of [mainRoad, stairs, emptyPath, quietFootway]) {
    const t = trafficScore(e);
    assert.ok(t >= 0 && t <= 1, `traffic out of range: ${t}`);
  }
});

test('blocked score flags stairs, tracks and dead footways', () => {
  assert.ok(blockedScore(stairs) > blockedScore(emptyPath));
  assert.ok(blockedScore(emptyPath) > blockedScore(quietFootway));
  assert.ok(blockedScore(quietFootway) > blockedScore(mainRoad));
  for (const e of [mainRoad, stairs, emptyPath, quietFootway]) {
    const b = blockedScore(e);
    assert.ok(b >= 0 && b <= 1, `blocked out of range: ${b}`);
  }
});

test('flow penalty is lowest on busy unobstructed roads', () => {
  assert.ok(flowPenalty(mainRoad) < flowPenalty(quietFootway));
  assert.ok(flowPenalty(quietFootway) < flowPenalty(emptyPath));
  assert.ok(flowPenalty(emptyPath) < flowPenalty(stairs));
});

test('fastest prefers the busy road, safest ignores flow', () => {
  const graph = { edges: [mainRoad, emptyPath] };
  const table = buildCostTable(graph, false, {});

  const fastMain = edgeCost(mainRoad, 0, table, PROFILES.fast);
  const fastPath = edgeCost(emptyPath, 1, table, PROFILES.fast);
  assert.ok(fastMain < fastPath, 'fastest should favour the high-traffic road');

  const safeMain = edgeCost(mainRoad, 0, table, PROFILES.safest);
  const safePathCost = edgeCost(emptyPath, 1, table, PROFILES.safest);
  const flowShare = PROFILES.safest.wF * table.flow[0] * mainRoad.len;
  assert.equal(flowShare, 0, 'safest must not pay the flow term');
  assert.ok(safeMain > 0 && safePathCost > 0);
});

test('balanced sits between fastest and safest on flow weight', () => {
  assert.ok(PROFILES.balanced.wF < PROFILES.fast.wF);
  assert.ok(PROFILES.balanced.wF > PROFILES.safest.wF);
  assert.ok(PROFILES.balanced.wS < PROFILES.safest.wS);
  assert.ok(PROFILES.balanced.wS > PROFILES.fast.wS);
});

test('heuristic stays a lower bound on real edge cost', () => {
  const graph = { edges: [mainRoad, stairs, emptyPath, quietFootway] };
  const table = buildCostTable(graph, true, { avoidUnlit: true, avoidIsolated: true });

  for (const profile of Object.values(PROFILES)) {
    const rate = heuristicRate(profile);
    graph.edges.forEach((e, i) => {
      const cost = edgeCost(e, i, table, profile);
      assert.ok(cost >= rate * e.len - 1e-6, `${profile.id} heuristic overestimates on ${e.cls}`);
    });
  }
});
