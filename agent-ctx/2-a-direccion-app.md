# Task 2-a — Dirección (Admin) app

## Agent
general-purpose (Dirección app)

## Scope
Build admin (Dirección) app: students, sections, plantel geocerca, users management.

## Files created
### API routes (`src/app/api/admin/`)
- `students/route.ts` — GET (pagination, search, sectionId filter, include parents) + POST (auto-generates qrCode UUID)
- `students/[id]/route.ts` — PUT (with uniqueness validation) + DELETE (soft)
- `sections/route.ts` — GET (with plantel, tutor, studentCount) + POST (sync SectionAssignment)
- `sections/[id]/route.ts` — PUT (reassign tutor, sync assignments) + DELETE (soft)
- `plantels/route.ts` — GET (with sectionCount) + POST
- `plantels/[id]/route.ts` — PUT (geocerca: lat, lng, radioM)
- `users/route.ts` — GET (filter by rol, search) + POST (hashes password with bcrypt)
- `users/[id]/route.ts` — PUT (optional password re-hash) + DELETE (soft, blocks self-deactivation)
- `stats/route.ts` — GET for dashboard (totals, today's attendance, 7-day section chart, recent activity)

### View components (`src/components/direccion/`)
- `admin-dashboard.tsx` — 4 stat cards + recharts BarChart (attendance by section, 7 days) + recent activity list
- `students-manager.tsx` — table with search, section filter, Switch activo, create/edit Dialog, delete AlertDialog
- `sections-manager.tsx` — grid of section cards with tutor select, create/edit/delete
- `plantel-config.tsx` — sidebar of plantels + form + visual geocerca circle
- `users-manager.tsx` — Tabs by role, table with role badges, create/edit Dialog with V-/E- prefix

## Files modified
- `src/components/layouts/app-shell.tsx` — added admin imports + `if (user.rol === 'admin') { switch(view) }` block in ViewRenderer. Preserves profesor block (added by another agent) and fallback for representante/alumno.

## Authorization
All admin API routes use `getUserFromRequest(request)` + check `rol === 'admin'`. Returns 403 if not admin. Verified with curl: profesor token → 403, no token → 403.

## Tests done (curl)
- Login as admin (V-00000000 / admin123) → 200, got token.
- GET `/admin/stats` → totals {students:5, sections:1, professors:1, plantels:1}, attendanceBySection[1].
- GET `/admin/users` → 4 users (admin, profesor, alumno, representante).
- GET `/admin/sections` → 1 section "1° A" with tutor "María García" and 5 students.
- GET `/admin/plantels` → "Liceo Demo" at lat 10.4806 / lng -66.9036, radio 200m.
- GET `/admin/students` → students with section info.
- POST `/admin/users` → 201, returns new user with hashed password.
- POST `/admin/students` → 201, returns new student with auto-generated qrCode UUID.
- Non-admin token → 403 on all admin endpoints.
- Empty token → 403.

## Lint result
`bun run lint` shows 1 error in `src/app/page.tsx:15` — pre-existing `setState in effect` warning, NOT introduced by this task, and `page.tsx` is on the "DO NOT modify" list. All files introduced by this task pass lint cleanly. TypeScript check (`bunx tsc --noEmit`) shows no errors in any file introduced by this task.

## Notes for next agents
- The `useViewStore` (zustand, `src/stores/view-store.ts`) was added by another agent and is used for navigation. My admin views work fine with it.
- Placeholder fallback for `representante` and `alumno` views remains in `ViewRenderer` — next agents should replace it with their own switch blocks.
- Admin endpoints are stable; representante/alumno endpoints can call public read endpoints they need (e.g., students/sections filtered).
