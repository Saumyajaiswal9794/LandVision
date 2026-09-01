'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/card';
import { Button } from '../../../components/button';
import { ArrowLeft, Check, X, Save, AlertTriangle, Loader2, ShieldCheck, ShieldX, ImageOff } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ExtractedFieldValue {
  value: string | null;
  confidence: number;
  source?: string;
}

interface DocumentDetail {
  recordId: string;
  filename: string;
  village: string;
  district: string;
  tehsil: string | null;
  state: string | null;
  owners: string[];
  areaTotal: number | null;
  areaUnit: string | null;
  documentId: string | null;
  khataNumber: string | null;
  khasraNumber: string | null;
  khatoniNumber: string | null;
  extractedFields: Record<string, ExtractedFieldValue>;
  extractionSource: string | null;
  validationFlags: string[];
  status: string;
  storageUrl: string | null;
  uploadedBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  extractionError: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  uploaded:          { label: 'Uploaded',          className: 'bg-slate-100 text-slate-700 border-slate-200' },
  extracting:        { label: 'Extracting',        className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  extracted:         { label: 'Extracted',         className: 'bg-blue-100 text-blue-800 border-blue-300' },
  extraction_failed: { label: 'Extraction Failed', className: 'bg-red-100 text-red-800 border-red-300' },
  needs_review:      { label: 'Needs Review',      className: 'bg-orange-100 text-orange-800 border-orange-300' },
  auto_approved:     { label: 'Auto Approved',     className: 'bg-green-100 text-green-800 border-green-300' },
  reviewed_approved: { label: 'Reviewed Approved', className: 'bg-teal-100 text-teal-800 border-teal-300' },
  reviewed_rejected: { label: 'Reviewed Rejected', className: 'bg-red-100 text-red-800 border-red-300' },
};

const FIELD_LABELS: Record<string, string> = {
  ownerName: 'Owner Name',
  khasraNumber: 'Khasra Number',
  plotArea: 'Plot Area',
  village: 'Village',
  district: 'District',
  landClass: 'Land Class',
};

const FLAG_LABELS: Record<string, string> = {
  duplicate_detected: 'Duplicate detected',
  exceeds_village_total: 'Exceeds village area limit',
};

function confidenceColor(confidence: number): string {
  if (confidence > 0.85) return 'text-green-600';
  if (confidence >= 0.6) return 'text-yellow-600';
  return 'text-red-600';
}

function confidenceBg(confidence: number): string {
  if (confidence > 0.85) return 'bg-green-50';
  if (confidence >= 0.6) return 'bg-yellow-50';
  return 'bg-red-50';
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [role, setRole] = useState<'officer' | 'reviewer' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  // Editable field copies (only used when reviewer + needs_review)
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const canReview = role === 'reviewer' && doc?.status === 'needs_review';

  const fetchDocument = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      if (!supabase) {
        router.push('/login');
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        router.push('/login');
        return;
      }

      const token = sessionData.session.access_token;
      const userRole = sessionData.session.user?.user_metadata?.role;
      setRole(userRole || null);

      const res = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.status === 404) {
        setError('Document not found.');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to fetch document (${res.status})`);
      }

      const data = await res.json();
      setDoc(data);

      // Initialize editable fields from extracted fields
      const initial: Record<string, string> = {};
      if (data.extractedFields) {
        for (const [key, field] of Object.entries(data.extractedFields)) {
          initial[key] = (field as ExtractedFieldValue).value || '';
        }
      }
      setEditedFields(initial);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  const handleFieldChange = (fieldName: string, value: string) => {
    setEditedFields((prev) => ({ ...prev, [fieldName]: value }));
  };

  const getAuthToken = async (): Promise<string | null> => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  };

  const handleApprove = async () => {
    setActionLoading(true);
    setActionMessage('');
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/documents/${id}/review`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Approval failed');
      }
      setActionMessage('Document approved successfully.');
      fetchDocument();
    } catch (err) {
      setActionMessage(`Error: ${(err as Error).message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    setActionMessage('');
    try {
      const token = await getAuthToken();
      const body: any = { action: 'reject' };
      if (rejectReason.trim()) body.reason = rejectReason.trim();
      const res = await fetch(`${API_BASE_URL}/api/documents/${id}/review`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Rejection failed');
      }
      setActionMessage('Document rejected.');
      setShowRejectModal(false);
      fetchDocument();
    } catch (err) {
      setActionMessage(`Error: ${(err as Error).message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveCorrections = async () => {
    setActionLoading(true);
    setActionMessage('');
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/documents/${id}/review`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'edit', correctedFields: editedFields }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save corrections');
      }
      setActionMessage('Corrections saved and document approved.');
      fetchDocument();
    } catch (err) {
      setActionMessage(`Error: ${(err as Error).message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-3" />
        Loading document...
      </div>
    );
  }

  if (error && !doc) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>
      </div>
    );
  }

  if (!doc) return null;

  const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.uploaded;

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{doc.filename}</h1>
            <p className="text-slate-500 text-sm mt-0.5">{doc.village}, {doc.district}</p>
          </div>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusCfg.className}`}>
          {statusCfg.label}
        </span>
      </div>

      {/* Action message */}
      {actionMessage && (
        <div className={`px-4 py-3 rounded text-sm border ${actionMessage.startsWith('Error') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
          {actionMessage}
        </div>
      )}

      {/* Validation flags */}
      {doc.validationFlags && doc.validationFlags.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            Validation Warnings
          </div>
          {doc.validationFlags.map((flag, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-amber-700 ml-6">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {FLAG_LABELS[flag] || flag}
            </div>
          ))}
        </div>
      )}

      {/* Rejection reason display */}
      {doc.status === 'reviewed_rejected' && doc.extractionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <strong>Rejection reason:</strong> {doc.extractionError}
        </div>
      )}

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Document image */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">Source Document</CardTitle>
            <CardDescription>Original scanned image of the land record.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center min-h-[400px] bg-slate-50 rounded-b-lg">
            {doc.storageUrl ? (
              <img
                src={doc.storageUrl}
                alt={`Document: ${doc.filename}`}
                className="max-w-full max-h-[600px] object-contain rounded border border-slate-200"
              />
            ) : (
              <div className="flex flex-col items-center text-slate-400">
                <ImageOff className="w-12 h-12 mb-3" />
                <p className="text-sm">No document image available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Extracted fields */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Extracted Data</CardTitle>
                <CardDescription>
                  {doc.extractionSource
                    ? `Extracted via ${doc.extractionSource}`
                    : 'No extraction performed yet.'}
                </CardDescription>
              </div>
              {doc.extractedFields && Object.keys(doc.extractedFields).length > 0 && (
                <div className="text-right">
                  {doc.status === 'reviewed_approved' && doc.reviewedBy && (
                    <span className="inline-flex items-center gap-1 text-xs text-teal-700 bg-teal-50 px-2 py-1 rounded-full">
                      <ShieldCheck className="w-3 h-3" /> Reviewed
                    </span>
                  )}
                  {doc.status === 'reviewed_rejected' && (
                    <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-1 rounded-full">
                      <ShieldX className="w-3 h-3" /> Rejected
                    </span>
                  )}
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 space-y-4">
            {doc.extractedFields && Object.keys(doc.extractedFields).length > 0 ? (
              Object.entries(doc.extractedFields).map(([fieldName, field]) => {
                const fieldData = field as ExtractedFieldValue;
                const label = FIELD_LABELS[fieldName] || fieldName;
                const isEditable = canReview;
                const currentValue = isEditable ? (editedFields[fieldName] ?? '') : (fieldData.value ?? '');
                const conf = fieldData.confidence;
                const isHumanCorrected = fieldData.source === 'human_corrected';

                return (
                  <div key={fieldName} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700">{label}</label>
                      <div className="flex items-center gap-2">
                        {isHumanCorrected && (
                          <span className="text-[10px] font-medium text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">Human Corrected</span>
                        )}
                        <span className={`text-xs font-mono font-medium ${confidenceColor(conf)}`}>
                          {(conf * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-md border ${isEditable ? 'border-slate-300 bg-white' : `${confidenceBg(conf)} border-slate-200`}`}>
                      {isEditable ? (
                        <input
                          type="text"
                          value={currentValue}
                          onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                          className="flex-1 text-sm focus:outline-none bg-transparent"
                        />
                      ) : (
                        <span className="text-sm text-slate-800">{fieldData.value || '—'}</span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">
                No extracted data available. The document may not have been processed yet.
              </div>
            )}
          </CardContent>

          {/* Review action buttons — only for reviewers on needs_review */}
          {canReview && (
            <div className="border-t border-slate-100 p-6 pt-4 flex flex-col sm:flex-row gap-3">
              <Button
                variant="ghost"
                className="text-red-600 hover:bg-red-50"
                onClick={() => setShowRejectModal(true)}
                disabled={actionLoading}
              >
                <X className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button
                variant="secondary"
                onClick={handleApprove}
                disabled={actionLoading}
              >
                <Check className="w-4 h-4 mr-2" />
                Approve
              </Button>
              <Button
                onClick={handleSaveCorrections}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Corrections
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Metadata section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Record Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-500 block">Uploaded</span>
              <span className="text-slate-800 font-medium">{formatDate(doc.createdAt)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Last Updated</span>
              <span className="text-slate-800 font-medium">{formatDate(doc.updatedAt)}</span>
            </div>
            {doc.reviewedAt && (
              <div>
                <span className="text-slate-500 block">Reviewed At</span>
                <span className="text-slate-800 font-medium">{formatDate(doc.reviewedAt)}</span>
              </div>
            )}
            <div>
              <span className="text-slate-500 block">Extraction Source</span>
              <span className="text-slate-800 font-medium capitalize">{doc.extractionSource || 'Not extracted'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold">Reject Document</h3>
            <p className="text-sm text-slate-500">Provide an optional reason for rejecting this document.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)..."
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-500 h-24 resize-none"
            />
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowRejectModal(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleReject} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
