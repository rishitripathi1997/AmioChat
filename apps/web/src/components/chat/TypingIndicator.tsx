interface TypingIndicatorProps {
  name: string;
}

export function TypingIndicator({ name }: TypingIndicatorProps) {
  return (
    <p className="px-4 py-1 text-xs italic text-[#667781]" aria-live="polite">
      {name} is typing…
    </p>
  );
}
