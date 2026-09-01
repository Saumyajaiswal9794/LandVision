'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { LayoutDashboard, Upload, FileSearch, LogOut, Menu, X, MapPin } from 'lucide-react';

interface NavBarProps {
  role?: 'officer' | 'reviewer' | null;
}

export function NavBar({ role }: NavBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    router.push('/login');
  };

  const linkClass = (href: string) => {
    const isActive = pathname === href || (href === '/dashboard' && pathname.startsWith('/dashboard'));
    return `flex items-center gap-2 text-sm font-medium transition-colors px-3 py-2 rounded-md ${
      isActive ? 'bg-brand-100 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-xl font-bold text-brand-600 tracking-tight">
            LandVision
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex gap-1">
            <Link href="/dashboard" className={linkClass('/dashboard')}>
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
            {role === 'officer' && (
              <Link href="/upload" className={linkClass('/upload')}>
                <Upload className="w-4 h-4" />
                Upload
              </Link>
            )}
            {role === 'reviewer' && (
              <Link href="/dashboard?status=needs_review" className={linkClass('/dashboard?status=needs_review')}>
                <FileSearch className="w-4 h-4" />
                Review Queue
              </Link>
            )}
            <Link href="/map" className={linkClass('/map')}>
              <MapPin className="w-4 h-4" />
              Map
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-slate-400 capitalize bg-slate-100 px-2 py-1 rounded">
            {role}
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-red-600 transition-colors px-3 py-2 rounded-md hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pb-3 space-y-1">
          <Link href="/dashboard" className={linkClass('/dashboard')} onClick={() => setMobileOpen(false)}>
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          {role === 'officer' && (
            <Link href="/upload" className={linkClass('/upload')} onClick={() => setMobileOpen(false)}>
              <Upload className="w-4 h-4" />
              Upload
            </Link>
          )}
          {role === 'reviewer' && (
            <Link href="/dashboard?status=needs_review" className={linkClass('/dashboard?status=needs_review')} onClick={() => setMobileOpen(false)}>
              <FileSearch className="w-4 h-4" />
              Review Queue
            </Link>
          )}
          <Link href="/map" className={linkClass('/map')} onClick={() => setMobileOpen(false)}>
            <MapPin className="w-4 h-4" />
            Map
          </Link>
        </div>
      )}
    </header>
  );
}

export default NavBar;
