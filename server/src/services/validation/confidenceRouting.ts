import { env } from '../../config/env';
import { ConvertedRow } from '../extraction/geminiExtract';
import { ValidationFlag } from '@landvision/types';

export type RoutingStatus = 'needs_review' | 'auto_approved';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The 6 required fields whose confidence is checked for routing. */
export const REQUIRED_FIELDS = [
  'ownerName',
  'khasraNumber',
  'plotArea',
  'village',
  'district',
  'landClass',
] as const;

export type RequiredFieldName = (typeof REQUIRED_FIELDS)[number];

export interface RoutingResult {
  status: RoutingStatus;
  /** Names of required fields below the threshold — UI uses this to
   *  highlight only those fields. */
  lowConfidenceFields: string[];
  /** Computed row-level confidence = MIN of required fields' confidence
   *  (0 if any required field is missing). */
  rowConfidence: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sprint C — per-row confidence routing.
 *
 * Computes a row-level confidence = MIN of the 6 required fields'
 * confidence values (0 if any required field is missing or null).
 *
 * Routing decision:
 *   - If any ValidationFlag has severity 'error'  → needs_review
 *   - If rowConfidence < env.CONFIDENCE_THRESHOLD  → needs_review
 *   - If any required field is null/empty         → needs_review
 *   - Otherwise                                     → auto_approved
 *
 * Returns a structured `RoutingResult` with the `lowConfidenceFields`
 * list (names of fields below the threshold) so the UI can highlight
 * only those fields in amber — confident fields are dimmed/collapsed.
 *
 * `validationFlags` here is the new structured shape `ValidationFlag[]`.
 * The legacy `routeByConfidence()` (string[] flags) is preserved as a
 * thin shim below.
 */
export function routeRowByConfidence(
  row: ConvertedRow,
  validationFlags: ValidationFlag[],
  confidenceThreshold: number = env.CONFIDENCE_THRESHOLD,
): RoutingResult {
  // If any structured flag has severity 'error', the row goes to review.
  const hasErrorFlag = validationFlags.some((f) => f.severity === 'error');
  if (hasErrorFlag) {
    const lowConfidenceFields = computeLowConfidenceFields(row, confidenceThreshold);
    const rowConfidence = computeRowConfidence(row);
    console.log(
      `[Routing] Row has ${validationFlags.filter((f) => f.severity === 'error').length} ` +
      `error-severity validation flag(s) → needs_review`,
    );
    return {
      status: 'needs_review',
      lowConfidenceFields,
      rowConfidence,
    };
  }

  // Walk the 6 required fields.
  const lowConfidenceFields: string[] = [];
  let minConfidence = 1.0;

  for (const fieldName of REQUIRED_FIELDS) {
    const field = row[fieldName];
    if (!field) {
      lowConfidenceFields.push(fieldName);
      minConfidence = 0;
      console.log(`[Routing] ${fieldName} missing → needs_review`);
      continue;
    }
    if (field.value === null || field.value === undefined || field.value === '') {
      lowConfidenceFields.push(fieldName);
      minConfidence = 0;
      console.log(`[Routing] ${fieldName} is null/empty (not extracted) → needs_review`);
      continue;
    }
    if (field.confidence < confidenceThreshold) {
      lowConfidenceFields.push(fieldName);
      console.log(
        `[Routing] ${fieldName} confidence (${field.confidence.toFixed(2)}) ` +
        `below threshold (${confidenceThreshold}) → needs_review`,
      );
    }
    if (field.confidence < minConfidence) {
      minConfidence = field.confidence;
    }
  }

  if (lowConfidenceFields.length > 0) {
    return {
      status: 'needs_review',
      lowConfidenceFields,
      rowConfidence: minConfidence,
    };
  }

  console.log(
    `[Routing] All confidence checks passed (row conf ${minConfidence.toFixed(2)}) → auto_approved`,
  );
  return {
    status: 'auto_approved',
    lowConfidenceFields: [],
    rowConfidence: minConfidence,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the names of required fields below the threshold. */
function computeLowConfidenceFields(
  row: ConvertedRow,
  confidenceThreshold: number,
): string[] {
  const out: string[] = [];
  for (const fieldName of REQUIRED_FIELDS) {
    const field = row[fieldName];
    if (!field) {
      out.push(fieldName);
      continue;
    }
    if (
      field.value === null ||
      field.value === undefined ||
      field.value === ''
    ) {
      out.push(fieldName);
      continue;
    }
    if (field.confidence < confidenceThreshold) {
      out.push(fieldName);
    }
  }
  return out;
}

/** Row-level confidence = MIN of the 6 required fields' confidence. */
function computeRowConfidence(row: ConvertedRow): number {
  let min = 1.0;
  for (const fieldName of REQUIRED_FIELDS) {
    const field = row[fieldName];
    if (!field) return 0;
    if (field.confidence < min) min = field.confidence;
  }
  return min;
}

// ---------------------------------------------------------------------------
// Legacy compatibility shims
// ---------------------------------------------------------------------------

/**
 * @deprecated Old single-row API. New code should use `routeRowByConfidence`
 * which returns the structured `RoutingResult` with `lowConfidenceFields`.
 *
 * This shim accepts the legacy `string[]` flag list (no severity info)
 * and treats ANY flag as a reason to route to needs_review.
 */
export function routeByConfidence(
  row: ConvertedRow,
  validationFlags: string[] | ValidationFlag[],
  confidenceThreshold: number = env.CONFIDENCE_THRESHOLD,
): RoutingStatus {
  // Coerce string[] → ValidationFlag[] (each becomes severity 'error').
  const structured: ValidationFlag[] = Array.isArray(validationFlags)
    ? validationFlags.map((f: any) =>
        typeof f === 'string'
          ? { rule: f, severity: 'error' as const, message: f }
          : f,
      )
    : [];
  return routeRowByConfidence(row, structured, confidenceThreshold).status;
}

/**
 * @deprecated Old single-row API. Kept for callers that haven't migrated
 * to the multi-row shape. Wraps `routeByConfidence` on a synthesized row.
 */
export function routeByConfidenceLegacy(
  extractedFields: {
    ownerName?: { value: string | null; confidence: number };
    khasraNumber?: { value: string | null; confidence: number };
    plotArea?: { value: string | null; confidence: number };
    village?: { value: string | null; confidence: number };
    district?: { value: string | null; confidence: number };
    landClass?: { value: string | null; confidence: number };
  },
  validationFlags: string[] | ValidationFlag[],
  confidenceThreshold: number = env.CONFIDENCE_THRESHOLD,
): RoutingStatus {
  const row: ConvertedRow = {
    ownerName: (extractedFields.ownerName as any) ?? { value: null, confidence: 0 },
    khasraNumber: (extractedFields.khasraNumber as any) ?? { value: null, confidence: 0 },
    plotArea: (extractedFields.plotArea as any) ?? { value: null, confidence: 0 },
    village: (extractedFields.village as any) ?? { value: null, confidence: 0 },
    district: (extractedFields.district as any) ?? { value: null, confidence: 0 },
    landClass: (extractedFields.landClass as any) ?? { value: null, confidence: 0 },
  };
  return routeByConfidence(row, validationFlags, confidenceThreshold);
}

/**
 * Legacy async function kept for backward compatibility with old code paths
 * that still call `evaluateConfidenceRoute` on a record.
 */
export const evaluateConfidenceRoute = async (record: any): Promise<boolean> => {
  console.log(
    `[Validation Service] Rating confidence: OCR=${record.confidenceScore?.ocrOverall}, LLM=${record.confidenceScore?.llmOverall}`,
  );
  const CONFIDENCE_THRESHOLD = 0.85;
  return record.confidenceScore?.combined < CONFIDENCE_THRESHOLD;
};

export default {
  routeRowByConfidence,
  routeByConfidence,
  routeByConfidenceLegacy,
  evaluateConfidenceRoute,
  REQUIRED_FIELDS,
};
