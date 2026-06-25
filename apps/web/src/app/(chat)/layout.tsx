'use client';

import { AuthGuard } from '@/components/auth/AuthGuard';
import { ChatProvider } from '@/components/chat/ChatProvider';
import { ToastProvider } from '@/components/ui/Toast';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ToastProvider>
        <ChatProvider>{children}</ChatProvider>
      </ToastProvider>
    </AuthGuard>
  );
}
