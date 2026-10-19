"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAreaSum = void 0;
exports.checkAreaSum = checkAreaSum;
const LandRecord_1 = require("../../models/LandRecord");
const env_1 = require("../../config/env");
/**
 * Validates if the total plot area for a village exceeds the configured limit.
 * The limit is read from env.VILLAGE_AREA_LIMIT_HECTARES (default 500).
 * An explicit villageAreaLimit parameter can still be passed to override it.
 *
 * @param village - Village name
 * @param villageAreaLimit - (Optional) Override limit; falls back to env.VILLAGE_AREA_LIMIT_HECTARES
 * @param excludeRecordId - Record ID to exclude from calculation (current record)
 * @returns Array of validation flags (empty if valid)
 */
async function checkAreaSum(village, villageAreaLimit, excludeRecordId) {
    try {
        const flags = [];
        // Use caller-supplied limit, or fall back to env variable (default 500)
        const limit = villageAreaLimit !== undefined ? villageAreaLimit : env_1.env.VILLAGE_AREA_LIMIT_HECTARES;
        // Find all extracted land records for this village
        const query = {
            village: { $regex: village, $options: 'i' }, // Case-insensitive
            extractedFields: { $exists: true },
            'extractedFields.plotArea.value': { $exists: true, $ne: null },
        };
        if (excludeRecordId) {
            query._id = { $ne: excludeRecordId };
        }
        const records = await LandRecord_1.LandRecord.find(query);
        // Sum plot areas (extract numeric value from strings like "2.5 hectare")
        let totalArea = 0;
        for (const record of records) {
            const plotAreaStr = record.extractedFields?.plotArea?.value;
            if (plotAreaStr) {
                // Extract numeric value from strings like "2.5 hectare" or "1.5"
                const numMatch = plotAreaStr.match(/^([\d.]+)/);
                if (numMatch) {
                    totalArea += parseFloat(numMatch[1]);
                }
            }
        }
        // Check if total exceeds limit
        if (totalArea > limit) {
            flags.push('exceeds_village_total');
            console.warn(`[Validation] Village "${village}" total area (${totalArea}) exceeds limit (${limit}) [env: VILLAGE_AREA_LIMIT_HECTARES]`);
        }
        return flags;
    }
    catch (error) {
        console.error('[Validation] Area sum check error:', error);
        return ['area_check_error'];
    }
}
/**
 * Legacy function for backward compatibility (placeholder)
 */
const verifyAreaSum = async (record) => {
    console.log(`[Validation Service] Running Area Sum Check for record in village: ${record.village}`);
    return record.areaTotal > 0;
};
exports.verifyAreaSum = verifyAreaSum;
exports.default = {
    checkAreaSum,
    verifyAreaSum: exports.verifyAreaSum,
};
