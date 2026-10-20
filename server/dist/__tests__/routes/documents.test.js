"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
// Mock Supabase admin auth
vitest_1.vi.mock('../../config/supabaseAdmin', () => ({
    default: {
        auth: {
            getUser: vitest_1.vi.fn(async (token) => {
                if (token === 'officer-token') {
                    return {
                        data: {
                            user: {
                                id: 'officer-1',
                                email: 'officer@test.com',
                                app_metadata: { role: 'officer' },
                            },
                        },
                        error: null,
                    };
                }
                if (token === 'other-officer-token') {
                    return {
                        data: {
                            user: {
                                id: 'officer-2',
                                email: 'officer2@test.com',
                                app_metadata: { role: 'officer' },
                            },
                        },
                        error: null,
                    };
                }
                if (token === 'reviewer-token') {
                    return {
                        data: {
                            user: {
                                id: 'reviewer-1',
                                email: 'reviewer@test.com',
                                app_metadata: { role: 'reviewer' },
                            },
                        },
                        error: null,
                    };
                }
                return { data: { user: null }, error: new Error('Invalid token') };
            }),
        },
    },
    supabaseAdmin: {
        auth: {
            getUser: vitest_1.vi.fn(),
        },
    },
}));
// Mock Storage service
vitest_1.vi.mock('../../services/storage/supabaseStorage', () => ({
    uploadDocument: vitest_1.vi.fn(async () => ({
        signedUrl: 'https://example.com/mock-signed-url.jpg',
        storagePath: 'land-records/mock-file.jpg',
    })),
    deleteDocument: vitest_1.vi.fn(async () => { }),
    regenerateSignedUrl: vitest_1.vi.fn(async () => 'https://example.com/refreshed-url.jpg'),
}));
// Mock LandRecord mongoose model
const mockSave = vitest_1.vi.fn().mockImplementation(function () {
    return Promise.resolve({
        _id: this._id || 'mock-doc-id',
        filename: this.filename || 'test.jpg',
        village: this.village || 'Rampur',
        district: this.district || 'Agra',
        status: this.status || 'uploaded',
        uploadedBy: this.uploadedBy || 'officer-1',
        extractedFields: this.extractedFields || {},
        save: mockSave,
    });
});
vitest_1.vi.mock('../../models/LandRecord', () => {
    const LandRecordMock = vitest_1.vi.fn().mockImplementation((data) => ({
        ...data,
        _id: 'mock-doc-id',
        save: mockSave,
    }));
    LandRecordMock.findById = vitest_1.vi.fn();
    LandRecordMock.find = vitest_1.vi.fn();
    return { LandRecord: LandRecordMock, default: LandRecordMock };
});
const index_1 = __importDefault(require("../../index"));
const LandRecord_1 = require("../../models/LandRecord");
(0, vitest_1.describe)('Documents Routes', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.describe)('POST /api/documents/upload', () => {
        (0, vitest_1.it)('returns 401 without auth header', async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .post('/api/documents/upload')
                .field('village', 'Rampur')
                .field('district', 'Agra')
                .attach('file', Buffer.from('fake image content'), 'test.jpg');
            (0, vitest_1.expect)(res.status).toBe(401);
            (0, vitest_1.expect)(res.body).toHaveProperty('error');
        });
        (0, vitest_1.it)('returns 403 if non-officer attempts upload', async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .post('/api/documents/upload')
                .set('Authorization', 'Bearer reviewer-token')
                .field('village', 'Rampur')
                .field('district', 'Agra')
                .attach('file', Buffer.from('fake image content'), 'test.jpg');
            (0, vitest_1.expect)(res.status).toBe(403);
            (0, vitest_1.expect)(res.body.error).toContain('Forbidden');
        });
        (0, vitest_1.it)('returns 413 when file exceeds the 10MB limit', async () => {
            // 10MB + 1 byte
            const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);
            const res = await (0, supertest_1.default)(index_1.default)
                .post('/api/documents/upload')
                .set('Authorization', 'Bearer officer-token')
                .field('village', 'Rampur')
                .field('district', 'Agra')
                .attach('file', largeBuffer, 'huge.jpg');
            (0, vitest_1.expect)(res.status).toBe(413);
            (0, vitest_1.expect)(res.body.error).toContain('File too large');
        });
        (0, vitest_1.it)('uploads successfully with valid officer token and returns 201', async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .post('/api/documents/upload')
                .set('Authorization', 'Bearer officer-token')
                .field('village', 'Rampur')
                .field('district', 'Agra')
                .attach('file', Buffer.from('fake content'), 'test.jpg');
            (0, vitest_1.expect)(res.status).toBe(201);
            (0, vitest_1.expect)(res.body).toHaveProperty('recordId');
            (0, vitest_1.expect)(res.body).toHaveProperty('filename', 'test.jpg');
            (0, vitest_1.expect)(res.body).toHaveProperty('village', 'Rampur');
            (0, vitest_1.expect)(res.body).toHaveProperty('district', 'Agra');
            (0, vitest_1.expect)(res.body).toHaveProperty('status', 'uploaded');
        });
    });
    (0, vitest_1.describe)('POST /api/documents/:id/extract (ownership check)', () => {
        (0, vitest_1.it)('returns 401 without auth header', async () => {
            const res = await (0, supertest_1.default)(index_1.default).post('/api/documents/doc-123/extract');
            (0, vitest_1.expect)(res.status).toBe(401);
        });
        (0, vitest_1.it)('returns 403 when an officer attempts to extract another officer upload', async () => {
            LandRecord_1.LandRecord.findById.mockResolvedValue({
                _id: 'doc-123',
                uploadedBy: 'officer-2', // owned by officer-2
                status: 'uploaded',
                save: vitest_1.vi.fn(),
            });
            const res = await (0, supertest_1.default)(index_1.default)
                .post('/api/documents/doc-123/extract')
                .set('Authorization', 'Bearer officer-token'); // officer-1
            (0, vitest_1.expect)(res.status).toBe(403);
            (0, vitest_1.expect)(res.body.error).toContain('Forbidden: You can only extract your own documents');
        });
    });
    (0, vitest_1.describe)('PATCH /api/documents/:id/review (reviewer only)', () => {
        (0, vitest_1.it)('returns 401 without auth header', async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .patch('/api/documents/doc-123/review')
                .send({ action: 'approve' });
            (0, vitest_1.expect)(res.status).toBe(401);
        });
        (0, vitest_1.it)('returns 403 when an officer attempts to review', async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .patch('/api/documents/doc-123/review')
                .set('Authorization', 'Bearer officer-token')
                .send({ action: 'approve' });
            (0, vitest_1.expect)(res.status).toBe(403);
            (0, vitest_1.expect)(res.body.error).toContain('Forbidden');
        });
        (0, vitest_1.it)('allows reviewer to approve a document and returns 200', async () => {
            const mockDoc = {
                _id: 'doc-123',
                status: 'needs_review',
                save: vitest_1.vi.fn().mockResolvedValue(true),
            };
            LandRecord_1.LandRecord.findById.mockResolvedValue(mockDoc);
            const res = await (0, supertest_1.default)(index_1.default)
                .patch('/api/documents/doc-123/review')
                .set('Authorization', 'Bearer reviewer-token')
                .send({ action: 'approve' });
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body).toHaveProperty('status', 'reviewed_approved');
            (0, vitest_1.expect)(mockDoc.save).toHaveBeenCalled();
        });
    });
});
