import 'dotenv/config';
import { pgPool } from '../config/db';
import mongoose from 'mongoose';
import { LandRecord } from '../models/LandRecord';
import { env } from '../config/env';

/**
 * Sprint 4: Seed synthetic plot boundaries into PostGIS.
 * Reads existing LandRecords from MongoDB and creates polygon geometries
 * for each unique khasraNumber + village combination.
 *
 * Coordinates are placed near Hamirpur, Himachal Pradesh (76.53, 31.68) as
 * realistic reference points.
 *
 * Usage: npx ts-node src/db/seedPlots.ts
 */

// Hamirpur, HP base coordinates
const BASE_LAT = 31.6800;
const BASE_LNG = 76.5300;
const CELL_SIZE = 0.0008; // ~89m per cell at this latitude
const ROWS = 10;
const COLS = 10;

/** Generate a deterministic polygon for a given grid position */
function generatePolygon(row: number, col: number): [number, number][] {
  const lat = BASE_LAT + row * CELL_SIZE;
  const lng = BASE_LNG + col * CELL_SIZE;
  // Slight random-ish variation using golden ratio to avoid perfectly rectangular look
  const jitter = ((row * 7 + col * 13) % 5) * 0.00005;
  return [
    [lng + jitter, lat],
    [lng + CELL_SIZE - jitter, lat + 0.00003],
    [lng + CELL_SIZE + jitter, lat + CELL_SIZE - 0.00003],
    [lng - jitter, lat + CELL_SIZE],
    [lng + jitter, lat], // close the ring
  ];
}

/** Simple string hash to deterministic grid position */
function hashToGrid(str: string): { row: number; col: number } {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return {
    row: Math.abs(hash) % ROWS,
    col: (Math.abs(hash >> 8) + 3) % COLS, // offset to avoid edge stacking
  };
}

async function seedPlots() {
  console.log('[Seed] Connecting to MongoDB...');
  await mongoose.connect(env.MONGODB_URI);

  console.log('[Seed] Fetching LandRecords with khasra/village data...');
  const records = await LandRecord.find({
    village: { $exists: true, $ne: null },
  }).lean();

  if (records.length === 0) {
    console.log('[Seed] No LandRecords found in MongoDB. Seeding with sample data for demo villages.');
  }

  // Build unique khasraNumber + village combos
  const combos = new Map<string, { khasraNumber: string; village: string; district: string }>();

  for (const r of records as any[]) {
    // Use extractedFields.khasraNumber if available, else top-level khasraNumber
    const khasra = r.extractedFields?.khasraNumber?.value || r.khasraNumber;
    if (!khasra) continue;
    const key = `${khasra}||${r.village}`;
    if (!combos.has(key)) {
      combos.set(key, {
        khasraNumber: khasra,
        village: r.village,
        district: r.district || 'Hamirpur',
      });
    }
  }

  // If no real data, seed demo villages for Hamirpur
  if (combos.size === 0) {
    const demoVillages = ['Rampur', 'Bhoranj', 'Nadaun'];
    const demoKhasras = ['101/1', '101/2', '102/1', '102/2', '103/1', '103/2', '104/1', '104/2', '105/1', '105/2', '106/1', '106/2'];
    let idx = 0;
    for (const village of demoVillages) {
      for (const khasra of demoKhasras) {
        combos.set(`${khasra}||${village}`, { khasraNumber: khasra, village, district: 'Hamirpur' });
        idx++;
      }
    }
  }

  console.log(`[Seed] Found ${combos.size} unique khasra+village combinations.`);

  // Clear existing plots
  const pgClient = await pgPool.connect();
  try {
    await pgClient.query('DELETE FROM plots');
    console.log('[Seed] Cleared existing plots.');

    // Insert plots
    let inserted = 0;
    for (const [, combo] of combos) {
      const { row, col } = hashToGrid(`${combo.khasraNumber}||${combo.village}`);
      const coords = generatePolygon(row, col);

      // Build WKT polygon
      const coordStr = coords.map((c) => `${c[0]} ${c[1]}`).join(', ');
      const wkt = `POLYGON((${coordStr}))`;

      await pgClient.query(
        `INSERT INTO plots (khasra_number, village, district, geom)
         VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromText($4), 4326))`,
        [combo.khasraNumber, combo.village, combo.district, wkt],
      );
      inserted++;
    }

    console.log(`[Seed] Inserted ${inserted} plots into PostGIS.`);
    console.log('[Seed] Done!');
  } finally {
    pgClient.release();
    await mongoose.disconnect();
    await pgPool.end();
  }
}

seedPlots().catch((err) => {
  console.error('[Seed] Fatal error:', err);
  process.exit(1);
});
