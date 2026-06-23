# Local development (mock auth — no AWS billing)

```bash
# From repo root
npm install
cp apps/web/.env.example apps/web/.env.local   # optional; mock is default

npm run dev
# Open http://localhost:3000
```

## Mock auth flow

1. **Register** at `/register` with any email + password (8+ chars)
2. **Confirm** at `/confirm` with code **`123456`**
3. **Sign in** at `/login`
4. Land on **`/chat`** — signed-in placeholder shell

Password reset also uses code **`123456`** in mock mode.

No `terraform apply` required. Sessions use an httpOnly cookie; tokens stay in memory.

## Switch to real Cognito (after terraform apply)

1. Run `terraform apply` on personal account
2. Copy outputs into `apps/web/.env.local`:

```env
NEXT_PUBLIC_AUTH_MODE=cognito
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<from terraform output>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<from terraform output>
AUTH_SESSION_SECRET=<random secret>
```

3. Restart `npm run dev`

## PostConfirmation Lambda

Handler lives at `packages/backend/src/triggers/post-confirmation.ts`.  
Wired to Cognito on **`terraform apply`** (creates DynamoDB profile on sign-up).  
In mock mode, profile creation is skipped (no DynamoDB).
