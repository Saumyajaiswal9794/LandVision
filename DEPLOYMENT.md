# LandVision — Deployment Guide (Sprint 5)

This document covers deploying **both** halves of LandVision:

| Service  | Platform | Source dir    | Public URL pattern                      |
| -------- | -------- | ------------- | --------------------------------------- |
| Backend  | Render   | `server/`     | `https://landvision-api.onrender.com`  |
| Frontend | Vercel   | `client/`     | `https://landvision.vercel.app`        |

> Render's free tier sleeps after 15 min of inactivity and takes ~50 s to wake
> on the next request. The first demo request will appear slow — this is
> expected, not a bug. Upgrade to a paid plan for always-on traffic.

---

## 0. Prerequisites

You will need accounts and credentials for:

- **GitHub** — the repo is your deploy source.
- **Render** — https://render.com (free tier works for demo).
- **Vercel** — https://vercel.com (free Hobby tier works).
- **MongoDB Atlas** — free M0 cluster for `MONGODB_URI`.
- **Supabase** — one project provides Auth, Storage (scanned docs), and Postgres/PostGIS (`PG_CONNECTION_STRING`).
- **Google AI Studio** — free Gemini API key for `GEMINI_API_KEY` (https://aistudio.google.com/app/apikey).

You must also have already created the Supabase **storage bucket** named
`land-records` and the `plots` PostGIS table (see
`server/src/db/migrations/001_create_plots_table.sql`).

---

## 1. Backend → Render

### Option A — Blueprint (recommended)

1. Push the repo to GitHub (this commit includes `render.yaml` at the repo root).
2. In the Render dashboard: **New → Blueprint** → pick the `LandVision` repo.
3. Render reads `render.yaml` and provisions a `landvision-api` Web Service.
4. In the service's **Environment** tab, fill in every `sync: false` secret:

   | Key                     | Where it comes from                                          |
   | ----------------------- | ------------------------------------------------------------ |
   | `CLIENT_ORIGIN`         | The Vercel URL you'll get in step 2 (e.g. `https://landvision.vercel.app`). Set it AFTER step 2 if you don't have it yet. |
   | `MONGODB_URI`           | MongoDB Atlas → Connect → Drivers connection string.        |
   | `SUPABASE_URL`          | Supabase dashboard → Project Settings → API → Project URL.   |
   | `SUPABASE_ANON_KEY`     | Supabase → Project Settings → API → `anon` `public` key.     |
   | `SUPABASE_SERVICE_KEY`  | Supabase → Project Settings → API → `service_role` key (server-only — never expose). |
   | `PG_CONNECTION_STRING`  | Supabase → Project Settings → Database → Connection string → URI (with `?sslmode=require`). |
   | `GEMINI_API_KEY`         | Google AI Studio → Get API key.                              |

5. Click **Manual Deploy → Deploy latest commit**.
6. Watch the logs. The first boot prints:

   ```
   [Server] LandVision backend API running on port 10000
   [Server] CORS allowed origins: https://landvision.vercel.app
   Successfully connected to MongoDB
   Successfully connected to PostgreSQL/PostGIS
   ```

7. Visit `https://landvision-api.onrender.com/health` — you should see:

   ```json
   { "status": "ok", "timestamp": "2026-09-03T..." }
   ```

### Option B — Manual dashboard setup

If you prefer to skip `render.yaml`:

1. Render dashboard → **New → Web Service** → connect the GitHub repo.
2. Set **Root Directory** to `server/`.
3. **Build Command:** `npm install && npm run build`
4. **Start Command:** `npm start`
5. Add every environment variable listed in `server/.env.production.example`
   (and the table above) under the **Environment** tab.
6. Deploy.

### Why the server uses `process.env.PORT` (not a hardcoded port)

Render assigns a random high port at runtime and routes external port 443 to
it. The server's `index.ts` reads `env.PORT` (which itself reads
`process.env.PORT || '4000'`), so the same code boots identically on:

- Local dev  → `PORT=4000`
- Render prod → `PORT=10000` (or whatever Render assigns)

You never need to change the code between environments.

### Why the env-missing check is fatal

`server/src/config/env.ts` checks every required env var on boot. If
`NODE_ENV=production` and any are missing, it throws and Render's start
command exits non-zero. The deploy is marked **Failed** in the dashboard
rather than silently running broken. Verify this yourself by temporarily
removing `GEMINI_API_KEY` from the dashboard and redeploying — Render will
fail the deploy with a clear log line.

---

## 2. Frontend → Vercel

1. Vercel dashboard → **Add New → Project** → import the `LandVision` GitHub repo.
2. Vercel auto-detects Next.js. Configure:

   | Field                | Value                                  |
   | -------------------- | -------------------------------------- |
   | Framework Preset     | Next.js                                |
   | Root Directory       | `client`                              |
   | Build Command        | `npm run build` (from `vercel.json`)  |
   | Output Directory     | `.next`                               |

3. Under **Environment Variables**, set:

   | Key                          | Value                                          |
   | ---------------------------- | ---------------------------------------------- |
   | `NEXT_PUBLIC_API_URL`       | `https://landvision-api.onrender.com` (your Render URL from step 1) |
   | `NEXT_PUBLIC_SUPABASE_URL`  | `https://YOUR-PROJECT.supabase.co`            |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon public key              |

   > `NEXT_PUBLIC_*` vars are baked into the bundle at build time, so any
   > change requires a redeploy. Vercel does this automatically when you save
   > in the dashboard.

4. Click **Deploy**.
5. After the build finishes, copy your Vercel URL (e.g.
   `https://landvision.vercel.app`) and paste it into the Render service's
   `CLIENT_ORIGIN` env var. Redeploy Render so the new value takes effect.

### `vercel.json`

The repo includes `client/vercel.json` for explicit framework, build command,
and region. You don't need to customise it for a standard Next.js deploy.

---

## 3. Post-deploy data seeding

After both services are live:

1. **Seed demo LandRecords into MongoDB** (run locally, with `MONGODB_URI`
   pointing at the production Atlas instance in your local `.env`):

   ```bash
   cd server
   MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/landvision?retryWrites=true&w=majority \
   npx ts-node src/db/seedDemo.ts
   ```

2. **Seed plot polygons into PostGIS** (matching the LandRecords above):

   ```bash
   cd server
   PG_CONNECTION_STRING=postgresql://USER:PASSWORD@HOST:5432/landvision?sslmode=require \
   npm run seed:plots
   ```

The two seeders are coordinated — `seedDemo.ts` writes the LandRecords using
the SAME khasra/village pairs that `seedPlots.ts` then turns into polygons —
so the dashboard and the map tell one consistent story about the same plots.

---

## 4. Verifying the deploy

Run through every step in [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md). Each step
should pass with no console errors in the browser DevTools network tab.

Specifically:

- [ ] `https://landvision-api.onrender.com/health` returns `{ "status": "ok" }`.
- [ ] `https://landvision.vercel.app` loads the login page without CORS errors.
- [ ] Logging in as officer shows the dashboard with 8–10 seeded records.
- [ ] Uploading a new document creates a record in `uploaded` status.
- [ ] Logging in as reviewer shows the same records plus a `needs_review`
      record with a visible validation flag.
- [ ] Approving/editing a `needs_review` record moves it to `reviewed_approved`.
- [ ] The map page (`/map`) for the seeded village renders polygons coloured by status.

---

## 5. Rollback

- **Render:** dashboard → Manual Deploy → pick a previous commit.
- **Vercel:** dashboard → Deployments → Redeploy on any past deployment.

---

## 6. Known limits of the free-tier demo

| Limit                | Effect                                                                |
| -------------------- | --------------------------------------------------------------------- |
| Render free sleeps   | First request after 15 min idle takes ~50 s (cold start).             |
| Gemini free quota    | ~15 req/min on the free tier; bursts will 429 and fall back to Tesseract. |
| Supabase free DB     | 500 MB Postgres / 1 GB Storage — fine for demo, not for production.   |
| Vercel Hobby         | 100 GB egress/month — plenty for a demo.                              |

See the README's **Future Work** section for the production-scale upgrade path.
