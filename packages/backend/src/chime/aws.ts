import {
  ChimeSDKMeetingsClient,
  CreateAttendeeCommand,
  CreateMeetingCommand,
  DeleteMeetingCommand,
} from '@aws-sdk/client-chime-sdk-meetings';
import type { ChimeAttendeeInfo, ChimeClient, ChimeMeetingInfo } from './types';

export class AwsChimeClient implements ChimeClient {
  private client: ChimeSDKMeetingsClient;
  private mediaRegion: string;

  constructor(mediaRegion = 'us-east-1') {
    this.mediaRegion = mediaRegion;
    this.client = new ChimeSDKMeetingsClient({ region: mediaRegion });
  }

  async createMeeting(externalMeetingId: string): Promise<ChimeMeetingInfo> {
    const result = await this.client.send(
      new CreateMeetingCommand({
        ClientRequestToken: crypto.randomUUID(),
        MediaRegion: this.mediaRegion,
        ExternalMeetingId: externalMeetingId.slice(0, 64),
      }),
    );

    const meeting = result.Meeting;
    if (!meeting?.MeetingId) {
      throw new Error('Failed to create Chime meeting');
    }

    return {
      meetingId: meeting.MeetingId,
      mediaRegion: meeting.MediaRegion ?? this.mediaRegion,
      externalMeetingId,
    };
  }

  async createAttendee(meetingId: string, externalUserId: string): Promise<ChimeAttendeeInfo> {
    const result = await this.client.send(
      new CreateAttendeeCommand({
        MeetingId: meetingId,
        ExternalUserId: externalUserId.slice(0, 64),
      }),
    );

    const attendee = result.Attendee;
    if (!attendee?.AttendeeId || !attendee.JoinToken) {
      throw new Error('Failed to create Chime attendee');
    }

    return {
      attendeeId: attendee.AttendeeId,
      joinToken: attendee.JoinToken,
      externalUserId,
    };
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    await this.client.send(new DeleteMeetingCommand({ MeetingId: meetingId }));
  }
}
