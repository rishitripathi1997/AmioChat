# Phase 4 — Implementation

**Project:** AmioChat  
**Version:** 0.2  
**Last updated:** 2026-06-18  
**Status:** In progress  
**Prerequisites:** Phases 1–3 (complete)

---

## 1. Build order

| Step | Task | Status |
|------|------|--------|
| 4.1 | Monorepo scaffold (`apps/web`, `packages/backend`, `packages/shared`) | **Complete** |
| 4.1b | Terraform scaffold (`infra/terraform/` + modules) | **Complete** |
| 4.2 | Terraform — JWT authorizers, real Lambda bundles, Chime IAM, SSM outputs | **Complete** |
| 4.3 | Auth flows — register, login, PostConfirmation trigger (local mock + Cognito-ready) | **Complete** |
| 4.4 | REST APIs — users, conversations, messages, media | **Complete** |
| 4.5 | WebSocket handlers — connect, sendMessage, typing, read | **Complete** |
| 4.6 | Chat UI — sidebar, thread, composer | **Complete** |
| 4.7 | Chime integration — call create/join, CallOverlay | **Complete** |
| 4.8 | Polish — notifications, error states, reconnect | **Next** |

---

## 2. Repository layout

```
AmioChat/
├── apps/
│   └── web/                 # Next.js frontend
├── packages/
│   ├── shared/              # Shared TypeScript types
│   └── backend/             # Lambda handlers & DDB layer
├── infra/
│   ├── README.md
│   └── terraform/           # Terraform root + modules
│       ├── main.tf
│       ├── modules/
│       │   ├── cognito/
│       │   ├── dynamodb/
│       │   ├── s3/
│       │   ├── lambda/
│       │   ├── http_api/
│       │   └── websocket_api/
│       └── environments/
├── docs/sdlc/
├── package.json             # npm workspaces root
└── tsconfig.base.json
```

---

## 3. Infrastructure (Terraform)

**IaC decision:** Terraform (team standard) — see [ADR-004](./phase-2-architecture.md#adr-004-terraform).

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

Baseline modules provision Cognito, DynamoDB, S3, Lambda, HTTP API, and WebSocket API.

### Phase 4.2 deliverables (complete)

| Item | Implementation |
|------|----------------|
| Lambda bundles | `packages/backend` REST + WS handlers, esbuild → `dist/`, auto-build on `terraform apply` |
| JWT authorizer (HTTP) | Cognito JWT on `$default`; public `GET /health` |
| JWT authorizer (WS) | Cognito JWT on `$connect` via `?token=` query param |
| Chime IAM | `chime:*Meeting`, `chime:*Attendee` on Lambda role |
| WS fan-out IAM | `execute-api:ManageConnections` on WebSocket API |
| SSM parameters | `/amiochat/{env}/*` — Cognito, API URLs, DynamoDB, S3 |
| CORS | HTTP API allows `web_app_origins` (default `localhost:3000`) |

### Phase 4.3 deliverables (complete)

Local mock auth + Cognito-ready UI at `/login`, `/register`, `/confirm`, `/forgot-password`, `/chat`.

### Phase 4.4 deliverables (complete)

| Item | Implementation |
|------|----------------|
| REST router | `packages/backend/src/rest/router.ts` — shared by Lambda + Next.js |
| Data layer | `MemoryRepository` for local dev; DynamoDB stub deferred |
| Endpoints | `GET/PATCH /users/me`, `GET /users/search`, `GET/POST /conversations`, `GET /conversations/{id}/messages`, `POST /media/upload-url`, `POST /media/download-url` |
| Calls | `501` stub — deferred to Phase 4.7 |
| Local API | `apps/web/src/app/api/v1/[...path]/route.ts` proxies to shared router |
| Mock media | `PUT /api/media/upload`, `GET /api/media/download` |
| Frontend client | `apps/web/src/lib/api/client.ts` |
| Chat demo | `/chat` — profile, user search, start conversation |

```bash
# After sign-in, REST APIs are available at:
curl -H "Authorization: Bearer <idToken>" http://localhost:3000/api/v1/users/me
```

### Phase 4.5 deliverables (complete)

| Item | Implementation |
|------|----------------|
| WS router | `packages/backend/src/ws/router.ts` — sendMessage, typing, read, presence, ping |
| Connections | In-memory connection store; presence online/offline on connect/disconnect |
| Lambda handler | `$connect`, `$disconnect`, default route with action dispatch |
| Local WS server | `npm run dev:ws` → `ws://localhost:3002?token=<idToken>` |
| Rate limits | 30 sendMessage/min, 60 typing/min per user |
| Frontend hook | `apps/web/src/lib/ws/client.ts` |
| Chat demo | `/chat` — live messaging when WS server is running |

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run dev:ws
```

`callSignal` returns `NOT_IMPLEMENTED` until Phase 4.7.

### Phase 4.6 deliverables (complete)

| Item | Implementation |
|------|----------------|
| Chat shell | WhatsApp Web layout — sidebar + thread panel |
| Components | `Sidebar`, `ThreadPanel`, `MessageList`, `Composer`, `NewChatModal`, etc. |
| State | `ChatProvider` — inbox, messages, optimistic send, typing, read receipts |
| Reconnect | WS client exponential backoff; sync inbox + messages on reconnect |
| Mobile | Single-panel toggle between sidebar and thread (< md) |
| UX | Date dividers, unread badges, connection banner, message status ticks |

Call buttons and file attachments are stubbed until Phase 4.7+.

### Phase 4.7 deliverables (complete)

| Item | Implementation |
|------|----------------|
| REST `/calls` | POST create, POST join, DELETE end |
| Chime layer | Mock client (local) + AWS SDK client (deployed) |
| WS signaling | `callSignal` accept/decline/end/busy; `call.incoming`, `call.updated` events |
| Call store | In-memory call records, busy detection, 30s ring timeout |
| Local bridge | `POST http://localhost:3002/internal/publish` fans out call events to WS clients |
| Frontend | `CallOverlay`, voice/video buttons in header, `amazon-chime-sdk-js` (real) + mock mode |
| System messages | Call ended/declined/missed appear in thread |

```bash
# Required for incoming call notifications in local dev:
npm run dev      # Terminal 1
npm run dev:ws   # Terminal 2 (includes call event bridge)
```

Set `USE_MOCK_CHIME=false` and `CHIME_MEDIA_REGION=us-east-1` after Terraform apply for real Chime meetings.

---

## Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-06-16 | SDLC Phase 4 | Implementation tracker started |
| 0.3 | 2026-06-22 | SDLC Phase 4 | Terraform validated; CDK removed; ready for Phase 4.2 |
| 0.4 | 2026-06-22 | SDLC Phase 4 | Phase 4.2: JWT auth, Lambda bundles, Chime IAM, SSM |
| 0.5 | 2026-06-22 | SDLC Phase 4 | Phase 4.3: local mock auth UI + Cognito-ready + PostConfirmation handler |
| 0.6 | 2026-06-16 | SDLC Phase 4 | Phase 4.4: REST APIs with memory repo + local Next.js proxy |
| 0.7 | 2026-06-16 | SDLC Phase 4 | Phase 4.5: WebSocket handlers + local WS dev server |
| 0.8 | 2026-06-16 | SDLC Phase 4 | Phase 4.6: WhatsApp-style chat UI shell |
| 0.9 | 2026-06-16 | SDLC Phase 4 | Phase 4.7: Chime calls REST + WS + CallOverlay |
