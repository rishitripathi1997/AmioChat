'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

export function RegisterForm() {
  const { signUp, mode } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signUp({ email, password, displayName });
      router.push(`/confirm?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === 'mock' && (
        <p className="rounded-lg bg-[#e7fce3] px-3 py-2 text-sm text-[#111b21]">
          Mock mode — verification code is <strong>123456</strong>.
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium">Display name</label>
        <input
          type="text"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-lg border border-[#d1d7db] px-3 py-2.5 outline-none focus:border-[#00a884]"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-[#d1d7db] px-3 py-2.5 outline-none focus:border-[#00a884]"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Password</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-[#d1d7db] px-3 py-2.5 outline-none focus:border-[#00a884]"
          placeholder="Min 8 chars, upper, lower, number"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[#00a884] py-2.5 font-medium text-white hover:bg-[#008f6f] disabled:opacity-60"
      >
        {loading ? 'Creating account…' : 'Create account'}
      </button>
      <p className="text-center text-sm text-[#667781]">
        Already have an account?{' '}
        <Link href="/login" className="text-[#00a884] hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
