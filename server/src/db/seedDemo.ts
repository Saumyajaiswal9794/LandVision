import 'dotenv/config';
import mongoose from 'mongoose';
import { LandRecord } from '../models/LandRecord';
import { env } from '../config/env';

/**
 * Sprint 5 — Realistic demo data for LandVision.
 *
 * Seeds 10 LandRecord documents that span:
 *   - every status in the pipeline enum
 *     (uploaded, extracting, extracted, extraction_failed,
 *      auto_approved, needs_review, reviewed_approved, reviewed_rejected)
 *   - both extractionSource values (gemini, tesseract)
 *   - 3 villages (Rampur, Bhoranj, Nadaun) in Hamirpur district, HP
 *   - at least one record with `duplicate_detected`
 *   - at least one record with `exceeds_village_total`
 *   - at least one reviewer-approved record with `source: human_corrected`
 *
 * The khasraNumber + village values here are the SAME ones seedPlots.ts
 * turns into PostGIS polygons (see DEMO_VILLAGES / DEMO_KHASRAS in that file),
 * so the dashboard and the map tell one consistent story about the same plots.
 *
 * Usage:
 *   npx ts-node src/db/seedDemo.ts
 *
 * Idempotent: clears existing records first so re-running won't produce
 * duplicate stacks of the same demo data.
 */

// ---------------------------------------------------------------------------
// Demo coordinate space — matches seedPlots.ts DEMO_VILLAGES/DEMO_KHASRAS.
// ---------------------------------------------------------------------------
const VILLAGES = ['Rampur', 'Bhoranj', 'Nadaun'] as const;
const DISTRICT = 'Hamirpur';
const STATE = 'Himachal Pradesh';
const TEHSIL_BY_VILLAGE: Record<string, string> = {
  Rampur: 'Hamirpur',
  Bhoranj: 'Bhoranj',
  Nadaun: 'Nadaun',
};

// Helper: build an extractedFields object with the schema's per-field
// {value, confidence} shape, plus an optional `source` for human-corrected.
type Field = { value: string | null; confidence: number; source?: string };
function fields(partial: Record<string, Field>): Record<string, Field> {
  return {
    ownerName: { value: null, confidence: 0 },
    khasraNumber: { value: null, confidence: 0 },
    plotArea: { value: null, confidence: 0 },
    village: { value: null, confidence: 0 },
    district: { value: null, confidence: 0 },
    landClass: { value: null, confidence: 0 },
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// Fixed demo user IDs. These do NOT need to resolve to real Supabase users
// for the seeded records to display — the dashboard only uses `uploadedBy`
// / `reviewedBy` for filtering and attribution, not for auth checks.
// ---------------------------------------------------------------------------
const REVIEWER_USER_ID = 'demo-reviewer-0001-0000-0000-000000000001';
const OFFICER_USER_ID   = 'demo-officer-0002-0000-0000-000000000002';

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

// ---------------------------------------------------------------------------
// The 10 demo records. Each object's khasraNumber + village pair is one of
// the combinations seedPlots.ts will produce a polygon for (so the dashboard
// and the map stay in sync).
// ---------------------------------------------------------------------------
const demoRecords = [
  // 1 — freshly uploaded, extraction hasn't fired yet
  {
    filename: 'rampur_khasra_101_1.jpg',
    village: 'Rampur',
    district: DISTRICT, tehsil: TEHSIL_BY_VILLAGE.Rampur, state: STATE,
    uploadedBy: OFFICER_USER_ID,
    storagePath: 'land-records/rampur_khasra_101_1.jpg',
    storageUrl: 'https://example.supabase.co/storage/v1/object/sign/land-records/rampur_khasra_101_1.jpg',
    extractionSource: null,
    status: 'uploaded',
    createdAt: hoursAgo(1),
  },

  // 2 — extraction in flight
  {
    filename: 'rampur_khasra_101_2.pdf',
    village: 'Rampur',
    district: DISTRICT, tehsil: TEHSIL_BY_VILLAGE.Rampur, state: STATE,
    uploadedBy: OFFICER_USER_ID,
    storagePath: 'land-records/rampur_khasra_101_2.pdf',
    storageUrl: 'https://example.supabase.co/storage/v1/object/sign/land-records/rampur_khasra_101_2.pdf',
    extractionSource: null,
    status: 'extracting',
    createdAt: hoursAgo(2),
  },

  // 3 — high-confidence Gemini extraction, no flags → auto_approved
  {
    filename: 'rampur_khasra_102_1.jpg',
    village: 'Rampur',
    district: DISTRICT, tehsil: TEHSIL_BY_VILLAGE.Rampur, state: STATE,
    uploadedBy: OFFICER_USER_ID,
    storagePath: 'land-records/rampur_khasra_102_1.jpg',
    storageUrl: 'https://example.supabase.co/storage/v1/object/sign/land-records/rampur_khasra_102_1.jpg',
    extractionSource: 'gemini',
    status: 'auto_approved',
    extractedFields: fields({
      ownerName: { value: 'Thakur Ram Singh', confidence: 0.96 },
      khasraNumber: { value: '102/1', confidence: 0.98 },
      plotArea: { value: '1.85 hectares', confidence: 0.93 },
      village: { value: 'Rampur', confidence: 0.97 },
      district: { value: DISTRICT, confidence: 0.99 },
      landClass: { value: 'Agricultural (Chahi)', confidence: 0.9 },
    }),
    validationFlags: [],
    createdAt: hoursAgo(3),
  },

  // 4 — Tesseract fallback extraction, low confidence on ownerName → needs_review
  {
    filename: 'rampur_khasra_102_2.jpg',
    village: 'Rampur',
    district: DISTRICT, tehsil: TEHSIL_BY_VILLAGE.Rampur, state: STATE,
    uploadedBy: OFFICER_USER_ID,
    storagePath: 'land-records/rampur_khasra_102_2.jpg',
    storageUrl: 'https://example.supabase.co/storage/v1/object/sign/land-records/rampur_khasra_102_2.jpg',
    extractionSource: 'tesseract',
    status: 'needs_review',
    extractedFields: fields({
      ownerName: { value: 'Parkash Chand (unclear)', confidence: 0.42 }, // < threshold
      khasraNumber: { value: '102/2', confidence: 0.91 },
      plotArea: { value: '0.95 hectares', confidence: 0.86 },
      village: { value: 'Rampur', confidence: 0.92 },
      district: { value: DISTRICT, confidence: 0.95 },
      landClass: { value: 'Agricultural (Gair Mumkin)', confidence: 0.55 },
    }),
    validationFlags: [],
    createdAt: hoursAgo(5),
  },

  // 5 — DELIBERATELY FLAGGED: duplicate_detected
  // Same khasra+village as record #3 (102/1, Rampur) — surfaces a
  // "Duplicate detected" warning in the UI so the reviewer can resolve it.
  {
    filename: 'rampur_khasra_102_1_dup.jpg',
    village: 'Rampur',
    district: DISTRICT, tehsil: TEHSIL_BY_VILLAGE.Rampur, state: STATE,
    uploadedBy: OFFICER_USER_ID,
    storagePath: 'land-records/rampur_khasra_102_1_dup.jpg',
    storageUrl: 'https://example.supabase.co/storage/v1/object/sign/land-records/rampur_khasra_102_1_dup.jpg',
    extractionSource: 'gemini',
    status: 'needs_review',
    extractedFields: fields({
      ownerName: { value: 'Thakur Ram Singh', confidence: 0.94 },
      khasraNumber: { value: '102/1', confidence: 0.97 }, // matches existing record → duplicate
      plotArea: { value: '1.85 hectares', confidence: 0.93 },
      village: { value: 'Rampur', confidence: 0.96 },
      district: { value: DISTRICT, confidence: 0.99 },
      landClass: { value: 'Agricultural (Chahi)', confidence: 0.9 },
    }),
    validationFlags: ['duplicate_detected'],
    createdAt: hoursAgo(4),
  },

  // 6 — DELIBERATELY FLAGGED: exceeds_village_total
  // Plot area is implausibly large relative to the village cap
  // (VILLAGE_AREA_LIMIT_HECTARES, default 500), so the area-sum validator
  // trips and surfaces a visible warning.
  {
    filename: 'bhoranj_khasra_103_1.jpg',
    village: 'Bhoranj',
    district: DISTRICT, tehsil: TEHSIL_BY_VILLAGE.Bhoranj, state: STATE,
    uploadedBy: OFFICER_USER_ID,
    storagePath: 'land-records/bhoranj_khasra_103_1.jpg',
    storageUrl: 'https://example.supabase.co/storage/v1/object/sign/land-records/bhoranj_khasra_103_1.jpg',
    extractionSource: 'gemini',
    status: 'needs_review',
    extractedFields: fields({
      ownerName: { value: 'Smt. Kamla Devi', confidence: 0.92 },
      khasraNumber: { value: '103/1', confidence: 0.95 },
      plotArea: { value: '620 hectares', confidence: 0.88 }, // exceeds default 500 cap
      village: { value: 'Bhoranj', confidence: 0.97 },
      district: { value: DISTRICT, confidence: 0.99 },
      landClass: { value: 'Agricultural (Chahi)', confidence: 0.85 },
    }),
    validationFlags: ['exceeds_village_total'],
    createdAt: hoursAgo(6),
  },

  // 7 — extraction just completed, validation/routing hasn't fired yet.
  // Demonstrates the intermediate `extracted` status: all fields populated,
  // no flags, not yet routed to needs_review or auto_approved.
  {
    filename: 'bhoranj_khasra_103_2.jpg',
    village: 'Bhoranj',
    district: DISTRICT, tehsil: TEHSIL_BY_VILLAGE.Bhoranj, state: STATE,
    uploadedBy: OFFICER_USER_ID,
    storagePath: 'land-records/bhoranj_khasra_103_2.jpg',
    storageUrl: 'https://example.supabase.co/storage/v1/object/sign/land-records/bhoranj_khasra_103_2.jpg',
    extractionSource: 'gemini',
    status: 'extracted',
    extractedFields: fields({
      ownerName: { value: 'Vikram Thakur', confidence: 0.95 },
      khasraNumber: { value: '103/2', confidence: 0.97 },
      plotArea: { value: '1.45 hectares', confidence: 0.9 },
      village: { value: 'Bhoranj', confidence: 0.96 },
      district: { value: DISTRICT, confidence: 0.99 },
      landClass: { value: 'Agricultural (Chahi)', confidence: 0.88 },
    }),
    validationFlags: [],
    createdAt: hoursAgo(20),
  },

  // 8 — reviewer edited fields then approved (human-corrected source tag)
  {
    filename: 'nadaun_khasra_104_1.jpg',
    village: 'Nadaun',
    district: DISTRICT, tehsil: TEHSIL_BY_VILLAGE.Nadaun, state: STATE,
    uploadedBy: OFFICER_USER_ID,
    storagePath: 'land-records/nadaun_khasra_104_1.jpg',
    storageUrl: 'https://example.supabase.co/storage/v1/object/sign/land-records/nadaun_khasra_104_1.jpg',
    extractionSource: 'tesseract',
    status: 'reviewed_approved',
    extractedFields: fields({
      ownerName: { value: 'Mohan Lal Sood', confidence: 1, source: 'human_corrected' },
      khasraNumber: { value: '104/1', confidence: 1, source: 'human_corrected' },
      plotArea: { value: '2.10 hectares', confidence: 0.87 },
      village: { value: 'Nadaun', confidence: 0.95 },
      district: { value: DISTRICT, confidence: 0.98 },
      landClass: { value: 'Agricultural (Chahi)', confidence: 0.82 },
    }),
    validationFlags: [],
    reviewedBy: REVIEWER_USER_ID,
    reviewedAt: hoursAgo(8),
    createdAt: hoursAgo(24),
  },

  // 9 — reviewer rejected with a reason
  {
    filename: 'nadaun_khasra_104_2.jpg',
    village: 'Nadaun',
    district: DISTRICT, tehsil: TEHSIL_BY_VILLAGE.Nadaun, state: STATE,
    uploadedBy: OFFICER_USER_ID,
    storagePath: 'land-records/nadaun_khasra_104_2.jpg',
    storageUrl: 'https://example.supabase.co/storage/v1/object/sign/land-records/nadaun_khasra_104_2.jpg',
    extractionSource: 'gemini',
    status: 'reviewed_rejected',
    extractedFields: fields({
      ownerName: { value: null, confidence: 0.2 },
      khasraNumber: { value: '104/2', confidence: 0.61 },
      plotArea: { value: null, confidence: 0.1 },
      village: { value: 'Nadaun', confidence: 0.7 },
      district: { value: DISTRICT, confidence: 0.85 },
      landClass: { value: null, confidence: 0.15 },
    }),
    validationFlags: [],
    reviewedBy: REVIEWER_USER_ID,
    reviewedAt: hoursAgo(9),
    extractionError: 'Scanned sheet is illegible — request a fresh scan from the patwari.',
    createdAt: hoursAgo(30),
  },

  // 10 — extraction failed (Tesseract fallback also failed)
  {
    filename: 'nadaun_khasra_105_1.jpg',
    village: 'Nadaun',
    district: DISTRICT, tehsil: TEHSIL_BY_VILLAGE.Nadaun, state: STATE,
    uploadedBy: OFFICER_USER_ID,
    storagePath: 'land-records/nadaun_khasra_105_1.jpg',
    storageUrl: 'https://example.supabase.co/storage/v1/object/sign/land-records/nadaun_khasra_105_1.jpg',
    extractionSource: 'tesseract',
    status: 'extraction_failed',
    extractedFields: fields({}),
    validationFlags: [],
    extractionError: 'Tesseract returned no recognisable text — document image is too dark or low-resolution.',
    createdAt: hoursAgo(12),
  },
];

// ---------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------
async function seedDemo() {
  console.log('[seedDemo] Connecting to MongoDB...');
  await mongoose.connect(env.MONGODB_URI);

  console.log('[seedDemo] Clearing existing LandRecords...');
  await LandRecord.deleteMany({});

  console.log(`[seedDemo] Inserting ${demoRecords.length} demo records...`);
  await LandRecord.insertMany(demoRecords);

  // -----------------------------------------------------------------------
  // Print a status distribution so the operator can sanity-check coverage.
  // -----------------------------------------------------------------------
  console.log('\n[seedDemo] Status distribution:');
  const counts = demoRecords.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  for (const [status, n] of Object.entries(counts)) {
    console.log(`  ${status.padEnd(22)} → ${n}`);
  }

  console.log('\n[seedDemo] Validation flags:');
  const flagged = demoRecords.filter((r) => (r.validationFlags || []).length > 0);
  if (flagged.length === 0) {
    console.log('  (none)');
  } else {
    for (const r of flagged) {
      const khasra = r.extractedFields?.khasraNumber?.value || '—';
      console.log(`  khasra ${khasra} (${r.village}) → ${r.validationFlags!.join(', ')}`);
    }
  }

  console.log('\n[seedDemo] Villages covered:', VILLAGES.join(', '));
  console.log('[seedDemo] Extraction sources covered: gemini, tesseract, (none for uploaded/extracting)');

  console.log('\n[seedDemo] Done. Next step: run `npm run seed:plots` so the map polygons match.');
  await mongoose.disconnect();
}

seedDemo().catch((err) => {
  console.error('[seedDemo] Fatal error:', err);
  process.exit(1);
});
