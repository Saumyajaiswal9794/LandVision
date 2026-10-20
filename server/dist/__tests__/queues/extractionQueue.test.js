"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// server/src/__tests__/queues/extractionQueue.test.ts
const vitest_1 = require("vitest");
const extractionQueue_js_1 = require("../../queues/extractionQueue.js");
// Mock LandRecord model
vitest_1.vi.mock('../../models/LandRecord', () => {
    const mockRecord = {
        _id: 'doc123',
        status: 'uploaded',
        // Mock save resolves without changing state
        save: vitest_1.vi.fn().mockResolvedValue(undefined),
    };
    return {
        LandRecord: {
            findById: vitest_1.vi.fn().mockImplementation((id) => {
                if (id === mockRecord._id) {
                    // Return the same mock record instance
                    return Promise.resolve(mockRecord);
                }
                return Promise.resolve(null);
            }),
        },
    };
});
(0, vitest_1.describe)('extractionQueue (in‑memory)', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.resetAllMocks();
    });
    (0, vitest_1.it)('processes a job and marks record as extracted', async () => {
        const { LandRecord } = await import('../../models/LandRecord.js');
        const mock = (await LandRecord.findById('doc123'));
        // Ensure initial state
        (0, vitest_1.expect)(mock.status).toBe('uploaded');
        await extractionQueue_js_1.extractionQueue.addJob({ id: 'doc123' });
        // Wait a tick for async processing (in‑memory runs fire‑and‑forget)
        await new Promise((r) => setTimeout(r, 10));
        // After processing, the mocked record should have status updated to 'extracted'
        (0, vitest_1.expect)(mock.save).toHaveBeenCalled();
        (0, vitest_1.expect)(mock.status).toBe('extracted');
    });
});
