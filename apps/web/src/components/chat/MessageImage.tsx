'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { createDownloadUrl } from '@/lib/api/client';

interface MessageImageProps {
  mediaKey: string;
  alt?: string;
}

export function MessageImage({ mediaKey, alt = 'Image' }: MessageImageProps) {
  const { idToken } = useAuth();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!idToken) return;

    let cancelled = false;
    (async () => {
      try {
        const { downloadUrl } = await createDownloadUrl(idToken, mediaKey);
        if (!cancelled) setSrc(downloadUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [idToken, mediaKey]);

  if (failed) {
    return <p className="text-sm italic text-[#667781]">Image unavailable</p>;
  }

  if (!src) {
    return (
      <div className="h-32 w-48 animate-pulse rounded bg-[#e9edef]" aria-label="Loading image" />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="max-h-64 max-w-full rounded object-cover"
      loading="lazy"
    />
  );
}
