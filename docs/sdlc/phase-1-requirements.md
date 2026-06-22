# Phase 1 — Discovery & Requirements

**Project:** AmioChat  
**Version:** 0.2  
**Last updated:** 2026-06-16  
**Status:** Approved — ready for Phase 2 (Architecture)

---

## 1. Executive summary

AmioChat is a **web-first** messaging application inspired by WhatsApp Web. Users can exchange real-time text messages, share media, and place **voice and video calls** with other users. The platform is built on **AWS managed services** to minimize operational overhead and scale with demand.

This document defines what AmioChat must do (functional requirements), how well it must perform (non-functional requirements), and what is explicitly excluded from the first release (MVP scope).

---

## 2. Vision & goals

### Vision

Provide a familiar, low-friction chat and calling experience in the browser — comparable to WhatsApp Web — backed by a modern, serverless AWS architecture.

### Primary goals


| #   | Goal                         | Measure of success                                                                     |
| --- | ---------------------------- | -------------------------------------------------------------------------------------- |
| G1  | Reliable real-time messaging | Messages delivered to online recipients within **2 seconds** (p95)                     |
| G2  | Stable 1:1 voice/video calls | Call setup completes within **5 seconds** (p95); audio/video usable on modern browsers |
| G3  | Secure user accounts         | Only authenticated users access conversations; data encrypted in transit and at rest   |
| G4  | Familiar UX                  | Users can send a message or start a call without training                              |
| G5  | AWS-native foundation        | Core features run on managed AWS services (no self-hosted chat/video servers in MVP)   |


---

## 3. Stakeholders & users

### Stakeholders


| Role          | Interest                                    |
| ------------- | ------------------------------------------- |
| Product owner | Feature scope, priorities, release timeline |
| Engineering   | Buildability, maintainability, AWS cost     |
| End users     | Usability, reliability, privacy             |


### User personas (MVP)

**Persona A — Everyday chatter**  
Uses AmioChat daily for text and occasional voice/video with friends or colleagues. Expects WhatsApp-like behavior: contact list, chat threads, typing indicators, read receipts.

**Persona B — Remote worker**  
Uses AmioChat for quick 1:1 video check-ins. Needs reliable calls, mute/unmute, and camera on/off.

*Assumption:* MVP targets **general consumers and small teams**, not enterprise compliance-heavy deployments (e.g. HIPAA) unless stated otherwise later.

---

## 4. Scope

### 4.1 In scope — MVP (v1.0)


| Area               | MVP capability                                                            |
| ------------------ | ------------------------------------------------------------------------- |
| **Authentication** | Sign up, sign in, sign out; email + password (Cognito). Password reset.   |
| **Profile**        | Display name, avatar (upload to S3), online/offline presence              |
| **Contacts**       | Search users by email or username; start 1:1 conversation                 |
| **1:1 chat**       | Real-time text messages; message history on load; timestamps              |
| **Chat UX**        | Typing indicators, delivery status (sent/delivered/read), unread counts   |
| **Media**          | Send/receive images and files in chat (S3-backed, size limits enforced)   |
| **1:1 voice call** | Outbound/inbound voice via Amazon Chime SDK                               |
| **1:1 video call** | Outbound/inbound video; mute, camera toggle, end call                     |
| **Client**         | Responsive **web app** (desktop-first, usable on tablet)                  |
| **Notifications**  | In-app indicators for new messages; browser notifications where permitted |


### 4.2 Post-MVP (v1.x / v2)


| Feature                                                   | Target phase                      |
| --------------------------------------------------------- | --------------------------------- |
| Group chats (create, add/remove members, group name/icon) | v1.1                              |
| Group voice/video calls                                   | v1.2                              |
| Message reactions, replies, forward                       | v1.x                              |
| Voice messages (record & play)                            | v1.x                              |
| Phone OTP / social login (Google, Apple)                  | v1.x                              |
| Mobile apps (iOS/Android)                                 | v2                                |
| End-to-end encryption                                     | v2+ (major architecture decision) |
| Message search                                            | v1.x                              |
| Admin/moderation console                                  | v2                                |


### 4.3 Out of scope (all versions unless revisited)

- SMS gateway integration (true phone-number messaging like carrier SMS)
- Public channels / broadcast feeds (Telegram-style)
- Built-in payments or marketplace
- On-premise or multi-cloud deployment in MVP
- AI chatbots or LLM assistants (unless added as separate initiative)

---

## 5. Functional requirements

Requirements use IDs for traceability in design and test phases.

### 5.1 Authentication & account (AUTH)


| ID      | Requirement                                                                         | Priority |
| ------- | ----------------------------------------------------------------------------------- | -------- |
| AUTH-01 | User can register with email and password                                           | Must     |
| AUTH-02 | User can sign in and receive a session/token                                        | Must     |
| AUTH-03 | User can sign out (invalidate session client-side and server-side where applicable) | Must     |
| AUTH-04 | User can request password reset via email                                           | Must     |
| AUTH-05 | Unauthenticated users cannot access chat or call APIs                               | Must     |
| AUTH-06 | User can update display name and avatar                                             | Should   |


### 5.2 Contacts & discovery (CONT)


| ID      | Requirement                                                  | Priority |
| ------- | ------------------------------------------------------------ | -------- |
| CONT-01 | User can search for other registered users                   | Must     |
| CONT-02 | User can open or create a 1:1 conversation with another user | Must     |
| CONT-03 | Conversation list shows recent chats sorted by last activity | Must     |
| CONT-04 | User sees online/offline/last-seen status for contacts       | Should   |


### 5.3 Messaging (MSG)


| ID     | Requirement                                                   | Priority |
| ------ | ------------------------------------------------------------- | -------- |
| MSG-01 | User can send text messages in a 1:1 conversation             | Must     |
| MSG-02 | Recipient receives messages in real time when online          | Must     |
| MSG-03 | User sees message history when opening a conversation         | Must     |
| MSG-04 | Messages show sender, body, and timestamp                     | Must     |
| MSG-05 | User sees typing indicator when other party is typing         | Should   |
| MSG-06 | User sees delivery status: sent → delivered → read            | Should   |
| MSG-07 | User can send images (JPEG, PNG, WebP)                        | Must     |
| MSG-08 | User can send generic files (PDF, DOCX, etc.) with size limit | Should   |
| MSG-09 | Media messages display thumbnail or file name with download   | Must     |
| MSG-10 | User sees unread message count per conversation               | Must     |


### 5.4 Voice & video calls (CALL)


| ID      | Requirement                                                                  | Priority |
| ------- | ---------------------------------------------------------------------------- | -------- |
| CALL-01 | User can initiate a 1:1 voice call from an open conversation                 | Must     |
| CALL-02 | User can initiate a 1:1 video call from an open conversation                 | Must     |
| CALL-03 | Callee receives an in-app incoming call notification                         | Must     |
| CALL-04 | Callee can accept or decline the call                                        | Must     |
| CALL-05 | Active call supports mute/unmute microphone                                  | Must     |
| CALL-06 | Active video call supports camera on/off                                     | Must     |
| CALL-07 | Either party can end the call                                                | Must     |
| CALL-08 | Call state is visible (ringing, connected, ended)                            | Must     |
| CALL-09 | Missed/declined calls are surfaced in conversation (system message or badge) | Should   |


### 5.5 Notifications (NOTIF)


| ID       | Requirement                                                             | Priority |
| -------- | ----------------------------------------------------------------------- | -------- |
| NOTIF-01 | User receives in-app alert for new message when not viewing that thread | Must     |
| NOTIF-02 | User can enable browser push notifications for new messages (opt-in)    | Should   |
| NOTIF-03 | Incoming call shows prominent UI (ringtone optional)                    | Must     |


---

## 6. Non-functional requirements

### 6.1 Performance


| ID      | Requirement                            | Target                      |
| ------- | -------------------------------------- | --------------------------- |
| PERF-01 | Message delivery latency (online user) | p95 < 2 s                   |
| PERF-02 | Initial chat history load              | < 3 s for last 50 messages  |
| PERF-03 | Call connection time                   | p95 < 5 s                   |
| PERF-04 | Image upload (≤ 5 MB)                  | < 10 s on typical broadband |


### 6.2 Scalability


| ID       | Requirement                                               | Target                                                         |
| -------- | --------------------------------------------------------- | -------------------------------------------------------------- |
| SCALE-01 | Concurrent connected users (MVP launch)                   | **500**; architecture must support **5,000+** without redesign |
| SCALE-02 | Messages per second (system-wide)                         | **100** at launch; headroom for 10×                            |
| SCALE-03 | Architecture supports horizontal scaling without redesign | Required                                                       |


### 6.3 Availability & reliability


| ID     | Requirement                                                                                     | Target        |
| ------ | ----------------------------------------------------------------------------------------------- | ------------- |
| REL-01 | Service uptime (excluding planned maintenance)                                                  | 99.5% monthly |
| REL-02 | No single message loss under normal operation                                                   | Required      |
| REL-03 | Graceful degradation when callee is offline (missed call, queued message delivery on reconnect) | Required      |


### 6.4 Security


| ID     | Requirement                                                                |
| ------ | -------------------------------------------------------------------------- |
| SEC-01 | TLS 1.2+ for all client–server and service-to-service traffic              |
| SEC-02 | Authentication via Amazon Cognito (or equivalent managed IdP)              |
| SEC-03 | Authorization: users access only conversations they belong to              |
| SEC-04 | Media stored in S3 with private ACL; access via short-lived presigned URLs |
| SEC-05 | Input validation on all API and WebSocket payloads                         |
| SEC-06 | Rate limiting on auth and message endpoints                                |
| SEC-07 | Secrets in AWS Secrets Manager or SSM Parameter Store — not in source code |


*Note:* MVP uses **transport encryption + at-rest encryption** on AWS. **End-to-end encryption** is out of scope for v1 (see §4.2).

### 6.5 Privacy & compliance


| ID      | Requirement                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------ |
| PRIV-01 | Privacy policy and terms of service linked in app                                                |
| PRIV-02 | User can delete their account and associated profile data                                        |
| PRIV-03 | Message retention policy documented (default: retain until user deletes account or conversation) |


### 6.6 Usability & accessibility


| ID    | Requirement                                                                      |
| ----- | -------------------------------------------------------------------------------- |
| UX-01 | Layout inspired by WhatsApp Web: sidebar (chats) + main panel (active chat)      |
| UX-02 | Supported browsers: latest Chrome, Firefox, Safari, Edge (last 2 major versions) |
| UX-03 | Keyboard accessible: send message (Enter), focus management for modals           |
| UX-04 | WCAG 2.1 Level A for core flows (stretch: AA)                                    |


### 6.7 Operability


| ID     | Requirement                                                                        |
| ------ | ---------------------------------------------------------------------------------- |
| OPS-01 | Structured logging (CloudWatch) with correlation IDs                               |
| OPS-02 | Metrics: message throughput, WebSocket connections, call success rate, error rates |
| OPS-03 | Infrastructure defined as code (Terraform)                                           |
| OPS-04 | Separate dev, staging, and production environments                                 |


---

## 7. Technical constraints & assumptions

### Constraints

- **Cloud provider:** AWS only for MVP
- **Client:** Web application (React or Next.js — decision in Phase 2)
- **Video/voice:** Amazon Chime SDK (not self-hosted WebRTC SFU)
- **Real-time transport:** WebSockets (API Gateway) or AWS AppSync — decision in Phase 2
- **No native mobile apps** in MVP

### Confirmed decisions (2026-06-16)


| #   | Decision                                                                           | Status        |
| --- | ---------------------------------------------------------------------------------- | ------------- |
| A1  | MVP includes **1:1 chat only**; group chat deferred to v1.1                        | **Confirmed** |
| A2  | **Email + password** auth for v1; phone OTP deferred                               | **Confirmed** |
| A3  | Launch scale **500 concurrent users**; design for **10× headroom** (~5,000)        | **Confirmed** |
| A4  | **Solo or small team** development; simplicity favored over premature optimization | Assumed       |
| A5  | **English-only** UI for MVP; i18n later                                            | Assumed       |
| A6  | Max upload size: **25 MB** per file (configurable)                                 | Assumed       |
| A7  | Message history retained **indefinitely** unless user deletes account              | Assumed       |
| A8  | AWS monthly budget guideline: **< $200** at MVP scale (soft target)                | **Confirmed** |
| A9  | AWS region: `**us-east-1`** for MVP (single region)                                | **Confirmed** |


---

## 8. User journeys (MVP)

### Journey 1 — First message

1. User registers and verifies email
2. User searches for a contact by email
3. User opens conversation and sends “Hello”
4. Contact sees message in real time with notification
5. Contact replies; both see read receipts

### Journey 2 — Video call

1. User A opens chat with User B
2. User A taps video call
3. User B sees incoming call UI and accepts
4. Both connect with audio/video
5. User A mutes mic; User B turns camera off
6. Either user ends call; conversation shows call ended

### Journey 3 — Share image

1. User attaches image in chat
2. Image uploads to S3; progress indicator shown
3. Recipient sees thumbnail in thread
4. Recipient opens full image via presigned URL

---

## 9. Success criteria (MVP launch)

MVP is **ready for limited beta** when:

- All **Must** functional requirements (AUTH, CONT, MSG, CALL, NOTIF) are implemented and tested
- PERF-01 through PERF-03 targets met in staging under simulated load
- SEC-01 through SEC-06 verified (security review checklist)
- Deployed to production AWS account with monitoring dashboards
- At least **5 beta users** complete Journeys 1–3 without blocking defects

---

## 10. Decisions

### Resolved (Phase 2)


| #   | Decision                 | Resolution                                                                                     |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| D1  | Real-time chat transport | **API Gateway WebSockets + Lambda** — see [phase-2-architecture.md](./phase-2-architecture.md) |
| D2  | Frontend framework       | **Next.js 15 (App Router)**                                                                    |
| D3  | IaC tool                 | **Terraform (HCL)** — see [phase-2-architecture.md](./phase-2-architecture.md) ADR-004 |


### Resolved (Phase 1)


| #   | Decision                      | Resolution                                    |
| --- | ----------------------------- | --------------------------------------------- |
| D4  | MVP group chat                | **Deferred** to v1.1                          |
| D5  | Phone OTP login               | **Deferred** — email + password for v1        |
| D6  | Launch concurrent user target | **500** at launch; **5,000+** design headroom |
| D7  | AWS region                    | `**us-east-1`** (single region for MVP)       |
| D8  | AWS budget                    | **< $200/month** soft target at MVP scale     |


## 11. Glossary


| Term              | Definition                                       |
| ----------------- | ------------------------------------------------ |
| Conversation      | A 1:1 thread between two users                   |
| Presence          | Online, offline, or last-seen state              |
| Chime SDK meeting | AWS resource backing a voice/video session       |
| Delivery status   | Progression: sent → delivered → read             |
| MVP               | Minimum viable product — first shippable version |


---

## 12. Approval


| Role          | Name    | Date       | Sign-off |
| ------------- | ------- | ---------- | -------- |
| Product owner | Rishitr | 2026-06-16 | ☑        |
| Tech lead     | TBD     |            | ☐        |


---

## Revision history


| Version | Date       | Author       | Changes                                     |
| ------- | ---------- | ------------ | ------------------------------------------- |
| 0.1     | 2026-06-16 | SDLC Phase 1 | Initial draft                               |
| 0.2     | 2026-06-16 | SDLC Phase 1 | Stakeholder confirmations; Phase 1 approved |
