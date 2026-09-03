'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

/**
 * Root route — auth-aware redirect (Sprint 5 audit fix).
 *
 * Previously this file was a Sprint 1 mock dashboard that rendered hardcoded
 * fake data (1,248 / 34 / 1,214 cards, APPROVED/PENDING/UNDER_REVIEW badges,
 * Khata No. column) at `localhost:3000` with NO auth guard, so anyone could
 * see a fake dashboard without logging in.
 *
 * Now it does the only thing a root route should do in an auth-gated app:
 *   - If the user has a Supabase session -> redirect to /dashboard.
 *   - Otherwise                          -> redirect to /login.
 *
 * The real dashboard lives at /dashboard (which has its own auth guard as a
 * backstop) and renders counts/records from the live GET /api/documents
 * response.
 */
export default function RootRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const decide = async () => {
      try {
        if (!supabase) {
          // Supabase not configured (e.g. missing NEXT_PUBLIC_SUPABASE_* env
          // vars) — there is nothing useful to show, send to /login so the
          // user sees the configuration error message there.
          if (!cancelled) router.replace('/login');
          return;
        }
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          router.replace('/dashboard');
        } else {
          router.replace('/login');
        }
      } catch {
        if (!cancelled) router.replace('/login');
      }
    };

    decide();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Minimal blank fallback while the redirect resolves (one render frame).
  // No data is shown — by design, so an unauthenticated visitor never sees
  // any record information even for a split second.
  return (
    <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
      <p className="text-sm">Loading LandVision…</p>
    </div>
  );
}
