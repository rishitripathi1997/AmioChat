import { useChat } from '@/components/chat/ChatProvider';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { Composer } from '@/components/chat/Composer';
import { ConnectionBanner } from '@/components/chat/ConnectionBanner';
import { MessageList } from '@/components/chat/MessageList';
import { TypingIndicator } from '@/components/chat/TypingIndicator';

export function ThreadPanel() {
  const { selectedConv, connectionState, typingName } = useChat();

  if (!selectedConv) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[#f8f9fa] p-8 text-center">
        <div className="mb-4 text-6xl opacity-30" aria-hidden>
          💬
        </div>
        <h2 className="text-xl font-light text-[#41525d]">AmioChat Web</h2>
        <p className="mt-2 max-w-sm text-sm text-[#667781]">
          Select a conversation from the sidebar or start a new chat to send messages.
        </p>
        <p className="mt-6 text-xs text-[#8696a0]">
          Run <code className="rounded bg-[#e9edef] px-1">npm run dev:ws</code> for real-time
          messaging.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      <ConnectionBanner state={connectionState} />
      <ChatHeader />
      <MessageList />
      {typingName && <TypingIndicator name={typingName} />}
      <Composer connectionState={connectionState} />
    </div>
  );
}
