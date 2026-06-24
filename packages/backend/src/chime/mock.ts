import type { ChimeAttendeeInfo, ChimeClient, ChimeMeetingInfo } from './types';

export class MockChimeClient implements ChimeClient {
  async createMeeting(externalMeetingId: string): Promise<ChimeMeetingInfo> {
    return {
      meetingId: `mock-meeting-${crypto.randomUUID()}`,
      mediaRegion: process.env.CHIME_MEDIA_REGION ?? 'us-east-1',
      externalMeetingId,
    };
  }

  async createAttendee(_meetingId: string, externalUserId: string): Promise<ChimeAttendeeInfo> {
    return {
      attendeeId: `mock-attendee-${crypto.randomUUID()}`,
      joinToken: `mock-token-${crypto.randomUUID()}`,
      externalUserId,
    };
  }

  async deleteMeeting(_meetingId: string): Promise<void> {
    // no-op for mock
  }
}
