import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the LandRecord model before importing the validator under test.
// ---------------------------------------------------------------------------
// We mock at the module path so the validator's `import { LandRecord }`
// resolves to our mock. Each test configures the mock's `find` return
// value to simulate the desired DB state.

vi.mock('../../../models/LandRecord', () => {
  const find = vi.fn();
  return {
    LandRecord: {
      find,
      // Some legacy callers use `findOne` — keep a stub so accidental
      // calls don't crash.
      findOne: vi.fn(),
    },
  };
});

import { detectDuplicateFlags } from '../duplicateDetection';
import { LandRecord } from '../../../models/LandRecord';

const mockFind = LandRecord.find as unknown as ReturnType<typeof vi.fn>;

// Helper: make `LandRecord.find(...).limit(n).lean()` resolve to `rows`.
function setFindResult(rows: any[]) {
  const cursor = {
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(rows),
  };
  mockFind.mockReset();
  mockFind.mockResolvedValue(rows);
  // Also support the chained .limit().lean() pattern.
  mockFind.mockReturnValue(cursor);
}

describe('detectDuplicateFlags', () => {
  beforeEach(() => {
    mockFind.mockReset();
  });

  it('returns no flags when khasraNumber is null', async () => {
    const flags = await detectDuplicateFlags({
      khasraNumber: null,
      village: 'Rampur',
      documentId: 'doc-1',
    });
    expect(flags).toEqual([]);
  });

  it('returns no flags when village is null', async () => {
    const flags = await detectDuplicateFlags({
      khasraNumber: '100/1',
      village: null,
      documentId: 'doc-1',
    });
    expect(flags).toEqual([]);
  });

  it('flags a cross-document duplicate when another doc has the same khasra+village', async () => {
    // First call (cross-doc query) returns 1 match on a different documentId.
    // Second call (within-doc query) returns 1 match (the current row itself,
    // assuming the row has already been saved).
    let callCount = 0;
    mockFind.mockImplementation(() => {
      callCount++;
      const cursor = {
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(
          callCount === 1
            ? [{ _id: 'other-row', documentId: 'doc-2' }]
            : [{ _id: 'self-row', documentId: 'doc-1' }],
        ),
      };
      return cursor;
    });

    const flags = await detectDuplicateFlags({
      khasraNumber: '100/1',
      subSurveyNumber: '2',
      village: 'Rampur',
      documentId: 'doc-1',
      excludeRecordId: 'self-row',
    });

    expect(flags.length).toBe(1);
    expect(flags[0].rule).toBe('duplicate_detected_cross_doc');
    expect(flags[0].severity).toBe('error');
    expect(flags[0].field).toBe('khasraNumber');
    expect(flags[0].message).toContain('100/1');
  });

  it('flags a within-document duplicate when the same doc has 2+ rows with the same key', async () => {
    let callCount = 0;
    mockFind.mockImplementation(() => {
      callCount++;
      const cursor = {
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(
          callCount === 1
            ? [] // no cross-doc matches
            : [
                { _id: 'self-row', documentId: 'doc-1' },
                { _id: 'sibling-row', documentId: 'doc-1' },
              ], // 2 within-doc matches
        ),
      };
      return cursor;
    });

    const flags = await detectDuplicateFlags({
      khasraNumber: '100/1',
      village: 'Rampur',
      documentId: 'doc-1',
      excludeRecordId: 'self-row',
    });

    expect(flags.length).toBe(1);
    expect(flags[0].rule).toBe('duplicate_detected_within_doc');
    expect(flags[0].severity).toBe('error');
  });

  it('returns no flags when the only match is the current row itself', async () => {
    let callCount = 0;
    mockFind.mockImplementation(() => {
      callCount++;
      const cursor = {
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(
          callCount === 1 ? [] : [{ _id: 'self-row', documentId: 'doc-1' }],
        ),
      };
      return cursor;
    });

    const flags = await detectDuplicateFlags({
      khasraNumber: '100/1',
      village: 'Rampur',
      documentId: 'doc-1',
      excludeRecordId: 'self-row',
    });

    expect(flags).toEqual([]);
  });

  it('returns a generic duplicate_detected flag when no documentId is provided', async () => {
    mockFind.mockImplementation(() => {
      const cursor = {
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([
          { _id: 'other-row', documentId: 'doc-2' },
        ]),
      };
      return cursor;
    });

    const flags = await detectDuplicateFlags({
      khasraNumber: '100/1',
      village: 'Rampur',
    });

    expect(flags.length).toBe(1);
    expect(flags[0].rule).toBe('duplicate_detected');
    expect(flags[0].severity).toBe('error');
  });

  it('returns a warning flag on internal error instead of throwing', async () => {
    mockFind.mockImplementation(() => {
      throw new Error('DB connection failed');
    });

    const flags = await detectDuplicateFlags({
      khasraNumber: '100/1',
      village: 'Rampur',
      documentId: 'doc-1',
    });

    expect(flags.length).toBe(1);
    expect(flags[0].rule).toBe('duplicate_check_error');
    expect(flags[0].severity).toBe('warning');
  });

  it('handles a null subSurveyNumber by matching rows with missing sub-survey', async () => {
    let callCount = 0;
    mockFind.mockImplementation(() => {
      callCount++;
      const cursor = {
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(
          callCount === 1
            ? [{ _id: 'other-row', documentId: 'doc-2' }]
            : [{ _id: 'self-row', documentId: 'doc-1' }],
        ),
      };
      return cursor;
    });

    const flags = await detectDuplicateFlags({
      khasraNumber: '100/1',
      subSurveyNumber: null,
      village: 'Rampur',
      documentId: 'doc-1',
      excludeRecordId: 'self-row',
    });

    // Cross-doc duplicate should fire.
    expect(flags.some((f) => f.rule === 'duplicate_detected_cross_doc')).toBe(true);
  });
});
