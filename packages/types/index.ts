// Core types for LandVision project

// Sprint 2 extracted field shape (value + confidence score)
export interface ExtractedFieldValue {
  value: string | null;
  confidence: number;
}

export interface LandRecord {
  id: string;
  filename: string;
  village: string;
  district: string;
  uploadedBy: string;
  storagePath: string | null;   // Raw Supabase Storage object path (Sprint 2: for URL regeneration)
  storageUrl: string;           // Signed download URL (expires after 1 hour)
  // Sprint 2: expanded status enum
  status:
    | 'uploaded'
    | 'ocr_done'
    | 'extracting'
    | 'extracted'
    | 'extraction_failed'
    | 'needs_review'
    | 'auto_approved'
    | 'reviewed';
  createdAt: Date;

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
