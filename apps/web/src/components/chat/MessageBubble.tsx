import type { DisplayMessage } from '@/lib/chat/utils';
import { formatMessageTime, isPendingMessage } from '@/lib/chat/utils';
import { MessageImage } from '@/components/chat/MessageImage';

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
  const type = isPendingMessage(message) ? (message.type ?? 'text') : message.type;
  const body = isPendingMessage(message) ? message.body : message.body;
  const mediaKey = isPendingMessage(message) ? message.mediaKey : message.mediaKey;

  if (isSystem || type === 'system') {
    const systemText = body ?? `[${type}]`;
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-lg bg-white/80 px-3 py-1 text-xs text-[#54656f]">{systemText}</span>
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
        {type === 'image' && mediaKey && <MessageImage mediaKey={mediaKey} />}
        {body && (
          <p className="whitespace-pre-wrap break-words text-sm text-[#111b21]">{body}</p>
        )}
        {!body && type !== 'image' && (
          <p className="text-sm text-[#667781]">[{type}]</p>
        )}
        <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
          <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
          {isOwn && <StatusTicks status={message.status} />}
        </div>
      </div>
    </div>
  );
}
