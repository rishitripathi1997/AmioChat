import type { DisplayMessage } from '@/lib/chat/utils';
import { formatMessageTime, isPendingMessage } from '@/lib/chat/utils';

interface MessageBubbleProps {
  message: DisplayMessage;
  isOwn: boolean;
  isSystem?: boolean;
}

function StatusTicks({ status }: { status: DisplayMessage['status'] }) {
  if (status === 'pending') {
    return <span className="text-[#8696a0]" aria-label="Sending">🕐</span>;
  }
  if (status === 'sent') {
    return <span className="text-[#8696a0]" aria-label="Sent">✓</span>;
  }
  if (status === 'delivered') {
    return <span className="text-[#8696a0]" aria-label="Delivered">✓</span>;
  }
  return <span className="text-[#53bdeb]" aria-label="Read">✓✓</span>;
}

export function MessageBubble({ message, isOwn, isSystem }: MessageBubbleProps) {
  const body = isPendingMessage(message) ? message.body : (message.body ?? `[${message.type}]`);

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-lg bg-white/80 px-3 py-1 text-xs text-[#54656f]">{body}</span>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[75%] rounded-lg px-3 py-1.5 shadow-sm ${
          isOwn ? 'rounded-tr-none bg-[#d9fdd3]' : 'rounded-tl-none bg-white'
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-sm text-[#111b21]">{body}</p>
        <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
          <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
          {isOwn && <StatusTicks status={message.status} />}
        </div>
      </div>
    </div>
  );
}
