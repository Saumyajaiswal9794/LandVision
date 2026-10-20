"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const bboxConverter_1 = require("../bboxConverter");
(0, vitest_1.describe)('geminiBoxToBoundingBox', () => {
    (0, vitest_1.it)('converts a canonical Gemini box_2d into a normalised BoundingBox', () => {
        // [ymin, xmin, ymax, xmax] = [100, 200, 300, 600] on a 1000x1000 grid.
        // Expected: x=0.2, y=0.1, w=0.4, h=0.2
        const result = (0, bboxConverter_1.geminiBoxToBoundingBox)([100, 200, 300, 600]);
        (0, vitest_1.expect)(result).not.toBeNull();
        (0, vitest_1.expect)(result).toEqual({
            x: 0.2,
            y: 0.1,
            width: 0.4,
            height: 0.2,
        });
    });
    (0, vitest_1.it)('returns null for missing or malformed input', () => {
        (0, vitest_1.expect)((0, bboxConverter_1.geminiBoxToBoundingBox)(null)).toBeNull();
        (0, vitest_1.expect)((0, bboxConverter_1.geminiBoxToBoundingBox)(undefined)).toBeNull();
        (0, vitest_1.expect)((0, bboxConverter_1.geminiBoxToBoundingBox)([])).toBeNull();
        (0, vitest_1.expect)((0, bboxConverter_1.geminiBoxToBoundingBox)([1, 2, 3])).toBeNull(); // only 3 entries
        (0, vitest_1.expect)((0, bboxConverter_1.geminiBoxToBoundingBox)({})).toBeNull();
    });
    (0, vitest_1.it)('clamps out-of-range values to [0, GEMINI_BOX_SCALE]', () => {
        // Negative values and >1000 values should be clamped, not rejected.
        const result = (0, bboxConverter_1.geminiBoxToBoundingBox)([-50, 0, 1500, 500]);
        (0, vitest_1.expect)(result).not.toBeNull();
        (0, vitest_1.expect)(result).toEqual({
            x: 0,
            y: 0,
            width: 0.5,
            height: 1.0,
        });
    });
    (0, vitest_1.it)('handles the full-image box [0,0,1000,1000] correctly', () => {
        const result = (0, bboxConverter_1.geminiBoxToBoundingBox)([0, 0, 1000, 1000]);
        (0, vitest_1.expect)(result).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    });
    (0, vitest_1.it)('produces a zero-size bbox when ymin==ymax and xmin==xmax', () => {
        const result = (0, bboxConverter_1.geminiBoxToBoundingBox)([500, 500, 500, 500]);
        (0, vitest_1.expect)(result).toEqual({ x: 0.5, y: 0.5, width: 0, height: 0 });
    });
    (0, vitest_1.it)('swaps inverted corners so width/height are always non-negative', () => {
        // Model noise: returns [ymax, xmax, ymin, xmin] for the same box as the
        // first test. We expect the same output as the canonical input.
        const result = (0, bboxConverter_1.geminiBoxToBoundingBox)([300, 600, 100, 200]);
        (0, vitest_1.expect)(result).toEqual({ x: 0.2, y: 0.1, width: 0.4, height: 0.2 });
    });
    (0, vitest_1.it)('treats non-numeric entries as 0 instead of NaN', () => {
        const result = (0, bboxConverter_1.geminiBoxToBoundingBox)([NaN, 'abc', 500, 500]);
        (0, vitest_1.expect)(result).toEqual({ x: 0, y: 0, width: 0.5, height: 0.5 });
    });
    (0, vitest_1.it)('attaches pageNo when provided', () => {
        const result = (0, bboxConverter_1.geminiBoxToBoundingBox)([0, 0, 500, 500], 3);
        (0, vitest_1.expect)(result).toEqual({ x: 0, y: 0, width: 0.5, height: 0.5, pageNo: 3 });
    });
    (0, vitest_1.it)('omits pageNo when the value is undefined or non-positive', () => {
        (0, vitest_1.expect)((0, bboxConverter_1.geminiBoxToBoundingBox)([0, 0, 100, 100])).not.toHaveProperty('pageNo');
        (0, vitest_1.expect)((0, bboxConverter_1.geminiBoxToBoundingBox)([0, 0, 100, 100], 0)).not.toHaveProperty('pageNo');
        (0, vitest_1.expect)((0, bboxConverter_1.geminiBoxToBoundingBox)([0, 0, 100, 100], -1)).not.toHaveProperty('pageNo');
    });
    (0, vitest_1.it)('uses GEMINI_BOX_SCALE constant = 1000', () => {
        (0, vitest_1.expect)(bboxConverter_1.GEMINI_BOX_SCALE).toBe(1000);
    });
});
(0, vitest_1.describe)('geminiBoxMapToBoundingBoxMap', () => {
    (0, vitest_1.it)('returns an empty object for null/undefined input', () => {
        (0, vitest_1.expect)((0, bboxConverter_1.geminiBoxMapToBoundingBoxMap)(null)).toEqual({});
        (0, vitest_1.expect)((0, bboxConverter_1.geminiBoxMapToBoundingBoxMap)(undefined)).toEqual({});
    });
    (0, vitest_1.it)('converts each field independently, preserving keys', () => {
        const result = (0, bboxConverter_1.geminiBoxMapToBoundingBoxMap)({
            ownerName: [100, 100, 200, 200],
            village: [0, 0, 500, 500],
            unknown: null,
        });
        (0, vitest_1.expect)(result.ownerName).toEqual({ x: 0.1, y: 0.1, width: 0.1, height: 0.1 });
        (0, vitest_1.expect)(result.village).toEqual({ x: 0, y: 0, width: 0.5, height: 0.5 });
        (0, vitest_1.expect)(result.unknown).toBeNull();
    });
    (0, vitest_1.it)('attaches pageNo to every converted box', () => {
        const result = (0, bboxConverter_1.geminiBoxMapToBoundingBoxMap)({
            a: [0, 0, 100, 100],
            b: [200, 200, 300, 300],
        }, 2);
        (0, vitest_1.expect)(result.a).toHaveProperty('pageNo', 2);
        (0, vitest_1.expect)(result.b).toHaveProperty('pageNo', 2);
    });
});
