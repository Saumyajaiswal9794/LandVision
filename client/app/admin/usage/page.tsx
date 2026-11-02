'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/card';
import { Button } from '../../../components/button';
import { ApiErrorFallback } from '../../../components/ErrorBoundary';
import { AdminGuard } from '../../../components/admin/adminGuard';
import api, { ApiUsageEntry } from '../../../lib/api';
import { RefreshCw, BarChart3, Coins } from 'lucide-react';

function UsageContent() {
  const [usage, setUsage] = useState<ApiUsageEntry[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUsage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listApiUsage(100);
      setUsage(data.usage || []);
      setTotalCost(data.totalCost || 0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Usage &amp; Cost</h1>
          <p className="text-slate-500 mt-1">
            Gemini 2.5 Flash token consumption, recorded per extraction call.
          </p>
        </div>
        <button
          onClick={loadUsage}
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
            <ApiErrorFallback message={error} onRetry={loadUsage} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="w-4 h-4 text-emerald-600" />
              Total Cost (last {usage.length} calls)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-4xl font-extrabold text-emerald-600">
              ${totalCost.toFixed(4)}
            </span>
            <p className="text-xs text-slate-500 mt-1">
              Estimated from Gemini list pricing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4 text-brand-600" />
              Total Tokens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-4xl font-extrabold text-brand-600">
              {usage.reduce((sum, u) => sum + (u.totalTokens || 0), 0).toLocaleString()}
            </span>
            <p className="text-xs text-slate-500 mt-1">Prompt + completion</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Extraction Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-4xl font-extrabold text-slate-700">{usage.length}</span>
            <p className="text-xs text-slate-500 mt-1">Most recent 100 shown</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Calls</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !usage.length ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-3" />
              Loading usage data...
            </div>
          ) : usage.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              No AI calls recorded yet. Run an extraction to see token usage and
              cost here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-500">
                    <th className="px-6 py-3 font-medium">Timestamp</th>
                    <th className="px-6 py-3 font-medium">Model</th>
                    <th className="px-6 py-3 font-medium">Operation</th>
                    <th className="px-6 py-3 font-medium">Prompt</th>
                    <th className="px-6 py-3 font-medium">Completion</th>
                    <th className="px-6 py-3 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {usage.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(entry.timestamp)}
                      </td>
                      <td className="px-6 py-3 text-slate-800">{entry.modelName}</td>
                      <td className="px-6 py-3 text-slate-600 text-xs capitalize">{entry.operation}</td>
                      <td className="px-6 py-3 text-slate-600 text-xs">
                        {entry.promptTokens?.toLocaleString() ?? '—'}
                      </td>
                      <td className="px-6 py-3 text-slate-600 text-xs">
                        {entry.completionTokens?.toLocaleString() ?? '—'}
                      </td>
                      <td className="px-6 py-3 text-slate-800 text-xs">
                        ${(entry.cost || 0).toFixed(6)}
                      </td>
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

export default function AdminUsagePage() {
  return (
    <AdminGuard>
      <UsageContent />
    </AdminGuard>
  );
}
