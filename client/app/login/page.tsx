'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/card';
import { Button } from '../../components/button';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!supabase) {
        setError('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in client/.env.local');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError('Login failed: No user data returned');
        setLoading(false);
        return;
      }

      // Get the user's role from metadata
      const userRole = data.user.user_metadata?.role;

      if (!userRole) {
        setError('User role not configured. Please contact support.');
        setLoading(false);
        return;
      }

      // Redirect based on role from user_metadata
      if (userRole === 'officer' || userRole === 'reviewer') {
        router.push('/dashboard');
      } else {
        setError(`Unknown role: ${userRole}`);
        setLoading(false);
        return;
      }
    } catch (err) {
      setError((err as Error).message || 'An error occurred during login');
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="w-full max-w-md">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Access the Land Ownership digitization portal with your Gov credentials.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-500 disabled:bg-gray-100"
                placeholder="officer@nic.in"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-500 disabled:bg-gray-100"
                placeholder="••••••••"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Verifying...' : 'Login'}
            </Button>
            <div className="text-center text-xs text-slate-500">
              Don't have an account?{' '}
              <Link href="/signup" className="text-brand-600 hover:text-brand-700 font-medium">
                Sign up
              </Link>
            </div>
            <div className="text-center text-xs text-slate-400">
              Authorized personnel only. All access attempts are audited.
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
