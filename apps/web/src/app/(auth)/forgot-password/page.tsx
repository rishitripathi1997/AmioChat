import { AuthShell } from '@/components/auth/AuthShell';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset password" subtitle="We will send you a code">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
