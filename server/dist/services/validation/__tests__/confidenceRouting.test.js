"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// Mock env so CONFIDENCE_THRESHOLD is deterministic.
vitest_1.vi.mock('../../../config/env', () => ({
    env: {
        CONFIDENCE_THRESHOLD: 0.75,
        VILLAGE_AREA_LIMIT_HECTARES: 500,
    },
}));
const confidenceRouting_1 = require("../confidenceRouting");
// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
function field(value, confidence) {
    return { value, confidence, source: 'gemini' };
}
function goodRow(overrides = {}) {
    return {
        ownerName: field('Ram Singh', 0.95),
        khasraNumber: field('100/1', 0.92),
        plotArea: field('1.85 hectares', 0.88),
        village: field('Rampur', 0.97),
        district: field('Hamirpur', 0.99),
        landClass: field('Chahi', 0.90),
        ...overrides,
    };
}
function nullRow() {
    return {
        ownerName: field(null, 0.0),
        khasraNumber: field(null, 0.0),
        plotArea: field(null, 0.0),
        village: field(null, 0.0),
        district: field(null, 0.0),
        landClass: field(null, 0.0),
    };
}
(0, vitest_1.describe)('routeRowByConfidence', () => {
    (0, vitest_1.it)('auto_approves a row with all required fields above the threshold', () => {
        const row = goodRow();
        const result = (0, confidenceRouting_1.routeRowByConfidence)(row, []);
        (0, vitest_1.expect)(result.status).toBe('auto_approved');
        (0, vitest_1.expect)(result.lowConfidenceFields).toEqual([]);
        (0, vitest_1.expect)(result.rowConfidence).toBeCloseTo(0.88, 2); // min of 0.95,0.92,0.88,0.97,0.99,0.90
    });
    (0, vitest_1.it)('routes to needs_review when any required field is below the threshold', () => {
        const row = goodRow({
            ownerName: field('Ram Singh', 0.50), // below 0.75 threshold
        });
        const result = (0, confidenceRouting_1.routeRowByConfidence)(row, []);
        (0, vitest_1.expect)(result.status).toBe('needs_review');
        (0, vitest_1.expect)(result.lowConfidenceFields).toEqual(['ownerName']);
    });
    (0, vitest_1.it)('routes to needs_review when any required field is null', () => {
        const row = goodRow({
            khasraNumber: field(null, 0.3),
        });
        const result = (0, confidenceRouting_1.routeRowByConfidence)(row, []);
        (0, vitest_1.expect)(result.status).toBe('needs_review');
        (0, vitest_1.expect)(result.lowConfidenceFields).toEqual(['khasraNumber']);
        (0, vitest_1.expect)(result.rowConfidence).toBe(0);
    });
    (0, vitest_1.it)('lists ALL low-confidence fields, not just the first', () => {
        const row = goodRow({
            ownerName: field('Ram Singh', 0.40),
            khasraNumber: field(null, 0.0),
            plotArea: field('1.85 hectares', 0.50),
        });
        const result = (0, confidenceRouting_1.routeRowByConfidence)(row, []);
        (0, vitest_1.expect)(result.status).toBe('needs_review');
        (0, vitest_1.expect)(result.lowConfidenceFields).toEqual(vitest_1.expect.arrayContaining(['ownerName', 'khasraNumber', 'plotArea']));
        (0, vitest_1.expect)(result.lowConfidenceFields).toHaveLength(3);
    });
    (0, vitest_1.it)('routes to needs_review when any validation flag has severity "error"', () => {
        const row = goodRow();
        const flags = [
            {
                rule: 'duplicate_detected_cross_doc',
                severity: 'error',
                message: 'Duplicate found on document doc-2',
                field: 'khasraNumber',
            },
        ];
        const result = (0, confidenceRouting_1.routeRowByConfidence)(row, flags);
        (0, vitest_1.expect)(result.status).toBe('needs_review');
    });
    (0, vitest_1.it)('does NOT route to needs_review when only "warning" flags are present', () => {
        const row = goodRow();
        const flags = [
            {
                rule: 'near_village_total',
                severity: 'warning',
                message: 'Village is at 85% of area limit',
                field: 'plotArea',
            },
        ];
        const result = (0, confidenceRouting_1.routeRowByConfidence)(row, flags);
        (0, vitest_1.expect)(result.status).toBe('auto_approved');
    });
    (0, vitest_1.it)('still computes lowConfidenceFields when an error flag forces needs_review', () => {
        const row = goodRow({
            ownerName: field('Ram Singh', 0.40),
        });
        const flags = [
            {
                rule: 'duplicate_detected_cross_doc',
                severity: 'error',
                message: 'Duplicate',
                field: 'khasraNumber',
            },
        ];
        const result = (0, confidenceRouting_1.routeRowByConfidence)(row, flags);
        (0, vitest_1.expect)(result.status).toBe('needs_review');
        (0, vitest_1.expect)(result.lowConfidenceFields).toContain('ownerName');
    });
    (0, vitest_1.it)('treats an empty string value as a missing field', () => {
        const row = goodRow({
            village: field('', 0.95),
        });
        const result = (0, confidenceRouting_1.routeRowByConfidence)(row, []);
        (0, vitest_1.expect)(result.status).toBe('needs_review');
        (0, vitest_1.expect)(result.lowConfidenceFields).toEqual(['village']);
    });
    (0, vitest_1.it)('respects a custom threshold override', () => {
        const row = goodRow(); // min conf = 0.88
        const result = (0, confidenceRouting_1.routeRowByConfidence)(row, [], 0.90); // threshold 0.90
        // plotArea(0.88) and landClass(0.90) are below 0.90 (well, landClass is exactly 0.90 — let's pick something below).
        (0, vitest_1.expect)(result.status).toBe('needs_review');
        (0, vitest_1.expect)(result.lowConfidenceFields).toContain('plotArea');
    });
    (0, vitest_1.it)('rowConfidence is 0 when any required field is missing entirely', () => {
        const row = nullRow();
        const result = (0, confidenceRouting_1.routeRowByConfidence)(row, []);
        (0, vitest_1.expect)(result.rowConfidence).toBe(0);
        (0, vitest_1.expect)(result.lowConfidenceFields).toEqual(confidenceRouting_1.REQUIRED_FIELDS.slice());
        (0, vitest_1.expect)(result.status).toBe('needs_review');
    });
});
// ---------------------------------------------------------------------------
// Legacy shim test — `routeByConfidence` accepts string[] OR ValidationFlag[]
// ---------------------------------------------------------------------------
(0, vitest_1.describe)('routeByConfidence (legacy shim)', () => {
    (0, vitest_1.it)('accepts string[] flags and routes to needs_review', () => {
        const row = goodRow();
        const status = (0, confidenceRouting_1.routeByConfidence)(row, ['duplicate_detected']);
        (0, vitest_1.expect)(status).toBe('needs_review');
    });
    (0, vitest_1.it)('accepts ValidationFlag[] and routes to auto_approved on warning-only', () => {
        const row = goodRow();
        const status = (0, confidenceRouting_1.routeByConfidence)(row, [
            { rule: 'near_village_total', severity: 'warning', message: 'x' },
        ]);
        (0, vitest_1.expect)(status).toBe('auto_approved');
    });
    (0, vitest_1.it)('returns needs_review when the row has low confidence AND no flags', () => {
        const row = goodRow({ ownerName: field('x', 0.4) });
        const status = (0, confidenceRouting_1.routeByConfidence)(row, []);
        (0, vitest_1.expect)(status).toBe('needs_review');
    });
});
