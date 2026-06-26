# Phase 5 — Testing

**Project:** AmioChat  
**Version:** 0.1  
**Last updated:** 2026-06-16  
**Status:** Complete  
**Prerequisites:** Phase 4 (complete)

---

## 1. Test strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | Vitest | Shared helpers, memory repository, services |
| Integration | Vitest | REST router, WebSocket action handlers |
| E2E | Playwright | Auth flows, chat, calls in browser |
| Manual | Local dev checklist | Two-browser real-time + call scenarios |

Tests run against the **in-memory repository** — no AWS credentials or billing required.

---

## 2. Build order

| Step | Task | Status |
|------|------|--------|
| 5.1 | Vitest scaffold + `npm test` at repo root | **Complete** |
| 5.2 | Shared unit tests (`directConvId`, etc.) | **Complete** |
| 5.3 | Memory repository tests | **Complete** |
| 5.4 | REST router integration tests | **Complete** |
| 5.5 | WebSocket handler tests | **Complete** |
| 5.6 | Playwright E2E suite | **Complete** |
| 5.7 | CI workflow (GitHub Actions) | **Complete** |

---

## 3. Running tests

```bash
# Unit + integration (Vitest)
npm test

# E2E — installs Chromium on first run
npm run test:e2e:install
npm run test:e2e

# E2E with Playwright UI
npm run test:e2e:ui
```

### CI (GitHub Actions)

On every push/PR to `master` or `main`, [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs:

| Job | Steps |
|-----|-------|
| **Unit & build** | `npm ci` → `typecheck` → `test` → `build` |
| **Playwright E2E** | `npm ci` → install Chromium → `test:e2e` |

Failed E2E runs upload `playwright-report/` and `test-results/` artifacts.

---

> **Corporate proxy note:** E2E registers users via `POST /api/auth/mock`. If a proxy (e.g. Zscaler) blocks `localhost` API calls, run tests off VPN or allowlist `localhost:3100`.

### E2E coverage

| Spec | Scenarios |
|------|-----------|
| `e2e/auth.spec.ts` | Mock hint, auth guard, register → confirm → login |
| `e2e/chat.spec.ts` | New chat, conversation thread; live message when WS connected |
| `e2e/call.spec.ts` | Incoming voice call overlay + decline |

---

## 4. Requirements traceability (Must)

| Req ID | Area | Covered by |
|--------|------|------------|
| AUTH-01 | Sign-in identity | REST `/users/me` tests |
| CONT-01 | Start conversation | REST `POST /conversations` |
| MSG-01 | Send text message | WS `sendMessage` + memory repo |
| MSG-02 | Message deduplication | Memory repo `clientMsgId` |
| CALL-01 | Create call | E2E `call.spec.ts` (incoming overlay) |
| NOTIF-02 | Browser notifications | Manual / future E2E |

---

## Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.2 | 2026-06-16 | SDLC Phase 5 | Phase 5.6: Playwright E2E (auth, chat, calls) |
| 0.3 | 2026-06-16 | SDLC Phase 5 | Phase 5.7: GitHub Actions CI workflow |
