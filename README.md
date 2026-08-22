# Safe Routes for Women

Safety-weighted pedestrian navigation for central Delhi. The router does not treat safety as a
map overlay: lighting, isolation, camera coverage and area crime priors are folded into the cost
of every street segment, so distance, time and safety are traded off inside the search itself.

Coverage area: `28.55–28.68 N, 77.15–77.28 E` (Connaught Place, India Gate, Khan Market, Lodi,
Mandi House, ITO, Karol Bagh, Chanakyapuri).

## What it does

- Enter a start and destination by search or by clicking the map.
- Compare three options for the same walk: **Fastest**, **Balanced**, **Safest**.
- See a 0–100 safety score per route and per street segment, coloured on the map.
- See flagged unsafe zones near the walk, labelled with the reason.
- Filter out poorly lit or isolated streets — the filters change the path, not just the display.
- Read a plain-language explanation of why the chosen route scores as it does.

## Running it

Two processes: the Express API on `:4000` and the Next.js app on `:3000`.

### 1. API

```bash
cd server
npm install
cp .env.example .env          # set JWT_SECRET, optionally OPENAI_API_KEY
npm run build:graph           # one-off, ~10 min: downloads the walk graph from Overpass
npm run dev
```

`npm run build:graph` writes `data/graph.json`. It caches each Overpass tile in
`data/.cache/`, so if a run is interrupted by rate limiting you can simply run it again and it
picks up where it stopped.

### 2. Web

```bash
cd web
npm install
npm run dev                   # http://localhost:3000
```

Register an account, then plan a walk. Without `OPENAI_API_KEY` everything still works; the
"why this route" panel writes the same facts using deterministic wording instead of the model.

## How the routing works

Every junction-to-junction street segment carries four normalised signals:

| Signal | Source | Meaning |
| --- | --- | --- |
| Lighting | `highway=street_lamp` within 40 m, `lit=*` tags, road class prior | 1 = well lit |
| Isolation | density of shops, amenities, offices and transit within 80 m, plus road class | 1 = nobody around |
| Cameras | `man_made=surveillance` within 60 m | 1 = covered |
| Crime | seeded area priors in `data/crime.geojson`, inverse-distance weighted | 1 = high exposure |

These combine into a single `risk` value in 0–1. Night shifts the weights towards lighting and
isolation; daytime shifts them towards crime exposure.

The cost of walking a segment is

```
cost = wD · metres + wT · seconds + wS · risk · metres
```

A* searches the same graph three times with different weight sets, which is what produces the
Fastest / Balanced / Safest comparison. The heuristic is straight-line distance multiplied by the
cheapest possible cost per metre, which keeps it admissible. Filters multiply the cost of dim or
isolated segments rather than deleting them, so a route is still found when there is no
alternative.

A segment's displayed score is `100 × (1 − risk)`; a route's score is its length-weighted mean.

## Data and its limits

- **Street network and infrastructure**: OpenStreetMap via the Overpass API, © OpenStreetMap
  contributors, ODbL.
- **Basemap**: CARTO Voyager tiles.
- **Geocoding**: Nominatim, throttled to one request per second and cached server-side.
- **Crime**: `server/data/crime.geojson` holds neighbourhood-level risk priors for the demo bbox,
  approximated from published Delhi Police district and station aggregates for crimes against
  women. They are area priors, not street-level incident reports, and they are deliberately kept
  in an editable file so they can be replaced with an official feed.

Street lamp coverage in OpenStreetMap is uneven across Delhi, so lighting falls back to a road
class prior where no lamps are mapped. Scores describe streets, not people, and are estimates
rather than guarantees.

## Layout

```
server/
  src/index.js        Express app, validation, rate limits
  src/graph.js        graph loading, spatial index, snapping
  src/score.js        safety signals, weights, filters, edge cost
  src/route.js        A*, segment assembly, unsafe zone clustering
  src/auth.js         register / login / me (JWT + bcrypt + SQLite)
  src/geocode.js      Nominatim proxy with throttle and cache
  src/explain.js      route explanation, model call with rule-based fallback
  scripts/build-graph.mjs
web/
  app/                layout, map page, login, register
  components/         MapView, RouteRail, RouteCard, AuthCard
  lib/api.ts          typed API client
  store/useApp.ts     Zustand store
```
