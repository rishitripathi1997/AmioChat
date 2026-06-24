import type { CallStatus, CallType } from './types';

export interface ChimeMeetingInfo {
  meetingId: string;
  mediaRegion: string;
  externalMeetingId?: string;
}

export interface ChimeAttendeeInfo {
  attendeeId: string;
  joinToken: string;
  externalUserId?: string;
}

export interface CallSessionResponse {
  callId: string;
  convId: string;
  type: CallType;
  status: CallStatus;
  chimeMeeting: ChimeMeetingInfo;
  attendee: ChimeAttendeeInfo;
}

export interface IncomingCallPayload {
  callId: string;
  convId: string;
  callerId: string;
  callerName: string;
  type: CallType;
}

export interface CallUpdatedPayload {
  callId: string;
  status: CallStatus;
}

export function isMockChimeMeeting(meetingId: string): boolean {
  return meetingId.startsWith('mock-');
}
