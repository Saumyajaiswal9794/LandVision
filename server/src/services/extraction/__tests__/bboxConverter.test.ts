import { describe, it, expect } from 'vitest';
import {
  geminiBoxToBoundingBox,
  geminiBoxMapToBoundingBoxMap,
  GEMINI_BOX_SCALE,
} from '../bboxConverter';
import { BoundingBox } from '@landvision/types';

describe('geminiBoxToBoundingBox', () => {
  it('converts a canonical Gemini box_2d into a normalised BoundingBox', () => {
    // [ymin, xmin, ymax, xmax] = [100, 200, 300, 600] on a 1000x1000 grid.
    // Expected: x=0.2, y=0.1, w=0.4, h=0.2
    const result = geminiBoxToBoundingBox([100, 200, 300, 600]);
    expect(result).not.toBeNull();
    expect(result as BoundingBox).toEqual({
      x: 0.2,
      y: 0.1,
      width: 0.4,
      height: 0.2,
    });
  });

  it('returns null for missing or malformed input', () => {
    expect(geminiBoxToBoundingBox(null)).toBeNull();
    expect(geminiBoxToBoundingBox(undefined)).toBeNull();
    expect(geminiBoxToBoundingBox([])).toBeNull();
    expect(geminiBoxToBoundingBox([1, 2, 3])).toBeNull(); // only 3 entries
    expect(geminiBoxToBoundingBox({} as never)).toBeNull();
  });

  it('clamps out-of-range values to [0, GEMINI_BOX_SCALE]', () => {
    // Negative values and >1000 values should be clamped, not rejected.
    const result = geminiBoxToBoundingBox([-50, 0, 1500, 500]);
    expect(result).not.toBeNull();
    expect(result as BoundingBox).toEqual({
      x: 0,
      y: 0,
      width: 0.5,
      height: 1.0,
    });
  });

  it('handles the full-image box [0,0,1000,1000] correctly', () => {
    const result = geminiBoxToBoundingBox([0, 0, 1000, 1000]);
    expect(result).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('produces a zero-size bbox when ymin==ymax and xmin==xmax', () => {
    const result = geminiBoxToBoundingBox([500, 500, 500, 500]);
    expect(result).toEqual({ x: 0.5, y: 0.5, width: 0, height: 0 });
  });

  it('swaps inverted corners so width/height are always non-negative', () => {
    // Model noise: returns [ymax, xmax, ymin, xmin] for the same box as the
    // first test. We expect the same output as the canonical input.
    const result = geminiBoxToBoundingBox([300, 600, 100, 200]);
    expect(result).toEqual({ x: 0.2, y: 0.1, width: 0.4, height: 0.2 });
  });

  it('treats non-numeric entries as 0 instead of NaN', () => {
    const result = geminiBoxToBoundingBox([NaN, 'abc' as unknown as number, 500, 500]);
    expect(result).toEqual({ x: 0, y: 0, width: 0.5, height: 0.5 });
  });

  it('attaches pageNo when provided', () => {
    const result = geminiBoxToBoundingBox([0, 0, 500, 500], 3);
    expect(result).toEqual({ x: 0, y: 0, width: 0.5, height: 0.5, pageNo: 3 });
  });

  it('omits pageNo when the value is undefined or non-positive', () => {
    expect(geminiBoxToBoundingBox([0, 0, 100, 100])).not.toHaveProperty('pageNo');
    expect(geminiBoxToBoundingBox([0, 0, 100, 100], 0)).not.toHaveProperty('pageNo');
    expect(geminiBoxToBoundingBox([0, 0, 100, 100], -1)).not.toHaveProperty('pageNo');
  });

  it('uses GEMINI_BOX_SCALE constant = 1000', () => {
    expect(GEMINI_BOX_SCALE).toBe(1000);
  });
});

describe('geminiBoxMapToBoundingBoxMap', () => {
  it('returns an empty object for null/undefined input', () => {
    expect(geminiBoxMapToBoundingBoxMap(null)).toEqual({});
    expect(geminiBoxMapToBoundingBoxMap(undefined)).toEqual({});
  });

  it('converts each field independently, preserving keys', () => {
    const result = geminiBoxMapToBoundingBoxMap({
      ownerName: [100, 100, 200, 200],
      village: [0, 0, 500, 500],
      unknown: null,
    });
    expect(result.ownerName).toEqual({ x: 0.1, y: 0.1, width: 0.1, height: 0.1 });
    expect(result.village).toEqual({ x: 0, y: 0, width: 0.5, height: 0.5 });
    expect(result.unknown).toBeNull();
  });

  it('attaches pageNo to every converted box', () => {
    const result = geminiBoxMapToBoundingBoxMap(
      {
        a: [0, 0, 100, 100],
        b: [200, 200, 300, 300],
      },
      2,
    );
    expect(result.a).toHaveProperty('pageNo', 2);
    expect(result.b).toHaveProperty('pageNo', 2);
  });
});
