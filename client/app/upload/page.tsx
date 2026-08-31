'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/card';
import { Button } from '../../components/button';
import { Upload, FileText, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [recordId, setRecordId] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setSuccess(false);
      setError('');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file');
      return;
    }

    if (!village || !district) {
      setError('Please fill in village and district');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Get current session token
      const { data, error: authError } = await supabase.auth.getSession();

      if (authError || !data.session) {
        setError('Not authenticated. Please login again.');
        router.push('/login');
        return;
      }

      const token = data.session.access_token;

      // Prepare FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('village', village);
      formData.append('district', district);

      // Upload to server
      const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 413) {
          setError('File too large. Maximum size is 10MB.');
          return;
        }
        if (response.status === 403) {
          setError('You do not have permission to upload documents. Only officers can upload.');
          return;
        }
        if (response.status === 401) {
          setError('Authentication failed. Please login again.');
          router.push('/login');
          return;
        }

        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || `Upload failed (${response.status})`);
        return;
      }

      const result = await response.json();
      setRecordId(result.recordId);
      setSuccess(true);
      setFile(null);
      setVillage('');
      setDistrict('');
    } catch (err) {
      setError((err as Error).message || 'An error occurred during upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Land Records</h1>
        <p className="text-slate-500 mt-1">
          Upload scanned Khasra, Khata, or Khatoni registers (PDF or image format) to run OCR extraction.
        </p>
      </div>

      <Card>
        <form onSubmit={handleUpload}>
          <CardHeader>
            <CardTitle>Select Document File</CardTitle>
            <CardDescription>
              File must be a high-contrast scan of the record sheet to optimize AI entity extraction.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="border-2 border-dashed border-slate-200 rounded-lg p-10 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100/50 transition-colors relative cursor-pointer">
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={handleFileChange}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-10 h-10 text-slate-400 mb-4" />
              <div className="text-sm font-semibold text-slate-700">
                Drag and drop your scan here, or click to browse
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Supports PDF, JPG, PNG up to 10MB
              </div>
            </div>

            {file && (
              <div className="flex items-center space-x-3 p-3 bg-brand-50 border border-brand-100 rounded-lg">
                <FileText className="w-5 h-5 text-brand-600" />
                <div className="flex-1 text-sm font-medium text-brand-900 truncate">
                  {file.name}
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  disabled={uploading}
                  className="text-xs text-red-500 hover:underline disabled:text-gray-400"
                >
                  Remove
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Village</label>
                <input
                  type="text"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  disabled={uploading}
                  placeholder="e.g., Rampur"
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-500 disabled:bg-gray-100"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">District</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  disabled={uploading}
                  placeholder="e.g., Agra"
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-500 disabled:bg-gray-100"
                  required
                />
              </div>
            </div>

            {success && (
              <div className="flex items-center space-x-3 p-3 bg-green-50 border border-green-100 rounded-lg text-green-800">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div className="text-sm font-medium">
                  Document uploaded successfully! Record ID: {recordId}
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!file || uploading || !village || !district}
            >
              {uploading ? 'Processing Extraction...' : 'Submit and Extract'}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
