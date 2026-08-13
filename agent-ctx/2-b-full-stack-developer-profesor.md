# Agent Context — Task 2-b: Profesor App

## Task
Build profesor app for the Lista attendance system:
- Profesor API routes (sections, students, attendance, checkin, feed)
- Notifications API route (GET/PUT)
- Profesor view components (dashboard, attendance, checkin, feed, notifications)
- Wire up ViewRenderer

## Files Created

### API Routes
- `src/app/api/profesor/sections/route.ts` — GET sections assigned to professor
- `src/app/api/profesor/students/route.ts` — GET students in a section
- `src/app/api/profesor/attendance/route.ts` — GET/POST/PUT attendance with notifications
- `src/app/api/profesor/checkin/route.ts` — GET/POST professor GPS check-in
- `src/app/api/profesor/feed/route.ts` — GET/POST feed posts with parent notifications
- `src/app/api/notifications/route.ts` — GET/PUT notifications for any user

### State
- `src/stores/view-store.ts` — Zustand store for navigation between views

### Components
- `src/components/profesor/profesor-dashboard.tsx`
- `src/components/profesor/attendance-taker.tsx`
- `src/components/profesor/profesor-checkin.tsx`
- `src/components/profesor/feed-poster.tsx`
- `src/components/profesor/profesor-notifications.tsx`

## Files Modified
- `src/components/layouts/app-shell.tsx` — wired ViewRenderer for profesor role, refactored SidebarContent out of render to fix lint errors

## Verification
- All endpoints tested with curl: returns correct HTTP codes (200/201/401/403)
- Notifications correctly created when marking student as ausente/tardanza
- Checkin idempotency works (returns existing entrada)
- Feed post creates parent notifications
- Lint passes (1 pre-existing error in page.tsx that we cannot modify)

## Notes for other agents
- `useViewStore` exposes `setActiveView(view: string)` for cross-component navigation
- All profesor API routes require `rol === 'profesor'` via `getUserFromRequest`
- Notifications API works for ALL authenticated roles (used by representante app too)
