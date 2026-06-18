# Security Model — AmioChat

**Version:** 1.0  
**Applies to:** MVP (v1.0)

---

## 1. Threat model (MVP)

| Threat | Mitigation |
|--------|------------|
| Unauthorized API access | Cognito JWT on all endpoints |
| Access to other users' chats | Membership check on every read/write |
| Token theft (XSS) | Short-lived ID token; refresh via httpOnly cookie |
| Media URL sharing | Presigned URLs expire in 15 minutes |
| Injection | Zod validation; parameterized DynamoDB |
| Brute-force login | Cognito lockout + API Gateway throttling |
| Data exfiltration via S3 | Private bucket; IAM least privilege |

---

## 2. Authentication flow

### Token types

| Token | Lifetime | Storage (client) |
|-------|----------|------------------|
| ID token | 1 hour | Memory only (`AuthContext` state) |
| Access token | 1 hour | Memory only |
| Refresh token | 30 days | **httpOnly, Secure, SameSite=Strict** cookie via Next.js API route |

### Why not localStorage?

ID/access tokens in `localStorage` are vulnerable to XSS. MVP stores them in React state (memory). Refresh token in httpOnly cookie enables silent refresh without exposing long-lived secrets to JavaScript.

### Next.js API route — `/api/auth/session`

```
POST /api/auth/session   → Set refresh cookie after Cognito login
POST /api/auth/refresh   → Exchange refresh token for new ID token
DELETE /api/auth/session → Clear cookie on logout
```

### WebSocket auth

```
wss://ws.../prod?token=<idToken>
```

Lambda `$connect` validates JWT signature against Cognito JWKS (`us-east-1`). Reject if expired or invalid.

---

## 3. Authorization rules

Every handler executes:

```typescript
const userId = verifyJwt(token).sub;
await assertConversationMember(userId, convId); // for conv-scoped ops
```

| Resource | Rule |
|----------|------|
| `GET /users/me` | `userId` from token only |
| `PATCH /users/me` | Own profile only |
| `GET /users/search` | Authenticated; returns public fields only |
| `GET /conversations` | Inbox for `userId` only |
| `GET /conversations/{id}/messages` | Member of `convId` |
| `POST /media/upload-url` | Member of `convId`; key prefix must match `attachments/{convId}/` |
| `POST /media/download-url` | User is member of conversation that owns `mediaKey` |
| `POST /calls` | Member of `convId`; caller = `userId` |
| WS `sendMessage` | Member of `convId`; `senderId` must equal `userId` |

---

## 4. CORS

### HTTP API

| Environment | Allowed origins |
|-------------|-----------------|
| dev | `http://localhost:3000` |
| staging | `https://staging.<amplify-domain>` |
| prod | `https://<amplify-domain>` |

```
Access-Control-Allow-Origin: <specific origin>  (not *)
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
```

### S3 bucket CORS (presigned upload)

```json
[
  {
    "AllowedOrigins": ["https://<amplify-domain>", "http://localhost:3000"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3000
  }
]
```

---

## 5. IAM policies (Lambda)

### REST Lambda role

```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:GetItem",
    "dynamodb:PutItem",
    "dynamodb:UpdateItem",
    "dynamodb:Query",
    "dynamodb:TransactWriteItems"
  ],
  "Resource": [
    "arn:aws:dynamodb:us-east-1:*:table/AmioChat-{env}",
    "arn:aws:dynamodb:us-east-1:*:table/AmioChat-{env}/index/GSI1-Email"
  ]
}
```

```json
{
  "Effect": "Allow",
  "Action": ["s3:PutObject", "s3:GetObject"],
  "Resource": "arn:aws:s3:::amiochat-media-{env}/*"
}
```

```json
{
  "Effect": "Allow",
  "Action": ["chime:CreateMeeting", "chime:DeleteMeeting", "chime:CreateAttendee"],
  "Resource": "*"
}
```

### WebSocket Lambda role

Additional permission:

```json
{
  "Effect": "Allow",
  "Action": ["execute-api:ManageConnections"],
  "Resource": "arn:aws:execute-api:us-east-1:*:*/@connections/*"
}
```

**Principle:** No `dynamodb:Scan`, no `s3:*`, no wildcard table ARNs across environments.

---

## 6. Input validation

All inbound data validated with **Zod** before business logic.

| Endpoint / action | Key constraints |
|-------------------|-----------------|
| `sendMessage.body` | Max 4096 chars; strip control chars |
| `displayName` | 1–64 chars |
| `filename` | Alphanumeric + `.`-`_`; max 255 |
| `contentType` | Allowlist only |
| Upload size | 25 MB max (S3 presigned conditions) |

---

## 7. Rate limiting

| Layer | Limit |
|-------|-------|
| API Gateway (HTTP) | 100 req/s burst per stage |
| API Gateway (WS) | 500 new connections/s |
| Application | 30 messages/min/user; 10 calls/hour/user |

Return `429` / WS `RATE_LIMITED` when exceeded.

---

## 8. Secrets & configuration

| Secret / config | Storage |
|-----------------|---------|
| Cognito User Pool ID | SSM Parameter Store |
| Cognito Client ID | SSM Parameter Store |
| Chime region | SSM (`us-east-1`) |
| Media bucket name | SSM |
| JWT issuer URL | Derived from pool ID |

**Never** commit `.env` with real values. Provide `.env.example` with placeholder keys.

---

## 9. Encryption

| Data | At rest | In transit |
|------|---------|------------|
| DynamoDB | AWS owned key (default) | TLS |
| S3 media | SSE-S3 (AES-256) | TLS |
| Cognito passwords | Cognito managed | TLS |
| Chime media | Chime managed | DTLS/SRTP |

---

## 10. Account deletion (PRIV-02)

`DELETE /users/me` (Phase 4):

1. Delete all `USER#` items (profile, inbox, connections)
2. Remove user from `MEMBER#` records (or delete conv if 1:1)
3. Delete Cognito user via `AdminDeleteUser`
4. Delete S3 avatar objects
5. Messages retained with anonymized sender OR deleted — **default: delete conversation for both parties** (document in privacy policy)

---

## 11. Security checklist (pre-beta)

- [ ] Cognito password policy enforced
- [ ] JWT validation on every Lambda entry point
- [ ] No public S3 bucket ACLs
- [ ] Presigned URL expiry ≤ 15 min
- [ ] CORS origins are explicit (no `*`)
- [ ] CloudWatch alarms on 4xx/5xx spikes
- [ ] Dependency audit (`npm audit`) in CI
- [ ] HTTPS only (HSTS on CloudFront)
