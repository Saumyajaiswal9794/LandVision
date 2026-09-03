'use client';

import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/card';
import { Button } from '../../components/button';
import { FileText, Filter, RefreshCw, Eye, UploadCloud, FileStack, ClipboardCheck, CheckCircle2 } from 'lucide-react';
import { ApiErrorFallback } from '../../components/ErrorBoundary';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// --- Status badge configuration ---
// Keys match the EXACT status enum values in the LandRecord schema
// (server/src/models/LandRecord.ts). Adding/removing a status here MUST be
// mirrored in the schema and vice versa.
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

// Statuses that count toward each summary card. Keeping these as constants
// (rather than inlining magic strings) makes the business rule auditable.
const IN_PIPELINE_STATUSES = ['uploaded', 'extracting', 'extracted', 'extraction_failed'];
const PENDING_REVIEW_STATUSES = ['needs_review'];
const DIGITIZED_STATUSES = ['auto_approved', 'reviewed_approved'];

interface DocumentListItem {
  recordId: string;
  filename: string;
  village: string;
  district: string;
  status: string;
  extractionSource: string | null;
  createdAt: string;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  // allDocuments holds the UNFILTERED snapshot so the summary cards always
  // show true totals — the visible table below respects statusFilter, but
  // the cards must not change when the user filters.
  const [allDocuments, setAllDocuments] = useState<DocumentListItem[]>([]);
  const [role, setRole] = useState<'officer' | 'reviewer' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');

  // Fetch the unfiltered document list and store it for the summary cards.
  // Called once on mount (and on manual refresh) — does NOT depend on filter.
  const fetchAllDocuments = useCallback(async (): Promise<DocumentListItem[]> => {
    if (!supabase) {
      router.push('/login');
      return [];
    }
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      router.push('/login');
      return [];
    }
    const token = sessionData.session.access_token;
    const userRole = sessionData.session.user?.user_metadata?.role;
    setRole(userRole || null);

    const res = await fetch(`${API_BASE_URL}/api/documents`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      router.push('/login');
      return [];
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch documents (${res.status})`);
    }
    const data = await res.json();
    return (data.documents || []) as DocumentListItem[];
  }, [router]);

  // Fetch the (possibly filtered) document list for the visible table.
  const fetchDocuments = useCallback(async (filter: string) => {
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

      let url = `${API_BASE_URL}/api/documents`;
      if (filter) {
        url += `?status=${encodeURIComponent(filter)}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        router.push('/login');
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to fetch documents (${res.status})`);
      }

      const data = await res.json();
      const docs: DocumentListItem[] = data.documents || [];
      setDocuments(docs);
      // If we just did an unfiltered fetch, also update allDocuments so the
      // summary cards reflect the latest totals.
      if (!filter) {
        setAllDocuments(docs);
      }
    } catch (err) {
      // Distinguish network failures (CORS, backend down, no internet) from
      // server errors so the fallback message is actually useful.
      const e = err as Error;
      const isNetwork =
        e.message.includes('Failed to fetch') ||
        e.message.includes('Network request failed') ||
        e.message.toLowerCase().includes('network');
      const friendly = isNetwork
        ? 'Could not reach the LandVision backend. The service may be starting up (Render free tier cold start) or your network may be down. Click retry to try again.'
        : e.message;
      setError(friendly);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // On mount: fetch BOTH the unfiltered snapshot (for cards) and the filtered
  // list (for the table). When no filter is set these are the same request —
  // we still make both calls so the dependency arrays stay simple.
  useEffect(() => {
    (async () => {
      try {
        const all = await fetchAllDocuments();
        setAllDocuments(all);
        // If there's no filter, also seed the table from the unfiltered
        // response to avoid a redundant second network call.
        if (!statusFilter) {
          setDocuments(all);
          setLoading(false);
        } else {
          await fetchDocuments(statusFilter);
        }
      } catch (err) {
        const e = err as Error;
        const isNetwork =
          e.message.includes('Failed to fetch') ||
          e.message.includes('Network request failed') ||
          e.message.toLowerCase().includes('network');
        setError(
          isNetwork
            ? 'Could not reach the LandVision backend. The service may be starting up (Render free tier cold start) or your network may be down. Click retry to try again.'
            : e.message,
        );
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch table when filter changes (cards stay on the unfiltered snapshot).
  useEffect(() => {
    if (statusFilter) {
      fetchDocuments(statusFilter);
    }
  }, [statusFilter, fetchDocuments]);

  // Manual refresh — re-fetches BOTH the unfiltered snapshot (cards) and the
  // filtered table.
  const handleRefresh = useCallback(async () => {
    try {
      const all = await fetchAllDocuments();
      setAllDocuments(all);
      if (!statusFilter) {
        setDocuments(all);
      } else {
        await fetchDocuments(statusFilter);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [fetchAllDocuments, fetchDocuments, statusFilter]);

  // --- Summary card counts: derived from the UNFILTERED document list so
  // they reflect true totals, not the current filter view.
  const counts = useMemo(() => {
    const inPipeline = allDocuments.filter((d) => IN_PIPELINE_STATUSES.includes(d.status)).length;
    const pendingReview = allDocuments.filter((d) => PENDING_REVIEW_STATUSES.includes(d.status)).length;
    const digitized = allDocuments.filter((d) => DIGITIZED_STATUSES.includes(d.status)).length;
    return {
      total: allDocuments.length,
      inPipeline,
      pendingReview,
      digitized,
    };
  }, [allDocuments]);

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {role === 'reviewer' ? 'Document Review Dashboard' : 'My Documents'}
          </h1>
          <p className="text-slate-500 mt-1">
            {role === 'reviewer'
              ? 'View and manage all uploaded land records across the pipeline.'
              : 'Track the status of your uploaded land records.'}
          </p>
        </div>

        {role === 'officer' && (
          <Link href="/upload">
            <Button>
              <UploadCloud className="w-4 h-4 mr-2" />
              Upload New Document
            </Button>
          </Link>
        )}
      </div>

      {/* --- Summary cards (counts derived from real GET /api/documents) --- */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileStack className="w-4 h-4 text-brand-600" />
              In Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-4xl font-extrabold text-brand-600">{counts.inPipeline}</span>
            <p className="text-xs text-slate-500 mt-1">
              Uploaded, extracting, extracted, or failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="w-4 h-4 text-amber-600" />
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-4xl font-extrabold text-amber-600">{counts.pendingReview}</span>
            <p className="text-xs text-slate-500 mt-1">
              Low-confidence or validation-flagged
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Digitized
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-4xl font-extrabold text-emerald-600">{counts.digitized}</span>
            <p className="text-xs text-slate-500 mt-1">
              Auto-approved or reviewed-approved
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status filter — only for reviewers */}
      {role === 'reviewer' && (
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={handleStatusFilterChange}
            className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-500 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="uploaded">Uploaded</option>
            <option value="extracting">Extracting</option>
            <option value="extracted">Extracted</option>
            <option value="extraction_failed">Extraction Failed</option>
            <option value="needs_review">Needs Review</option>
            <option value="auto_approved">Auto Approved</option>
            <option value="reviewed_approved">Reviewed Approved</option>
            <option value="reviewed_rejected">Reviewed Rejected</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {error && !loading && (
        <Card>
          <CardContent className="py-0">
            <ApiErrorFallback message={error} onRetry={handleRefresh} />
          </CardContent>
        </Card>
      )}

      {loading && !documents.length ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-3" />
          Loading documents...
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No documents found</p>
            <p className="text-slate-400 text-sm mt-1">
              {role === 'officer'
                ? 'Upload a land record to get started.'
                : statusFilter
                  ? `No documents with status "${statusFilter}".`
                  : 'No documents have been uploaded yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Documents ({documents.length}{statusFilter ? ` of ${counts.total}` : ''})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-500">
                    <th className="px-6 py-3 font-medium">Filename</th>
                    <th className="px-6 py-3 font-medium">Village</th>
                    <th className="px-6 py-3 font-medium">District</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Source</th>
                    <th className="px-6 py-3 font-medium">Uploaded</th>
                    <th className="px-6 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {documents.map((doc) => {
                    const cfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.uploaded;
                    return (
                      <tr key={doc.recordId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 font-medium text-slate-800 max-w-[200px] truncate">
                          {doc.filename || '—'}
                        </td>
                        <td className="px-6 py-3 text-slate-600">{doc.village || '—'}</td>
                        <td className="px-6 py-3 text-slate-600">{doc.district || '—'}</td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate-500 capitalize text-xs">
                          {doc.extractionSource || '—'}
                        </td>
                        <td className="px-6 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {formatDate(doc.createdAt)}
                        </td>
                        <td className="px-6 py-3">
                          <Link href={`/documents/${doc.recordId}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {documents.map((doc) => {
                const cfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.uploaded;
                return (
                  <Link key={doc.recordId} href={`/documents/${doc.recordId}`} className="block px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-800 text-sm truncate max-w-[60%]">
                        {doc.filename || '—'}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.className}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {doc.village}, {doc.district} &middot; {formatDate(doc.createdAt)}
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20 text-slate-400">
        Loading...
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
