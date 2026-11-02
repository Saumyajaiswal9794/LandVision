'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/card';
import { Users, ScrollText, BarChart3, ChevronRight } from 'lucide-react';
import { AdminGuard } from '../../components/admin/adminGuard';

const ADMIN_SECTIONS = [
  {
    href: '/admin/users',
    title: 'User Management',
    description: 'View registered users and manage their roles (officer / reviewer / admin).',
    icon: Users,
    iconClass: 'text-brand-600 bg-brand-50',
  },
  {
    href: '/admin/audit',
    title: 'Audit Logs',
    description: 'Every upload, extraction, correction, review and role change — who did what, when.',
    icon: ScrollText,
    iconClass: 'text-amber-600 bg-amber-50',
  },
  {
    href: '/admin/usage',
    title: 'AI Usage & Cost',
    description: 'Gemini token consumption and estimated cost per extraction.',
    icon: BarChart3,
    iconClass: 'text-emerald-600 bg-emerald-50',
  },
] as const;

export default function AdminPage() {
  return (
    <AdminGuard>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-slate-500 mt-1">
            Manage users, inspect system activity and track AI usage.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {ADMIN_SECTIONS.map(({ href, title, description, icon: Icon, iconClass }) => (
            <Link key={href} href={href} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardHeader>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${iconClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <CardTitle className="flex items-center gap-1 text-base">
                    {title}
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                  </CardTitle>
                  <CardDescription className="text-sm">{description}</CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AdminGuard>
  );
}
