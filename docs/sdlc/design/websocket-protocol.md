# WebSocket Protocol — AmioChat

**Version:** 1.0  
**Endpoint:** `wss://ws.{env}.amiochat.example.com`  
**Auth:** Cognito ID token passed as query param on connect

---

## 1. Connection

### Connect

```
wss://ws.{env}.amiochat.example.com?token=<CognitoIdToken>
```


| Step       | Behavior                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| `$connect` | Lambda validates JWT, extracts `sub` → `userId`, stores `CONN#<connectionId>`, sets presence `online` |
| Success    | Connection established; server may send `connected` event                                             |
| Failure    | Connection rejected with 401                                                                          |


### Disconnect


| Step          | Behavior                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------- |
| `$disconnect` | Remove `CONN#` record; if no remaining connections, set presence `offline` + `lastSeenAt` |


### Heartbeat

- Client sends `ping` action every **30 seconds**
- Server responds with `pong`
- If no ping for **90 seconds**, server may close connection

---

## 2. Message envelope

All frames are JSON text.

### Client → Server

```json
{
  "action": "<actionName>",
  "payload": { },
  "requestId": "<uuid>"
}
```


| Field       | Required | Description                           |
| ----------- | -------- | ------------------------------------- |
| `action`    | Yes      | Handler route key                     |
| `payload`   | Yes      | Action-specific body                  |
| `requestId` | No       | Client correlation ID; echoed in acks |


### Server → Client

```json
{
  "event": "<eventName>",
  "payload": { },
  "requestId": "<uuid>"
}
```

---

## 3. Client actions

### `sendMessage`

Send a text or media message.

**Payload:**

```json
{
  "convId": "direct#user-a#user-b",
  "clientMsgId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "text",
  "body": "Hello!",
  "mediaKey": null
}
```


| Field         | Type   | Required | Notes                       |
| ------------- | ------ | -------- | --------------------------- |
| `convId`      | string | Yes      |                             |
| `clientMsgId` | uuid   | Yes      | Idempotency / optimistic UI |
| `type`        | enum   | Yes      | `text`, `image`, `file`     |
| `body`        | string | If text  | Max 4096 chars              |
| `mediaKey`    | string | If media | From `/media/upload-url`    |


**Server:** Persist message → push `message.new` to recipient(s) → send `message.ack` to sender.

---

### `typing`

**Payload:**

```json
{
  "convId": "direct#user-a#user-b",
  "isTyping": true
}
```

**Server:** Push `typing` event to other participant. No persistence. Debounce on client (max 1 event per 2s).

---

### `read`

**Payload:**

```json
{
  "convId": "direct#user-a#user-b",
  "messageId": "msg-uuid"
}
```

**Server:** Update `lastReadAt` on member record; push `read` to other participant; update message statuses ≤ `messageId` time to `read`.

---

### `presence`

**Payload:**

```json
{
  "status": "online"
}
```

Values: `online`, `away`. Server sets `offline` on disconnect.

---

### `callSignal`

Relay call state between parties (supplements REST `/calls`).

**Payload:**

```json
{
  "callId": "call-uuid",
  "signal": "accept",
  "payload": {}
}
```


| `signal`  | Meaning                                       |
| --------- | --------------------------------------------- |
| `accept`  | Callee accepted; triggers caller notification |
| `decline` | Callee declined                               |
| `end`     | Either party ended before REST DELETE         |
| `busy`    | Callee in another call                        |


---

### `ping`

**Payload:** `{}`  
**Response:** `pong` event

---

## 4. Server events

### `connected`

Sent once after successful `$connect`.

```json
{
  "event": "connected",
  "payload": {
    "userId": "cognito-sub",
    "connectionId": "abc123"
  }
}
```

---

### `message.new`

```json
{
  "event": "message.new",
  "payload": {
    "messageId": "msg-uuid",
    "convId": "direct#user-a#user-b",
    "senderId": "user-a",
    "type": "text",
    "body": "Hello!",
    "status": "delivered",
    "createdAt": "2026-06-16T12:00:00.000Z"
  }
}
```

---

### `message.ack`

```json
{
  "event": "message.ack",
  "payload": {
    "clientMsgId": "550e8400-e29b-41d4-a716-446655440000",
    "messageId": "msg-uuid",
    "status": "sent"
  },
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### `typing`

```json
{
  "event": "typing",
  "payload": {
    "convId": "direct#user-a#user-b",
    "userId": "user-b",
    "isTyping": true
  }
}
```

---

### `read`

```json
{
  "event": "read",
  "payload": {
    "convId": "direct#user-a#user-b",
    "userId": "user-b",
    "messageId": "msg-uuid",
    "readAt": "2026-06-16T12:01:00.000Z"
  }
}
```

---

### `presence`

```json
{
  "event": "presence",
  "payload": {
    "userId": "user-b",
    "status": "online",
    "lastSeenAt": null
  }
}
```

---

### `call.incoming`

```json
{
  "event": "call.incoming",
  "payload": {
    "callId": "call-uuid",
    "convId": "direct#user-a#user-b",
    "callerId": "user-a",
    "callerName": "Alice",
    "type": "video"
  }
}
```

---

### `call.updated`

```json
{
  "event": "call.updated",
  "payload": {
    "callId": "call-uuid",
    "status": "declined"
  }
}
```

Status values: `ringing`, `connected`, `declined`, `missed`, `ended`.

---

### `pong`

Response to `ping`.

---

### `error`

```json
{
  "event": "error",
  "payload": {
    "code": "FORBIDDEN",
    "message": "Not a member of this conversation",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

## 5. Error codes


| Code               | HTTP equiv | When                           |
| ------------------ | ---------- | ------------------------------ |
| `UNAUTHORIZED`     | 401        | Invalid/expired token          |
| `FORBIDDEN`        | 403        | Not conversation member        |
| `NOT_FOUND`        | 404        | Conversation or call not found |
| `VALIDATION_ERROR` | 400        | Invalid payload                |
| `RATE_LIMITED`     | 429        | Too many messages              |
| `INTERNAL_ERROR`   | 500        | Unexpected server error        |


---

## 6. Reconnect strategy (client)

1. On disconnect, show “Connecting…” banner
2. Backoff: 1s → 2s → 4s → 8s → 16s → 30s (cap)
3. On reconnect, call `GET /conversations/{id}/messages?since=<lastKnownTimestamp>`
4. Dedupe messages by `messageId`
5. Re-send pending outbound messages (tracked by `clientMsgId`)

---

## 7. Rate limits


| Action        | Limit           |
| ------------- | --------------- |
| `sendMessage` | 30/min per user |
| `typing`      | 60/min per user |
| `callSignal`  | 10/min per user |


Exceeded → `error` event with `RATE_LIMITED`.