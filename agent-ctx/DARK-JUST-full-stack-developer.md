# Task DARK-JUST — Dark mode toggle + Representative justifications

## Goal
1. Add dark mode toggle (next-themes) in AppShell header (next to bell icon), works on desktop + mobile.
2. Add Justification model + API + UI for representative to notify absence.
3. Wire nav item `representante-justifications` to ViewRenderer.

## Files modified
- `src/app/layout.tsx` — wrap children in ThemeProvider
- `src/components/layouts/app-shell.tsx` — Sun/Moon toggle button (desktop + mobile), nav item, ViewRenderer case
- `prisma/schema.prisma` — add Justification model + relations on User/Student

## Files created
- `src/app/api/representante/justifications/route.ts` — GET (list last 30d), POST (create + notify tutor/admin)
- `src/app/api/representante/justifications/[id]/route.ts` — DELETE (cancel pending)
- `src/components/representante/representante-justifications.tsx` — UI view

## Patterns followed
- `isD1()` pattern from `src/lib/d1.ts` and `src/app/api/auth/login/route.ts`
- Tables prefixed with `v3_`
- Boolean fields in D1 as INTEGER 0/1
- `uuid` v4 for IDs in D1 inserts
- Push notifications fired via `sendPushNotification` (fire-and-forget)
- Spanish (VE) text, emerald/teal color theme
- shadcn/ui components, lucide-react icons, sonner toasts
