// Core types for LandVision project

// ---------------------------------------------------------------------------
// Bounding box — coordinates normalised 0-1 relative to the source image.
// ---------------------------------------------------------------------------
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 1-based page number the bbox belongs to (for multi-page documents). */
  pageNo?: number;
}

// ---------------------------------------------------------------------------
// Generic extracted field — wraps any value with provenance metadata.
// ---------------------------------------------------------------------------
export interface ExtractedField<T = string | null> {
  value: T;
  confidence: number;
  source?: 'gemini' | 'tesseract' | 'human_corrected';
  bbox?: BoundingBox;
  rawText?: string;
}

// ---------------------------------------------------------------------------
// Backward-compatible alias used by the existing Sprint 2 pipeline.
// The Sprint 2 code writes `{ value, confidence, source? }` — that shape is
// a subset of `ExtractedField<string | null>`, so the alias type-checks.
// ---------------------------------------------------------------------------
export type ExtractedFieldValue = ExtractedField<string | null>;

// ---------------------------------------------------------------------------
// Co-owner entry (for jointly-held plots).
// ---------------------------------------------------------------------------
export interface CoOwner {
  name: string;
  share?: string;
}

// ---------------------------------------------------------------------------
// Mutation history entry (transfer / inheritance / partition records).
// ---------------------------------------------------------------------------
export interface MutationHistoryEntry {
  mutationNo?: string;
  date?: string;
  type?: string;
  from?: string;
  to?: string;
}

// ---------------------------------------------------------------------------
// Main LandRecord interface.
// ---------------------------------------------------------------------------
export interface LandRecord {
  id: string;
  filename: string;
  village: string;
  district: string;
  uploadedBy: string;
  storagePath: string | null;
  storageUrl: string;

  // Sprint 2+3: expanded status enum
  status:
    | 'uploaded'
    | 'ocr_done'
    | 'extracting'
    | 'extracted'
    | 'extraction_failed'
    | 'needs_review'
    | 'auto_approved'
    | 'reviewed'
    | 'reviewed_approved'
    | 'reviewed_rejected';
  createdAt: Date;

  // --- Original schema fields (populated by batch imports / pre-Sprint-2 data) -
  documentId?: string | null;
  khataNumber?: string | null;
  khasraNumber?: string | null;
  khatoniNumber?: string | null;
  owners?: string[];
  areaTotal?: number | null;
  areaUnit?: 'HECTARE' | 'ACRE' | 'BIGHA' | 'KILLA' | 'MARLA' | null;
  tehsil?: string | null;
  state?: string | null;
  gisPlotId?: string | null;

  // --- New multi-row / extended fields (Step 1 upgrade) --------------------
  /** Sub-survey / sub-division number within a khasra. */
  subSurveyNumber?: string | null;
  /** Father's or husband's name (common identifier in Indian land records). */
  fatherOrHusbandName?: string | null;
  /** Co-owners for jointly-held plots. */
  coOwners?: CoOwner[];
  /** Historical mutation (transfer) entries. */
  mutationHistory?: MutationHistoryEntry[];
  /** Free-text remarks attached to the record. */
  remarks?: string | null;
  /** 1-based page number within the source document this record came from. */
  pageNo?: number | null;
  /** 0-based row index when multiple plot rows are extracted from a single page. */
  rowIndex?: number | null;

  // Sprint 2: AI extraction fields
  extractedFields?: {
    ownerName?: ExtractedField<string | null>;
    khasraNumber?: ExtractedField<string | null>;
    plotArea?: ExtractedField<string | null>;
    village?: ExtractedField<string | null>;
    district?: ExtractedField<string | null>;
    landClass?: ExtractedField<string | null>;
    // New extraction targets
    khataNumber?: ExtractedField<string | null>;
    tehsil?: ExtractedField<string | null>;
    subSurveyNumber?: ExtractedField<string | null>;
    fatherOrHusbandName?: ExtractedField<string | null>;
    remarks?: ExtractedField<string | null>;
  };
  extractionSource?: 'gemini' | 'tesseract' | null;
  extractionError?: string | null;

  // Sprint 2: Validation & Routing
  validationFlags?: string[];
  reviewedBy?: string | null;
  reviewedAt?: Date | null;

  // Legacy fields kept on the schema for backward compatibility with
  // documents imported under earlier schema versions.
  legacyExtractedFields?: LegacyExtractedField[];
  confidenceScore?: {
    ocrOverall?: number | null;
    llmOverall?: number | null;
    combined?: number | null;
  };
}

// ---------------------------------------------------------------------------
// Upload response DTO — unchanged.
// ---------------------------------------------------------------------------
export interface DocumentUploadResponse {
  recordId: string;
  filename: string;
  village: string;
  district: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Legacy extracted field shape (pre-Sprint-2 imports).
// Renamed from `ExtractedField` → `LegacyExtractedField` to free the generic
// name for the new generic wrapper above.
// ---------------------------------------------------------------------------
export interface LegacyExtractedField {
  name: string;
  rawValue: string;
  inferredValue: string | number | string[];
  confidence: number;
  boundingBox: BoundingBox;
}

/**
 * @deprecated Use `LegacyExtractedField` instead.  Kept as a re-export so
 * existing imports of the old name (`ExtractedField` without a generic param)
 * don't break at the call-site level — TypeScript will resolve the branded
 * name to the same structural type.
 *
 * NOTE: In code that previously imported `ExtractedField` to mean the *legacy*
 * shape, callers should migrate to `LegacyExtractedField`.  New code should
 * use `ExtractedField<T>` for the generic per-field wrapper.
 *
 * Because `ExtractedField` is now a generic (`ExtractedField<T>`), old callers
 * that used the non-generic form (`ExtractedField` with no type arg) will get
 * the default `T = string | null`, which is intentionally different from the
 * legacy shape.  To keep those callers compiling during the migration window
 * we provide this explicitly-named alias.
 */

// ---------------------------------------------------------------------------
// Auth / user types — unchanged.
// ---------------------------------------------------------------------------
export type UserRole = 'officer' | 'reviewer' | 'admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

// Sprint 2: Review Queue
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

// Sprint 2: GIS Plot Data
export interface GISPlotData {
  plotId: string;
  khasraNumber: string;
  village: string;
  district: string;
  geometry?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Migration / adapter helpers.
// ---------------------------------------------------------------------------

/**
 * Adapts a "flat" seed-style extracted-field object (`{ value, confidence,
 * source? }`) into the new `ExtractedField<string | null>` shape.  The old
 * shape is already a structural subset, so the function merely narrows the
 * `source` union and adds the missing optional keys with `undefined`.
 *
 * Use this when loading legacy / seeded records into code that expects the
 * full `ExtractedField<T>` type.
 */
export function toExtractedField(
  flat: { value: string | null; confidence: number; source?: string },
): ExtractedField<string | null> {
  return {
    value: flat.value,
    confidence: flat.confidence,
    source: (flat.source as ExtractedField['source']) ?? undefined,
    bbox: undefined,
    rawText: undefined,
  };
}

/**
 * Adapts an entire `extractedFields` object from the legacy flat shape to the
 * new `ExtractedField<string | null>` shape, field-by-field.
 */
export function migrateExtractedFields(
  flat: Record<string, { value: string | null; confidence: number; source?: string }>,
): Record<string, ExtractedField<string | null>> {
  const out: Record<string, ExtractedField<string | null>> = {};
  for (const [key, val] of Object.entries(flat)) {
    out[key] = toExtractedField(val);
  }
  return out;
}
