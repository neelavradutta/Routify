import { test } from 'node:test';
import assert from 'node:assert/strict';
import { factorsAt, rateToPrior, reasonFor, riskFrom, statisticalCrime } from '../src/risk.js';
import { cityAt, nearestState, stateByName, stateRate } from '../src/regions.js';
import { filterPenalty } from '../src/osrm.js';

/** Stub of the live Overpass context, so tests never touch the network. */
function context({ lamps = 0, cameras = 0, poi = 0, litWay = false, policeDistance = Infinity } = {}) {
  return { counts: {}, mapped: { lamps: true, litWays: true }, at: () => ({ lamps, cameras, poi, litWay, policeDistance }) };
}

/** Context from an area nobody has surveyed for lighting. */
function unsurveyed(poi = 0) {
  return {
    counts: {},
    mapped: { lamps: false, litWays: false },
    at: () => ({ lamps: null, cameras: 0, poi, litWay: null, policeDistance: Infinity }),
  };
}

test('reported crime rate maps onto a bounded 0..1 prior', () => {
  assert.ok(rateToPrior(0) < rateToPrior(64.6));
  assert.ok(rateToPrior(64.6) < rateToPrior(176.8));
  assert.ok(rateToPrior(10_000) <= 1);
});

test('NCRB rates separate the safest and least safe metros', () => {
  const delhi = statisticalCrime({ stateRate: 130.7, cityRate: 176.8 });
  const kolkata = statisticalCrime({ stateRate: 71.8, cityRate: 28.8 });
  const jaipur = statisticalCrime({ stateRate: 91.3, cityRate: 199 });
  assert.ok(delhi > kolkata, 'Delhi should outrank Kolkata on reported crime');
  assert.ok(jaipur > kolkata);
});

test('states without a published 2024 rate are rebased, not dropped', () => {
  const kerala = stateByName('Kerala');
  assert.equal(kerala.rate2024, undefined);
  const rate = stateRate(kerala);
  assert.ok(rate > 0 && rate < kerala.rate2022, 'rebasing to 2024 should ease the 2022 figure slightly');
});

test('metro city lookup covers the city and stops outside it', () => {
  assert.equal(cityAt(19.08, 72.88)?.name, 'Mumbai');
  assert.equal(cityAt(21.0, 78.0), null, 'open country belongs to no metropolitan city');
});

test('every point in India resolves to a state even without reverse geocoding', () => {
  assert.equal(nearestState(28.61, 77.2).name, 'Delhi');
  assert.equal(nearestState(13.08, 80.27).name, 'Tamil Nadu');
});

test('shops and lamps make a street safer than an empty one', () => {
  const busy = factorsAt(28.61, 77.2, true, context({ lamps: 6, poi: 20, cameras: 3 }));
  const empty = factorsAt(28.61, 77.2, true, context({ lamps: 0, poi: 0 }));
  assert.ok(busy.light > empty.light);
  assert.ok(busy.isolation < empty.isolation);
  assert.ok(riskFrom(busy, true) < riskFrom(empty, true));
});

test('a police post nearby counts as watched ground', () => {
  const watched = factorsAt(28.61, 77.2, true, context({ poi: 5, policeDistance: 120 }));
  const alone = factorsAt(28.61, 77.2, true, context({ poi: 5 }));
  assert.ok(watched.camera > alone.camera);
});

test('unmapped street lamps are not read as darkness', () => {
  const noSurvey = factorsAt(28.61, 77.2, true, unsurveyed(14));
  const surveyedDark = factorsAt(28.61, 77.2, true, context({ lamps: 0, poi: 14 }));
  assert.ok(noSurvey.light > surveyedDark.light);
});

test('a quiet lane is called isolated, a lit crime hotspot is not', () => {
  const lonely = factorsAt(21.0, 78.0, false, context({ poi: 0, lamps: 4 }));
  assert.equal(reasonFor(lonely, false), 'isolation');
  const delhiNight = factorsAt(28.61, 77.2, true, context({ poi: 30, lamps: 8 }));
  assert.ok(['crime', 'isolation', 'darkness'].includes(reasonFor(delhiNight, true)));
});

test('night shifts weight from reported crime onto darkness', () => {
  const dark = { light: 0.1, isolation: 0.3, crime: 0.3, camera: 0 };
  assert.ok(riskFrom(dark, true) > riskFrom(dark, false));
});

test('avoid filters push unlit and lonely routes down the ranking', () => {
  const route = { safety: 70, factors: { light: 0.2, isolation: 0.8, crime: 0.3, camera: 0 } };
  const bright = { safety: 70, factors: { light: 0.95, isolation: 0.05, crime: 0.3, camera: 0 } };

  assert.equal(filterPenalty(route, {}), 0, 'no filter, no penalty');
  assert.ok(filterPenalty(route, { avoidUnlit: true }) > filterPenalty(bright, { avoidUnlit: true }));
  assert.ok(filterPenalty(route, { avoidIsolated: true }) > filterPenalty(bright, { avoidIsolated: true }));

  const both = filterPenalty(route, { avoidUnlit: true, avoidIsolated: true });
  assert.ok(both > filterPenalty(route, { avoidUnlit: true }));
});
