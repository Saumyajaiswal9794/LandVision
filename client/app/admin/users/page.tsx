'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/card';
import { Button } from '../../../components/button';
import { ApiErrorFallback } from '../../../components/ErrorBoundary';
import { AdminGuard } from '../../../components/admin/adminGuard';
import api, { AdminUser } from '../../../lib/api';
import { RefreshCw, Users } from 'lucide-react';

function UsersContent() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listUsers();
      setUsers(data.users || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const updateRole = async (userId: string, role: AdminUser['role']) => {
    setSavingId(userId);
    try {
      await api.updateUserRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
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
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-slate-500 mt-1">
            Assign roles. Changes take effect on the user&apos;s next request.
          </p>
        </div>
        <button
          onClick={loadUsers}
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
            <ApiErrorFallback message={error} onRetry={loadUsers} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-4 h-4 text-brand-600" />
            Registered Users ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !users.length ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-3" />
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              No users have signed in yet. Users are created automatically on
              their first authenticated request.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-500">
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 font-medium">Role</th>
                    <th className="px-6 py-3 font-medium">Last Login</th>
                    <th className="px-6 py-3 font-medium">Created</th>
                    <th className="px-6 py-3 font-medium">Change Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-800">{user.email}</td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            user.role === 'admin'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : user.role === 'reviewer'
                                ? 'bg-teal-50 text-teal-700 border-teal-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(user.lastLoginAt)}
                      </td>
                      <td className="px-6 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-3">
                        <select
                          value={user.role}
                          disabled={savingId === user.id}
                          onChange={(e) => updateRole(user.id, e.target.value as AdminUser['role'])}
                          className="border border-slate-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-brand-500 bg-white disabled:opacity-50"
                        >
                          <option value="officer">Officer</option>
                          <option value="reviewer">Reviewer</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400">
        Tip: use the buttons below to save changes — nothing is written until
        you change a dropdown.
      </p>
      <Button variant="ghost" size="sm" onClick={() => history.back()}>
        ← Back to Admin
      </Button>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <AdminGuard>
      <UsersContent />
    </AdminGuard>
  );
}
