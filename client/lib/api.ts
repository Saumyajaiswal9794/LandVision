import { LandRecord, DocumentUploadResponse, ValidationFlag, BoundingBox } from '@landvision/types';
import { supabase } from './supabaseClient';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Sprint D: typed response shapes
// ---------------------------------------------------------------------------

/** A single extracted field as returned by the API. */
export interface ExtractedFieldValue {
  value: string | null;
  confidence: number;
  source?: 'gemini' | 'tesseract' | 'human_corrected';
  bbox?: BoundingBox;
  rawText?: string;
}

/** One row of a document — a LandRecord child belonging to a document. */
export interface DocumentRow {
  recordId: string;
  documentId: string | null;
  rowIndex: number | null;
  pageNo: number | null;
  filename: string | null;
  village: string;
  district: string;
  extractedFields: Record<string, ExtractedFieldValue>;
  extractionSource: 'gemini' | 'tesseract' | null;
  validationFlags: string[];
  validationResults: ValidationFlag[];
  lowConfidenceFields: string[];
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The full document detail returned by GET /api/documents/:id. */
export interface DocumentDetail {
  recordId: string;
  filename: string;
  village: string;
  district: string;
  tehsil?: string | null;
  state?: string | null;
  owners?: string[];
  areaTotal?: number | null;
  areaUnit?: string | null;
  documentId?: string | null;
  khataNumber?: string | null;
  khasraNumber?: string | null;
  khatoniNumber?: string | null;
  extractedFields: Record<string, ExtractedFieldValue>;
  extractionSource: string | null;
  validationFlags: string[];
  validationResults?: ValidationFlag[];
  lowConfidenceFields?: string[];
  status: string;
  storageUrl: string | null;
  storagePath?: string | null;
  uploadedBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  extractionError: string | null;
  createdAt: string;
  updatedAt: string;
  /** Sprint D: all child rows belonging to this document. */
  rows?: DocumentRow[];
}

/** Document summary item from GET /api/documents. */
export interface DocumentListItem {
  recordId: string;
  filename: string;
  village: string;
  district: string;
  status: string;
  extractionSource?: string | null;
  createdAt: string;
}

/** Body for PATCH /api/documents/:id/review — per-row and per-doc review. */
export interface ReviewRequestBody {
  action: 'approve' | 'reject' | 'edit' | 'approve_all_high_confidence';
  correctedFields?: Record<string, string>;
  reason?: string;
  /** Sprint D: when set, the action applies to a specific row LandRecord
   *  instead of the document itself. */
  rowId?: string;
}

class ApiClient {
  private async getAuthToken(): Promise<string | null> {
    try {
      if (!supabase) return null;
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token || null;
    } catch {
      return null;
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = await this.getAuthToken();

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> | undefined),
    };

    // Only set Content-Type for non-FormData requests
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    // Add authorization token if available
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async getProfile(): Promise<unknown> {
    return this.request('/api/auth/profile');
  }

  async uploadDocument(formData: FormData): Promise<DocumentUploadResponse> {
    return this.request('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });
  }

  // Sprint D: typed list records — supports ?documentId=... filter.
  async listRecords(filter?: { documentId?: string; status?: string }): Promise<{ records: DocumentRow[]; total: number }> {
    const params = new URLSearchParams();
    if (filter?.documentId) params.set('documentId', filter.documentId);
    if (filter?.status) params.set('status', filter.status);
    const qs = params.toString();
    return this.request(`/api/records${qs ? `?${qs}` : ''}`);
  }

  // Sprint D: typed getRecord.
  async getRecord(id: string): Promise<DocumentRow> {
    return this.request(`/api/records/${id}`);
  }

  /**
   * Sprint D: PATCH /api/records/:id — edit a single field of a row.
   * Sets source=human_corrected, confidence=1.0, removes the field from
   * lowConfidenceFields.
   */
  async updateRecordField(id: string, fieldName: string, value: string): Promise<{
    message: string;
    recordId: string;
    fieldName: string;
    extractedFields: Record<string, ExtractedFieldValue>;
    lowConfidenceFields: string[];
  }> {
    return this.request(`/api/records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ fieldName, value }),
    });
  }

  // Legacy — kept for any caller that passes a partial LandRecord.
  async updateRecord(id: string, updates: Partial<LandRecord>): Promise<LandRecord> {
    return this.request(`/api/records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // Sprint 3: List documents (role-filtered)
  async listDocuments(statusFilter?: string): Promise<{ documents: DocumentListItem[] }> {
    let endpoint = '/api/documents';
    if (statusFilter) {
      endpoint += `?status=${encodeURIComponent(statusFilter)}`;
    }
    return this.request(endpoint);
  }

  // Sprint 3 + Sprint D: Get full document detail (now includes rows[])
  async getDocumentDetail(id: string): Promise<DocumentDetail> {
    return this.request(`/api/documents/${id}`);
  }

  // Sprint 3 + Sprint D: Review document / row (reviewer-only)
  async reviewDocument(id: string, body: ReviewRequestBody): Promise<any> {
    return this.request(`/api/documents/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }
}

export const api = new ApiClient();
export default api;
