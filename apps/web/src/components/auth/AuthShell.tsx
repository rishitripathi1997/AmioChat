import Link from 'next/link';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-[#f0f2f5] p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-3xl font-semibold text-[#111b21]">
            AmioChat
          </Link>
          <p className="mt-2 text-[#667781]">{subtitle}</p>
        </div>
        <div className="rounded-xl bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-xl font-semibold text-[#111b21]">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}
