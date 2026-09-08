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
    validationFlags?: string[];
    reviewedBy?: string | null;
    reviewedAt?: Date | null;
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
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export interface GISPlotData {
    plotId: string;
    khasraNumber: string;
    village: string;
    district: string;
    geometry?: Record<string, unknown>;
}
//# sourceMappingURL=index.d.ts.map