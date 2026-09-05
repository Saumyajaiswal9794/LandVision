// Core types for LandVision project

// Sprint 2 extracted field shape (value + confidence score)
export interface ExtractedFieldValue {
  value: string | null;
  confidence: number;
  source?: string;
}

export interface LandRecord {
  id: string;
  filename: string;
  village: string;
  district: string;
  uploadedBy: string;
  storagePath: string | null;   // Raw Supabase Storage object path (Sprint 2: for URL regeneration)
  storageUrl: string;           // Signed download URL (expires after 1 hour)
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
  // These are defined on the Mongoose schema in `server/src/models/LandRecord.ts`
  // and MUST be present on the shared interface so the schema definition
  // type-checks (TS2353 fires when the schema object literal contains a key
  // the interface doesn't know about).
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

  // Sprint 2: AI extraction fields
  extractedFields?: {
    ownerName?: ExtractedFieldValue;
    khasraNumber?: ExtractedFieldValue;
    plotArea?: ExtractedFieldValue;
    village?: ExtractedFieldValue;
    district?: ExtractedFieldValue;
    landClass?: ExtractedFieldValue;
  };
  extractionSource?: 'gemini' | 'tesseract' | null;
  extractionError?: string | null;

  // Sprint 2: Validation & Routing
  validationFlags?: string[];
  reviewedBy?: string | null;
  reviewedAt?: Date | null;

  // Legacy fields kept on the schema for backward compatibility with
  // documents imported under earlier schema versions. Typed loosely because
  // they are not part of the new extraction pipeline.
  legacyExtractedFields?: ExtractedField[];
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

export interface ExtractedField {
  name: string;
  rawValue: string;
  inferredValue: string | number;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
