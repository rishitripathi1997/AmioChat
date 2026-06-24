'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useChat } from '@/components/chat/ChatProvider';
import { MessageBubble } from '@/components/chat/MessageBubble';
import type { DisplayMessage } from '@/lib/chat/utils';
import { dayLabel } from '@/lib/chat/utils';

export function MessageList() {
  const { user } = useAuth();
  const { messages, pendingMessages, selectedConvId } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  const displayMessages = useMemo((): DisplayMessage[] => {
    const pending = pendingMessages.filter((p) => p.convId === selectedConvId);
    return [...messages, ...pending].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [messages, pendingMessages, selectedConvId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages]);

  let lastDay = '';

  return (
    <div
      className="flex-1 overflow-y-auto bg-[#efeae2] px-4 py-4"
      aria-live="polite"
      aria-label="Messages"
    >
      {displayMessages.length === 0 ? (
        <p className="text-center text-sm text-[#667781]">
          No messages yet. Send a message to start the conversation.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {displayMessages.map((msg) => {
            const day = dayLabel(msg.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            const key = 'clientMsgId' in msg ? msg.clientMsgId : msg.messageId;

            return (
              <div key={key}>
                {showDay && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-lg bg-white/90 px-3 py-1 text-xs text-[#54656f] shadow-sm">
                      {day}
                    </span>
                  </div>
                )}
                <MessageBubble message={msg} isOwn={msg.senderId === user?.userId} />
              </div>
            );
          })}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
