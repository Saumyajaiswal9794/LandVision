import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the LandRecord model before importing the validator under test.
// The validator issues ONE SQL-backed duplicate query
// (LandRecord.findDuplicateMatches) and classifies cross-doc / within-doc /
// generic duplicates from the returned rows.
// ---------------------------------------------------------------------------

vi.mock('../../../models/LandRecord', () => ({
  LandRecord: {
    findDuplicateMatches: vi.fn(),
  },
}));

import { detectDuplicateFlags } from '../duplicateDetection';
import { LandRecord } from '../../../models/LandRecord';

const mockFindDuplicateMatches = LandRecord.findDuplicateMatches as unknown as ReturnType<
  typeof vi.fn
>;

function setMatches(rows: any[]) {
  mockFindDuplicateMatches.mockReset();
  mockFindDuplicateMatches.mockResolvedValue(rows);
}

describe('detectDuplicateFlags', () => {
  beforeEach(() => {
    mockFindDuplicateMatches.mockReset();
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
    // The current row (self-row, already saved) plus a row on doc-2.
    setMatches([
      { id: 'other-row', documentId: 'doc-2' },
      { id: 'self-row', documentId: 'doc-1' },
    ]);

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
    setMatches([
      { id: 'self-row', documentId: 'doc-1' },
      { id: 'sibling-row', documentId: 'doc-1' },
    ]);

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
    setMatches([{ id: 'self-row', documentId: 'doc-1' }]);

    const flags = await detectDuplicateFlags({
      khasraNumber: '100/1',
      village: 'Rampur',
      documentId: 'doc-1',
      excludeRecordId: 'self-row',
    });

    expect(flags).toEqual([]);
  });

  it('returns a generic duplicate_detected flag when no documentId is provided', async () => {
    setMatches([{ id: 'other-row', documentId: 'doc-2' }]);

    const flags = await detectDuplicateFlags({
      khasraNumber: '100/1',
      village: 'Rampur',
    });

    expect(flags.length).toBe(1);
    expect(flags[0].rule).toBe('duplicate_detected');
    expect(flags[0].severity).toBe('error');
  });

  it('returns a warning flag on internal error instead of throwing', async () => {
    mockFindDuplicateMatches.mockRejectedValue(new Error('DB connection failed'));

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
    setMatches([
      { id: 'other-row', documentId: 'doc-2' },
      { id: 'self-row', documentId: 'doc-1' },
    ]);

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
