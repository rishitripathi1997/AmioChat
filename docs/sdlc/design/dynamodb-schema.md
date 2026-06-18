# DynamoDB Schema — AmioChat

**Table:** `AmioChat-{env}`  
**Billing:** On-demand  
**Region:** us-east-1

---

## 1. Table definition

| Attribute | Type | Key |
|-----------|------|-----|
| `PK` | String | Partition key |
| `SK` | String | Sort key |
| `GSI1PK` | String | GSI1 partition key |
| `GSI1SK` | String | GSI1 sort key |
| `entityType` | String | Discriminator for debugging |
| `ttl` | Number | TTL (Unix epoch seconds) |

### GSI1 — Email lookup

| Key | Pattern |
|-----|---------|
| `GSI1PK` | `EMAIL#<lowercase-email>` |
| `GSI1SK` | `USER#<userId>` |

---

## 2. Entity schemas

### User profile

| Attribute | Type | Required | Example |
|-----------|------|----------|---------|
| `PK` | S | ✓ | `USER#abc-123` |
| `SK` | S | ✓ | `PROFILE` |
| `entityType` | S | ✓ | `UserProfile` |
| `userId` | S | ✓ | `abc-123` |
| `email` | S | ✓ | `alice@example.com` |
| `displayName` | S | ✓ | `Alice` |
| `avatarKey` | S | | `avatars/abc-123/uuid.jpg` |
| `createdAt` | S | ✓ | `2026-06-16T10:00:00.000Z` |
| `updatedAt` | S | | `2026-06-16T11:00:00.000Z` |
| `GSI1PK` | S | ✓ | `EMAIL#alice@example.com` |
| `GSI1SK` | S | ✓ | `USER#abc-123` |

---

### User inbox entry

Denormalized per-user view for conversation list.

| Attribute | Type | Required | Example |
|-----------|------|----------|---------|
| `PK` | S | ✓ | `USER#abc-123` |
| `SK` | S | ✓ | `CONV#direct#abc-123#def-456` |
| `entityType` | S | ✓ | `InboxEntry` |
| `convId` | S | ✓ | `direct#abc-123#def-456` |
| `otherUserId` | S | ✓ | `def-456` |
| `lastMessageAt` | S | ✓ | `2026-06-16T12:00:00.000Z` |
| `lastMessagePreview` | S | ✓ | `Hey, are you free?` |
| `unreadCount` | N | ✓ | `2` |

**Query:** `PK = USER#<userId> AND begins_with(SK, 'CONV#')` → inbox sorted by `lastMessageAt` (use sparse index or sort client-side).

---

### Conversation meta

| Attribute | Type | Required | Example |
|-----------|------|----------|---------|
| `PK` | S | ✓ | `CONV#direct#abc-123#def-456` |
| `SK` | S | ✓ | `META` |
| `entityType` | S | ✓ | `Conversation` |
| `convId` | S | ✓ | `direct#abc-123#def-456` |
| `type` | S | ✓ | `direct` |
| `participantIds` | SS | ✓ | `[abc-123, def-456]` |
| `createdAt` | S | ✓ | `2026-06-16T10:00:00.000Z` |

**Conversation ID algorithm:**

```typescript
function directConvId(userA: string, userB: string): string {
  const [a, b] = [userA, userB].sort();
  return `direct#${a}#${b}`;
}
```

---

### Conversation member

| Attribute | Type | Required | Example |
|-----------|------|----------|---------|
| `PK` | S | ✓ | `CONV#direct#abc-123#def-456` |
| `SK` | S | ✓ | `MEMBER#abc-123` |
| `entityType` | S | ✓ | `Member` |
| `userId` | S | ✓ | `abc-123` |
| `joinedAt` | S | ✓ | `2026-06-16T10:00:00.000Z` |
| `lastReadAt` | S | | `2026-06-16T12:00:00.000Z` |

---

### Message

| Attribute | Type | Required | Example |
|-----------|------|----------|---------|
| `PK` | S | ✓ | `CONV#direct#abc-123#def-456` |
| `SK` | S | ✓ | `MSG#2026-06-16T12:00:00.000Z#msg-uuid` |
| `entityType` | S | ✓ | `Message` |
| `messageId` | S | ✓ | `msg-uuid` |
| `convId` | S | ✓ | `direct#abc-123#def-456` |
| `senderId` | S | ✓ | `abc-123` |
| `type` | S | ✓ | `text` |
| `body` | S | | `Hello!` |
| `mediaKey` | S | | `attachments/conv/msg/file.pdf` |
| `status` | S | ✓ | `sent` |
| `createdAt` | S | ✓ | `2026-06-16T12:00:00.000Z` |

**Query history:** `PK = CONV#<convId> AND begins_with(SK, 'MSG#')` with `ScanIndexForward = false`, limit 50.

**Query since:** Same PK, `SK > MSG#<since>` .

---

### WebSocket connection

| Attribute | Type | Required | Example |
|-----------|------|----------|---------|
| `PK` | S | ✓ | `USER#abc-123` |
| `SK` | S | ✓ | `CONN#Y8abc123=` |
| `entityType` | S | ✓ | `Connection` |
| `connectionId` | S | ✓ | `Y8abc123=` |
| `connectedAt` | S | ✓ | `2026-06-16T12:00:00.000Z` |
| `ttl` | N | ✓ | `1718540800` (24h fallback) |

**Query active connections:** `PK = USER#<userId> AND begins_with(SK, 'CONN#')`

---

### Presence

| Attribute | Type | Required | Example |
|-----------|------|----------|---------|
| `PK` | S | ✓ | `USER#abc-123` |
| `SK` | S | ✓ | `PRESENCE` |
| `entityType` | S | ✓ | `Presence` |
| `status` | S | ✓ | `online` |
| `lastSeenAt` | S | | `2026-06-16T12:05:00.000Z` |
| `ttl` | N | | `1718541100` (5 min after last heartbeat) |

---

### Call session

| Attribute | Type | Required | Example |
|-----------|------|----------|---------|
| `PK` | S | ✓ | `CALL#call-uuid` |
| `SK` | S | ✓ | `META` |
| `entityType` | S | ✓ | `Call` |
| `callId` | S | ✓ | `call-uuid` |
| `convId` | S | ✓ | `direct#abc-123#def-456` |
| `callerId` | S | ✓ | `abc-123` |
| `calleeId` | S | ✓ | `def-456` |
| `type` | S | ✓ | `video` |
| `status` | S | ✓ | `ringing` |
| `chimeMeetingId` | S | ✓ | `meeting-uuid` |
| `startedAt` | S | ✓ | `2026-06-16T12:00:00.000Z` |
| `endedAt` | S | | `2026-06-16T12:05:00.000Z` |
| `ttl` | N | | Auto-delete after 7 days |

---

## 3. Example items (JSON)

### User profile

```json
{
  "PK": "USER#abc-123",
  "SK": "PROFILE",
  "entityType": "UserProfile",
  "userId": "abc-123",
  "email": "alice@example.com",
  "displayName": "Alice",
  "avatarKey": "avatars/abc-123/face.jpg",
  "createdAt": "2026-06-16T10:00:00.000Z",
  "GSI1PK": "EMAIL#alice@example.com",
  "GSI1SK": "USER#abc-123"
}
```

### Message

```json
{
  "PK": "CONV#direct#abc-123#def-456",
  "SK": "MSG#2026-06-16T12:00:00.000Z#msg-001",
  "entityType": "Message",
  "messageId": "msg-001",
  "convId": "direct#abc-123#def-456",
  "senderId": "abc-123",
  "type": "text",
  "body": "Hey, are you free?",
  "status": "sent",
  "createdAt": "2026-06-16T12:00:00.000Z"
}
```

---

## 4. Access patterns

| # | Pattern | Operation |
|---|---------|-----------|
| AP1 | Get user profile | `GetItem` PK=`USER#id`, SK=`PROFILE` |
| AP2 | Lookup user by email | `Query` GSI1 PK=`EMAIL#email` |
| AP3 | List user inbox | `Query` PK=`USER#id`, SK begins_with `CONV#` |
| AP4 | Get/create conversation | `GetItem` / `TransactWrite` on CONV# + MEMBER# + inbox entries |
| AP5 | List messages | `Query` PK=`CONV#id`, SK begins_with `MSG#`, reverse |
| AP6 | Send message | `TransactWrite`: Put MSG + Update both inbox entries |
| AP7 | Store WS connection | `PutItem` CONN# |
| AP8 | Fan-out to user | `Query` CONN# items for USER#id |
| AP9 | Mark read | `UpdateItem` MEMBER# lastReadAt + conditional message status |
| AP10 | Create call | `PutItem` CALL# + push WS event |

---

## 5. TransactWrite — send message

Single transaction:

1. **Put** message item (`MSG#...`)
2. **Update** sender inbox (`lastMessageAt`, `lastMessagePreview`, `unreadCount` unchanged)
3. **Update** recipient inbox (`lastMessageAt`, `lastMessagePreview`, `unreadCount + 1`)

Condition: both `MEMBER#` records must exist (user is participant).

---

## 6. TTL summary

| Entity | TTL duration | Attribute |
|--------|--------------|-----------|
| Connection | 24 hours | `ttl` |
| Presence | 5 minutes after last update | `ttl` |
| Call record | 7 days after end | `ttl` |

DynamoDB TTL must be enabled on attribute name `ttl`.
