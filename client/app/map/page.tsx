'use client';

// react-leaflet touches `window` at import time, so the entire route must
// be dynamically rendered (no SSG). The `useSearchParams()` hook also
// forces dynamic rendering and must be wrapped in a <Suspense> boundary
// per Next.js 14's CSR bailout rules.

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamicImport from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// react-leaflet touches `window` at import time, so we must load the MapView
// component client-side only. `ssr: false` ensures it is never evaluated
// during the Next.js server prerender pass.
const MapView = dynamicImport(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin mr-3" /> Loading map...
    </div>
  ),
});

function MapPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [villageList, setVillageList] = useState<string[]>([]);
  const preselectedVillage = searchParams.get('village');

  useEffect(() => {
    const fetchVillages = async () => {
      try {
        if (!supabase) {
          router.push('/login');
          return;
        }
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          router.push('/login');
          return;
        }
        const token = sessionData.session.access_token;
        const res = await fetch(`${API_BASE_URL}/api/documents`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const docs: any[] = data.documents || [];
        const villages = Array.from(
          new Set(
            docs
              .map((d: any) => d.village as string)
              .filter((v: string): v is string => typeof v === 'string' && v.length > 0),
          ),
        );
        setVillageList(villages.sort());
      } catch {
        // Silently fail — village list is optional, the user can still type
        // or pick from the seeded villages.
      }
    };
    fetchVillages();
  }, [router]);

  return (
    <MapView villageList={villageList} preselectedVillage={preselectedVillage} />
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-3" /> Loading map...
      </div>
    }>
      <MapPageInner />
    </Suspense>
  );
}
