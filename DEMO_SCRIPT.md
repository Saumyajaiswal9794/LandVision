# LandVision — 3-Minute Demo Script

A guided walkthrough an interviewer, judge, or new teammate could follow on
the **deployed** LandVision app (frontend on Vercel, backend on Render).

> ⏱ Total runtime: ~3 minutes (excluding the initial Render cold-start delay).
> Before you begin, make sure both `npm run seed:demo` and
> `npm run seed:plots` have been run against the production databases — see
> `DEPLOYMENT.md` §3.

## Demo accounts

LandVision uses Supabase Auth. Create these two accounts in the Supabase
dashboard before the demo (or use whatever accounts are already provisioned):

| Role     | Email (suggested)             | Password (suggested) |
| -------- | ----------------------------- | --------------------- |
| Officer  | `officer@landvision.demo`     | `LandVision#123`      |
| Reviewer | `reviewer@landvision.demo`    | `LandVision#123`      |

> The role is set via Supabase user_metadata `role: 'officer'` or
> `role: 'reviewer'` at signup time. The client reads it on login and
> redirects accordingly.

---

## Step 1 — Log in as an officer (0:00 → 0:20)

1. Open `https://landvision.vercel.app` in your browser.
2. Log in with the **officer** credentials above.
3. The dashboard loads automatically and shows the seeded records.

> **Narration.** "I'm logging in as a land records officer. The dashboard
> shows the documents I've uploaded — the seeded set already includes
> records in every pipeline state, from freshly-uploaded to
> reviewer-rejected."

The officer sees only their own uploads. The reviewer (Step 3) will see all
records.

---

## Step 2 — Upload a new document (0:20 → 0:55)

1. Click **Upload New Document** in the top-right.
2. Pick any scanned land record image/PDF on your laptop (a phone-camera
   photo of any printed form is fine for the demo).
3. Type `Rampur` for Village and `Hamirpur` for District.
4. Click **Submit and Extract**.
5. Watch the success banner — copy the displayed `Record ID` for later.

> **Narration.** "I'm uploading a scanned Khasra page for the village
> Rampur. The backend streams it to Supabase Storage and creates a
> LandRecord in MongoDB. The status shows 'uploaded' — extraction is
> triggered separately so the upload doesn't block the user."

---

## Step 3 — Switch to reviewer (0:55 → 1:15)

1. Click the avatar menu (top-right) → **Sign out**.
2. Log back in with the **reviewer** credentials.
3. The dashboard now shows ALL records across all officers and includes the
   seeded set of 10 records.

> **Narration.** "Now I'm logging in as a reviewer. The reviewer dashboard
> shows every record in the system, not just my own. Notice the variety of
> statuses — auto-approved, needs-review, reviewed-approved, etc. — that's
> the seeded demo data showing the full pipeline at a glance."

---

## Step 4 — Open a `needs_review` record with a validation flag (1:15 → 1:50)

1. In the status filter dropdown (top-left of the dashboard table), pick
   **Needs Review**.
2. Look for the record with filename `rampur_khasra_102_1_dup.jpg` (the
   intentionally flagged duplicate).
3. Click the **Eye** icon to open its detail page.
4. Notice the amber **Validation Warnings** box at the top: it reads
   `Duplicate detected`.

> **Narration.** "This record was flagged automatically by the validation
> engine because the same khasra number plus village already exists in the
> system. The amber banner tells the reviewer exactly what to look at —
> no guesswork."

Point to the **confidence scores** next to each extracted field. Mention
that owner-name confidence is high (94 %) but the validation flag still
overrides auto-approval — confidence alone isn't enough.

---

## Step 5 — Correct a field and approve (1:50 → 2:30)

1. In the same record's detail page, scroll to the **Extracted Data** card.
2. Click into the **Owner Name** field (it's editable because the user is a
   reviewer and the record is in `needs_review`).
3. Change `Thakur Ram Singh` to `Thakur Ram Singh (Joint owner with Mohan)`.
4. Click **Save Corrections** at the bottom of the card.
5. The status badge in the top-right flips from `Needs Review` to
   `Reviewed Approved` (teal). A green confirmation banner appears.

> **Narration.** "The reviewer edits the owner-name field to add a
> clarification. Saving marks those fields as `human_corrected` with
> confidence 1.0 and flips the record to reviewed-approved. The audit
> trail captures who approved it and when."

---

## Step 6 — Show the village map for the same record (2:30 → 3:00)

1. In the document detail page, click the **View on Map** button
   (top-right, next to the status badge).
2. The map page loads with village `Rampur` preselected.
3. Polygons render for every plot in Rampur, colour-coded by status.
4. Click the polygon for khasra `102/1` — the popup shows the owner name,
   khasra, and the now-`reviewed_approved` teal colour. The "View Record"
   link in the popup returns you to the same detail page.

> **Narration.** "Clicking View on Map flies us to the Rampur village
> polygons. Each polygon's colour matches the record's status on the
> dashboard — same data, two views. The popup links back to the document
> detail, so the reviewer can hop between map and metadata freely."

---

## Done. ✅

You've demonstrated:

- Role-based access (officer sees own, reviewer sees all).
- The upload → storage → record creation flow.
- AI extraction's confidence scores (visible in the document detail).
- The validation engine visibly flagging a duplicate.
- The reviewer correction + approval loop with audit trail.
- The GIS map reflecting the same status as the dashboard, with clickable
  polygons that link back to source records.

If a step fails (e.g. the dashboard is blank), the Sprint 5 client error
boundary shows a readable "Couldn't reach the LandVision backend" message
with a Retry button — point this out as part of the hardening work.

---

## Common failure modes (and how to recover mid-demo)

| Symptom                                        | Cause                                  | Recovery                                                              |
| ---------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| First click takes ~50 s, then works             | Render free-tier cold start            | Wait — the second click is instant. Mention this is the free tier.   |
| Dashboard shows "Couldn't reach backend"        | CORS misconfigured or backend down     | Check `CLIENT_ORIGIN` on Render includes the Vercel URL exactly.      |
| Map is blank for a village                     | `seedPlots` not run for that DB        | Run `npm run seed:plots` against the production Postgres.             |
| Login fails with "User role not configured"    | Supabase user_metadata missing `role`  | In Supabase dashboard → Auth → Users → edit the user → set `role` in `user_metadata`. |
| Upload returns 413                              | File > 10 MB                           | Use a smaller scan; the limit is set in `routes/documents.ts`.        |
