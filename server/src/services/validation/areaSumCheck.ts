import { LandRecord } from '../../models/LandRecord';
import { env } from '../../config/env';
import { ValidationFlag } from '@landvision/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AreaSumCheckInput {
  village: string;
  /** Plot area for the CURRENT row — included in the sum.
   *  Pass as a string like "1.85 hectares" or a number. */
  currentPlotArea?: string | number | null;
  /** Optional override for the village area limit (hectares).
   *  Falls back to env.VILLAGE_AREA_LIMIT_HECTARES (default 500). */
  villageAreaLimit?: number;
  /** The record id of the current row (so we don't double-count it when
   *  it has already been saved). */
  excludeRecordId?: string;
  /** The documentId of the current row (so we can also sum just the rows
   *  belonging to this document, if needed for a future rule). */
  documentId?: string | null;
}

export interface AreaSumCheckResult {
  flags: ValidationFlag[];
  /** Total area (hectares) summed across the village — including the
   *  current row's contribution. Useful for the UI. */
  totalArea: number;
  /** The limit used for the comparison. */
  limit: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sprint C — per-row area-sum check.
 *
 * Sums `plotArea` (in hectares) across ALL records for the given village
 * (regardless of documentId — the meaning is unchanged from the original
 * implementation), INCLUDING the current row's contribution passed in
 * `currentPlotArea`. Returns a structured `AreaSumCheckResult` with flags
 * when the sum exceeds the configured limit.
 *
 * - 'exceeds_village_total' (severity error)  — total > limit
 * - 'near_village_total'     (severity warning) — total > 80% of limit
 *
 * The numeric prefix is extracted from strings like "2.5 hectare" /
 * "1.85 हेक्टेयर" / "0.5 ha" — anything that starts with a number.
 */
export async function checkAreaSumFlags(
  input: AreaSumCheckInput,
): Promise<AreaSumCheckResult> {
  const limit =
    input.villageAreaLimit !== undefined
      ? input.villageAreaLimit
      : env.VILLAGE_AREA_LIMIT_HECTARES;

  try {
    const flags: ValidationFlag[] = [];

    // -------------------------------------------------------------------
    // Query all existing extracted rows for this village with a non-null
    // plotArea. We sum across documents (the rule is village-level).
    // -------------------------------------------------------------------
    const query: Record<string, unknown> = {
      village: { $regex: escapeRegex(input.village), $options: 'i' },
      // Use $nin to express "not null and not empty string" — combining
      // two `$ne` keys in the same literal triggers TS1117.
      'extractedFields.plotArea.value': { $exists: true, $nin: [null, ''] },
    };
    if (input.excludeRecordId) {
      query._id = { $ne: input.excludeRecordId };
    }

    const records = await LandRecord.find(query).lean();

    let totalArea = 0;
    for (const record of records as any[]) {
      const plotAreaStr = record.extractedFields?.plotArea?.value;
      const n = parsePlotArea(plotAreaStr);
      if (n !== null) {
        totalArea += n;
      }
    }

    // Add the current row's contribution (the row may not be saved yet).
    if (input.currentPlotArea !== undefined && input.currentPlotArea !== null) {
      const n = parsePlotArea(input.currentPlotArea);
      if (n !== null) {
        totalArea += n;
      }
    }

    if (totalArea > limit) {
      flags.push({
        rule: 'exceeds_village_total',
        severity: 'error',
        message:
          `Village "${input.village}" total area (${totalArea.toFixed(2)} ha) ` +
          `exceeds the configured limit (${limit} ha).`,
        field: 'plotArea',
      });
      console.warn(
        `[Validation] Village "${input.village}" total area (${totalArea}) ` +
        `exceeds limit (${limit}) [env: VILLAGE_AREA_LIMIT_HECTARES]`,
      );
    } else if (totalArea > limit * 0.8) {
      // Soft warning at 80% capacity — surfaces in the UI but does NOT
      // force needs_review on its own.
      flags.push({
        rule: 'near_village_total',
        severity: 'warning',
        message:
          `Village "${input.village}" total area (${totalArea.toFixed(2)} ha) ` +
          `is above 80% of the configured limit (${limit} ha).`,
        field: 'plotArea',
      });
    }

    return { flags, totalArea, limit };
  } catch (error) {
    console.error('[Validation] Area sum check error:', error);
    return {
      flags: [
        {
          rule: 'area_check_error',
          severity: 'warning',
          message: `Area sum check failed: ${(error as Error).message}`,
        },
      ],
      totalArea: 0,
      limit,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the leading numeric value from a plot-area string.
 *
 * Accepts:
 *   "2.5 hectare"  → 2.5
 *   "1.85 hectares" → 1.85
 *   "0.5 ha"       → 0.5
 *   "1.85 हेक्टेयर"  → 1.85
 *   "3"            → 3
 *   "3.0"          → 3.0
 *
 * Returns null when no leading number is found.
 */
export function parsePlotArea(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const s = String(value).trim();
  if (!s) return null;
  const m = s.match(/^([\d.]+)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Legacy shims
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `checkAreaSumFlags()` which returns structured flags
 * + the total. This thin shim is kept for backward compatibility with
 * old callers that expect a flat `string[]`.
 */
export async function checkAreaSum(
  village: string,
  villageAreaLimit?: number,
  excludeRecordId?: string,
): Promise<string[]> {
  const result = await checkAreaSumFlags({
    village,
    villageAreaLimit,
    excludeRecordId,
  });
  return result.flags.map((f) => f.rule);
}

/**
 * Legacy function for backward compatibility (placeholder)
 */
export const verifyAreaSum = async (record: any): Promise<boolean> => {
  console.log(`[Validation Service] Running Area Sum Check for record in village: ${record.village}`);
  return record.areaTotal > 0;
};

export default {
  checkAreaSumFlags,
  checkAreaSum,
  verifyAreaSum,
  parsePlotArea,
};
