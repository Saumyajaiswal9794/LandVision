import { Schema, model, Document } from 'mongoose';
import { LandRecord as ILandRecord } from '@landvision/types';

export interface LandRecordDocument extends Omit<ILandRecord, 'id'>, Document {}

// Field with confidence score (used for Sprint 2 extraction)
const ExtractedFieldValueSchema = new Schema({
  value: { type: String, default: null },
  confidence: { type: Number, default: 0 },
});

// Legacy extracted field (from earlier schema versions)
const ExtractedFieldSchema = new Schema({
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
});

const LandRecordSchema = new Schema<LandRecordDocument>(
  {
    // Sprint 1: Upload metadata
    filename: { type: String, default: null },
    uploadedBy: { type: String, default: null },
    storagePath: { type: String, default: null }, // Raw Supabase Storage object path (for URL regeneration)
    storageUrl: { type: String, default: null },  // Signed download URL (expires after 1 hour)

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

    // Sprint 2: AI Extraction (Gemini/Tesseract)
    extractedFields: {
      ownerName: ExtractedFieldValueSchema,
      khasraNumber: ExtractedFieldValueSchema,
      plotArea: ExtractedFieldValueSchema,
      village: ExtractedFieldValueSchema,
      district: ExtractedFieldValueSchema,
      landClass: ExtractedFieldValueSchema,
    },
    extractionSource: {
      type: String,
      enum: ['gemini', 'tesseract'],
      default: null,
    },

    // Legacy extracted fields (for compatibility)
    legacyExtractedFields: [ExtractedFieldSchema],
    confidenceScore: {
      ocrOverall: { type: Number, default: null },
      llmOverall: { type: Number, default: null },
      combined: { type: Number, default: null },
    },

    // Sprint 2: Validation & Routing
    validationFlags: [{ type: String }], // e.g., ["duplicate_detected", "exceeds_village_total"]
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    gisPlotId: { type: String, default: null },

    // Status: updated enum with Sprint 2 + Sprint 3 states
    status: {
      type: String,
      enum: [
        'uploaded',           // Sprint 1: file uploaded to storage
        'extracting',         // Sprint 2: AI extraction in progress
        'extracted',          // Sprint 2: extraction succeeded
        'extraction_failed',  // Sprint 2: extraction failed
        'needs_review',       // Sprint 2: low confidence or validation flags
        'auto_approved',      // Sprint 2: high confidence, no issues
        'reviewed_approved',  // Sprint 3: reviewer approved (possibly after edits)
        'reviewed_rejected',  // Sprint 3: reviewer rejected
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
      // Mongoose's typing for `ret` here is a complex union that doesn't reliably
      // include `_id` / `id` accessors, which previously produced TS2339/TS18046.
      // Cast `ret` to a precise record type so the transform body type-checks
      // without resorting to `as any` or `@ts-ignore`.
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

export const LandRecord = model<LandRecordDocument>('LandRecord', LandRecordSchema);
export default LandRecord;
