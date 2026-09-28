export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
    /** 1-based page number the bbox belongs to (for multi-page documents). */
    pageNo?: number;
}
export interface ExtractedField<T = string | null> {
    value: T;
    confidence: number;
    source?: 'gemini' | 'tesseract' | 'human_corrected';
    bbox?: BoundingBox;
    rawText?: string;
}
export type ExtractedFieldValue = ExtractedField<string | null>;
export interface CoOwner {
    name: string;
    share?: string;
}
export interface MutationHistoryEntry {
    mutationNo?: string;
    date?: string;
    type?: string;
    from?: string;
    to?: string;
}
export interface LandRecord {
    id: string;
    filename: string;
    village: string;
    district: string;
    uploadedBy: string;
    storagePath: string | null;
    storageUrl: string;
    status: 'uploaded' | 'ocr_done' | 'extracting' | 'extracted' | 'extraction_failed' | 'needs_review' | 'auto_approved' | 'reviewed' | 'reviewed_approved' | 'reviewed_rejected';
    createdAt: Date;
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
    extractedFields?: {
        ownerName?: ExtractedField<string | null>;
        khasraNumber?: ExtractedField<string | null>;
        plotArea?: ExtractedField<string | null>;
        village?: ExtractedField<string | null>;
        district?: ExtractedField<string | null>;
        landClass?: ExtractedField<string | null>;
        khataNumber?: ExtractedField<string | null>;
        tehsil?: ExtractedField<string | null>;
        subSurveyNumber?: ExtractedField<string | null>;
        fatherOrHusbandName?: ExtractedField<string | null>;
        remarks?: ExtractedField<string | null>;
    };
    extractionSource?: 'gemini' | 'tesseract' | null;
    extractionError?: string | null;
    validationFlags?: string[];
    reviewedBy?: string | null;
    reviewedAt?: Date | null;
    legacyExtractedFields?: LegacyExtractedField[];
    confidenceScore?: {
        ocrOverall?: number | null;
        llmOverall?: number | null;
        combined?: number | null;
    };
}
export interface DocumentUploadResponse {
    recordId: string;
    filename: string;
    village: string;
    district: string;
    status: string;
}
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
export type UserRole = 'officer' | 'reviewer' | 'admin';
export interface User {
    id: string;
    email: string;
    role: UserRole;
    createdAt: Date;
}
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export interface GISPlotData {
    plotId: string;
    khasraNumber: string;
    village: string;
    district: string;
    geometry?: Record<string, unknown>;
}
/**
 * Adapts a "flat" seed-style extracted-field object (`{ value, confidence,
 * source? }`) into the new `ExtractedField<string | null>` shape.  The old
 * shape is already a structural subset, so the function merely narrows the
 * `source` union and adds the missing optional keys with `undefined`.
 *
 * Use this when loading legacy / seeded records into code that expects the
 * full `ExtractedField<T>` type.
 */
export declare function toExtractedField(flat: {
    value: string | null;
    confidence: number;
    source?: string;
}): ExtractedField<string | null>;
/**
 * Adapts an entire `extractedFields` object from the legacy flat shape to the
 * new `ExtractedField<string | null>` shape, field-by-field.
 */
export declare function migrateExtractedFields(flat: Record<string, {
    value: string | null;
    confidence: number;
    source?: string;
}>): Record<string, ExtractedField<string | null>>;
//# sourceMappingURL=index.d.ts.map