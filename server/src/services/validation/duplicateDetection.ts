import { LandRecord } from '../../models/LandRecord';
import { ValidationFlag } from '@landvision/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DuplicateCheckInput {
  khasraNumber: string | null;
  subSurveyNumber?: string | null;
  village: string | null;
  /** The document this row belongs to (so we can detect within-document
   *  duplicates as well as cross-document duplicates). */
  documentId?: string | null;
  /** The current row's record id, if already saved (so we don't match
   *  the row against itself). */
  excludeRecordId?: string;
  /** Optional district scope — narrows the cross-document query. */
  district?: string | null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sprint C — per-row duplicate detection.
 *
 * Flags the row as a duplicate if there's another row with the same
 * `khasraNumber + subSurveyNumber + village`:
 *
 *   1. On a DIFFERENT documentId  → 'duplicate_detected_cross_doc' (severity error)
 *   2. On the SAME documentId      → 'duplicate_detected_within_doc' (severity error)
 *
 * The match is case-insensitive on village and exact on khasra/subSurvey
 * (since both are normalised identifiers, not free text). When
 * `subSurveyNumber` is null/empty we still match on khasraNumber+village.
 *
 * @returns Array of `ValidationFlag` objects (empty if no duplicates).
 */
export async function detectDuplicateFlags(
  input: DuplicateCheckInput,
): Promise<ValidationFlag[]> {
  const flags: ValidationFlag[] = [];

  try {
    const khasraNumber = input.khasraNumber?.trim() || null;
    const village = input.village?.trim() || null;

    if (!khasraNumber) {
      // Nothing to deduplicate on — skip silently.
      return flags;
    }
    if (!village) {
      return flags;
    }

    const subSurveyNumber =
      typeof input.subSurveyNumber === 'string' && input.subSurveyNumber.trim().length > 0
        ? input.subSurveyNumber.trim()
        : null;

    // -------------------------------------------------------------------
    // Build the MongoDB query.
    // We match on the per-row extractedFields so duplicates across rows
    // (within the same document OR across documents) are caught.
    // -------------------------------------------------------------------
    const baseQuery: Record<string, unknown> = {
      'extractedFields.khasraNumber.value': khasraNumber,
      'extractedFields.village.value': { $regex: `^${escapeRegex(village)}$`, $options: 'i' },
    };

    if (subSurveyNumber) {
      // Some rows may not have subSurveyNumber extracted at all — only
      // count as a duplicate when the other row has the SAME sub-survey.
      baseQuery['extractedFields.subSurveyNumber.value'] = subSurveyNumber;
    } else {
      // If THIS row has no sub-survey, match rows where sub-survey is
      // missing/empty too (otherwise we'd flag too aggressively).
      baseQuery['$or'] = [
        { 'extractedFields.subSurveyNumber.value': { $exists: false } },
        { 'extractedFields.subSurveyNumber.value': null },
        { 'extractedFields.subSurveyNumber.value': '' },
      ];
    }

    // Optional district scope — prevents cross-district false positives.
    if (input.district) {
      baseQuery['extractedFields.district.value'] = {
        $regex: `^${escapeRegex(input.district)}$`,
        $options: 'i',
      };
    }

    // Exclude the row itself if we already have its _id.
    if (input.excludeRecordId) {
      baseQuery._id = { $ne: input.excludeRecordId };
    }

    // -------------------------------------------------------------------
    // 1. Cross-document duplicate check (different documentId).
    // -------------------------------------------------------------------
    if (input.documentId) {
      const crossDocQuery: Record<string, unknown> = {
        ...baseQuery,
        // Match rows whose documentId is set AND is not the current
        // row's documentId. `$nin: [null, input.documentId]` is cleaner
        // than combining `$ne: x` with `$ne: null` because the latter
        // triggers TS1117 (duplicate keys in the same object literal).
        documentId: { $exists: true, $nin: [null, input.documentId] },
      };

      const crossMatches = await LandRecord.find(crossDocQuery).limit(1).lean();
      if (crossMatches.length > 0) {
        const m = crossMatches[0] as any;
        const otherDoc = m.documentId ?? '<unknown>';
        flags.push({
          rule: 'duplicate_detected_cross_doc',
          severity: 'error',
          message:
            `Plot "${khasraNumber}${subSurveyNumber ? `/${subSurveyNumber}` : ''}" ` +
            `in village "${village}" already exists on a different document (${otherDoc}).`,
          field: 'khasraNumber',
        });
        console.warn(
          `[Validation] Duplicate (cross-doc): khasra="${khasraNumber}" ` +
          `subSurvey="${subSurveyNumber ?? '-'}" village="${village}" ` +
          `on documentId=${input.documentId} → matches documentId=${otherDoc}`,
        );
      }
    }

    // -------------------------------------------------------------------
    // 2. Within-document duplicate check (same documentId, different row).
    // -------------------------------------------------------------------
    if (input.documentId) {
      const withinDocQuery: Record<string, unknown> = {
        ...baseQuery,
        documentId: input.documentId,
      };

      const withinMatches = await LandRecord.find(withinDocQuery).limit(2).lean();
      // `withinMatches` may include the current row itself (when called
      // AFTER the row is saved). We need at least 2 matches (the current
      // row + at least one sibling) to flag a within-doc duplicate.
      if (withinMatches.length >= 2) {
        flags.push({
          rule: 'duplicate_detected_within_doc',
          severity: 'error',
          message:
            `Plot "${khasraNumber}${subSurveyNumber ? `/${subSurveyNumber}` : ''}" ` +
            `appears more than once on this document.`,
          field: 'khasraNumber',
        });
        console.warn(
          `[Validation] Duplicate (within-doc): khasra="${khasraNumber}" ` +
          `subSurvey="${subSurveyNumber ?? '-'}" village="${village}" ` +
          `appears ${withinMatches.length}+ times on documentId=${input.documentId}`,
        );
      }
    } else {
      // No documentId supplied — just run a single global match query.
      const matches = await LandRecord.find(baseQuery).limit(2).lean();
      // If we get 2+ matches AND excludeRecordId was supplied, that means
      // at least one other row exists with the same key (dedupe case).
      // If excludeRecordId was NOT supplied (row not yet saved), even a
      // single match indicates a duplicate.
      const threshold = input.excludeRecordId ? 2 : 1;
      if (matches.length >= threshold) {
        flags.push({
          rule: 'duplicate_detected',
          severity: 'error',
          message:
            `Plot "${khasraNumber}${subSurveyNumber ? `/${subSurveyNumber}` : ''}" ` +
            `in village "${village}" already exists.`,
          field: 'khasraNumber',
        });
        console.warn(
          `[Validation] Duplicate: khasra="${khasraNumber}" ` +
          `village="${village}" (${matches.length} match(es))`,
        );
      }
    }

    return flags;
  } catch (error) {
    console.error('[Validation] Duplicate detection error:', error);
    return [
      {
        rule: 'duplicate_check_error',
        severity: 'warning',
        message: `Duplicate check failed: ${(error as Error).message}`,
      },
    ];
  }
}

/**
 * @deprecated Use `detectDuplicateFlags()` which returns structured
 * `ValidationFlag[]`. This thin shim is kept for backward compatibility
 * with old callers that expect a flat `string[]`.
 */
export async function detectDuplicates(
  khasraNumber: string | null,
  village: string,
  excludeRecordId?: string,
  district?: string,
): Promise<string[]> {
  const flags = await detectDuplicateFlags({
    khasraNumber,
    village,
    excludeRecordId,
    district,
  });
  return flags.map((f) => f.rule);
}

/**
 * Legacy function for backward compatibility (placeholder).
 */
export const detectDuplicateRecords = async (record: any): Promise<boolean> => {
  console.log(`[Validation Service] Checking duplicates for Khasra: ${record.khasraNumber}`);
  return false;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default {
  detectDuplicateFlags,
  detectDuplicates,
  detectDuplicateRecords,
};
