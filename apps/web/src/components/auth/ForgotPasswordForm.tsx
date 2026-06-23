'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

export function ForgotPasswordForm() {
  const { forgotPassword, resetPassword, mode } = useAuth();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await forgotPassword({ email });
      setMessage('If an account exists, a reset code was sent.');
      setStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword({ email, code, newPassword });
      setMessage('Password updated. You can sign in now.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {mode === 'mock' && (
        <p className="rounded-lg bg-[#e7fce3] px-3 py-2 text-sm">
          Mock reset code: <strong>123456</strong>
        </p>
      )}
      {message && (
        <p className="rounded-lg bg-[#e7fce3] px-3 py-2 text-sm text-[#111b21]">{message}</p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {step === 'request' ? (
        <form onSubmit={onRequest} className="space-y-4">
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
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#00a884] py-2.5 font-medium text-white"
          >
            Send reset code
          </button>
        </form>
      ) : (
        <form onSubmit={onReset} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Reset code</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-[#d1d7db] px-3 py-2.5 outline-none focus:border-[#00a884]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">New password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-[#d1d7db] px-3 py-2.5 outline-none focus:border-[#00a884]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#00a884] py-2.5 font-medium text-white"
          >
            Update password
          </button>
        </form>
      )}

      <p className="text-center text-sm">
        <Link href="/login" className="text-[#667781] hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
