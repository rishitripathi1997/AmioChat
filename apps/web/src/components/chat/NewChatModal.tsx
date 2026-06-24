'use client';

import { useEffect, useState } from 'react';
import { useChat } from '@/components/chat/ChatProvider';
import type { UserPublic } from '@amiochat/shared';
import { Avatar } from '@/components/ui/Avatar';

interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewChatModal({ open, onClose }: NewChatModalProps) {
  const { searchContacts, startConversation } = useChat();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSearch = async () => {
    if (query.trim().length < 3) return;
    setLoading(true);
    setError(null);
    try {
      const users = await searchContacts(query);
      setResults(users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      await startConversation(userId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start chat');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-chat-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e9edef] px-5 py-4">
          <h2 id="new-chat-title" className="text-lg font-semibold text-[#111b21]">
            New chat
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#667781] hover:text-[#111b21]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          <p className="mb-3 text-sm text-[#667781]">Search by email (min 3 characters)</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
              placeholder="email@example.com"
              className="flex-1 rounded-lg border border-[#e9edef] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]/40"
              autoFocus
            />
            <button
              type="button"
              onClick={() => void handleSearch()}
              disabled={query.trim().length < 3 || loading}
              className="rounded-lg bg-[#00a884] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Search
            </button>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <ul className="mt-4 max-h-64 overflow-y-auto">
            {results.map((u) => (
              <li key={u.userId}>
                <button
                  type="button"
                  onClick={() => void handleStart(u.userId)}
                  disabled={loading}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-[#f5f6f6] disabled:opacity-50"
                >
                  <Avatar name={u.displayName} size="sm" />
                  <div>
                    <p className="font-medium text-[#111b21]">{u.displayName}</p>
                    <p className="text-sm text-[#667781]">{u.email}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
