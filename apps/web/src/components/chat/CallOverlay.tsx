'use client';

import { useChat } from '@/components/chat/ChatProvider';
import { Avatar } from '@/components/ui/Avatar';

export function CallOverlay() {
  const {
    incomingCall,
    activeCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    callMuted,
    callVideoEnabled,
  } = useChat();

  if (incomingCall && !activeCall) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
          <Avatar name={incomingCall.callerName} size="lg" />
          <h2 className="mt-4 text-xl font-semibold text-[#111b21]">
            {incomingCall.callerName}
          </h2>
          <p className="mt-1 text-[#667781]">
            Incoming {incomingCall.type} call…
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <button
              type="button"
              onClick={() => void declineCall()}
              className="rounded-full bg-red-500 px-8 py-3 text-sm font-medium text-white hover:bg-red-600"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => void acceptCall()}
              className="rounded-full bg-[#00a884] px-8 py-3 text-sm font-medium text-white hover:bg-[#008f72]"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeCall) return null;

  const isVideo = activeCall.type === 'video';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#111b21]">
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-white">
        {isVideo && (
          <div
            id="chime-local-video"
            className="mb-6 flex h-48 w-64 items-center justify-center rounded-xl bg-[#2a3942] text-sm text-[#8696a0]"
          >
            {callVideoEnabled ? 'Camera on' : 'Camera off'}
          </div>
        )}
        <Avatar name={activeCall.remoteName} size="lg" />
        <h2 className="mt-4 text-xl font-medium">{activeCall.remoteName}</h2>
        <p className="mt-1 text-sm text-[#8696a0]">
          {activeCall.status === 'ringing' ? 'Calling…' : 'Connected'}
          {activeCall.isMock ? ' (mock mode)' : ''}
        </p>
      </div>

      <footer className="flex items-center justify-center gap-6 bg-[#202c33] px-6 py-8">
        <button
          type="button"
          onClick={toggleMute}
          className={`rounded-full p-4 ${callMuted ? 'bg-white text-[#111b21]' : 'bg-[#2a3942] text-white'}`}
          aria-label={callMuted ? 'Unmute' : 'Mute'}
        >
          {callMuted ? '🔇' : '🎤'}
        </button>
        {isVideo && (
          <button
            type="button"
            onClick={toggleVideo}
            className={`rounded-full p-4 ${callVideoEnabled ? 'bg-[#2a3942] text-white' : 'bg-white text-[#111b21]'}`}
            aria-label={callVideoEnabled ? 'Turn camera off' : 'Turn camera on'}
          >
            {callVideoEnabled ? '📹' : '🚫'}
          </button>
        )}
        <button
          type="button"
          onClick={() => void endCall()}
          className="rounded-full bg-red-500 p-4 text-white hover:bg-red-600"
          aria-label="End call"
        >
          📞
        </button>
      </footer>
    </div>
  );
}
