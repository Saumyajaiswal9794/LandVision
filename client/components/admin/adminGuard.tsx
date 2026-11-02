'use client';

import React from 'react';
import { useNavContext } from '@/app/navBarWrapper';
import { Card, CardContent } from '@/components/card';
import { ShieldAlert } from 'lucide-react';

/**
 * Client-side guard for /admin/* pages. Renders children only for admins;
 * everyone else (including anonymous visitors) gets a readable Forbidden
 * panel. The server still enforces requireRole(['admin']) — this is UX only.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { role, loading } = useNavContext();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshSpinner />
        Checking permissions...
      </div>
    );
  }

  if (role !== 'admin') {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <ShieldAlert className="w-12 h-12 text-red-300 mx-auto mb-4" />
          <p className="text-slate-700 font-medium">Forbidden</p>
          <p className="text-slate-400 text-sm mt-1">
            You need an administrator account to view this page.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}

function RefreshSpinner() {
  return (
    <svg
      className="w-5 h-5 animate-spin mr-3 text-slate-400"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
