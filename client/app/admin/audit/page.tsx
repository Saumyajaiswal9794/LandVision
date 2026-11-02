'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/card';
import { Button } from '../../../components/button';
import { ApiErrorFallback } from '../../../components/ErrorBoundary';
import { AdminGuard } from '../../../components/admin/adminGuard';
import api, { AuditLogEntry } from '../../../lib/api';
import { RefreshCw, ScrollText } from 'lucide-react';

function AuditContent() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listAuditLogs(100);
      setLogs(data.logs || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const actionClass = (action: string) => {
    if (action.includes('upload')) return 'bg-brand-50 text-brand-700 border-brand-200';
    if (action.includes('review') || action.includes('update')) return 'bg-teal-50 text-teal-700 border-teal-200';
    if (action.includes('extract')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (action.includes('role')) return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-slate-500 mt-1">
            Every mutation (upload, extract, correction, review, role change) is recorded here.
          </p>
        </div>
        <button
          onClick={loadLogs}
          disabled={loading}
          className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <Card>
          <CardContent className="py-0">
            <ApiErrorFallback message={error} onRetry={loadLogs} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="w-4 h-4 text-amber-600" />
            Recent Activity ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !logs.length ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-3" />
              Loading audit logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              No activity recorded yet. Upload, extract or review a document to
              see entries appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-500">
                    <th className="px-6 py-3 font-medium">Timestamp</th>
                    <th className="px-6 py-3 font-medium">User</th>
                    <th className="px-6 py-3 font-medium">Action</th>
                    <th className="px-6 py-3 font-medium">Resource</th>
                    <th className="px-6 py-3 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="px-6 py-3 text-slate-800 max-w-[220px] truncate">
                        {log.userEmail || log.userId}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${actionClass(log.action)}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-600 text-xs">
                        {log.resourceType}
                        {log.resourceId ? ` · ${String(log.resourceId).slice(0, 12)}…` : ''}
                      </td>
                      <td className="px-6 py-3 text-slate-400 text-xs">{log.ip || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="ghost" size="sm" onClick={() => history.back()}>
        ← Back to Admin
      </Button>
    </div>
  );
}

export default function AdminAuditPage() {
  return (
    <AdminGuard>
      <AuditContent />
    </AdminGuard>
  );
}
