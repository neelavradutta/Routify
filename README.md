# Routify

Safer walking routes for anywhere in India. Compare three walks — **Fastest**, **Balanced**, and **Safest** — with a safety score on each route.

## What you need

- [Node.js](https://nodejs.org/) 20 or newer
- Two terminal windows

## Setup

### 1. Start the API

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

API runs at **http://localhost:4000**

Edit `.env` and set `JWT_SECRET` to any long random string.

### 2. Start the website

```bash
cd web
npm install
cp .env.local.example .env.local
npm run dev
```

Website runs at **http://localhost:3000**

On Windows PowerShell, use `npm.cmd` instead of `npm` if needed.

## How to use

1. Open **http://localhost:3000** in your browser.
2. **Register** an account (or sign in if you already have one).
3. Type a **Start** and **Destination** — any place in India — or click the map to pick a point.
4. Choose **Day** or **Night**.
5. Optionally turn on **Avoid** filters (poorly lit streets, isolated areas).
6. Click **Get safer routes**.
7. Compare the three route cards. Tap one to see details on the map.
8. Use the **crosshair** button on the map to jump to your location.

Red circles on the map only appear when at least one **Avoid** filter is on.

## Optional

| Setting | Where | What it does |
| --- | --- | --- |
| `OPENAI_API_KEY` | `server/.env` | Smarter “why this route” text. Works without it too. |
| `NEXT_PUBLIC_API_URL` | `web/.env.local` | Point the website at a different API URL. |

## Deploy backend (Render)

Deploy the API before the Vercel frontend so you have a URL for `NEXT_PUBLIC_API_URL`.

### Option A — Blueprint (easiest)

1. Push this repo to GitHub.
2. Go to [dashboard.render.com/blueprints](https://dashboard.render.com/blueprints) → **New Blueprint Instance**.
3. Connect **Safe-Routes-for-Women** — Render reads `render.yaml` at the repo root.
4. After deploy, copy the service URL (e.g. `https://routify-api.onrender.com`).
5. Optional: set `WEB_ORIGIN` in Render → Environment to your Vercel URL later.

`JWT_SECRET` is auto-generated. Test: open `https://YOUR-SERVICE.onrender.com/api/health`

### Option B — Manual

1. [dashboard.render.com](https://dashboard.render.com) → **New +** → **Web Service**.
2. Connect the GitHub repo.
3. **Root Directory:** `server`
4. **Build Command:** `npm install`
5. **Start Command:** `npm start`
6. **Health Check Path:** `/api/health`
7. Environment variables:

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | long random string (32+ characters) |
| `WEB_ORIGIN` | your Vercel URL (optional — `*.vercel.app` already allowed) |

Free tier sleeps after ~15 min idle — first request may take 30–60 s to wake.

**Note:** SQLite user accounts live on ephemeral disk on free tier. They can reset on redeploy. Routing still works; only login history may be lost.

## Deploy frontend (Vercel)

The website lives in the `web/` folder. The API is separate — deploy that on [Render](https://render.com) or similar first, then point the frontend at it.

1. Push this repo to GitHub (already at `neelavradutta/Safe-Routes-for-Women`).
2. Go to [vercel.com/new](https://vercel.com/new) → **Import** the repo.
3. Set **Root Directory** to `web` (Edit → Root Directory → `web`).
4. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = your backend URL (e.g. `https://your-api.onrender.com`)
5. Click **Deploy**.

After deploy, set `WEB_ORIGIN` on the backend to your Vercel URL (e.g. `https://your-app.vercel.app`) so login and routing work.

**CLI (optional):**

```bash
cd web
npx vercel login
npx vercel --prod
```

Set `NEXT_PUBLIC_API_URL` in the Vercel project settings when prompted or in the dashboard.

## Tests

```bash
cd server
npm test
```

## Notes

- Safety scores use official crime statistics (NCRB), OpenStreetMap street data, and curated hotspot seeds. They are estimates, not guarantees.
- Routing uses the public OSRM foot network. Very long walks depend on that service being up.
