# LandVision — AI Digitization of Land Ownership Records

**LandVision** is a full-stack platform that turns scanned, often handwritten
Indian land records (Khasra, Khata, Khatoni registers) into structured,
searchable, geospatially-indexed digital records. It is built for state land
records departments (and the central DILRMP programme) whose officers
currently key in plot details by hand from paper scans — a slow, error-prone
process that bottlenecks the entire cadastral modernisation pipeline.

Rather than attempting a single giant OCR pass, LandVision splits the problem
into four stages — **upload → AI extraction → validation & review → GIS** —
and assigns each stage to the right technology: a multimodal LLM for entity
extraction, rule-based validators for integrity checks, a human reviewer for
low-confidence cases, and PostGIS for spatial queries. The result is a system
where high-quality scans flow through unaided (auto-approved in seconds) and
only the genuinely ambiguous records consume a reviewer's time — typically
10–15 % of the daily load in our test data.

The Sprint 5 milestone (this commit) makes LandVision deployable, demoable,
and presentable: production env config, Render + Vercel deploy recipes, a
realistic 10-record seed dataset, an end-to-end demo script, and a hardened
error surface that fails loudly instead of silently.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Tech Stack](#tech-stack)
3. [Project Layout](#project-layout)
4. [Local Setup](#local-setup)
5. [Seeding Demo Data](#seeding-demo-data)
6. [Deployment](#deployment)
7. [Demo Script](#demo-script)
8. [Screenshots](#screenshots)
9. [Future Work](#future-work)
10. [License](#license)

---

## Architecture

LandVision follows a classic **four-tier** architecture. Each tier is
independently deployable and the only cross-tier contract is JSON over HTTP.

```
┌──────────────────────────┐         ┌──────────────────────────────┐
│  Frontend (Next.js)      │  HTTPS  │  Backend (Express + Node)    │
│  ─────────────────────── │ ──────► │  ──────────────────────────── │
│  • Login (Supabase Auth) │         │  • JWT auth middleware         │
│  • Officer upload page   │         │  • Role-based access (RBAC)    │
│  • Reviewer dashboard    │         │  • Document routes            │
│  • Document detail page  │         │  • Extraction orchestrator     │
│  • Leaflet map viewer     │         │  • Validation pipeline        │
│  • Error boundary + UI    │         │  • Global error handler       │
└──────────────────────────┘         └────────┬───────────────────────┘
                                              │
                              ┌───────────────┼───────────────────┐
                              ▼               ▼                   ▼
                  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐
                  │  AI Services     │  │  Data & Storage  │  │  (Tesseract      │
                  │  ─────────────── │  │  ────────────── │  │   fallback only) │
                  │  • Gemini 2.5    │  │  • Supabase Auth │  │                  │
                  │    Flash (multi- │  │  • Supabase      │  └──────────────────┘
                  │    modal LLM)    │  │    Storage (img) │
                  │  • Confidence    │  │  • MongoDB Atlas  │
                  │    scoring       │  │    (LandRecords) │
                  │                  │  │  • Postgres +     │
                  │                  │  │    PostGIS (plots)│
                  └─────────────────┘  └──────────────────┘
```

### Request flow — upload through GIS

1. **Upload (officer).** The officer picks a scanned PDF/image, fills
   `village` and `district`, and submits. The browser uploads the file to
   the backend (`POST /api/documents/upload`), which streams it to Supabase
   Storage and creates a `LandRecord` in MongoDB with `status: uploaded`.

2. **Extraction (backend → Gemini).** An officer (or a background worker)
   calls `POST /api/documents/:id/extract`. The backend:
   - Downloads the file from Supabase Storage.
   - Sends the image to **Gemini 2.5 Flash** with a structured-output prompt
     that asks for `{ownerName, khasraNumber, plotArea, village, district,
     landClass}` plus a per-field confidence score.
   - On Gemini rate-limit or failure, falls back to Tesseract OCR + an LLM
     entity-extraction pass.
   - Persists the extracted fields onto the `LandRecord` and tags
     `extractionSource: gemini | tesseract`.

3. **Validation (backend).** After extraction, three rule-based validators
   run in sequence:
   - **Duplicate detection** — same `khasraNumber + village` already exists
     for a different record → flag `duplicate_detected`.
   - **Area-sum check** — sum of plot areas for a village exceeds
     `VILLAGE_AREA_LIMIT_HECTARES` → flag `exceeds_village_total`.
   - **Confidence routing** — combined confidence below
     `CONFIDENCE_THRESHOLD` (default 0.75) → status `needs_review`,
     otherwise → status `auto_approved`.

4. **Review (reviewer).** Reviewers see all documents in the dashboard.
   Clicking a `needs_review` record opens the document detail page, which
   shows the source scan side-by-side with the extracted fields. The reviewer
   can approve as-is, edit individual fields (which marks them
   `source: human_corrected` with confidence 1.0), or reject with a reason.

5. **GIS (any user).** Every approved record's `khasraNumber + village` is
   expected to have a corresponding polygon in PostGIS. The `/map` page lets
   the user pick a village and renders every plot for that village as a
   Leaflet polygon, coloured by status. Clicking a polygon links back to the
   document detail page. This is the "single source of truth" view — the
   same record shown on the dashboard also appears on the map with the same
   status colour.

---

## Tech Stack

### Frontend

| Tech                | Role                                              |
| ------------------- | ------------------------------------------------- |
| **Next.js 14**      | App Router, React Server Components for layout    |
| **TypeScript**      | End-to-end type-safety shared with backend via `packages/types` |
| **Tailwind CSS 3**  | Utility-first styling                              |
| **lucide-react**    | Icon set                                            |
| **react-leaflet**   | Cadastral plot viewer (Sprint 4)                   |
| **Supabase JS SDK** | Browser-side auth + signed-URL image loading       |

### Backend

| Tech                  | Role                                                  |
| --------------------- | ----------------------------------------------------- |
| **Express 4**         | HTTP API                                               |
| **TypeScript**        | Same shared types as frontend (`@landvision/types`)    |
| **Mongoose 8**        | `LandRecord` documents in MongoDB Atlas               |
| **pg 8**              | Postgres/PostGIS pool for plot polygons                |
| **Multer**            | In-memory file upload handling                         |
| **Supabase JS SDK**   | Server-side storage writes (service-role key)          |
| **@google/genai**     | Gemini 2.5 Flash multimodal extraction (Sprint 2)      |
| **tesseract.js**      | Fallback OCR for when Gemini is rate-limited            |

### Data & Storage

| Tech                  | Role                                                |
| --------------------- | --------------------------------------------------- |
| **Supabase Auth**     | JWT-based auth for officer + reviewer accounts       |
| **Supabase Storage**  | Private bucket for scanned document images           |
| **MongoDB Atlas**     | `LandRecord` documents (extracted fields, status)   |
| **Postgres + PostGIS**| Plot polygon geometries (one row per khasra+village) |

### Why Gemini over a separate OCR+LLM pipeline

A traditional land-records pipeline would chain **OCR (Tesseract) → LLM entity
extraction**, requiring two network round-trips per document and a brittle
text-only handoff that loses spatial cues (which field is *next to* which
column header). We chose **Gemini 2.5 Flash** because:

1. **Multimodal in a single call.** Gemini takes the raw image and returns
   structured JSON directly. One round-trip, no OCR-to-LLM text plumbing.
2. **Indic language support.** Indian land records frequently mix English
   numerals with Devanagari/Hindi labels (e.g. `खसरा संख्या`). Gemini's
   vision model handles Devanagari out of the box; Tesseract's out-of-the-box
   Hindi model is far less accurate, especially on handwritten scans.
3. **Confidence scores.** Gemini returns per-field confidence which we feed
   directly into our routing logic (`auto_approved` vs `needs_review`). With
   Tesseract alone we'd have to derive confidence from OCR engine metrics
   which are noisier and don't map cleanly to "is this owner name right?".
4. **Cost.** At Gemini 2.5 Flash pricing (~$0.075/M input tokens, $0.30/M
   output tokens on the free tier), a single A4 scan costs well under $0.001
   to process — far cheaper than running two separate services.

Tesseract is still wired in as a **fallback** so the pipeline keeps working
during Gemini rate-limit (429) bursts. We log every fallback and surface
`extractionSource: tesseract` in the UI so reviewers know to be more
skeptical of those records.

### Why Supabase over AWS

1. **Free tier that actually covers demo traffic.** Supabase Hobby gives
   500 MB Postgres, 1 GB Storage, and 50,000 monthly active users — enough
   for a pilot deployment with no credit card.
2. **Auth + Storage + Postgres in one project.** AWS would require stitching
   Cognito + S3 + RDS (or Aurora Serverless v2) together, each with its own
   IAM story. Supabase gives us all three with a single project URL and two
   keys (`anon` + `service_role`).
3. **PostGIS built in.** Supabase's hosted Postgres ships with PostGIS
   enabled by default, so Sprint 4's plot polygons "just work" without a
   separate spatial database.
4. **Row-level security.** Even though we currently enforce access control
   in Express middleware, having RLS available as a backstop is a strong
   defence-in-depth story for any future data leak via a misconfigured
   backend route.

---

## Project Layout

```
LandVision/
├── client/                     # Next.js 14 frontend (App Router)
│   ├── app/
│   │   ├── login/  signup/     # Supabase auth pages
│   │   ├── dashboard/         # Officer + reviewer dashboard
│   │   ├── upload/            # Officer-only document upload
│   │   ├── documents/[id]/    # Document detail + review UI
│   │   └── map/               # Leaflet plot viewer (Sprint 4)
│   ├── components/             # Card, Button, NavBar, EditableField
│   ├── lib/
│   │   ├── api.ts              # Typed API client with auth header injection
│   │   ├── supabaseClient.ts   # Browser Supabase singleton
│   │   └── ErrorBoundary.tsx   # Sprint 5 client-side error fallback UI
│   ├── .env.example
│   ├── .env.production.example
│   └── vercel.json             # Vercel deploy config (Sprint 5)
│
├── server/                     # Express + TypeScript backend
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts          # Sprint 5: fatal-on-missing-prod-env check
│   │   │   ├── db.ts           # Mongoose + pg pool
│   │   │   └── supabaseAdmin.ts
│   │   ├── controllers/        # auth, documents, gis, records, validation
│   │   ├── middleware/
│   │   │   ├── auth.ts         # JWT verification via Supabase
│   │   │   ├── rbac.ts         # requireRole(['officer' | 'reviewer'])
│   │   │   └── errorHandler.ts # Sprint 5: hardened global error handler
│   │   ├── models/
│   │   │   ├── LandRecord.ts
│   │   │   ├── ReviewQueue.ts
│   │   │   └── User.ts
│   │   ├── routes/             # documents, records, auth, validation, gis
│   │   ├── services/
│   │   │   ├── extraction/     # geminiExtract, tesseractFallback, orchestrator
│   │   │   ├── validation/     # duplicateDetection, areaSumCheck, confidenceRouting
│   │   │   ├── gis/            # PostGIS plot queries
│   │   │   └── storage/        # supabaseStorage
│   │   ├── db/
│   │   │   ├── seedDemo.ts     # Sprint 5: 10-record realistic seed
│   │   │   ├── seedPlots.ts    # Sprint 4: PostGIS polygons
│   │   │   └── migrations/
│   │   └── index.ts            # CORS via CLIENT_ORIGIN, PORT via env
│   ├── .env.example
│   ├── .env.production.example
│   └── package.json
│
├── packages/types/             # Shared TypeScript types (frontend + backend)
├── render.yaml                 # Sprint 5: Render blueprint for backend
├── DEPLOYMENT.md               # Sprint 5: full deploy guide
├── DEMO_SCRIPT.md              # Sprint 5: 3-min demo walkthrough
└── README.md                   # this file
```

---

## Local Setup

### Prerequisites

- Node.js 18+ and npm
- A Supabase project (free tier is fine) — create a bucket named `land-records`
- A MongoDB Atlas cluster (free M0) OR a local MongoDB via `docker compose up`
- A Postgres+PostGIS instance (Supabase Postgres works; or use the included
  `docker-compose.yml`)
- A Gemini API key from https://aistudio.google.com/app/apikey

### 1. Clone and install

```bash
git clone https://github.com/Saumyajaiswal9794/LandVision.git
cd LandVision
npm install                  # installs workspaces via npm (turbo.json optional)
cd packages/types && npm run build   # build the shared types package once
cd ../../server && npm install
cd ../client && npm install
```

### 2. Configure environment variables

```bash
cp server/.env.example server/.env        # fill in real values
cp client/.env.example client/.env.local  # fill in real values
```

Copy `server/.env.example` to `server/.env` and `client/.env.example` to
`client/.env.local`, then fill in real values. **Do not create any other
`.env` files** — `.env.production.example` files are reference-only for what
to set in your hosting dashboard (Render / Vercel), not local files.

Both `.env.example` files are checked into git and document every variable.
**Never commit a real `.env`** — see `.gitignore`.

The server's env loader (`server/src/config/env.ts`) resolves `server/.env`
relative to its own location, so it works whether you start the dev server
from the monorepo root via Turborepo (`npm run dev`) or directly from inside
`/server` (`cd server && npm run dev`). If `server/.env` is missing or any
required variable is empty, you'll see an `[env:warn]` message in dev (or a
`[FATAL]` crash in production) naming exactly which variables are missing.

### 3. Create the `plots` PostGIS table

```bash
psql "$PG_CONNECTION_STRING" -f server/src/db/migrations/001_create_plots_table.sql
```

### 4. Run the dev servers

In two terminals:

```bash
# Terminal 1 — backend
cd server
npm run dev        # boots Express on http://localhost:4000

# Terminal 2 — frontend
cd client
npm run dev        # boots Next.js on http://localhost:3000
```

### 5. Seed demo data (recommended on first run)

See the next section.

---

## Seeding Demo Data

LandVision ships with two coordinated seeders. **Run `seedDemo` first** so the
LandRecords exist before `seedPlots` reads them.

```bash
cd server

# 1. Seed 10 realistic LandRecords (all statuses, both extraction sources,
#    duplicate_detected + exceeds_village_total flags, 3 villages).
npm run seed:demo

# 2. Seed PostGIS polygons for every khasra+village pair found in MongoDB.
npm run seed:plots
```

The seeders are **coordinated**: `seedDemo.ts` uses the SAME
`Rampur / Bhoranj / Nadaun` villages and `101/1 ... 106/2` khasra numbers
that `seedPlots.ts` looks for. Running both in order guarantees the dashboard
and the map tell one consistent story about the same plots.

Re-running either script is idempotent — they clear the target collection /
table before inserting.

---

## Deployment

LandVision splits across two hosting platforms:

| Service  | Platform | Source dir |
| -------- | -------- | ---------- |
| Backend  | Render   | `server/`  |
| Frontend | Vercel   | `client/`  |

Full step-by-step instructions, env var tables, and verification checklists
live in **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

Quick summary:

1. **Backend → Render.** Use the included `render.yaml` Blueprint
   (dashboard → New → Blueprint) or follow the manual steps in
   `DEPLOYMENT.md`. Set every env var from `server/.env.production.example`
   in the Render dashboard. The server binds to `process.env.PORT`
   (Render assigns this dynamically) and refuses to boot if any required
   env var is missing (see `server/src/config/env.ts`).

2. **Frontend → Vercel.** Import the GitHub repo, set **Root Directory** to
   `client/`, and add three env vars in Vercel's dashboard:
   `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `NEXT_PUBLIC_API_URL` MUST point to your
   Render backend URL (NOT localhost).

3. **Update Render's `CLIENT_ORIGIN`** to your deployed Vercel URL so CORS
   lets the frontend through. Redeploy.

---

## Demo Script

A step-by-step 3-minute walkthrough an interviewer or judge could follow is
in **[DEMO_SCRIPT.md](./DEMO_SCRIPT.md)**. It covers:

- Logging in as an officer and uploading a document.
- Switching to a reviewer account.
- Inspecting a `needs_review` record and its validation flag.
- Correcting a field and approving it.
- Viewing the village map for the same record.

---

## Screenshots

> **Note** — these will be added after a live run-through of the deployed
> demo (see Sprint 5 verify step). The planned captures are:
>
> 1. Dashboard with 10 seeded records across all statuses (officer view).
> 2. Document detail page showing the duplicate_detected flag and an editable
>    owner-name field.
> 3. Map view of village "Rampur" with polygons coloured by status, plus a
>    popup linking back to the document detail.
>
> For now, run the demo locally (`DEMO_SCRIPT.md`) and screenshot those three
> moments; drop the PNGs into `docs/img/` and replace this section.

---

## Future Work

### Real Google Vision + DILRMP integration

The current Gemini-only path works for printed and clear-handwritten scans,
but the long tail of Indian land records is severely degraded: faded ink,
creased folds, mixed Devanagari + English numerals, and stamp marks
overlapping owner names. Production deployments should add **Google Cloud
Vision API's `DOCUMENT_TEXT_DETECTION`** as a parallel pre-processing step
that returns structured page blocks + confidence scores per character — a
richer signal than Tesseract's word-level boxes and a useful ground-truth
for cross-checking Gemini's output.

We also need a **direct integration with DILRMP** (Digital India Land
Records Modernisation Programme) for canonical village/district codes and
khasra-numbering schemes, so the system stops relying on free-text village
names typed by officers at upload time. DILRMP exposes standardised village
IDs that should replace the current `village` string field.

### Fine-tuned Indic handwriting models (Florence-2 evaluation)

During Sprint 2 we evaluated **Microsoft Florence-2** as a candidate model
for Indic handwriting recognition. Florence-2 has strong layout-aware
vision-language grounding and can be fine-tuned on the IIIT-H Indian
Bilingual Scene Text dataset, which would in principle give better
handwriting accuracy than Gemini on long-tail scripts. We ultimately chose
Gemini for the production path because:

1. **Zero fine-tuning cost.** Gemini 2.5 Flash's out-of-the-box accuracy on
   our test set was ~88 % field-accuracy on printed records and ~62 % on
   handwritten ones — sufficient for a pilot. Florence-2 would require
   fine-tuning (GPU hours + labelled data) before matching that baseline.
2. **Operational simplicity.** Fine-tuned Florence-2 means hosting a GPU
   inference server, managing model weights, and scaling it — a significant
   ops burden that the team wasn't ready to take on in Sprint 5.
3. **Multilingual promptability.** Gemini responds to prompt changes
   ("extract only fields visible in the top-left table") without retraining.
   Florence-2 would require fresh fine-tuning for each new prompt variant.

We're keeping Florence-2 on the roadmap for a v2 once labelled Indic
handwriting data exists and the cost-per-document justifies a dedicated
fine-tuned model.

### Production-scale cost considerations

The free tiers used by the demo (Render free, Gemini free, Supabase Hobby)
are intentionally not production-grade:

| Service            | Free tier limit                  | Production upgrade cost estimate          |
| ------------------ | -------------------------------- | ----------------------------------------- |
| Gemini 2.5 Flash   | 15 req/min, 1500/day             | ~$0.001/record at paid tier — for 1 M records/year ≈ **$1,000** |
| Supabase           | 500 MB DB, 1 GB Storage, 50K MAU | Pro tier $25/mo covers 8 GB DB / 100 GB Storage / 100K MAU |
| Render             | Sleeps after 15 min idle          | Starter $7/mo per service = always-on     |
| MongoDB Atlas       | 512 MB M0                        | M10 ~$60/mo for 10 GB with backups         |
| Vercel             | 100 GB egress/mo on Hobby        | Pro $20/mo for 1 TB egress + team features |

At a target throughput of 100 documents/day the all-in cost lands around
**$120–$150/month**, dominated by Supabase Pro and MongoDB M10. The biggest
variable is Gemini: a single burst of digitising a backlog (say 50 K
historical scans) would cost ~$50 in Gemini calls alone — well within
budget, but worth monitoring with per-record cost dashboards from day one.

---

## License

Internal academic / hackathon project. All rights reserved by the
LandVision team.
