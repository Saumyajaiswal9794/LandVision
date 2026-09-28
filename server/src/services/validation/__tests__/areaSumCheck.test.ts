import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the LandRecord model before importing the validator.
vi.mock('../../../models/LandRecord', () => {
  const find = vi.fn();
  return {
    LandRecord: {
      find,
      findOne: vi.fn(),
    },
  };
});

// Mock env so VILLAGE_AREA_LIMIT_HECTARES is deterministic.
vi.mock('../../../config/env', () => ({
  env: {
    VILLAGE_AREA_LIMIT_HECTARES: 500,
    CONFIDENCE_THRESHOLD: 0.75,
  },
}));

import { checkAreaSumFlags, parsePlotArea } from '../areaSumCheck';
import { LandRecord } from '../../../models/LandRecord';

const mockFind = LandRecord.find as unknown as ReturnType<typeof vi.fn>;

function setFindResult(rows: any[]) {
  mockFind.mockReset();
  const cursor = {
    lean: vi.fn().mockResolvedValue(rows),
  };
  mockFind.mockReturnValue(cursor);
}

describe('parsePlotArea', () => {
  it('extracts the leading numeric value', () => {
    expect(parsePlotArea('2.5 hectare')).toBe(2.5);
    expect(parsePlotArea('1.85 hectares')).toBe(1.85);
    expect(parsePlotArea('0.5 ha')).toBe(0.5);
    expect(parsePlotArea('3')).toBe(3);
    expect(parsePlotArea('3.0')).toBe(3.0);
    // Devanagari numerals in the unit suffix still parse because we only
    // extract the leading ASCII numeric portion.
    expect(parsePlotArea('1.85 हेक्टेयर')).toBe(1.85);
  });

  it('returns null for non-numeric strings', () => {
    expect(parsePlotArea('not a number')).toBeNull();
    expect(parsePlotArea('')).toBeNull();
    expect(parsePlotArea(null)).toBeNull();
    expect(parsePlotArea(undefined)).toBeNull();
  });

  it('passes numeric input through unchanged', () => {
    expect(parsePlotArea(2.5)).toBe(2.5);
    expect(parsePlotArea(0)).toBe(0);
  });

  it('rejects NaN', () => {
    expect(parsePlotArea(Number.NaN)).toBeNull();
    expect(parsePlotArea(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('checkAreaSumFlags', () => {
  beforeEach(() => {
    mockFind.mockReset();
  });

  it('flags exceeds_village_total when sum exceeds the limit', async () => {
    // Existing records: 3 records summing to 600 (> 500 limit).
    setFindResult([
      {
        extractedFields: { plotArea: { value: '200 hectare' } },
      },
      {
        extractedFields: { plotArea: { value: '200' } },
      },
      {
        extractedFields: { plotArea: { value: '200' } },
      },
    ]);

    const result = await checkAreaSumFlags({
      village: 'Rampur',
      villageAreaLimit: 500,
    });

    expect(result.totalArea).toBe(600);
    expect(result.flags.length).toBe(1);
    expect(result.flags[0].rule).toBe('exceeds_village_total');
    expect(result.flags[0].severity).toBe('error');
    expect(result.flags[0].field).toBe('plotArea');
  });

  it('flags near_village_total when sum is above 80% but below the limit', async () => {
    setFindResult([
      { extractedFields: { plotArea: { value: '200' } } },
      { extractedFields: { plotArea: { value: '210' } } },
    ]);

    const result = await checkAreaSumFlags({
      village: 'Rampur',
      villageAreaLimit: 500,
    });

    expect(result.totalArea).toBe(410);
    expect(result.flags.length).toBe(1);
    expect(result.flags[0].rule).toBe('near_village_total');
    expect(result.flags[0].severity).toBe('warning');
  });

  it('returns no flags when sum is well below the limit', async () => {
    setFindResult([
      { extractedFields: { plotArea: { value: '100' } } },
      { extractedFields: { plotArea: { value: '100' } } },
    ]);

    const result = await checkAreaSumFlags({
      village: 'Rampur',
      villageAreaLimit: 500,
    });

    expect(result.totalArea).toBe(200);
    expect(result.flags).toEqual([]);
  });

  it('adds the current row\'s plotArea to the sum when passed in', async () => {
    setFindResult([
      { extractedFields: { plotArea: { value: '200' } } },
      { extractedFields: { plotArea: { value: '200' } } },
    ]);

    const result = await checkAreaSumFlags({
      village: 'Rampur',
      villageAreaLimit: 500,
      currentPlotArea: '150 hectares',
    });

    expect(result.totalArea).toBe(550); // 200 + 200 + 150
    expect(result.flags.length).toBe(1);
    expect(result.flags[0].rule).toBe('exceeds_village_total');
  });

  it('skips records whose plotArea cannot be parsed', async () => {
    setFindResult([
      { extractedFields: { plotArea: { value: 'not a number' } } },
      { extractedFields: { plotArea: { value: '100' } } },
    ]);

    const result = await checkAreaSumFlags({
      village: 'Rampur',
      villageAreaLimit: 500,
    });

    expect(result.totalArea).toBe(100);
  });

  it('falls back to env.VILLAGE_AREA_LIMIT_HECTARES when no limit is passed', async () => {
    setFindResult([]);
    const result = await checkAreaSumFlags({ village: 'Rampur' });
    expect(result.limit).toBe(500);
  });

  it('returns a warning flag on internal error', async () => {
    mockFind.mockImplementation(() => {
      throw new Error('DB connection failed');
    });
    const result = await checkAreaSumFlags({
      village: 'Rampur',
      villageAreaLimit: 500,
    });
    expect(result.flags.length).toBe(1);
    expect(result.flags[0].rule).toBe('area_check_error');
    expect(result.flags[0].severity).toBe('warning');
  });
});
