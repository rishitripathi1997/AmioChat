'use client';

import { useRef, useState } from 'react';
import { useChat } from '@/components/chat/ChatProvider';
import { useToast } from '@/components/ui/Toast';
import type { WsConnectionState } from '@/lib/ws/client';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface ComposerProps {
  connectionState: WsConnectionState;
}

export function Composer({ connectionState }: ComposerProps) {
  const { sendTextMessage, sendImageMessage, sendTyping } = useChat();
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const typingOffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const disabled = connectionState === 'disconnected' || uploading;

  const handleChange = (value: string) => {
    setDraft(value);
    if (value.trim()) {
      sendTyping(true);
      if (typingOffTimer.current) clearTimeout(typingOffTimer.current);
      typingOffTimer.current = setTimeout(() => sendTyping(false), 2000);
    }
  };

  const handleSend = () => {
    if (!draft.trim()) return;
    sendTextMessage(draft);
    sendTyping(false);
    setDraft('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Only JPEG, PNG, and WebP images are supported.');
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Image must be 5 MB or smaller.');
      return;
    }

    setUploading(true);
    try {
      await sendImageMessage(file);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send image';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <footer className="flex items-end gap-2 border-t border-[#e9edef] bg-[#f0f2f5] px-4 py-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        className="hidden"
        onChange={(e) => void handleFileChange(e)}
        aria-hidden
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="shrink-0 rounded-full p-2 text-[#54656f] hover:bg-[#e9edef] disabled:opacity-50"
        aria-label="Attach image"
        title="Attach image"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden>
          <path d="M1.816 15.556v.002c0 1.502.584 2.912 1.646 3.972 1.062 1.06 2.472 1.642 3.974 1.642h8.962c1.502 0 2.912-.582 3.974-1.642 1.06-1.06 1.642-2.47 1.642-3.972V8.414c0-1.502-.584-2.912-1.646-3.972A5.58 5.58 0 0 0 16.378 2.8h-8.96c-1.502 0-2.912.582-3.974 1.642A5.58 5.58 0 0 0 1.816 8.414v7.142zm2-7.142c0-.797.31-1.546.872-2.108a2.97 2.97 0 0 1 2.108-.872h8.962c.797 0 1.546.31 2.108.872.562.562.872 1.311.872 2.108v7.142c0 .797-.31 1.546-.872 2.108a2.97 2.97 0 0 1-2.108.872H8.796a2.97 2.97 0 0 1-2.108-.872 2.97 2.97 0 0 1-.872-2.108V8.414z" />
        </svg>
      </button>

      <textarea
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder={
          uploading ? 'Uploading image…' : disabled ? 'Reconnecting…' : 'Type a message'
        }
        rows={1}
        disabled={disabled}
        className="max-h-32 min-h-[42px] flex-1 resize-none rounded-lg border border-[#e9edef] bg-white px-4 py-2.5 text-sm text-[#111b21] placeholder:text-[#667781] focus:outline-none focus:ring-2 focus:ring-[#00a884]/40 disabled:opacity-60"
        aria-label="Message"
      />

      <button
        type="button"
        onClick={handleSend}
        disabled={disabled || !draft.trim()}
        className="shrink-0 rounded-full bg-[#00a884] p-2.5 text-white disabled:opacity-40"
        aria-label="Send message"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
          <path d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.911z" />
        </svg>
      </button>
    </footer>
  );
}
