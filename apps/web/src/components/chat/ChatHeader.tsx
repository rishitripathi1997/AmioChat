import { useChat } from '@/components/chat/ChatProvider';
import { Avatar } from '@/components/ui/Avatar';

export function ChatHeader() {
  const { selectedConv, setShowSidebarOnMobile } = useChat();

  if (!selectedConv) return null;

  const { participant } = selectedConv;

  return (
    <header className="flex items-center gap-3 border-b border-[#e9edef] bg-[#f0f2f5] px-4 py-3">
      <button
        type="button"
        className="mr-1 text-[#54656f] md:hidden"
        onClick={() => setShowSidebarOnMobile(true)}
        aria-label="Back to conversations"
      >
        ←
      </button>
      <Avatar name={participant.displayName} size="sm" online />
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-medium text-[#111b21]">{participant.displayName}</h1>
        <p className="truncate text-xs text-[#667781]">{participant.email}</p>
      </div>
      <div className="flex gap-1 opacity-40" title="Voice and video calls in Phase 4.7">
        <button type="button" disabled className="rounded-full p-2" aria-label="Voice call">
          📞
        </button>
        <button type="button" disabled className="rounded-full p-2" aria-label="Video call">
          📹
        </button>
      </div>
    </header>
  );
}
