'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

export function LoginForm() {
  const { signIn, mode } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn({ email, password });
      router.replace('/chat');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      if (message === 'CONFIRM_SIGN_UP') {
        router.push(`/confirm?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === 'mock' && (
        <p className="rounded-lg bg-[#e7fce3] px-3 py-2 text-sm text-[#111b21]">
          Local mock auth — no AWS. Use any email; confirm with code{' '}
          <strong>123456</strong>.
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <div>
        <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-[#111b21]">Email</label>
        <input
          id="login-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-[#d1d7db] px-3 py-2.5 outline-none focus:border-[#00a884]"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-[#111b21]">Password</label>
        <input
          id="login-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-[#d1d7db] px-3 py-2.5 outline-none focus:border-[#00a884]"
          placeholder="••••••••"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[#00a884] py-2.5 font-medium text-white hover:bg-[#008f6f] disabled:opacity-60"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center text-sm text-[#667781]">
        No account?{' '}
        <Link href="/register" className="text-[#00a884] hover:underline">
          Create one
        </Link>
      </p>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="text-[#667781] hover:underline">
          Forgot password?
        </Link>
      </p>
    </form>
  );
}
