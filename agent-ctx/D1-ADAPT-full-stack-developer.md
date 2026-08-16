# Task D1-ADAPT — Adapt 28 API routes from Prisma to D1-compatible pattern

## Agent
full-stack-developer (D1 adaptation)

## Task
Rewrite ALL 28 API route files to use the direct D1 pattern (like login does):
`if (isD1()) { d1Query/d1First/d1Run(...); } else { db.X.findMany/create/update(...); }`

## Work Log
- Leído contexto crítico: worklog.md, src/lib/d1.ts, src/app/api/auth/login/route.ts.
- Verificado estado actual de las 28 rutas bajo src/app/api/ (cambios sin commitear):
  - Auth (1): auth/me ✓
  - Admin (9): students, students/[id], sections, sections/[id], plantels, plantels/[id], users, users/[id], stats ✓
  - Profesor (5): sections, students, attendance, checkin, feed ✓
  - Representante (5): children, location, attendance, feed, notifications ✓
  - Alumno (5): profile, checkin, location, feed, attendance ✓
  - General (3): notifications, push/subscribe, upload ✓
- Auditoría con grep: 14 archivos usan `include:` y 3 usan `_count` (admin/plantels, admin/sections, profesor/sections); todos tienen su rama `if (isD1())` con JOIN/subquery equivalente.
- Booleanos D1 (0/1 INTEGER) normalizados en cada respuesta (`activo === 1`, `activa === 1`, `leida === 1`, `esPrincipal === 1`).
- Helpers compartidos (checkSectionAccess, verifyOwnership) también bifurcan isD1().
- upload/route.ts correctamente configurado: R2 en prod vía Symbol.for('__cloudflare-context__') + getCloudflareContext, sin sharp; filesystem + sharp opcional en dev.
- Lógica de negocio preservada en ambas ramas: JWT, bcrypt, haversine, geocerca, idempotencia, push VAPID, long polling 25s.

## Stage Summary
- 28 rutas verificadas con patrón D1 directo.
- Lint source limpio (0 errores en src/; todos los 887 errores reportados son artefactos de build en `.open-next/`).
- Dev server corre sin errores.
- Pendiente: commitear los cambios (27 modified + 1 untracked en src/app/api/).

## Files Adapted (28)
1. src/app/api/auth/me/route.ts
2. src/app/api/admin/students/route.ts
3. src/app/api/admin/students/[id]/route.ts
4. src/app/api/admin/sections/route.ts
5. src/app/api/admin/sections/[id]/route.ts
6. src/app/api/admin/plantels/route.ts
7. src/app/api/admin/plantels/[id]/route.ts
8. src/app/api/admin/users/route.ts
9. src/app/api/admin/users/[id]/route.ts
10. src/app/api/admin/stats/route.ts
11. src/app/api/profesor/sections/route.ts
12. src/app/api/profesor/students/route.ts
13. src/app/api/profesor/attendance/route.ts
14. src/app/api/profesor/checkin/route.ts
15. src/app/api/profesor/feed/route.ts
16. src/app/api/representante/children/route.ts
17. src/app/api/representante/location/route.ts
18. src/app/api/representante/attendance/route.ts
19. src/app/api/representante/feed/route.ts
20. src/app/api/representante/notifications/route.ts
21. src/app/api/alumno/profile/route.ts
22. src/app/api/alumno/checkin/route.ts
23. src/app/api/alumno/location/route.ts
24. src/app/api/alumno/feed/route.ts
25. src/app/api/alumno/attendance/route.ts
26. src/app/api/notifications/route.ts
27. src/app/api/push/subscribe/route.ts
28. src/app/api/upload/route.ts
