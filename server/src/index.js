import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { authRouter, requireAuth } from './auth.js';
import { geocodeRouter } from './geocode.js';
import { planRoutes } from './route.js';
import { explainPlan } from './explain.js';
import { loadGraph } from './graph.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:3000';

app.use(helmet());
app.use(cors({ origin: WEB_ORIGIN }));
app.use(express.json({ limit: '32kb' }));

const limit = (max) => rateLimit({ windowMs: 60_000, max, standardHeaders: true, legacyHeaders: false });

const point = z.object({ lat: z.number(), lng: z.number() });
const planRequest = z.object({
  from: point,
  to: point,
  night: z.boolean().default(false),
  avoidUnlit: z.boolean().default(false),
  avoidIsolated: z.boolean().default(false),
});

const ERRORS = {
  START_OUT_OF_AREA: [400, 'Start point is outside the covered area of central Delhi'],
  END_OUT_OF_AREA: [400, 'Destination is outside the covered area of central Delhi'],
  NO_WALKABLE_START: [400, 'No walkable street found near one of those points'],
  TOO_CLOSE: [400, 'Those two points are on the same spot'],
  NO_ROUTE: [404, 'No walking route connects those points'],
};

function plan(req, res) {
  const parsed = planRequest.safeParse(req.body);
  if (!parsed.success) return { error: res.status(400).json({ error: 'Pick a start and a destination' }) };

  const { from, to, night, avoidUnlit, avoidIsolated } = parsed.data;
  const result = planRoutes({ from, to, night, filters: { avoidUnlit, avoidIsolated } });

  if (result.error) {
    const [status, message] = ERRORS[result.error] ?? [400, 'Could not plan that walk'];
    return { error: res.status(status).json({ error: message }) };
  }
  return { result };
}

app.get('/api/health', (_req, res) => {
  const graph = loadGraph();
  res.json({ ok: true, nodes: graph.nodes.length, edges: graph.edges.length, bbox: graph.bbox, builtAt: graph.builtAt });
});

app.get('/api/area', (_req, res) => {
  const graph = loadGraph();
  res.json({ bbox: graph.bbox, hotspots: graph.hotspots.length });
});

app.use('/api/auth', limit(30), authRouter);
app.use('/api/geocode', requireAuth, limit(60), geocodeRouter);

app.post('/api/route', requireAuth, limit(60), (req, res) => {
  const { error, result } = plan(req, res);
  if (error) return;
  res.json(result);
});

app.post('/api/explain', requireAuth, limit(20), async (req, res) => {
  const { error, result } = plan(req, res);
  if (error) return;
  const selected = typeof req.body.selected === 'string' ? req.body.selected : 'safest';
  res.json(await explainPlan(result, selected));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

loadGraph();
app.listen(PORT, () => {
  console.log(`Safe Routes API on http://localhost:${PORT} (origin allowed: ${WEB_ORIGIN})`);
});
