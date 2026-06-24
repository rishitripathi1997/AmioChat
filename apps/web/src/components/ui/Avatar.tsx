interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  online?: boolean;
}

const SIZES = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-14 w-14 text-lg',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function Avatar({ name, size = 'md', online }: AvatarProps) {
  return (
    <div className="relative shrink-0">
      <div
        className={`flex items-center justify-center rounded-full bg-[#dfe5e7] font-medium text-[#54656f] ${SIZES[size]}`}
        aria-hidden
      >
        {initials(name)}
      </div>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
            online ? 'bg-[#00a884]' : 'bg-[#8696a0]'
          }`}
          aria-label={online ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}
