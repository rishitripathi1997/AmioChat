import { useChat } from '@/components/chat/ChatProvider';
import { Sidebar } from '@/components/chat/Sidebar';
import { ThreadPanel } from '@/components/chat/ThreadPanel';

export function ChatShell() {
  const { showSidebarOnMobile } = useChat();

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#d1d7db]">
      <div className="mx-auto flex h-full w-full max-w-[1600px] flex-1 overflow-hidden md:my-2 md:h-[calc(100dvh-16px)] md:rounded-xl md:shadow-lg">
        <div
          className={`${
            showSidebarOnMobile ? 'flex' : 'hidden'
          } h-full w-full md:flex md:w-auto`}
        >
          <Sidebar />
        </div>
        <div
          className={`${
            showSidebarOnMobile ? 'hidden' : 'flex'
          } h-full min-w-0 flex-1 flex-col md:flex`}
        >
          <ThreadPanel />
        </div>
      </div>
    </div>
  );
}
