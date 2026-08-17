# Task WHATSAPP-INVITE — WhatsApp Invitation Link

## Agent
full-stack-developer (WhatsApp invitation)

## Task
Generate invitation link + send via WhatsApp + accept invitation page

## Context Reviewed
- `/home/z/my-project/worklog.md` — prior tasks (D1-ADAPT, PROFILES-WHATSAPP added User.whatsapp)
- `/home/z/my-project/prisma/schema.prisma` — User has `whatsapp String?`, no InvitationToken
- `/home/z/my-project/src/lib/d1.ts` — `isD1()`, `d1First`, `d1Run`, `d1Query`
- `/home/z/my-project/src/app/api/auth/login/route.ts` — admin/representante login via cedula, returns JWT + user
- `/home/z/my-project/src/lib/auth.ts` — `signToken`, `verifyToken`, `hashPassword`, `getUserFromRequest`, `JwtPayload`
- `/home/z/my-project/src/lib/db-auth.ts` — `hashPassword` (bcrypt)
- `/home/z/my-project/src/app/api/admin/users/route.ts` — already returns `whatsapp` field
- `/home/z/my-project/src/components/direccion/users-manager.tsx` — pre-existing "Create Representante" dialog using `?cedula=` query param (client-side); refactored to use server-side invitation token
- `/home/z/my-project/src/stores/auth-store.ts` — `setAuth(token, user)` for auto-login

## Work Log

### Schema
- Edited `prisma/schema.prisma`:
  - Added `invitations InvitationToken[]` to User model
  - Added new `InvitationToken` model (id, token @unique, userId, used Boolean, expiresAt, createdAt, @@index([token, used]), @@map("v3_invitation_tokens"))
- Ran `bun run db:push` (SQLite dev) — synced successfully
- Applied D1 table via `wrangler d1 execute lista_db --remote`:
  ```sql
  CREATE TABLE IF NOT EXISTS v3_invitation_tokens (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    userId TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    expiresAt DATETIME NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES v3_users(id) ON DELETE CASCADE
  )
  ```

### API Routes (all use `isD1()` pattern)

- **`src/app/api/admin/representantes/[id]/invite/route.ts`** (NEW — POST + GET):
  - POST: admin-only. Verifies user exists + is `representante`. Invalidates previous unused tokens (`UPDATE ... SET used = 1 WHERE userId = ? AND used = 0`). Generates random token (`uuidv4 + uuidv4.slice(0,8)`, 40 hex chars). Sets `expiresAt = now + 7 days`. Returns `{ token, url, whatsappUrl, whatsappNumber, message, expiresAt, expiresAtDays, representante }`. URL built from `LISTA_PUBLIC_URL` env or request host. WhatsApp URL = `https://wa.me/{digits}?text={encoded message}`. Message: `Hola {nombre} {apellido}, te han registrado en el Sistema de Asistencia Escolar Lista. Completa tu registro aquí: {url}`.
  - GET: admin-only. Returns most-recent invitation status `{ hasInvitation, token, used, expired, expiresAt, createdAt, url }`.

- **`src/app/api/auth/accept-invitation/route.ts`** (NEW — GET + POST, PUBLIC, no auth):
  - GET `?token=xxx`: validates (exists, not used, not expired, user activo). Returns `{ valid, representante: { id, cedula, nombre, apellido, email }, expiresAt }` or 410 `{ valid:false, error: "El enlace ha expirado o ya fue usado" }`.
  - POST `?token=xxx` with body `{ password }`: validates token again, validates password ≥6 chars, hashes with bcrypt, updates `v3_users.password`, marks `v3_invitation_tokens.used = 1`, returns `{ token: jwt, user }` (auto-login, same shape as /api/auth/login).

### UI Components

- **`src/components/auth/accept-invitation.tsx`** (NEW — public page):
  - Loading state while validating token
  - Valid: shows representante name + cedula + email card, password + confirm inputs with show/hide toggle, validation (min 6 chars, match), submit → POST → on success sets auth in store + toast + clears `?invitacion=` from URL + router.refresh
  - Invalid/expired: red alert "El enlace ha expirado o ya fue usado"
  - Success state with check icon + spinner
  - Emerald/teal theme consistent with LoginForm

- **`src/app/page.tsx`** (MODIFIED):
  - Reads `window.location.search` for `?invitacion=` or `?token=` query param (in `requestAnimationFrame`)
  - If invitation token present AND not authenticated → renders `<AcceptInvitation token={token} />`
  - Else falls through to existing `LoginForm` / `AppShell` flow

- **`src/components/direccion/users-manager.tsx`** (MODIFIED):
  - Removed unused client-side helpers (`buildInvitationLink`, `buildWhatsAppMessage`, `buildWhatsAppUrl`) — kept `generateRandomPassword` (used by create form)
  - Refactored `openInvite(user)` to be `async` + call `POST /api/admin/representantes/{id}/invite` (server-side token, not `?cedula=` URL)
  - Extended `inviteData` state shape to include `token`, `expiresAt`, `expiresAtDays`
  - Added `inviteLoading` state
  - Refactored "Crear Representante" success dialog (`repResult`): after creating user via `POST /api/admin/representantes`, automatically calls `POST /api/admin/representantes/{id}/invite` to get a server-generated invitation token. Shows: success banner with representante name, cédula, password (backup), invitation link with copy button, WhatsApp button (with "Ver mensaje" details), expiration info, "¿Cómo funciona?" help.
  - Updated per-row invitation dialog (MessageCircle button on representante rows) to use server-side data + show expiration info + "Generar nuevo enlace" button (RefreshCw icon)
  - Updated "¿Cómo funciona?" steps to describe the new self-service password flow (representante sets own password via link)

## Verification (curl tests against live dev server)

All endpoints tested successfully:

1. **POST `/api/admin/representantes/{id}/invite`** with admin token → 200, returns `{ token, url, whatsappUrl, whatsappNumber, message, expiresAt, expiresAtDays, representante }`
2. **POST `/api/admin/representantes/{id}/invite`** with non-representante user id → 400 `{ error: "Las invitaciones solo aplican a representantes" }`
3. **POST `/api/admin/representantes/{id}/invite`** without admin auth → 403 `{ error: "No autorizado" }`
4. **GET `/api/admin/representantes/{id}/invite`** with admin token → 200, returns `{ hasInvitation, token, used, expired, expiresAt, createdAt, url }`
5. **GET `/api/auth/accept-invitation?token=validtoken`** → 200, returns `{ valid:true, representante, expiresAt }`
6. **GET `/api/auth/accept-invitation?token=invalid`** → 410, returns `{ valid:false, error: "El enlace ha expirado o ya fue usado" }`
7. **POST `/api/auth/accept-invitation?token=validtoken` with `{ password:"newpass123" }`** → 200, returns `{ token: jwt, user }` (auto-login working)
8. **POST `/api/auth/accept-invitation?token=sametokenagain`** → 410 (token correctly marked as used)
9. **POST `/api/auth/accept-invitation?token=validtoken` with `{ password:"12" }`** → 400 `{ error: "La contraseña debe tener al menos 6 caracteres" }`
10. **POST `/api/auth/login` with representante's new password** → 200 (password was correctly hashed and saved)

## Stage Summary
- 1 Prisma schema model added (`InvitationToken`), `invitations` relation added to User
- 1 D1 table created (`v3_invitation_tokens`)
- 2 new API route files created:
  - `src/app/api/admin/representantes/[id]/invite/route.ts` (POST + GET)
  - `src/app/api/auth/accept-invitation/route.ts` (GET + POST)
- 1 new UI component: `src/components/auth/accept-invitation.tsx`
- 2 modified UI files:
  - `src/app/page.tsx` (detects `?invitacion=` param)
  - `src/components/direccion/users-manager.tsx` (server-side invitation flow integrated)
- All endpoints work in both D1 (prod) and Prisma (dev) modes via `isD1()` pattern
- Boolean fields stored as INTEGER 0/1 in D1, mapped to boolean in Prisma
- WhatsApp links use `https://wa.me/{digits}?text={encoded}` (digits without +)
- Color theme: emerald/teal consistent with existing pages
- Spanish (Venezuela) text throughout
- shadcn/ui + lucide-react (MessageCircle, Copy, Check, ExternalLink, RefreshCw, KeyRound, Link2)
- `sonner` for toast notifications
- Lint exit code 0 for all new/modified files
