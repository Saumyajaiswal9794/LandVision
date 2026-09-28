import { Schema, model, Document } from 'mongoose';
import { LandRecord as ILandRecord } from '@landvision/types';

export interface LandRecordDocument extends Omit<ILandRecord, 'id'>, Document {}

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

// Per-field extraction result: value + confidence + provenance metadata.
const ExtractedFieldSchema = new Schema(
  {
    value: { type: String, default: null },
    confidence: { type: Number, default: 0 },
    source: {
      type: String,
      enum: ['gemini', 'tesseract', 'human_corrected'],
      default: null,
    },
    bbox: {
      x: { type: Number },
      y: { type: Number },
      width: { type: Number },
      height: { type: Number },
      pageNo: { type: Number },
    },
    rawText: { type: String, default: null },
  },
  { _id: false },
);

// Co-owner entry (jointly-held plots).
const CoOwnerSchema = new Schema(
  {
    name: { type: String, required: true },
    share: { type: String, default: null },
  },
  { _id: false },
);

// Mutation history entry (transfer / inheritance / partition).
const MutationHistorySchema = new Schema(
  {
    mutationNo: { type: String, default: null },
    date: { type: String, default: null },
    type: { type: String, default: null },
    from: { type: String, default: null },
    to: { type: String, default: null },
  },
  { _id: false },
);

// Legacy extracted field (from earlier schema versions — pre-Sprint-2).
const LegacyExtractedFieldSchema = new Schema(
  {
    name: { type: String, required: true },
    rawValue: { type: String, required: true },
    inferredValue: { type: Schema.Types.Mixed, required: true },
    confidence: { type: Number, required: true },
    boundingBox: {
      x: Number,
      y: Number,
      width: Number,
      height: Number,
    },
  },
  { _id: false },
);

// Sprint C: structured validation flag — { rule, severity, message, field? }.
const ValidationResultSchema = new Schema(
  {
    rule: { type: String, required: true },
    severity: {
      type: String,
      enum: ['error', 'warning', 'info'],
      default: 'warning',
    },
    message: { type: String, required: true },
    field: { type: String, default: null },
  },
  { _id: false },
);

// ---------------------------------------------------------------------------
// Main schema
// ---------------------------------------------------------------------------

const LandRecordSchema = new Schema<LandRecordDocument>(
  {
    // Sprint 1: Upload metadata
    filename: { type: String, default: null },
    uploadedBy: { type: String, default: null },
    storagePath: { type: String, default: null },
    storageUrl: { type: String, default: null },

    // Original schema fields (may be populated by batch imports)
    documentId: { type: String, default: null, index: true },
    khataNumber: { type: String, default: null, index: true },
    khasraNumber: { type: String, default: null, index: true },
    khatoniNumber: { type: String, default: null },
    owners: [{ type: String }],
    areaTotal: { type: Number, default: null },
    areaUnit: {
      type: String,
      enum: ['HECTARE', 'ACRE', 'BIGHA', 'KILLA', 'MARLA'],
      default: null,
    },
    district: { type: String, default: null },
    tehsil: { type: String, default: null },
    village: { type: String, required: true, index: true },
    state: { type: String, default: null },

    // --- New multi-row / extended fields (Step 1 upgrade) ------------------
    subSurveyNumber: { type: String, default: null },
    fatherOrHusbandName: { type: String, default: null },
    coOwners: [CoOwnerSchema],
    mutationHistory: [MutationHistorySchema],
    remarks: { type: String, default: null },
    /** 1-based page number within the source document. */
    pageNo: { type: Number, default: null },
    /** 0-based row index when many rows are extracted from one page. */
    rowIndex: { type: Number, default: null },

    // Sprint 2: AI Extraction (Gemini/Tesseract) — extended field set
    extractedFields: {
      ownerName: ExtractedFieldSchema,
      khasraNumber: ExtractedFieldSchema,
      plotArea: ExtractedFieldSchema,
      village: ExtractedFieldSchema,
      district: ExtractedFieldSchema,
      landClass: ExtractedFieldSchema,
      // New extraction targets
      khataNumber: ExtractedFieldSchema,
      tehsil: ExtractedFieldSchema,
      subSurveyNumber: ExtractedFieldSchema,
      fatherOrHusbandName: ExtractedFieldSchema,
      remarks: ExtractedFieldSchema,
    },
    extractionSource: {
      type: String,
      enum: ['gemini', 'tesseract'],
      default: null,
    },

    // Legacy extracted fields (for compatibility)
    legacyExtractedFields: [LegacyExtractedFieldSchema],
    confidenceScore: {
      ocrOverall: { type: Number, default: null },
      llmOverall: { type: Number, default: null },
      combined: { type: Number, default: null },
    },

    // Sprint 2: Validation & Routing
    validationFlags: [{ type: String }],
    // Sprint C: structured validation flags { rule, severity, message, field? }.
    validationResults: [ValidationResultSchema],
    // Sprint C: list of required-field names below the confidence threshold.
    lowConfidenceFields: [{ type: String }],
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    gisPlotId: { type: String, default: null },

    // Status: updated enum with Sprint 2 + Sprint 3 states
    status: {
      type: String,
      enum: [
        'uploaded',
        'extracting',
        'extracted',
        'extraction_failed',
        'needs_review',
        'auto_approved',
        'reviewed_approved',
        'reviewed_rejected',
      ],
      default: 'uploaded',
      index: true,
    },

    // Error message if extraction failed
    extractionError: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        const r = ret as Record<string, unknown> & { _id: unknown };
        r.id = String(r._id);
        delete r._id;
        delete r.__v;
        return r;
      },
    },
  },
);

// ---------------------------------------------------------------------------
// Compound indexes for multi-row queries and common lookups.
// ---------------------------------------------------------------------------
LandRecordSchema.index({ documentId: 1, rowIndex: 1 });
LandRecordSchema.index({ khasraNumber: 1, village: 1 });

export const LandRecord = model<LandRecordDocument>('LandRecord', LandRecordSchema);
export default LandRecord;
