"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// Mock LandRecord model
vitest_1.vi.mock('../../models/LandRecord', () => {
    return {
        LandRecord: {
            findById: vitest_1.vi.fn(),
            find: vitest_1.vi.fn(),
        },
    };
});
const recordsController_1 = require("../recordsController");
const LandRecord_1 = require("../../models/LandRecord");
const mockFindById = LandRecord_1.LandRecord.findById;
function createMockResponse() {
    const res = {};
    res.status = vitest_1.vi.fn().mockReturnValue(res);
    res.json = vitest_1.vi.fn().mockReturnValue(res);
    return res;
}
(0, vitest_1.describe)('Records PATCH RBAC (updateRecord)', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('allows an officer to edit their own record', async () => {
        const mockRecord = {
            _id: 'rec-123',
            uploadedBy: 'officer-user-id',
            extractedFields: {},
            lowConfidenceFields: ['ownerName'],
            save: vitest_1.vi.fn().mockResolvedValue(true),
        };
        mockFindById.mockResolvedValue(mockRecord);
        const req = {
            user: {
                id: 'officer-user-id',
                email: 'officer@example.com',
                role: 'officer',
            },
            params: { id: 'rec-123' },
            body: { fieldName: 'ownerName', value: 'Ram Singh' },
        };
        const res = createMockResponse();
        await (0, recordsController_1.updateRecord)(req, res);
        (0, vitest_1.expect)(mockFindById).toHaveBeenCalledWith('rec-123');
        (0, vitest_1.expect)(mockRecord.save).toHaveBeenCalled();
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(200);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            message: 'Field updated successfully.',
            recordId: 'rec-123',
            fieldName: 'ownerName',
        }));
    });
    (0, vitest_1.it)('forbids an officer from editing another user record', async () => {
        const mockRecord = {
            _id: 'rec-123',
            uploadedBy: 'other-officer-id',
            extractedFields: {},
            save: vitest_1.vi.fn(),
        };
        mockFindById.mockResolvedValue(mockRecord);
        const req = {
            user: {
                id: 'officer-user-id',
                email: 'officer@example.com',
                role: 'officer',
            },
            params: { id: 'rec-123' },
            body: { fieldName: 'ownerName', value: 'Malicious Change' },
        };
        const res = createMockResponse();
        await (0, recordsController_1.updateRecord)(req, res);
        (0, vitest_1.expect)(mockFindById).toHaveBeenCalledWith('rec-123');
        (0, vitest_1.expect)(mockRecord.save).not.toHaveBeenCalled();
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(403);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith({
            error: 'Forbidden: You can only edit your own records.',
        });
    });
    (0, vitest_1.it)('allows a reviewer to edit any record', async () => {
        const mockRecord = {
            _id: 'rec-123',
            uploadedBy: 'officer-user-id',
            extractedFields: {},
            lowConfidenceFields: [],
            save: vitest_1.vi.fn().mockResolvedValue(true),
        };
        mockFindById.mockResolvedValue(mockRecord);
        const req = {
            user: {
                id: 'reviewer-user-id',
                email: 'reviewer@example.com',
                role: 'reviewer',
            },
            params: { id: 'rec-123' },
            body: { fieldName: 'ownerName', value: 'Verified Name' },
        };
        const res = createMockResponse();
        await (0, recordsController_1.updateRecord)(req, res);
        (0, vitest_1.expect)(mockFindById).toHaveBeenCalledWith('rec-123');
        (0, vitest_1.expect)(mockRecord.save).toHaveBeenCalled();
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(200);
    });
});
