import type { Conversation } from '@amiochat/shared';
import { Avatar } from '@/components/ui/Avatar';
import { formatConversationTime } from '@/lib/chat/utils';

interface ConversationItemProps {
  conversation: Conversation;
  selected: boolean;
  onSelect: () => void;
}

export function ConversationItem({ conversation, selected, onSelect }: ConversationItemProps) {
  const { participant, lastMessagePreview, lastMessageAt, unreadCount } = conversation;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[#f5f6f6] ${
        selected ? 'bg-[#f0f2f5]' : ''
      }`}
    >
      <Avatar name={participant.displayName} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium text-[#111b21]">{participant.displayName}</span>
          <span className="shrink-0 text-xs text-[#667781]">
            {formatConversationTime(lastMessageAt)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="truncate text-sm text-[#667781]">
            {lastMessagePreview || 'No messages yet'}
          </p>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#00a884] px-1.5 text-xs font-medium text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
