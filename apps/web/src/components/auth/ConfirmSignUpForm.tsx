'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

export function ConfirmSignUpForm() {
  const { confirmSignUp, mode } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await confirmSignUp({ email, code });
      router.replace('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === 'mock' && (
        <p className="rounded-lg bg-[#e7fce3] px-3 py-2 text-sm">
          Enter code <strong>123456</strong> in mock mode.
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <div>
        <label htmlFor="confirm-email" className="mb-1 block text-sm font-medium">Email</label>
        <input
          id="confirm-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-[#d1d7db] px-3 py-2.5 outline-none focus:border-[#00a884]"
        />
      </div>
      <div>
        <label htmlFor="confirm-code" className="mb-1 block text-sm font-medium">Verification code</label>
        <input
          id="confirm-code"
          type="text"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full rounded-lg border border-[#d1d7db] px-3 py-2.5 outline-none focus:border-[#00a884]"
          placeholder="6-digit code"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[#00a884] py-2.5 font-medium text-white hover:bg-[#008f6f] disabled:opacity-60"
      >
        {loading ? 'Verifying…' : 'Verify email'}
      </button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-[#667781] hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
