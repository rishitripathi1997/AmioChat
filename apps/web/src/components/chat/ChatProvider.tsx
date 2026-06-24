'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  createConversation,
  createCall,
  endCall as endCallApi,
  joinCall,
  listConversations,
  listMessages,
  searchUsers,
} from '@/lib/api/client';
import type { PendingMessage } from '@/lib/chat/utils';
import { createMeetingController, type MeetingController } from '@/lib/chime/meeting';
import { useWsClient, type WsConnectionState } from '@/lib/ws/client';
import type {
  CallType,
  Conversation,
  IncomingCallPayload,
  Message,
  UserPublic,
  WsServerEnvelope,
} from '@amiochat/shared';
import { isMockChimeMeeting } from '@amiochat/shared';

interface QueuedOutbound {
  clientMsgId: string;
  convId: string;
  body: string;
}

interface ActiveCallState {
  callId: string;
  convId: string;
  type: CallType;
  remoteName: string;
  status: 'ringing' | 'connected';
  role: 'caller' | 'callee';
  isMock: boolean;
}

interface ChatContextValue {
  conversations: Conversation[];
  selectedConvId: string | null;
  selectedConv: Conversation | null;
  messages: Message[];
  pendingMessages: PendingMessage[];
  typingName: string | null;
  connectionState: WsConnectionState;
  loading: boolean;
  sidebarSearch: string;
  setSidebarSearch: (q: string) => void;
  selectConversation: (convId: string | null) => void;
  sendTextMessage: (body: string) => void;
  sendTyping: (isTyping: boolean) => void;
  refreshInbox: () => Promise<void>;
  searchContacts: (query: string) => Promise<UserPublic[]>;
  startConversation: (participantId: string) => Promise<void>;
  showSidebarOnMobile: boolean;
  setShowSidebarOnMobile: (show: boolean) => void;
  incomingCall: IncomingCallPayload | null;
  activeCall: ActiveCallState | null;
  startCall: (type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  callMuted: boolean;
  callVideoEnabled: boolean;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user, idToken } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [typingByConv, setTypingByConv] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [showSidebarOnMobile, setShowSidebarOnMobile] = useState(true);
  const [outboundQueue, setOutboundQueue] = useState<QueuedOutbound[]>([]);
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const [callMuted, setCallMuted] = useState(false);
  const [callVideoEnabled, setCallVideoEnabled] = useState(false);

  const meetingControllerRef = useRef<MeetingController | null>(null);
  const sessionRef = useRef<Awaited<ReturnType<typeof createCall>> | null>(null);

  const selectedConvIdRef = useRef(selectedConvId);
  const lastMessageAtRef = useRef<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);

  useEffect(() => {
    selectedConvIdRef.current = selectedConvId;
  }, [selectedConvId]);

  const selectedConv = useMemo(
    () => conversations.find((c) => c.convId === selectedConvId) ?? null,
    [conversations, selectedConvId],
  );

  const typingName =
    selectedConvId && typingByConv[selectedConvId]
      ? (selectedConv?.participant.displayName ?? null)
      : null;

  const refreshInbox = useCallback(async () => {
    if (!idToken) return;
    const inbox = await listConversations(idToken);
    setConversations(inbox.conversations);
  }, [idToken]);

  const loadMessagesForConv = useCallback(
    async (convId: string, since?: string) => {
      if (!idToken) return;
      const result = await listMessages(idToken, convId, { since, limit: 100 });
      if (since) {
        setMessages((prev) => {
          const merged = [...prev];
          for (const msg of result.messages) {
            if (!merged.some((m) => m.messageId === msg.messageId)) {
              merged.push(msg);
            }
          }
          return merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        });
      } else {
        setMessages(result.messages);
      }
      if (result.messages.length > 0) {
        lastMessageAtRef.current = result.messages[result.messages.length - 1].createdAt;
      }
    },
    [idToken],
  );

  const markRead = useCallback(
    (convId: string, messageId: string) => {
      wsSendRef.current?.({
        action: 'read',
        payload: { convId, messageId },
      });
    },
    [],
  );

  const wsSendRef = useRef<((envelope: import('@amiochat/shared').WsClientEnvelope) => boolean) | null>(null);

  const cleanupCall = useCallback(async () => {
    await meetingControllerRef.current?.leave();
    meetingControllerRef.current = null;
    sessionRef.current = null;
    setActiveCall(null);
    setIncomingCall(null);
    setCallMuted(false);
    setCallVideoEnabled(false);
    await refreshInbox();
    const convId = selectedConvIdRef.current;
    if (convId) {
      await loadMessagesForConv(convId);
    }
  }, [loadMessagesForConv, refreshInbox]);

  const handleWsEvent = useCallback(
    (event: WsServerEnvelope) => {
      if (event.event === 'message.new') {
        const msg = event.payload as Message;
        const activeConvId = selectedConvIdRef.current;

        if (activeConvId === msg.convId) {
          setMessages((prev) =>
            prev.some((m) => m.messageId === msg.messageId) ? prev : [...prev, msg],
          );
          markRead(msg.convId, msg.messageId);
        }

        setConversations((prev) =>
          prev.map((c) => {
            if (c.convId !== msg.convId) return c;
            return {
              ...c,
              lastMessageAt: msg.createdAt,
              lastMessagePreview: msg.body ?? `[${msg.type}]`,
              unreadCount:
                activeConvId === msg.convId || msg.senderId === user?.userId
                  ? c.unreadCount
                  : c.unreadCount + 1,
            };
          }),
        );
      }

      if (event.event === 'message.ack') {
        const payload = event.payload as {
          clientMsgId: string;
          messageId: string;
          status: string;
        };
        setPendingMessages((prev) =>
          prev.filter((m) => m.clientMsgId !== payload.clientMsgId),
        );
        const convId = selectedConvIdRef.current;
        if (convId) {
          void loadMessagesForConv(convId);
        }
        void refreshInbox();
      }

      if (event.event === 'typing') {
        const payload = event.payload as {
          convId: string;
          userId: string;
          isTyping: boolean;
        };
        if (payload.userId === user?.userId) return;

        setTypingByConv((prev) => {
          const next = { ...prev };
          if (payload.isTyping) {
            next[payload.convId] = true;
          } else {
            delete next[payload.convId];
          }
          return next;
        });

        if (payload.isTyping) {
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => {
            setTypingByConv((prev) => {
              const next = { ...prev };
              delete next[payload.convId];
              return next;
            });
          }, 4000);
        }
      }

      if (event.event === 'read') {
        const payload = event.payload as { convId: string; messageId: string };
        if (selectedConvIdRef.current === payload.convId) {
          setMessages((prev) => {
            const target = prev.find((m) => m.messageId === payload.messageId);
            if (!target) return prev;
            return prev.map((m) =>
              m.senderId === user?.userId && m.createdAt <= target.createdAt
                ? { ...m, status: 'read' as const }
                : m,
            );
          });
        }
      }

      if (event.event === 'call.incoming') {
        const payload = event.payload as IncomingCallPayload;
        setIncomingCall(payload);
      }

      if (event.event === 'call.updated') {
        const payload = event.payload as { callId: string; status: string };
        if (payload.status === 'connected') {
          setActiveCall((prev) =>
            prev && prev.callId === payload.callId
              ? { ...prev, status: 'connected' }
              : prev,
          );
        }
        if (['ended', 'declined', 'missed'].includes(payload.status)) {
          void cleanupCall();
        }
      }
    },
    [cleanupCall, loadMessagesForConv, markRead, refreshInbox, user?.userId],
  );

  const handleReconnect = useCallback(async () => {
    await refreshInbox();
    const convId = selectedConvIdRef.current;
    if (convId && lastMessageAtRef.current) {
      await loadMessagesForConv(convId, lastMessageAtRef.current);
    }
  }, [loadMessagesForConv, refreshInbox]);

  const { connectionState, send: wsSend, connected } = useWsClient({
    idToken,
    onEvent: handleWsEvent,
    onReconnect: handleReconnect,
  });

  useEffect(() => {
    wsSendRef.current = wsSend;
  }, [wsSend]);

  useEffect(() => {
    if (!idToken) return;
    (async () => {
      setLoading(true);
      try {
        await refreshInbox();
      } finally {
        setLoading(false);
      }
    })();
  }, [idToken, refreshInbox]);

  useEffect(() => {
    if (!selectedConvId) {
      setMessages([]);
      return;
    }
    void loadMessagesForConv(selectedConvId);
    setConversations((prev) =>
      prev.map((c) =>
        c.convId === selectedConvId ? { ...c, unreadCount: 0 } : c,
      ),
    );
  }, [loadMessagesForConv, selectedConvId]);

  useEffect(() => {
    if (!selectedConvId || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.senderId !== user?.userId) {
      markRead(selectedConvId, last.messageId);
    }
  }, [markRead, messages, selectedConvId, user?.userId]);

  const flushQueue = useCallback(() => {
    if (!connected || outboundQueue.length === 0) return;
    const sent: string[] = [];
    for (const item of outboundQueue) {
      const ok = wsSend({
        action: 'sendMessage',
        requestId: item.clientMsgId,
        payload: {
          convId: item.convId,
          clientMsgId: item.clientMsgId,
          type: 'text',
          body: item.body,
        },
      });
      if (ok) sent.push(item.clientMsgId);
    }
    if (sent.length > 0) {
      setOutboundQueue((prev) => prev.filter((q) => !sent.includes(q.clientMsgId)));
    }
  }, [connected, outboundQueue, wsSend]);

  useEffect(() => {
    flushQueue();
  }, [flushQueue]);

  const sendTextMessage = useCallback(
    (body: string) => {
      if (!selectedConvId || !user?.userId || !body.trim()) return;

      const clientMsgId = crypto.randomUUID();
      const trimmed = body.trim();
      const pending: PendingMessage = {
        clientMsgId,
        convId: selectedConvId,
        senderId: user.userId,
        body: trimmed,
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      setPendingMessages((prev) => [...prev, pending]);

      const sent = wsSend({
        action: 'sendMessage',
        requestId: clientMsgId,
        payload: {
          convId: selectedConvId,
          clientMsgId,
          type: 'text',
          body: trimmed,
        },
      });

      if (!sent) {
        setOutboundQueue((prev) => [
          ...prev,
          { clientMsgId, convId: selectedConvId, body: trimmed },
        ]);
      }
    },
    [selectedConvId, user?.userId, wsSend],
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!selectedConvId) return;
      const now = Date.now();
      if (isTyping && now - lastTypingSentRef.current < 2000) return;
      lastTypingSentRef.current = now;
      wsSend({
        action: 'typing',
        payload: { convId: selectedConvId, isTyping },
      });
    },
    [selectedConvId, wsSend],
  );

  const selectConversation = useCallback((convId: string | null) => {
    setSelectedConvId(convId);
    setShowSidebarOnMobile(false);
    setTypingByConv((prev) => {
      if (!convId) return prev;
      const next = { ...prev };
      delete next[convId];
      return next;
    });
  }, []);

  const searchContacts = useCallback(
    async (query: string) => {
      if (!idToken || query.trim().length < 3) return [];
      const result = await searchUsers(idToken, query.trim());
      return result.users;
    },
    [idToken],
  );

  const startConversation = useCallback(
    async (participantId: string) => {
      if (!idToken) return;
      const conv = await createConversation(idToken, participantId);
      await refreshInbox();
      setSelectedConvId(conv.convId);
      setShowSidebarOnMobile(false);
    },
    [idToken, refreshInbox],
  );

  const startCall = useCallback(
    async (type: CallType) => {
      if (!idToken || !selectedConv) return;
      const session = await createCall(idToken, selectedConv.convId, type);
      sessionRef.current = session;

      setActiveCall({
        callId: session.callId,
        convId: session.convId,
        type: session.type,
        remoteName: selectedConv.participant.displayName,
        status: 'ringing',
        role: 'caller',
        isMock: isMockChimeMeeting(session.chimeMeeting.meetingId),
      });
      setCallVideoEnabled(type === 'video');

      const controller = await createMeetingController(
        session.chimeMeeting,
        session.attendee,
        type === 'video',
      );
      meetingControllerRef.current = controller;
      await controller.join();
    },
    [idToken, selectedConv],
  );

  const acceptCall = useCallback(async () => {
    if (!idToken || !incomingCall) return;

    wsSend({
      action: 'callSignal',
      payload: { callId: incomingCall.callId, signal: 'accept' },
    });

    const joined = await joinCall(idToken, incomingCall.callId);

    setActiveCall({
      callId: incomingCall.callId,
      convId: incomingCall.convId,
      type: incomingCall.type,
      remoteName: incomingCall.callerName,
      status: 'connected',
      role: 'callee',
      isMock: isMockChimeMeeting(joined.chimeMeeting.meetingId),
    });
    setIncomingCall(null);
    setCallVideoEnabled(incomingCall.type === 'video');

    const controller = await createMeetingController(
      joined.chimeMeeting,
      {
        attendeeId: joined.attendeeId,
        joinToken: joined.joinToken,
        externalUserId: joined.externalUserId,
      },
      incomingCall.type === 'video',
    );
    meetingControllerRef.current = controller;
    await controller.join();
  }, [idToken, incomingCall, wsSend]);

  const declineCall = useCallback(async () => {
    if (!incomingCall) return;
    wsSend({
      action: 'callSignal',
      payload: { callId: incomingCall.callId, signal: 'decline' },
    });
    setIncomingCall(null);
  }, [incomingCall, wsSend]);

  const endCall = useCallback(async () => {
    if (!idToken || !activeCall) return;
    try {
      await endCallApi(idToken, activeCall.callId);
    } finally {
      wsSend({
        action: 'callSignal',
        payload: { callId: activeCall.callId, signal: 'end' },
      });
      await cleanupCall();
    }
  }, [activeCall, cleanupCall, idToken, wsSend]);

  const toggleMute = useCallback(() => {
    const controller = meetingControllerRef.current;
    if (!controller) return;
    setCallMuted(controller.toggleMute());
  }, []);

  const toggleVideo = useCallback(() => {
    const controller = meetingControllerRef.current;
    if (!controller) return;
    setCallVideoEnabled(controller.toggleVideo());
  }, []);

  const filteredConversations = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.participant.displayName.toLowerCase().includes(q) ||
        c.participant.email.toLowerCase().includes(q) ||
        c.lastMessagePreview.toLowerCase().includes(q),
    );
  }, [conversations, sidebarSearch]);

  const value: ChatContextValue = {
    conversations: filteredConversations,
    selectedConvId,
    selectedConv,
    messages,
    pendingMessages,
    typingName,
    connectionState,
    loading,
    sidebarSearch,
    setSidebarSearch,
    selectConversation,
    sendTextMessage,
    sendTyping,
    refreshInbox,
    searchContacts,
    startConversation,
    showSidebarOnMobile,
    setShowSidebarOnMobile,
    incomingCall,
    activeCall,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    callMuted,
    callVideoEnabled,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return ctx;
}
