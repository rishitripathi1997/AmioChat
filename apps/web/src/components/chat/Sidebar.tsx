'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useChat } from '@/components/chat/ChatProvider';
import { ConversationItem } from '@/components/chat/ConversationItem';
import { NotificationToggle } from '@/components/chat/NotificationToggle';
import { NewChatModal } from '@/components/chat/NewChatModal';
import { Avatar } from '@/components/ui/Avatar';

export function Sidebar() {
  const { user, signOut } = useAuth();
  const {
    conversations,
    selectedConvId,
    sidebarSearch,
    setSidebarSearch,
    selectConversation,
    loading,
  } = useChat();
  const [newChatOpen, setNewChatOpen] = useState(false);

  return (
    <aside className="flex h-full w-full flex-col border-r border-[#e9edef] bg-white md:w-[380px] md:min-w-[380px]">
      <header className="flex items-center justify-between bg-[#f0f2f5] px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={user?.displayName ?? 'Me'} size="sm" online />
          <span className="font-medium text-[#111b21]">{user?.displayName}</span>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="text-sm text-[#00a884] hover:underline"
        >
          Sign out
        </button>
      </header>

      <div className="border-b border-[#e9edef] px-3 py-2">
        <input
          type="search"
          value={sidebarSearch}
          onChange={(e) => setSidebarSearch(e.target.value)}
          placeholder="Search or start new chat"
          className="w-full rounded-lg bg-[#f0f2f5] px-4 py-2 text-sm text-[#111b21] placeholder:text-[#667781] focus:outline-none focus:ring-2 focus:ring-[#00a884]/40"
          aria-label="Search conversations"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-6 text-center text-sm text-[#667781]">Loading conversations…</p>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-[#667781]">No conversations yet.</p>
            <button
              type="button"
              onClick={() => setNewChatOpen(true)}
              className="rounded-lg bg-[#00a884] px-4 py-2 text-sm font-medium text-white hover:bg-[#008f72]"
            >
              Start a new chat
            </button>
          </div>
        ) : (
          <ul>
            {conversations.map((conv) => (
              <li key={conv.convId}>
                <ConversationItem
                  conversation={conv}
                  selected={conv.convId === selectedConvId}
                  onSelect={() => selectConversation(conv.convId)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="border-t border-[#e9edef] p-3">
        <NotificationToggle />
        <button
          type="button"
          onClick={() => setNewChatOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#e9edef] py-2.5 text-sm font-medium text-[#00a884] hover:bg-[#f5f6f6]"
        >
          <span className="text-lg leading-none">+</span> New chat
        </button>
      </footer>

      <NewChatModal open={newChatOpen} onClose={() => setNewChatOpen(false)} />
    </aside>
  );
}
