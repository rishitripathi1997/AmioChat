import type {
  CallSessionResponse,
  CallType,
  ChimeAttendeeInfo,
  ChimeMeetingInfo,
} from '@amiochat/shared';
import { isMockChimeMeeting } from '@amiochat/shared';

export interface MeetingController {
  join(): Promise<void>;
  leave(): Promise<void>;
  toggleMute(): boolean;
  toggleVideo(): boolean;
  isMuted(): boolean;
  isVideoEnabled(): boolean;
}

class MockMeetingController implements MeetingController {
  private muted = false;
  private videoEnabled: boolean;

  constructor(enableVideo: boolean) {
    this.videoEnabled = enableVideo;
  }

  async join(): Promise<void> {
    // Simulated join for local dev without AWS Chime
  }

  async leave(): Promise<void> {
    // no-op
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  toggleVideo(): boolean {
    this.videoEnabled = !this.videoEnabled;
    return this.videoEnabled;
  }

  isMuted(): boolean {
    return this.muted;
  }

  isVideoEnabled(): boolean {
    return this.videoEnabled;
  }
}

export async function createMeetingController(
  meeting: ChimeMeetingInfo,
  attendee: ChimeAttendeeInfo,
  enableVideo: boolean,
): Promise<MeetingController> {
  if (isMockChimeMeeting(meeting.meetingId)) {
    return new MockMeetingController(enableVideo);
  }

  const {
    ConsoleLogger,
    DefaultDeviceController,
    DefaultMeetingSession,
    LogLevel,
    MeetingSessionConfiguration,
  } = await import('amazon-chime-sdk-js');

  const logger = new ConsoleLogger('AmioChatChime', LogLevel.WARN);
  const deviceController = new DefaultDeviceController(logger);

  const configuration = new MeetingSessionConfiguration(
    {
      MeetingId: meeting.meetingId,
      MediaRegion: meeting.mediaRegion,
      ExternalMeetingId: meeting.externalMeetingId,
    },
    {
      AttendeeId: attendee.attendeeId,
      JoinToken: attendee.joinToken,
      ExternalUserId: attendee.externalUserId,
    },
  );

  const session = new DefaultMeetingSession(configuration, logger, deviceController);
  const audioVideo = session.audioVideo;

  const audioInputs = await deviceController.listAudioInputDevices();
  if (audioInputs.length > 0) {
    await audioVideo.startAudioInput(audioInputs[0].deviceId);
  }

  if (enableVideo) {
    const videoInputs = await deviceController.listVideoInputDevices();
    if (videoInputs.length > 0) {
      await audioVideo.startVideoInput(videoInputs[0].deviceId);
    }
  }

  let muted = false;
  let videoOn = enableVideo;

  return {
    async join() {
      audioVideo.start();
      if (videoOn) {
        const el = document.getElementById('chime-local-video');
        if (el) audioVideo.startLocalVideoTile();
      }
    },
    async leave() {
      audioVideo.stop();
    },
    toggleMute() {
      if (muted) {
        audioVideo.realtimeUnmuteLocalAudio();
      } else {
        audioVideo.realtimeMuteLocalAudio();
      }
      muted = !muted;
      return muted;
    },
    toggleVideo() {
      if (videoOn) {
        audioVideo.stopLocalVideoTile();
      } else {
        audioVideo.startLocalVideoTile();
      }
      videoOn = !videoOn;
      return !videoOn;
    },
    isMuted: () => muted,
    isVideoEnabled: () => videoOn,
  };
}
