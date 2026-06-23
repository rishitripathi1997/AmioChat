import { Suspense } from 'react';
import { AuthShell } from '@/components/auth/AuthShell';
import { ConfirmSignUpForm } from '@/components/auth/ConfirmSignUpForm';

export default function ConfirmPage() {
  return (
    <AuthShell title="Verify your email" subtitle="One more step">
      <Suspense fallback={<p className="text-sm text-[#667781]">Loading…</p>}>
        <ConfirmSignUpForm />
      </Suspense>
    </AuthShell>
  );
}
