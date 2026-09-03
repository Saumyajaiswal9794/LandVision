'use client';

import React, { useEffect, useState, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { NavBar } from '@/components/navBar';

const NavContext = createContext<{ role: 'officer' | 'reviewer' | null; loading: boolean }>({
  role: null,
  loading: true,
});

export const useNavContext = () => useContext(NavContext);

/**
 * Pages that don't need the nav bar or auth check.
 *
 * Note: '/' is intentionally NOT in this list — the root route now does its
 * own auth-aware redirect to /dashboard or /login (see app/page.tsx) and we
 * want NavBarWrapper's auth listener to run for it too, as a backstop in
 * case the root page's redirect is slow or fails.
 */
const PUBLIC_PATHS = ['/login', '/signup'];

export function NavBarWrapper({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<'officer' | 'reviewer' | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || (p !== '/' && pathname.startsWith(p)),
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!supabase) {
      // Supabase not configured — treat as unauthenticated
      setLoading(false);
      if (!isPublic) {
        router.push('/login');
      }
      return;
    }

    // Capture in a local const so TS knows the closure below can't run after
    // the value has been nulled (it can't — `supabase` is module-level and
    // never reassigned, but TS's narrowing doesn't survive the closure).
    const client = supabase;

    const getSession = async () => {
      const { data, error } = await client.auth.getSession();

      if (error || !data.session) {
        setRole(null);
        setLoading(false);
        if (!isPublic) {
          router.push('/login');
        }
        return;
      }

      const userRole = data.session.user?.user_metadata?.role as 'officer' | 'reviewer' | null;
      setRole(userRole);
      setLoading(false);
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const r = session.user?.user_metadata?.role as 'officer' | 'reviewer' | null;
        setRole(r);
      } else {
        setRole(null);
        if (!isPublic) {
          router.push('/login');
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [mounted, isPublic, router]);

  // Don't render nav on public pages
  const showNav = !isPublic && mounted;

  return (
    <NavContext.Provider value={{ role, loading }}>
      {showNav && <NavBar role={role} />}
      <>{children}</>
    </NavContext.Provider>
  );
}
