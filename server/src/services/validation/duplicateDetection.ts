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
    // Single SQL query (Supabase Postgres) returns every row matching the
    // same khasraNumber + village (+ sub-survey, + district scope), excluding
    // the row itself. We then classify cross-doc vs within-doc duplicates.
    // -------------------------------------------------------------------
    const matches = await LandRecord.findDuplicateMatches({
      khasraNumber,
      village,
      subSurveyNumber,
      district: input.district ?? null,
      excludeRecordId: input.excludeRecordId ?? null,
    });

    // 1. Cross-document duplicate check (different documentId).
    if (input.documentId) {
      const crossMatch = matches.find(
        (m: any) => m.documentId && m.documentId !== input.documentId,
      );
      if (crossMatch) {
        const otherDoc = crossMatch.documentId ?? '<unknown>';
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

    // 2. Within-document duplicate check (same documentId, different row).
    if (input.documentId) {
      const withinCount = matches.filter(
        (m: any) => m.documentId === input.documentId &&
          (!input.excludeRecordId || m.id !== input.excludeRecordId),
      ).length;
      // The current row is not yet saved when excludeRecordId is unset, so
      // one matching sibling is enough to flag.
      const threshold = input.excludeRecordId ? 1 : 1;
      if (withinCount >= threshold) {
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
          `appears ${withinCount} time(s) on documentId=${input.documentId}`,
        );
      }
    }

    // 3. Generic check when no documentId was supplied (row not tied to a
    // document): a single other match is enough when the row is not yet
    // saved (no excludeRecordId); otherwise require 2 to be safe.
    if (!input.documentId) {
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


export default {
  detectDuplicateFlags,
  detectDuplicates,
  detectDuplicateRecords,
};
