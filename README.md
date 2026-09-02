# Routify

Safer walking routes for anywhere in India. Compare three walks — **Fastest**, **Balanced**, and **Safest** — with a safety score on each route.
I made this in 8hrs in a Devcrest Buildathon2026.

https://routify-eight.vercel.app/login

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

## Notes

- Safety scores use official crime statistics (NCRB), OpenStreetMap street data, and curated hotspot seeds. They are estimates, not guarantees.
- Routing uses the public OSRM foot network. Very long walks depend on that service being up.
