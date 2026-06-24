'use client';

import { AuthGuard } from '@/components/auth/AuthGuard';
import { ChatProvider } from '@/components/chat/ChatProvider';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ChatProvider>{children}</ChatProvider>
    </AuthGuard>
  );
}
