import { otherParticipant } from '@amiochat/shared';
import type { CallSessionResponse, CallType, WsServerEnvelope } from '@amiochat/shared';
import { getChimeClient } from '../chime';
import { getRepository } from '../db';
import { MemoryRepository } from '../db/memory';
import type { StoredCall } from '../db/types';
import type { AuthContext } from '../lib/auth';
import { publishCallEvent } from '../ws/call-events';

function sessionFromRecord(record: StoredCall, userId: string): CallSessionResponse {
  const attendee = record.attendees[userId];
  if (!attendee) throw new Error('NOT_FOUND');

  return {
    callId: record.callId,
    convId: record.convId,
    type: record.type,
    status: record.status,
    chimeMeeting: {
      meetingId: record.chimeMeetingId,
      mediaRegion: record.mediaRegion,
      externalMeetingId: record.externalMeetingId,
    },
    attendee: {
      attendeeId: attendee.attendeeId,
      joinToken: attendee.joinToken,
      externalUserId: attendee.externalUserId,
    },
  };
}

async function notifyBoth(call: { callId: string; callerId: string; calleeId: string }, event: WsServerEnvelope) {
  await publishCallEvent(call.callerId, event);
  await publishCallEvent(call.calleeId, event);
}

export async function createCall(
  auth: AuthContext,
  convId: string,
  type: CallType,
): Promise<CallSessionResponse> {
  const repo = getRepository();
  const chime = getChimeClient();

  if (!(await repo.isMember(convId, auth.userId))) {
    throw new Error('FORBIDDEN');
  }

  const calleeId = otherParticipant(convId, auth.userId);
  if (!calleeId) {
    throw new Error('VALIDATION_ERROR');
  }

  const callerActive = await repo.getUserActiveCall(auth.userId);
  if (callerActive && ['ringing', 'connected'].includes(callerActive.status)) {
    throw new Error('CALL_IN_PROGRESS');
  }

  const calleeActive = await repo.getUserActiveCall(calleeId);
  if (calleeActive && ['ringing', 'connected'].includes(calleeActive.status)) {
    throw new Error('CALLEE_BUSY');
  }

  const externalMeetingId = `amiochat-${convId}-${Date.now()}`;
  const meeting = await chime.createMeeting(externalMeetingId);
  const callerAttendee = await chime.createAttendee(meeting.meetingId, auth.userId);

  const record = await repo.createCallRecord({
    convId,
    callerId: auth.userId,
    calleeId,
    type,
    chimeMeetingId: meeting.meetingId,
    mediaRegion: meeting.mediaRegion,
    externalMeetingId,
    callerAttendee,
  });

  const callerProfile = await repo.getUserProfile(auth.userId);

  await publishCallEvent(calleeId, {
    event: 'call.incoming',
    payload: {
      callId: record.callId,
      convId,
      callerId: auth.userId,
      callerName: callerProfile?.displayName ?? 'Unknown',
      type,
    },
  });

  if (repo instanceof MemoryRepository) {
    repo.scheduleRingTimeout(record.callId, () => {
      void handleMissedCall(record.callId);
    });
  } else {
    setTimeout(() => void handleMissedCall(record.callId), 30_000);
  }

  return sessionFromRecord(record, auth.userId);
}

export async function joinCall(auth: AuthContext, callId: string) {
  const repo = getRepository();
  const chime = getChimeClient();
  const call = await repo.getCall(callId);

  if (!call) throw new Error('NOT_FOUND');
  if (call.status === 'ended' || call.status === 'declined' || call.status === 'missed') {
    throw new Error('CALL_ENDED');
  }
  if (auth.userId !== call.callerId && auth.userId !== call.calleeId) {
    throw new Error('FORBIDDEN');
  }

  let attendee = call.attendees[auth.userId];
  if (!attendee) {
    attendee = await chime.createAttendee(call.chimeMeetingId, auth.userId);
    await repo.saveCallAttendee(callId, auth.userId, attendee);
  }

  if (repo instanceof MemoryRepository) {
    repo.clearRingTimeout(callId);
  }

  const updated = await repo.getCall(callId);
  if (!updated) throw new Error('NOT_FOUND');

  return {
    attendeeId: attendee.attendeeId,
    joinToken: attendee.joinToken,
    externalUserId: attendee.externalUserId,
    chimeMeeting: {
      meetingId: updated.chimeMeetingId,
      mediaRegion: updated.mediaRegion,
      externalMeetingId: updated.externalMeetingId,
    },
  };
}

export async function endCall(auth: AuthContext, callId: string): Promise<void> {
  const repo = getRepository();
  const chime = getChimeClient();
  const call = await repo.getCall(callId);

  if (!call) throw new Error('NOT_FOUND');
  if (auth.userId !== call.callerId && auth.userId !== call.calleeId) {
    throw new Error('FORBIDDEN');
  }

  const label = call.type === 'video' ? 'Video call' : 'Voice call';
  await repo.finalizeCall(callId, `${label} ended`);
  await chime.deleteMeeting(call.chimeMeetingId);

  await notifyBoth(call, {
    event: 'call.updated',
    payload: { callId, status: 'ended' },
  });
}

export async function handleCallSignal(
  auth: AuthContext,
  callId: string,
  signal: 'accept' | 'decline' | 'end' | 'busy',
): Promise<void> {
  const repo = getRepository();
  const call = await repo.getCall(callId);
  if (!call) throw new Error('NOT_FOUND');

  const isParticipant = auth.userId === call.callerId || auth.userId === call.calleeId;
  if (!isParticipant) throw new Error('FORBIDDEN');

  if (signal === 'accept') {
    await publishCallEvent(call.callerId, {
      event: 'call.updated',
      payload: { callId, status: 'connected' },
    });
    return;
  }

  if (signal === 'busy') {
    await repo.updateCallStatus(callId, 'declined');
    await publishCallEvent(call.callerId, {
      event: 'call.updated',
      payload: { callId, status: 'declined' },
    });
    return;
  }

  if (signal === 'decline') {
    const label = call.type === 'video' ? 'Video call' : 'Voice call';
    await repo.finalizeCall(callId, `${label} declined`);
    await getChimeClient().deleteMeeting(call.chimeMeetingId);
    await notifyBoth(call, {
      event: 'call.updated',
      payload: { callId, status: 'declined' },
    });
    return;
  }

  if (signal === 'end') {
    await endCall(auth, callId);
  }
}

async function handleMissedCall(callId: string): Promise<void> {
  const repo = getRepository();
  const call = await repo.getCall(callId);
  if (!call || call.status !== 'ringing') return;

  const label = call.type === 'video' ? 'Missed video call' : 'Missed voice call';
  await repo.finalizeCall(callId, label);
  await getChimeClient().deleteMeeting(call.chimeMeetingId);

  await notifyBoth(call, {
    event: 'call.updated',
    payload: { callId, status: 'missed' },
  });
}
