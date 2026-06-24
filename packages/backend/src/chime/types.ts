export interface ChimeMeetingInfo {
  meetingId: string;
  mediaRegion: string;
  externalMeetingId: string;
}

export interface ChimeAttendeeInfo {
  attendeeId: string;
  joinToken: string;
  externalUserId: string;
}

export interface ChimeClient {
  createMeeting(externalMeetingId: string): Promise<ChimeMeetingInfo>;
  createAttendee(meetingId: string, externalUserId: string): Promise<ChimeAttendeeInfo>;
  deleteMeeting(meetingId: string): Promise<void>;
}
