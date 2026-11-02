'use client';

import React, { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { NavBar } from '@/components/navBar';

export type UserRole = 'officer' | 'reviewer' | 'admin';

const NavContext = createContext<{ role: UserRole | null; loading: boolean }>({
  role: null,
  loading: true,
});

export const useNavContext = () => useContext(NavContext);

/**
 * Pages that don't need the nav bar or auth check.
 *
 * Note: '/' is intentionally NOT in this list — the root route does its
 * own auth-aware redirect to /dashboard or /login (see app/page.tsx).
 */
const PUBLIC_PATHS = ['/login', '/signup', '/auth/callback'];

export function NavBarWrapper({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || (p !== '/' && pathname.startsWith(p)),
  );

  /**
   * Resolves the signed-in user's role.
   * 1. Try the backend profile (role from the local users collection —
   *    reflects admin-panel role changes immediately).
   * 2. Fall back to the Supabase session's user_metadata role.
   */
  const resolveRole = useCallback(async (): Promise<UserRole | null> => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return null;

    // 1. Backend profile (authoritative).
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const serverRole = json?.user?.role as UserRole | undefined;
        if (serverRole) {
          // Keep the backend users table in sync on first sign-in.
          void fetch(`${API_BASE_URL}/api/auth/sync`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          }).catch(() => {});
          return serverRole;
        }
      }
    } catch {
      // Backend unreachable — fall through to Supabase metadata.
    }

    // 2. Supabase metadata fallback.
    const { data: userData } = await supabase.auth.getUser();
    const metaRole = (userData.user?.app_metadata?.role ||
      userData.user?.user_metadata?.role) as UserRole | undefined;
    return metaRole || 'officer';
  }, []);

  // Initial load + auth state listener.
  useEffect(() => {
    setMounted(true);
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      const nextRole = await resolveRole();
      if (!cancelled) {
        setRole(nextRole);
        setLoading(false);
      }
    };

    void refresh();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setRole(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        void refresh();
      }
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [resolveRole]);

  // Redirect unauthenticated users away from protected pages (and send
  // signed-in users on public auth pages to the dashboard).
  useEffect(() => {
    if (!mounted || loading || isPublic) return;
    if (!role) {
      router.replace('/login');
    }
  }, [mounted, loading, isPublic, role, router]);

  // Don't render nav on public pages; avoid flashing it before hydration.
  const showNav = !isPublic && mounted && !!role;

  return (
    <NavContext.Provider value={{ role, loading }}>
      {showNav && <NavBar role={role} />}
      <>{children}</>
    </NavContext.Provider>
  );
}
