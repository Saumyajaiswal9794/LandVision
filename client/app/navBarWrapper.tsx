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
 */
const PUBLIC_PATHS = ['/login', '/signup', '/'];

export function NavBarWrapper({ children }: { children: React.ReactNode }) {
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

    const getSession = async () => {
      const { data, error } = await supabase.auth.getSession();

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
