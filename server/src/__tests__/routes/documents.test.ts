import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Mock Supabase admin auth
vi.mock('../../config/supabaseAdmin', () => ({
  default: {
    auth: {
      getUser: vi.fn(async (token: string) => {
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
      getUser: vi.fn(),
    },
  },
}));

// Mock Storage service
vi.mock('../../services/storage/supabaseStorage', () => ({
  uploadDocument: vi.fn(async () => ({
    signedUrl: 'https://example.com/mock-signed-url.jpg',
    storagePath: 'land-records/mock-file.jpg',
  })),
  deleteDocument: vi.fn(async () => {}),
  regenerateSignedUrl: vi.fn(async () => 'https://example.com/refreshed-url.jpg'),
}));

// Mock LandRecord mongoose model
const mockSave = vi.fn().mockImplementation(function (this: any) {
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

vi.mock('../../models/LandRecord', () => {
  const LandRecordMock: any = vi.fn().mockImplementation((data: any) => ({
    ...data,
    _id: 'mock-doc-id',
    save: mockSave,
  }));
  LandRecordMock.findById = vi.fn();
  LandRecordMock.find = vi.fn();
  return { LandRecord: LandRecordMock, default: LandRecordMock };
});

import app from '../../index';
import { LandRecord } from '../../models/LandRecord';

describe('Documents Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/documents/upload', () => {
    it('returns 401 without auth header', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .field('village', 'Rampur')
        .field('district', 'Agra')
        .attach('file', Buffer.from('fake image content'), 'test.jpg');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 403 if non-officer attempts upload', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', 'Bearer reviewer-token')
        .field('village', 'Rampur')
        .field('district', 'Agra')
        .attach('file', Buffer.from('fake image content'), 'test.jpg');

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });

    it('returns 413 when file exceeds the 10MB limit', async () => {
      // 10MB + 1 byte
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', 'Bearer officer-token')
        .field('village', 'Rampur')
        .field('district', 'Agra')
        .attach('file', largeBuffer, 'huge.jpg');

      expect(res.status).toBe(413);
      expect(res.body.error).toContain('File too large');
    });

    it('uploads successfully with valid officer token and returns 201', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', 'Bearer officer-token')
        .field('village', 'Rampur')
        .field('district', 'Agra')
        .attach('file', Buffer.from('fake content'), 'test.jpg');

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('recordId');
      expect(res.body).toHaveProperty('filename', 'test.jpg');
      expect(res.body).toHaveProperty('village', 'Rampur');
      expect(res.body).toHaveProperty('district', 'Agra');
      expect(res.body).toHaveProperty('status', 'uploaded');
    });
  });

  describe('POST /api/documents/:id/extract (ownership check)', () => {
    it('returns 401 without auth header', async () => {
      const res = await request(app).post('/api/documents/doc-123/extract');
      expect(res.status).toBe(401);
    });

    it('returns 403 when an officer attempts to extract another officer upload', async () => {
      (LandRecord.findById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        _id: 'doc-123',
        uploadedBy: 'officer-2', // owned by officer-2
        status: 'uploaded',
        save: vi.fn(),
      });

      const res = await request(app)
        .post('/api/documents/doc-123/extract')
        .set('Authorization', 'Bearer officer-token'); // officer-1

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden: You can only extract your own documents');
    });
  });

  describe('PATCH /api/documents/:id/review (reviewer only)', () => {
    it('returns 401 without auth header', async () => {
      const res = await request(app)
        .patch('/api/documents/doc-123/review')
        .send({ action: 'approve' });

      expect(res.status).toBe(401);
    });

    it('returns 403 when an officer attempts to review', async () => {
      const res = await request(app)
        .patch('/api/documents/doc-123/review')
        .set('Authorization', 'Bearer officer-token')
        .send({ action: 'approve' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });

    it('allows reviewer to approve a document and returns 200', async () => {
      const mockDoc = {
        _id: 'doc-123',
        status: 'needs_review',
        save: vi.fn().mockResolvedValue(true),
      };
      (LandRecord.findById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockDoc);

      const res = await request(app)
        .patch('/api/documents/doc-123/review')
        .set('Authorization', 'Bearer reviewer-token')
        .send({ action: 'approve' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'reviewed_approved');
      expect(mockDoc.save).toHaveBeenCalled();
    });
  });
});
