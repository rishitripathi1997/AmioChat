import type { WsServerEnvelope } from '@amiochat/shared';

export type WsOutbound = WsServerEnvelope;

export interface WsPublisher {
  send(connectionId: string, event: WsOutbound): Promise<void>;
  sendToUser(userId: string, event: WsOutbound): Promise<void>;
}

export class NoopPublisher implements WsPublisher {
  async send(_connectionId: string, _event: WsOutbound): Promise<void> {}

  async sendToUser(_userId: string, _event: WsOutbound): Promise<void> {}
}
