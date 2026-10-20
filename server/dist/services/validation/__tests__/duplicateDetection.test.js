"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// ---------------------------------------------------------------------------
// Mock the LandRecord model before importing the validator under test.
// ---------------------------------------------------------------------------
// We mock at the module path so the validator's `import { LandRecord }`
// resolves to our mock. Each test configures the mock's `find` return
// value to simulate the desired DB state.
vitest_1.vi.mock('../../../models/LandRecord', () => {
    const find = vitest_1.vi.fn();
    return {
        LandRecord: {
            find,
            // Some legacy callers use `findOne` — keep a stub so accidental
            // calls don't crash.
            findOne: vitest_1.vi.fn(),
        },
    };
});
const duplicateDetection_1 = require("../duplicateDetection");
const LandRecord_1 = require("../../../models/LandRecord");
const mockFind = LandRecord_1.LandRecord.find;
// Helper: make `LandRecord.find(...).limit(n).lean()` resolve to `rows`.
function setFindResult(rows) {
    const cursor = {
        limit: vitest_1.vi.fn().mockReturnThis(),
        lean: vitest_1.vi.fn().mockResolvedValue(rows),
    };
    mockFind.mockReset();
    mockFind.mockResolvedValue(rows);
    // Also support the chained .limit().lean() pattern.
    mockFind.mockReturnValue(cursor);
}
(0, vitest_1.describe)('detectDuplicateFlags', () => {
    (0, vitest_1.beforeEach)(() => {
        mockFind.mockReset();
    });
    (0, vitest_1.it)('returns no flags when khasraNumber is null', async () => {
        const flags = await (0, duplicateDetection_1.detectDuplicateFlags)({
            khasraNumber: null,
            village: 'Rampur',
            documentId: 'doc-1',
        });
        (0, vitest_1.expect)(flags).toEqual([]);
    });
    (0, vitest_1.it)('returns no flags when village is null', async () => {
        const flags = await (0, duplicateDetection_1.detectDuplicateFlags)({
            khasraNumber: '100/1',
            village: null,
            documentId: 'doc-1',
        });
        (0, vitest_1.expect)(flags).toEqual([]);
    });
    (0, vitest_1.it)('flags a cross-document duplicate when another doc has the same khasra+village', async () => {
        // First call (cross-doc query) returns 1 match on a different documentId.
        // Second call (within-doc query) returns 1 match (the current row itself,
        // assuming the row has already been saved).
        let callCount = 0;
        mockFind.mockImplementation(() => {
            callCount++;
            const cursor = {
                limit: vitest_1.vi.fn().mockReturnThis(),
                lean: vitest_1.vi.fn().mockResolvedValue(callCount === 1
                    ? [{ _id: 'other-row', documentId: 'doc-2' }]
                    : [{ _id: 'self-row', documentId: 'doc-1' }]),
            };
            return cursor;
        });
        const flags = await (0, duplicateDetection_1.detectDuplicateFlags)({
            khasraNumber: '100/1',
            subSurveyNumber: '2',
            village: 'Rampur',
            documentId: 'doc-1',
            excludeRecordId: 'self-row',
        });
        (0, vitest_1.expect)(flags.length).toBe(1);
        (0, vitest_1.expect)(flags[0].rule).toBe('duplicate_detected_cross_doc');
        (0, vitest_1.expect)(flags[0].severity).toBe('error');
        (0, vitest_1.expect)(flags[0].field).toBe('khasraNumber');
        (0, vitest_1.expect)(flags[0].message).toContain('100/1');
    });
    (0, vitest_1.it)('flags a within-document duplicate when the same doc has 2+ rows with the same key', async () => {
        let callCount = 0;
        mockFind.mockImplementation(() => {
            callCount++;
            const cursor = {
                limit: vitest_1.vi.fn().mockReturnThis(),
                lean: vitest_1.vi.fn().mockResolvedValue(callCount === 1
                    ? [] // no cross-doc matches
                    : [
                        { _id: 'self-row', documentId: 'doc-1' },
                        { _id: 'sibling-row', documentId: 'doc-1' },
                    ]),
            };
            return cursor;
        });
        const flags = await (0, duplicateDetection_1.detectDuplicateFlags)({
            khasraNumber: '100/1',
            village: 'Rampur',
            documentId: 'doc-1',
            excludeRecordId: 'self-row',
        });
        (0, vitest_1.expect)(flags.length).toBe(1);
        (0, vitest_1.expect)(flags[0].rule).toBe('duplicate_detected_within_doc');
        (0, vitest_1.expect)(flags[0].severity).toBe('error');
    });
    (0, vitest_1.it)('returns no flags when the only match is the current row itself', async () => {
        let callCount = 0;
        mockFind.mockImplementation(() => {
            callCount++;
            const cursor = {
                limit: vitest_1.vi.fn().mockReturnThis(),
                lean: vitest_1.vi.fn().mockResolvedValue(callCount === 1 ? [] : [{ _id: 'self-row', documentId: 'doc-1' }]),
            };
            return cursor;
        });
        const flags = await (0, duplicateDetection_1.detectDuplicateFlags)({
            khasraNumber: '100/1',
            village: 'Rampur',
            documentId: 'doc-1',
            excludeRecordId: 'self-row',
        });
        (0, vitest_1.expect)(flags).toEqual([]);
    });
    (0, vitest_1.it)('returns a generic duplicate_detected flag when no documentId is provided', async () => {
        mockFind.mockImplementation(() => {
            const cursor = {
                limit: vitest_1.vi.fn().mockReturnThis(),
                lean: vitest_1.vi.fn().mockResolvedValue([
                    { _id: 'other-row', documentId: 'doc-2' },
                ]),
            };
            return cursor;
        });
        const flags = await (0, duplicateDetection_1.detectDuplicateFlags)({
            khasraNumber: '100/1',
            village: 'Rampur',
        });
        (0, vitest_1.expect)(flags.length).toBe(1);
        (0, vitest_1.expect)(flags[0].rule).toBe('duplicate_detected');
        (0, vitest_1.expect)(flags[0].severity).toBe('error');
    });
    (0, vitest_1.it)('returns a warning flag on internal error instead of throwing', async () => {
        mockFind.mockImplementation(() => {
            throw new Error('DB connection failed');
        });
        const flags = await (0, duplicateDetection_1.detectDuplicateFlags)({
            khasraNumber: '100/1',
            village: 'Rampur',
            documentId: 'doc-1',
        });
        (0, vitest_1.expect)(flags.length).toBe(1);
        (0, vitest_1.expect)(flags[0].rule).toBe('duplicate_check_error');
        (0, vitest_1.expect)(flags[0].severity).toBe('warning');
    });
    (0, vitest_1.it)('handles a null subSurveyNumber by matching rows with missing sub-survey', async () => {
        let callCount = 0;
        mockFind.mockImplementation(() => {
            callCount++;
            const cursor = {
                limit: vitest_1.vi.fn().mockReturnThis(),
                lean: vitest_1.vi.fn().mockResolvedValue(callCount === 1
                    ? [{ _id: 'other-row', documentId: 'doc-2' }]
                    : [{ _id: 'self-row', documentId: 'doc-1' }]),
            };
            return cursor;
        });
        const flags = await (0, duplicateDetection_1.detectDuplicateFlags)({
            khasraNumber: '100/1',
            subSurveyNumber: null,
            village: 'Rampur',
            documentId: 'doc-1',
            excludeRecordId: 'self-row',
        });
        // Cross-doc duplicate should fire.
        (0, vitest_1.expect)(flags.some((f) => f.rule === 'duplicate_detected_cross_doc')).toBe(true);
    });
});
