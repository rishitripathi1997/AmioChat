'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  createConversation,
  getCurrentUser,
  listConversations,
  listMessages,
  searchUsers,
} from '@/lib/api/client';
import { useWsClient } from '@/lib/ws/client';
import type { Conversation, Message, User, UserPublic, WsServerEnvelope } from '@amiochat/shared';

export default function ChatPage() {
  const { user, idToken, mode, signOut } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [typingFrom, setTypingFrom] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserPublic[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!idToken) return;
    setError(null);
    try {
      const [me, inbox] = await Promise.all([
        getCurrentUser(idToken),
        listConversations(idToken),
      ]);
      setProfile(me);
      setConversations(inbox.conversations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API data');
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  const loadMessages = useCallback(
    async (convId: string) => {
      if (!idToken) return;
      const result = await listMessages(idToken, convId);
      setMessages(result.messages);
    },
    [idToken],
  );

  const handleWsEvent = useCallback(
    (event: WsServerEnvelope) => {
      if (event.event === 'message.new' && selectedConv) {
        const msg = event.payload as Message;
        if (msg.convId === selectedConv.convId) {
          setMessages((prev) =>
            prev.some((m) => m.messageId === msg.messageId) ? prev : [...prev, msg],
          );
          if (idToken) {
            void loadData();
          }
        }
      }
      if (event.event === 'typing' && selectedConv) {
        const payload = event.payload as { convId: string; userId: string; isTyping: boolean };
        if (payload.convId === selectedConv.convId && payload.userId !== user?.userId) {
          setTypingFrom(payload.isTyping ? selectedConv.participant.displayName : null);
        }
      }
      if (event.event === 'error') {
        const payload = event.payload as { message?: string };
        setError(payload.message ?? 'WebSocket error');
      }
    },
    [idToken, loadData, selectedConv, user?.userId],
  );

  const { connected: wsConnected, send: wsSend } = useWsClient({
    idToken,
    onEvent: handleWsEvent,
  });

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedConv) {
      void loadMessages(selectedConv.convId);
    } else {
      setMessages([]);
    }
  }, [loadMessages, selectedConv]);

  const handleSearch = async () => {
    if (!idToken || searchQuery.trim().length < 3) return;
    setError(null);
    try {
      const result = await searchUsers(idToken, searchQuery.trim());
      setSearchResults(result.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    }
  };

  const handleStartChat = async (participantId: string) => {
    if (!idToken) return;
    setError(null);
    setStatus(null);
    try {
      const conv = await createConversation(idToken, participantId);
      setStatus(`Conversation ready with ${conv.participant.displayName}`);
      setSearchResults([]);
      setSearchQuery('');
      setSelectedConv(conv);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start conversation');
    }
  };

  const handleSend = () => {
    if (!selectedConv || !draft.trim()) return;
    const clientMsgId = crypto.randomUUID();
    wsSend({
      action: 'sendMessage',
      requestId: clientMsgId,
      payload: {
        convId: selectedConv.convId,
        clientMsgId,
        type: 'text',
        body: draft.trim(),
      },
    });
    setDraft('');
    void loadData();
  };

  const handleSelectConv = (conv: Conversation) => {
    setSelectedConv(conv);
    setTypingFrom(null);
  };

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f0f2f5]">
      <header className="flex items-center justify-between border-b border-[#d1d7db] bg-[#00a884] px-6 py-3 text-white">
        <div>
          <h1 className="text-lg font-semibold">AmioChat</h1>
          <p className="text-sm opacity-90">
            {user?.displayName} · {mode} mode · WS {wsConnected ? 'connected' : 'connecting…'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-lg bg-white/20 px-3 py-1.5 text-sm hover:bg-white/30"
        >
          Sign out
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
        {loading && (
          <p className="text-center text-[#667781]">Loading profile and conversations…</p>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {status && (
          <div className="rounded-lg bg-[#e7fce3] px-4 py-3 text-sm text-[#111b21]">{status}</div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {profile && (
              <section className="rounded-xl bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-[#111b21]">Your profile</h2>
                <p className="mt-2 text-sm text-[#667781]">
                  {profile.displayName} · {profile.email}
                </p>
              </section>
            )}

            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#111b21]">Start a conversation</h2>
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by email"
                  className="flex-1 rounded-lg border border-[#d1d7db] px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleSearch()}
                  disabled={searchQuery.trim().length < 3}
                  className="rounded-lg bg-[#00a884] px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  Search
                </button>
              </div>
              {searchResults.length > 0 && (
                <ul className="mt-4 divide-y divide-[#e9edef]">
                  {searchResults.map((u) => (
                    <li key={u.userId} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-[#111b21]">{u.displayName}</p>
                        <p className="text-sm text-[#667781]">{u.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleStartChat(u.userId)}
                        className="rounded-lg bg-[#00a884] px-3 py-1.5 text-sm text-white"
                      >
                        Chat
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#111b21]">Conversations</h2>
              {conversations.length === 0 ? (
                <p className="mt-3 text-sm text-[#667781]">No conversations yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-[#e9edef]">
                  {conversations.map((conv) => (
                    <li key={conv.convId}>
                      <button
                        type="button"
                        onClick={() => handleSelectConv(conv)}
                        className={`w-full py-3 text-left ${
                          selectedConv?.convId === conv.convId ? 'bg-[#f0f2f5]' : ''
                        }`}
                      >
                        <p className="font-medium text-[#111b21]">{conv.participant.displayName}</p>
                        <p className="text-sm text-[#667781]">{conv.lastMessagePreview || 'No messages'}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="flex min-h-[420px] flex-col rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111b21]">
              {selectedConv
                ? `Chat with ${selectedConv.participant.displayName}`
                : 'Select a conversation'}
            </h2>
            {typingFrom && (
              <p className="mt-1 text-xs text-[#667781]">{typingFrom} is typing…</p>
            )}

            <div className="mt-4 flex-1 space-y-2 overflow-y-auto rounded-lg bg-[#efeae2] p-4">
              {messages.length === 0 ? (
                <p className="text-sm text-[#667781]">No messages yet. Say hello!</p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.messageId}
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.senderId === user?.userId
                        ? 'ml-auto bg-[#d9fdd3] text-[#111b21]'
                        : 'bg-white text-[#111b21]'
                    }`}
                  >
                    {msg.body}
                  </div>
                ))
              )}
            </div>

            {selectedConv && (
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    wsSend({
                      action: 'typing',
                      payload: { convId: selectedConv.convId, isTyping: true },
                    });
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Type a message"
                  className="flex-1 rounded-lg border border-[#d1d7db] px-3 py-2 text-sm"
                  disabled={!wsConnected}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!wsConnected || !draft.trim()}
                  className="rounded-lg bg-[#00a884] px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            )}

            <p className="mt-3 text-xs text-[#8696a0]">
              Run <code className="rounded bg-[#f0f2f5] px-1">npm run dev:ws</code> in a second
              terminal. Full chat UI in Phase 4.6.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
