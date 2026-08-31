import { LandRecord, DocumentUploadResponse } from '@landvision/types';
import { supabase } from './supabaseClient';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

class ApiClient {
  private async getAuthToken(): Promise<string | null> {
    try {
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
      ...options.headers,
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
      throw new Error(errorData.message || `Request failed with status ${response.status}`);
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

  async listRecords(): Promise<{ records: LandRecord[]; total: number }> {
    return this.request('/api/records');
  }

  async getRecord(id: string): Promise<LandRecord> {
    return this.request(`/api/records/${id}`);
  }

  async updateRecord(id: string, updates: Partial<LandRecord>): Promise<LandRecord> {
    return this.request(`/api/records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }
}

export const api = new ApiClient();
export default api;
