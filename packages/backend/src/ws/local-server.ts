import { createServer, type IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket, type WebSocket as WsSocket } from 'ws';
import type { WsClientEnvelope, WsServerEnvelope } from '@amiochat/shared';
import { parseToken } from '../lib/auth';
import { getConnectionRepository } from './connections';
import type { WsPublisher } from './publisher';
import {
  broadcastOfflinePresence,
  handleConnect,
  handleDisconnect,
  handleWsAction,
} from './router';

const connections = new Map<string, WsSocket>();

class LocalWsPublisher implements WsPublisher {
  async send(connectionId: string, event: WsServerEnvelope): Promise<void> {
    const ws = connections.get(connectionId);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  async sendToUser(userId: string, event: WsServerEnvelope): Promise<void> {
    const repo = getConnectionRepository();
    const ids = await repo.getUserConnections(userId);
    await Promise.all(ids.map((id) => this.send(id, event)));
  }
}

function parseTokenFromRequest(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? '/', 'http://localhost');
  return url.searchParams.get('token');
}

export function startLocalWsServer(port = 3002): void {
  const publisher = new LocalWsPublisher();
  const server = createServer((_req, res) => {
    res.writeHead(426);
    res.end('Upgrade Required');
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', async (ws, req) => {
    const token = parseTokenFromRequest(req);
    const auth = parseToken(token);
    if (!auth) {
      ws.close(4401, 'Unauthorized');
      return;
    }

    const connectionId = crypto.randomUUID();
    connections.set(connectionId, ws);

    ws.on('message', async (data) => {
      let envelope: WsClientEnvelope;
      try {
        envelope = JSON.parse(data.toString()) as WsClientEnvelope;
      } catch {
        ws.send(
          JSON.stringify({
            event: 'error',
            payload: { code: 'VALIDATION_ERROR', message: 'Invalid JSON' },
          }),
        );
        return;
      }

      const events = await handleWsAction(
        { auth, connectionId, publisher },
        envelope,
      );
      for (const event of events) {
        await publisher.send(connectionId, event);
      }
    });

    ws.on('close', async () => {
      connections.delete(connectionId);
      const userId = await getConnectionRepository().removeConnection(connectionId);
      await handleDisconnect(connectionId);
      if (userId) {
        const remaining = await getConnectionRepository().countUserConnections(userId);
        if (remaining === 0) {
          await broadcastOfflinePresence(publisher, userId);
        }
      }
    });

    await handleConnect({ auth, connectionId, publisher });
  });

  server.listen(port, () => {
    console.log(`AmioChat local WebSocket server listening on ws://localhost:${port}`);
  });
}

if (require.main === module) {
  const port = Number(process.env.WS_PORT ?? 3002);
  startLocalWsServer(port);
}
