'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/card';
import { Button } from '../../../components/button';
import {
  ArrowLeft,
  Check,
  X,
  Save,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  ShieldX,
  ImageOff,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { ApiErrorFallback } from '../../../components/ErrorBoundary';
import { BboxOverlay, BboxOverlayBox } from '../../../components/review/bboxOverlay';
import { CroppedFieldPreview } from '../../../components/review/croppedFieldPreview';
import type {
  DocumentDetail,
  DocumentRow,
  ExtractedFieldValue,
} from '../../../lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  uploaded: { label: 'Uploaded', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  extracting: { label: 'Extracting', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  extracted: { label: 'Extracted', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  extraction_failed: {
    label: 'Extraction Failed',
    className: 'bg-red-100 text-red-800 border-red-300',
  },
  needs_review: {
    label: 'Needs Review',
    className: 'bg-orange-100 text-orange-800 border-orange-300',
  },
  auto_approved: {
    label: 'Auto Approved',
    className: 'bg-green-100 text-green-800 border-green-300',
  },
  reviewed_approved: {
    label: 'Reviewed Approved',
    className: 'bg-teal-100 text-teal-800 border-teal-300',
  },
  reviewed_rejected: {
    label: 'Reviewed Rejected',
    className: 'bg-red-100 text-red-800 border-red-300',
  },
};

// All fields we render in the per-row detail panel — required first.
const FIELD_LABELS: Record<string, string> = {
  ownerName: 'Owner Name',
  khasraNumber: 'Khasra Number',
  plotArea: 'Plot Area',
  village: 'Village',
  district: 'District',
  landClass: 'Land Class',
  khataNumber: 'Khata Number',
  tehsil: 'Tehsil',
  subSurveyNumber: 'Sub-Survey Number',
  fatherOrHusbandName: "Father / Husband's Name",
  remarks: 'Remarks',
};

const FIELD_ORDER = Object.keys(FIELD_LABELS);

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

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [role, setRole] = useState<'officer' | 'reviewer' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null,
  );

  // Currently selected row's recordId (null = none selected, or single-row mode).
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Edited fields per row: { [rowId]: { [fieldName]: string } }
  const [editedFieldsByRow, setEditedFieldsByRow] = useState<
    Record<string, Record<string, string>>
  >({});

  // Reject-modal state
  const [rejectModalRowId, setRejectModalRowId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }, []);

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

      const data: DocumentDetail = await res.json();
      setDoc(data);

      // Auto-select the first row if there are child rows.
      if (data.rows && data.rows.length > 0) {
        setSelectedRowId(data.rows[0].recordId);
      } else {
        setSelectedRowId(null);
      }

      // Initialize edited-fields maps.
      const edits: Record<string, Record<string, string>> = {};
      if (data.rows && data.rows.length > 0) {
        for (const row of data.rows) {
          edits[row.recordId] = initEditedFields(row.extractedFields);
        }
      } else {
        // Legacy single-record mode — treat the document itself as the row.
        edits['__document__'] = initEditedFields(data.extractedFields);
      }
      setEditedFieldsByRow(edits);
    } catch (err) {
      const e = err as Error;
      const isNetwork =
        e.message.includes('Failed to fetch') ||
        e.message.includes('Network request failed') ||
        e.message.toLowerCase().includes('network');
      const friendly = isNetwork
        ? 'Could not reach the LandVision backend to load this document. The service may be starting up (Render free tier cold start). Click retry to try again.'
        : e.message;
      setError(friendly);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  const rows: DocumentRow[] = useMemo(() => {
    return doc?.rows ?? [];
  }, [doc]);

  const hasChildRows = rows.length > 0;

  // Currently selected row (in multi-row mode) — null when single-row mode.
  const selectedRow: DocumentRow | null = useMemo(() => {
    if (!hasChildRows) return null;
    return rows.find((r) => r.recordId === selectedRowId) ?? rows[0] ?? null;
  }, [rows, selectedRowId, hasChildRows]);

  // The "active record" — either the selected row, or the document itself
  // (for legacy single-record mode). Drives what's shown in the right panel.
  const activeRecordId = selectedRow?.recordId ?? null;
  const activeStatus = selectedRow?.status ?? doc?.status ?? '';
  const activeValidationResults =
    selectedRow?.validationResults ?? doc?.validationResults ?? [];
  const activeLowConfidenceFields =
    selectedRow?.lowConfidenceFields ?? doc?.lowConfidenceFields ?? [];
  const activeExtractedFields = selectedRow?.extractedFields ?? doc?.extractedFields ?? {};

  // Bbox overlay boxes — built from the selected row's extracted fields
  // (or the document's own extractedFields in single-record mode).
  const overlayBoxes: BboxOverlayBox[] = useMemo(() => {
    const out: BboxOverlayBox[] = [];
    const fields = activeExtractedFields;
    for (const fieldKey of FIELD_ORDER) {
      const field = fields[fieldKey];
      if (!field?.bbox) continue;
      const isLow = activeLowConfidenceFields.includes(fieldKey);
      out.push({
        fieldKey,
        label: FIELD_LABELS[fieldKey] || fieldKey,
        bbox: field.bbox,
        confidence: field.confidence,
        highlighted: isLow,
        dimmed: false,
      });
    }
    return out;
  }, [activeExtractedFields, activeLowConfidenceFields]);

  // Boxes for OTHER (non-selected) rows — drawn dimmed.
  const otherRowBoxes: BboxOverlayBox[] = useMemo(() => {
    if (!hasChildRows) return [];
    const out: BboxOverlayBox[] = [];
    for (const row of rows) {
      if (row.recordId === selectedRow?.recordId) continue;
      for (const fieldKey of FIELD_ORDER) {
        const field = row.extractedFields?.[fieldKey];
        if (!field?.bbox) continue;
        out.push({
          fieldKey: `${row.recordId}.${fieldKey}`,
          label: `${FIELD_LABELS[fieldKey] || fieldKey} (row ${row.rowIndex ?? '?'})`,
          bbox: field.bbox,
          confidence: field.confidence,
          highlighted: false,
          dimmed: true,
        });
      }
    }
    return out;
  }, [rows, hasChildRows, selectedRow]);

  const canReview = role === 'reviewer' && activeStatus === 'needs_review';

  // "Approve all high-confidence rows" — enabled when at least one
  // needs_review row exists with no error flags and no low-confidence fields.
  const approveAllEnabled = useMemo(() => {
    return rows.some(
      (r) =>
        r.status === 'needs_review' &&
        (r.validationResults || []).every((f) => f.severity !== 'error') &&
        (r.lowConfidenceFields || []).length === 0,
    );
  }, [rows]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const initEditedFields = (
    fields: Record<string, ExtractedFieldValue>,
  ): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = v?.value || '';
    }
    return out;
  };

  const handleFieldChange = (rowKey: string, fieldName: string, value: string) => {
    setEditedFieldsByRow((prev) => ({
      ...prev,
      [rowKey]: { ...(prev[rowKey] ?? {}), [fieldName]: value },
    }));
  };

  const handleApprove = async (rowId?: string) => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/documents/${id}/review`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'approve', rowId: rowId || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Approval failed');
      }
      setActionMessage({
        kind: 'ok',
        text: rowId ? 'Row approved successfully.' : 'Document approved successfully.',
      });
      fetchDocument();
    } catch (err) {
      setActionMessage({ kind: 'err', text: `Error: ${(err as Error).message}` });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveAllHighConfidence = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/documents/${id}/review`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'approve_all_high_confidence' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Approve-all failed');
      }
      const data = await res.json();
      setActionMessage({ kind: 'ok', text: `${data.approvedCount} row(s) auto-approved.` });
      fetchDocument();
    } catch (err) {
      setActionMessage({ kind: 'err', text: `Error: ${(err as Error).message}` });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModalRowId && rejectModalRowId !== null) return;
    const rowId = rejectModalRowId ?? undefined;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const token = await getAuthToken();
      const body: any = { action: 'reject', rowId };
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
      setActionMessage({
        kind: 'ok',
        text: rowId ? 'Row rejected.' : 'Document rejected.',
      });
      setRejectModalRowId(null);
      setRejectReason('');
      fetchDocument();
    } catch (err) {
      setActionMessage({ kind: 'err', text: `Error: ${(err as Error).message}` });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveCorrections = async (rowId?: string) => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const token = await getAuthToken();
      const editedKey = rowId || '__document__';
      const corrected = editedFieldsByRow[editedKey] ?? {};
      // Only send the fields that changed.
      const current = rowId ? selectedRow?.extractedFields ?? {} : doc?.extractedFields ?? {};
      const diff: Record<string, string> = {};
      for (const [k, v] of Object.entries(corrected)) {
        if (v !== (current[k]?.value ?? '')) {
          diff[k] = v;
        }
      }
      if (Object.keys(diff).length === 0) {
        setActionMessage({ kind: 'ok', text: 'No changes to save.' });
        setActionLoading(false);
        return;
      }
      const res = await fetch(`${API_BASE_URL}/api/documents/${id}/review`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'edit', correctedFields: diff, rowId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save corrections');
      }
      setActionMessage({
        kind: 'ok',
        text: rowId ? 'Row corrections saved and approved.' : 'Corrections saved and document approved.',
      });
      fetchDocument();
    } catch (err) {
      setActionMessage({ kind: 'err', text: `Error: ${(err as Error).message}` });
    } finally {
      setActionLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render: loading state
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-3" />
        Loading document...
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: error state (no doc)
  // -------------------------------------------------------------------------
  if (error && !doc) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <Card>
          <CardContent className="py-0">
            <ApiErrorFallback message={error} onRetry={fetchDocument} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: empty state (doc not found)
  // -------------------------------------------------------------------------
  if (!doc) return null;

  const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.uploaded;

  // -------------------------------------------------------------------------
  // Render: main page
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{doc.filename}</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {doc.village}, {doc.district}
              {hasChildRows && (
                <span className="ml-2 text-slate-400">
                  · {rows.length} row{rows.length !== 1 ? 's' : ''} extracted
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {doc.village && (
            <Link
              href={`/map?village=${encodeURIComponent(doc.village)}`}
              className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-md transition-colors border border-brand-200"
            >
              <MapPin className="w-4 h-4" />
              View on Map
            </Link>
          )}
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusCfg.className}`}
          >
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Action message */}
      {actionMessage && (
        <div
          className={`px-4 py-3 rounded text-sm border ${
            actionMessage.kind === 'err'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-green-50 border-green-200 text-green-700'
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Approve-all-high-confidence button */}
      {role === 'reviewer' && approveAllEnabled && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-teal-50 border border-teal-200 rounded-lg">
          <div className="flex items-center gap-2 text-teal-800 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Some rows are high-confidence and ready to approve in batch.
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleApproveAllHighConfidence}
            disabled={actionLoading}
          >
            {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Approve all high-confidence rows
          </Button>
        </div>
      )}

      {/* Validation flags — for the selected row OR the document */}
      {(activeValidationResults?.length ?? 0) > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            Validation Warnings
            <span className="text-xs text-amber-700 ml-2">
              ({activeValidationResults!.filter((f) => f.severity === 'error').length} error,
              {' '}
              {activeValidationResults!.filter((f) => f.severity === 'warning').length} warning)
            </span>
          </div>
          {activeValidationResults!.map((flag, i) => (
            <div key={i} className="flex items-start gap-2 text-sm ml-6">
              <span
                className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                  flag.severity === 'error'
                    ? 'bg-red-500'
                    : flag.severity === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-blue-400'
                }`}
              />
              <div>
                <div className="text-slate-800">
                  <span className="font-mono text-xs text-slate-500 mr-2">[{flag.rule}]</span>
                  {flag.message}
                </div>
                {flag.field && (
                  <div className="text-xs text-slate-500">Field: {FIELD_LABELS[flag.field] || flag.field}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rejection reason display (legacy per-document) */}
      {doc.status === 'reviewed_rejected' && doc.extractionError && !hasChildRows && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <strong>Rejection reason:</strong> {doc.extractionError}
        </div>
      )}

      {/* -------------------------------------------------------------------------
          Row table — shown when there are child rows. Clicking a row selects it.
          -------------------------------------------------------------------------- */}
      {hasChildRows && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Extracted Rows</CardTitle>
            <CardDescription>
              Click a row to inspect it. Low-confidence fields are highlighted in amber.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Row</th>
                    <th className="text-left px-4 py-2 font-medium">Khasra</th>
                    <th className="text-left px-4 py-2 font-medium">Owner</th>
                    <th className="text-left px-4 py-2 font-medium">Area</th>
                    <th className="text-left px-4 py-2 font-medium">Confidence</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const isSelected = row.recordId === selectedRow?.recordId;
                    const khasra = row.extractedFields?.khasraNumber?.value || '—';
                    const owner = row.extractedFields?.ownerName?.value || '—';
                    const area = row.extractedFields?.plotArea?.value || '—';
                    const lowCount = (row.lowConfidenceFields || []).length;
                    const hasErrorFlag = (row.validationResults || []).some(
                      (f) => f.severity === 'error',
                    );
                    const statusCfg =
                      STATUS_CONFIG[row.status] || STATUS_CONFIG.uploaded;
                    return (
                      <tr
                        key={row.recordId}
                        onClick={() => setSelectedRowId(row.recordId)}
                        className={`cursor-pointer border-b border-slate-100 last:border-0 transition-colors ${
                          isSelected
                            ? 'bg-amber-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-4 py-2 font-mono text-slate-500">
                          #{idx + 1}
                          <span className="text-slate-400 text-xs ml-1">
                            (p{row.pageNo ?? '?'}, r{row.rowIndex ?? '?'})
                          </span>
                        </td>
                        <td className="px-4 py-2">{khasra}</td>
                        <td className="px-4 py-2">{owner}</td>
                        <td className="px-4 py-2">{area}</td>
                        <td className="px-4 py-2">
                          {lowCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-xs font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              {lowCount} low field{lowCount !== 1 ? 's' : ''}
                            </span>
                          ) : hasErrorFlag ? (
                            <span className="inline-flex items-center gap-1 text-red-700 bg-red-100 px-2 py-0.5 rounded text-xs font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              Error flag
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2 py-0.5 rounded text-xs font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              OK
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusCfg.className}`}
                          >
                            {statusCfg.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Document image with bbox overlay */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">Source Document</CardTitle>
            <CardDescription>
              Bounding boxes are drawn for the selected row. Hover a field on the right to
              highlight its box. Low-confidence fields are shown in amber.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {doc.storageUrl ? (
              <BboxOverlay
                imageUrl={doc.storageUrl}
                boxes={[...overlayBoxes, ...otherRowBoxes]}
                onSelectBox={(fieldKey) => {
                  // Clicking a box scrolls the corresponding field into view.
                  const el = document.getElementById(`field-${fieldKey}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('ring-2', 'ring-blue-400');
                    setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400'), 1500);
                  }
                }}
              />
            ) : (
              <div className="flex flex-col items-center text-slate-400 min-h-[400px] justify-center">
                <ImageOff className="w-12 h-12 mb-3" />
                <p className="text-sm">No document image available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Extracted fields for the selected row */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {selectedRow
                    ? `Row #${(rows.findIndex((r) => r.recordId === selectedRow.recordId) ?? 0) + 1} — Extracted Data`
                    : 'Extracted Data'}
                </CardTitle>
                <CardDescription>
                  {activeExtractedFields && Object.keys(activeExtractedFields).length > 0
                    ? `Source: ${selectedRow?.extractionSource ?? doc.extractionSource ?? 'unknown'}`
                    : 'No extraction performed yet.'}
                </CardDescription>
              </div>
              {activeStatus === 'reviewed_approved' && (
                <span className="inline-flex items-center gap-1 text-xs text-teal-700 bg-teal-50 px-2 py-1 rounded-full">
                  <ShieldCheck className="w-3 h-3" /> Reviewed
                </span>
              )}
              {activeStatus === 'reviewed_rejected' && (
                <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-1 rounded-full">
                  <ShieldX className="w-3 h-3" /> Rejected
                </span>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 space-y-3">
            {activeExtractedFields && Object.keys(activeExtractedFields).length > 0 ? (
              FIELD_ORDER.filter((k) => activeExtractedFields[k]).map((fieldName) => {
                const fieldData = activeExtractedFields[fieldName] as ExtractedFieldValue;
                const label = FIELD_LABELS[fieldName] || fieldName;
                const isEditable = canReview;
                const editedKey = activeRecordId || '__document__';
                const currentValue = isEditable
                  ? editedFieldsByRow[editedKey]?.[fieldName] ?? ''
                  : fieldData.value ?? '';
                const conf = fieldData.confidence ?? 0;
                const isLow = activeLowConfidenceFields.includes(fieldName);
                const isHumanCorrected = fieldData.source === 'human_corrected';

                return (
                  <div
                    id={`field-${fieldName}`}
                    key={fieldName}
                    className={`space-y-1 transition-all rounded-lg p-2 -mx-2 ${
                      isLow ? 'bg-amber-50 ring-1 ring-amber-200' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700">
                        {label}
                        {isLow && (
                          <span className="ml-2 text-xs text-amber-700">
                            · low confidence
                          </span>
                        )}
                      </label>
                      <div className="flex items-center gap-2">
                        {isHumanCorrected && (
                          <span className="text-[10px] font-medium text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">
                            Human Corrected
                          </span>
                        )}
                        <span className={`text-xs font-mono font-medium ${confidenceColor(conf)}`}>
                          {(conf * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Cropped preview — only when the field has a bbox. */}
                      {fieldData.bbox && (
                        <CroppedFieldPreview
                          imageUrl={doc.storageUrl ?? ''}
                          bbox={fieldData.bbox}
                          size={56}
                        />
                      )}
                      <div
                        className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-md border ${
                          isEditable
                            ? 'border-slate-300 bg-white'
                            : isLow
                            ? 'bg-amber-50 border-amber-200'
                            : `${confidenceBg(conf)} border-slate-200`
                        } ${isLow ? 'opacity-100' : ''}`}
                      >
                        {isEditable ? (
                          <input
                            type="text"
                            value={currentValue}
                            onChange={(e) =>
                              handleFieldChange(editedKey, fieldName, e.target.value)
                            }
                            className="flex-1 text-sm focus:outline-none bg-transparent"
                          />
                        ) : (
                          <span className="text-sm text-slate-800">
                            {fieldData.value || '—'}
                          </span>
                        )}
                      </div>
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
                onClick={() => setRejectModalRowId(activeRecordId)}
                disabled={actionLoading}
              >
                <X className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleApprove(activeRecordId ?? undefined)}
                disabled={actionLoading}
              >
                <Check className="w-4 h-4 mr-2" />
                Approve
              </Button>
              <Button
                onClick={() => handleSaveCorrections(activeRecordId ?? undefined)}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
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
            {(selectedRow?.reviewedAt || doc.reviewedAt) && (
              <div>
                <span className="text-slate-500 block">Reviewed At</span>
                <span className="text-slate-800 font-medium">
                  {formatDate(selectedRow?.reviewedAt || doc.reviewedAt)}
                </span>
              </div>
            )}
            <div>
              <span className="text-slate-500 block">Extraction Source</span>
              <span className="text-slate-800 font-medium capitalize">
                {selectedRow?.extractionSource ?? doc.extractionSource ?? 'Not extracted'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reject modal */}
      {rejectModalRowId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold">
              {rejectModalRowId ? 'Reject Row' : 'Reject Document'}
            </h3>
            <p className="text-sm text-slate-500">
              Provide an optional reason for rejecting this{' '}
              {rejectModalRowId ? 'row' : 'document'}.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)..."
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-500 h-24 resize-none"
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setRejectModalRowId(null);
                  setRejectReason('');
                }}
                disabled={actionLoading}
              >
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
