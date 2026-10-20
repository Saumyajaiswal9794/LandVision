// server/src/__tests__/queues/extractionQueue.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractionQueue } from '../../queues/extractionQueue.js';

// Mock LandRecord model
vi.mock('../../models/LandRecord.js', () => {
  const mockRecord = {
    _id: 'doc123',
    status: 'uploaded',
    save: vi.fn().mockResolvedValue(undefined),
  };
  return {
    LandRecord: {
      findById: vi.fn().mockImplementation((id: string) => {
        if (id === mockRecord._id) {
          return Promise.resolve(mockRecord as any);
        }
        return Promise.resolve(null);
      }),
    },
    default: {} as any,
  };
});

describe('extractionQueue (in‑memory)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes a job and marks record as extracted', async () => {
    const { LandRecord } = await import('../../models/LandRecord.js');
    const mock = (await LandRecord.findById('doc123')) as any;
    // Ensure initial state
    expect(mock.status).toBe('uploaded');

    await extractionQueue.addJob({ id: 'doc123' });
    // Wait a tick for async processing (in‑memory runs fire‑and‑forget)
    await new Promise((r) => setTimeout(r, 10));

    // After processing, the mocked record should have status updated to 'extracted'
    expect(mock.save).toHaveBeenCalled();
    expect(mock.status).toBe('extracted');
  });
});
