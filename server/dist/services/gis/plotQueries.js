"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlotByKhasra = getPlotByKhasra;
exports.getPlotsByVillage = getPlotsByVillage;
const db_1 = require("../../config/db");
const LandRecord_1 = require("../../models/LandRecord");
/**
 * Sprint 4: PostGIS plot queries.
 * These return GeoJSON and optionally enrich with MongoDB LandRecord data.
 */
/**
 * Get a single plot by khasraNumber + village as GeoJSON.
 */
async function getPlotByKhasra(khasraNumber, village) {
    if (!db_1.pgPool)
        throw new Error('PostgreSQL not configured — set PG_CONNECTION_STRING in server/.env');
    const result = await db_1.pgPool.query(`SELECT id, khasra_number, village, district,
            ST_AsGeoJSON(geom) as geojson, created_at
     FROM plots
     WHERE khasra_number = $1 AND village = $2
     LIMIT 1`, [khasraNumber, village]);
    if (result.rows.length === 0)
        return null;
    const row = result.rows[0];
    return {
        type: 'Feature',
        geometry: JSON.parse(row.geojson),
        properties: {
            plotId: row.id,
            khasraNumber: row.khasra_number,
            village: row.village,
            district: row.district,
        },
    };
}
/**
 * Get all plots in a village as a GeoJSON FeatureCollection,
 * enriched with LandRecord status and ownerName from MongoDB.
 */
async function getPlotsByVillage(village) {
    if (!db_1.pgPool)
        throw new Error('PostgreSQL not configured — set PG_CONNECTION_STRING in server/.env');
    const result = await db_1.pgPool.query(`SELECT id, khasra_number, village, district,
            ST_AsGeoJSON(geom) as geojson
     FROM plots
     WHERE village = $1`, [village]);
    // Fetch all LandRecords for this village from MongoDB
    const records = await LandRecord_1.LandRecord.find({ village }).lean();
    // Build a lookup: khasraNumber -> record info
    const recordMap = new Map();
    for (const r of records) {
        // Check extractedFields first, then top-level
        const khasra = r.extractedFields?.khasraNumber?.value || r.khasraNumber;
        if (khasra) {
            recordMap.set(khasra, {
                recordId: r._id?.toString?.() || r.id,
                status: r.status,
                ownerName: r.extractedFields?.ownerName?.value || null,
            });
        }
    }
    // Build FeatureCollection
    const features = result.rows.map((row) => {
        const recordInfo = recordMap.get(row.khasra_number);
        return {
            type: 'Feature',
            geometry: JSON.parse(row.geojson),
            properties: {
                plotId: row.id,
                khasraNumber: row.khasra_number,
                village: row.village,
                district: row.district,
                // Enriched from MongoDB
                recordId: recordInfo?.recordId || null,
                status: recordInfo?.status || null,
                ownerName: recordInfo?.ownerName || null,
            },
        };
    });
    return {
        type: 'FeatureCollection',
        features,
    };
}
