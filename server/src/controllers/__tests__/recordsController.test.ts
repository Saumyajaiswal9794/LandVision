import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';

// Mock LandRecord model
vi.mock('../../models/LandRecord', () => {
  return {
    LandRecord: {
      findById: vi.fn(),
      find: vi.fn(),
    },
  };
});

import { updateRecord } from '../recordsController';
import { LandRecord } from '../../models/LandRecord';

const mockFindById = LandRecord.findById as unknown as ReturnType<typeof vi.fn>;

function createMockResponse() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

describe('Records PATCH RBAC (updateRecord)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows an officer to edit their own record', async () => {
    const mockRecord = {
      _id: 'rec-123',
      uploadedBy: 'officer-user-id',
      extractedFields: {},
      lowConfidenceFields: ['ownerName'],
      save: vi.fn().mockResolvedValue(true),
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
    } as unknown as AuthenticatedRequest;

    const res = createMockResponse();

    await updateRecord(req, res);

    expect(mockFindById).toHaveBeenCalledWith('rec-123');
    expect(mockRecord.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Field updated successfully.',
        recordId: 'rec-123',
        fieldName: 'ownerName',
      }),
    );
  });

  it('forbids an officer from editing another user record', async () => {
    const mockRecord = {
      _id: 'rec-123',
      uploadedBy: 'other-officer-id',
      extractedFields: {},
      save: vi.fn(),
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
    } as unknown as AuthenticatedRequest;

    const res = createMockResponse();

    await updateRecord(req, res);

    expect(mockFindById).toHaveBeenCalledWith('rec-123');
    expect(mockRecord.save).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden: You can only edit your own records.',
    });
  });

  it('allows a reviewer to edit any record', async () => {
    const mockRecord = {
      _id: 'rec-123',
      uploadedBy: 'officer-user-id',
      extractedFields: {},
      lowConfidenceFields: [],
      save: vi.fn().mockResolvedValue(true),
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
    } as unknown as AuthenticatedRequest;

    const res = createMockResponse();

    await updateRecord(req, res);

    expect(mockFindById).toHaveBeenCalledWith('rec-123');
    expect(mockRecord.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
