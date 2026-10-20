"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// Mock the LandRecord model before importing the validator.
vitest_1.vi.mock('../../../models/LandRecord', () => {
    const find = vitest_1.vi.fn();
    return {
        LandRecord: {
            find,
            findOne: vitest_1.vi.fn(),
        },
    };
});
// Mock env so VILLAGE_AREA_LIMIT_HECTARES is deterministic.
vitest_1.vi.mock('../../../config/env', () => ({
    env: {
        VILLAGE_AREA_LIMIT_HECTARES: 500,
        CONFIDENCE_THRESHOLD: 0.75,
    },
}));
const areaSumCheck_1 = require("../areaSumCheck");
const LandRecord_1 = require("../../../models/LandRecord");
const mockFind = LandRecord_1.LandRecord.find;
function setFindResult(rows) {
    mockFind.mockReset();
    const cursor = {
        lean: vitest_1.vi.fn().mockResolvedValue(rows),
    };
    mockFind.mockReturnValue(cursor);
}
(0, vitest_1.describe)('parsePlotArea', () => {
    (0, vitest_1.it)('extracts the leading numeric value', () => {
        (0, vitest_1.expect)((0, areaSumCheck_1.parsePlotArea)('2.5 hectare')).toBe(2.5);
        (0, vitest_1.expect)((0, areaSumCheck_1.parsePlotArea)('1.85 hectares')).toBe(1.85);
        (0, vitest_1.expect)((0, areaSumCheck_1.parsePlotArea)('0.5 ha')).toBe(0.5);
        (0, vitest_1.expect)((0, areaSumCheck_1.parsePlotArea)('3')).toBe(3);
        (0, vitest_1.expect)((0, areaSumCheck_1.parsePlotArea)('3.0')).toBe(3.0);
        // Devanagari numerals in the unit suffix still parse because we only
        // extract the leading ASCII numeric portion.
        (0, vitest_1.expect)((0, areaSumCheck_1.parsePlotArea)('1.85 हेक्टेयर')).toBe(1.85);
    });
    (0, vitest_1.it)('returns null for non-numeric strings', () => {
        (0, vitest_1.expect)((0, areaSumCheck_1.parsePlotArea)('not a number')).toBeNull();
        (0, vitest_1.expect)((0, areaSumCheck_1.parsePlotArea)('')).toBeNull();
        (0, vitest_1.expect)((0, areaSumCheck_1.parsePlotArea)(null)).toBeNull();
        (0, vitest_1.expect)((0, areaSumCheck_1.parsePlotArea)(undefined)).toBeNull();
    });
    (0, vitest_1.it)('passes numeric input through unchanged', () => {
        (0, vitest_1.expect)((0, areaSumCheck_1.parsePlotArea)(2.5)).toBe(2.5);
        (0, vitest_1.expect)((0, areaSumCheck_1.parsePlotArea)(0)).toBe(0);
    });
    (0, vitest_1.it)('rejects NaN', () => {
        (0, vitest_1.expect)((0, areaSumCheck_1.parsePlotArea)(Number.NaN)).toBeNull();
        (0, vitest_1.expect)((0, areaSumCheck_1.parsePlotArea)(Number.POSITIVE_INFINITY)).toBeNull();
    });
});
(0, vitest_1.describe)('checkAreaSumFlags', () => {
    (0, vitest_1.beforeEach)(() => {
        mockFind.mockReset();
    });
    (0, vitest_1.it)('flags exceeds_village_total when sum exceeds the limit', async () => {
        // Existing records: 3 records summing to 600 (> 500 limit).
        setFindResult([
            {
                extractedFields: { plotArea: { value: '200 hectare' } },
            },
            {
                extractedFields: { plotArea: { value: '200' } },
            },
            {
                extractedFields: { plotArea: { value: '200' } },
            },
        ]);
        const result = await (0, areaSumCheck_1.checkAreaSumFlags)({
            village: 'Rampur',
            villageAreaLimit: 500,
        });
        (0, vitest_1.expect)(result.totalArea).toBe(600);
        (0, vitest_1.expect)(result.flags.length).toBe(1);
        (0, vitest_1.expect)(result.flags[0].rule).toBe('exceeds_village_total');
        (0, vitest_1.expect)(result.flags[0].severity).toBe('error');
        (0, vitest_1.expect)(result.flags[0].field).toBe('plotArea');
    });
    (0, vitest_1.it)('flags near_village_total when sum is above 80% but below the limit', async () => {
        setFindResult([
            { extractedFields: { plotArea: { value: '200' } } },
            { extractedFields: { plotArea: { value: '210' } } },
        ]);
        const result = await (0, areaSumCheck_1.checkAreaSumFlags)({
            village: 'Rampur',
            villageAreaLimit: 500,
        });
        (0, vitest_1.expect)(result.totalArea).toBe(410);
        (0, vitest_1.expect)(result.flags.length).toBe(1);
        (0, vitest_1.expect)(result.flags[0].rule).toBe('near_village_total');
        (0, vitest_1.expect)(result.flags[0].severity).toBe('warning');
    });
    (0, vitest_1.it)('returns no flags when sum is well below the limit', async () => {
        setFindResult([
            { extractedFields: { plotArea: { value: '100' } } },
            { extractedFields: { plotArea: { value: '100' } } },
        ]);
        const result = await (0, areaSumCheck_1.checkAreaSumFlags)({
            village: 'Rampur',
            villageAreaLimit: 500,
        });
        (0, vitest_1.expect)(result.totalArea).toBe(200);
        (0, vitest_1.expect)(result.flags).toEqual([]);
    });
    (0, vitest_1.it)('adds the current row\'s plotArea to the sum when passed in', async () => {
        setFindResult([
            { extractedFields: { plotArea: { value: '200' } } },
            { extractedFields: { plotArea: { value: '200' } } },
        ]);
        const result = await (0, areaSumCheck_1.checkAreaSumFlags)({
            village: 'Rampur',
            villageAreaLimit: 500,
            currentPlotArea: '150 hectares',
        });
        (0, vitest_1.expect)(result.totalArea).toBe(550); // 200 + 200 + 150
        (0, vitest_1.expect)(result.flags.length).toBe(1);
        (0, vitest_1.expect)(result.flags[0].rule).toBe('exceeds_village_total');
    });
    (0, vitest_1.it)('skips records whose plotArea cannot be parsed', async () => {
        setFindResult([
            { extractedFields: { plotArea: { value: 'not a number' } } },
            { extractedFields: { plotArea: { value: '100' } } },
        ]);
        const result = await (0, areaSumCheck_1.checkAreaSumFlags)({
            village: 'Rampur',
            villageAreaLimit: 500,
        });
        (0, vitest_1.expect)(result.totalArea).toBe(100);
    });
    (0, vitest_1.it)('falls back to env.VILLAGE_AREA_LIMIT_HECTARES when no limit is passed', async () => {
        setFindResult([]);
        const result = await (0, areaSumCheck_1.checkAreaSumFlags)({ village: 'Rampur' });
        (0, vitest_1.expect)(result.limit).toBe(500);
    });
    (0, vitest_1.it)('returns a warning flag on internal error', async () => {
        mockFind.mockImplementation(() => {
            throw new Error('DB connection failed');
        });
        const result = await (0, areaSumCheck_1.checkAreaSumFlags)({
            village: 'Rampur',
            villageAreaLimit: 500,
        });
        (0, vitest_1.expect)(result.flags.length).toBe(1);
        (0, vitest_1.expect)(result.flags[0].rule).toBe('area_check_error');
        (0, vitest_1.expect)(result.flags[0].severity).toBe('warning');
    });
});
