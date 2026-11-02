'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        if (!supabase) {
          setError('Supabase is not configured');
          return;
        }

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setError(error.message);
          setTimeout(() => router.push('/login'), 3000);
          return;
        }

        if (data.session) {
          try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auth/sync`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${data.session.access_token}`,
                'Content-Type': 'application/json',
              },
            });
          } catch (e) {
            console.warn('Failed to sync user:', e);
          }
          router.push('/dashboard');
        } else {
          setError('No session found');
          setTimeout(() => router.push('/login'), 3000);
        }
      } catch (err) {
        setError((err as Error).message || 'An error occurred');
        setTimeout(() => router.push('/login'), 3000);
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-red-600 mb-4">{error}</p>
            <p className="text-sm text-slate-500">Redirecting to login...</p>
          </>
        ) : (
          <p className="text-slate-600">Completing sign in...</p>
        )}
      </div>
    </div>
  );
}
