# Task 3 — Representante App (Parent)

## What I built

### API routes (under `src/app/api/representante/`)
- `children/route.ts` — GET lista hijos del representante con section + plantel info.
- `location/route.ts` — GET último LocationPing del estudiante. **Long polling** con `?wait=true&lastTimestamp=xxx` (hasta 25s, poll cada 3s). Devuelve `stale: true` en timeout.
- `attendance/route.ts` — GET registros de asistencia del estudiante (últimos 30 días) con info de sesión.
- `feed/route.ts` — GET FeedPosts de todas las secciones de los hijos del representante (límite 50, desc).
- `notifications/route.ts` — GET notificaciones del representante (no leídas primero, luego por fecha desc).

Todos los endpoints validan `getUserFromRequest` + `rol === 'representante'` y verifican propiedad vía `ParentStudent` relation.

### Components (under `src/components/representante/`)
- `child-selector.tsx` — selector de hijo reutilizable (DropdownMenu si hay múltiples, card simple si solo uno).
- `map-view.tsx` — mapa SVG custom (viewBox 400x300) con:
  - Plantel como círculo verde (radio proporcional a `radioM`)
  - Estudiante como punto azul pulsante
  - Línea con etiqueta de distancia (haversine)
  - Cuadrícula con etiquetas N/S/E/O en metros
  - Brújula, leyenda, gradient emerald/teal
  - Auto-escalado basado en max(radioM, distancia)
- `child-location-map.tsx` — vista con mapa + long polling + refresco cada 15s como fallback.
- `child-attendance.tsx` — calendario 30 días + grid de stats (% asistencia, presentes/ausentes/tardanzas) + lista detallada con color coding por estado.
- `representante-dashboard.tsx` — dashboard con status de hoy, última ubicación, quick links, badge de notificaciones.
- `representante-feed.tsx` — feed tipo red social con avatar del profesor, badge de tipo, placeholder `📷 Foto` para mediaKey.
- `representante-notifications.tsx` — lista de notificaciones con color coding por tipo, click para marcar como leída, botón "marcar todo".
- `utils.ts` — helpers (haversine, formatDistance, formatRelative, estadoStyle, notifStyle, etc).

### Stores
- `src/stores/representante-store.ts` — Zustand store con `children`, `selectedChildId`, `fetchChildren`, `selectChild`.

### AppShell wiring
- Editado `src/components/layouts/app-shell.tsx`:
  - Añadidos imports de los 5 componentes representante.
  - Añadido bloque `if (user.rol === 'representante') { switch(view) {...} }` en ViewRenderer (entre profesor y alumno).
  - Renombrado comentario "FALLBACK" → "ALUMNO VIEWS" (el bloque alumno ya estaba wired por otro agente).

### Seed data
- Inyectados 5 LocationPing de demo para el estudiante Carlos Pérez (cerca del plantel Liceo Demo) para que el mapa funcione en desarrollo.

## Tests run

### curl endpoints (login como V-00000003):
- `GET /api/representante/children` → 200, 1 hijo (Carlos Pérez, section-default).
- `GET /api/representante/location?estudianteId=xxx` → 200, último ping con lat/lng/precision/timestamp.
- `GET /api/representante/attendance?estudianteId=xxx` → 200, 1 registro (ausente).
- `GET /api/representante/feed` → 200, 1 post (aviso de María García).
- `GET /api/representante/notifications` → 200, 2 notificaciones, 1 no leída.

### Long polling:
- `?wait=true` sin `lastTimestamp` → retorna inmediatamente con el último ping.
- `?wait=true&lastTimestamp=<pasado>` → espera hasta 25s, retorna último ping con `stale: true`.
- `?wait=true&lastTimestamp=<último conocido>` + inyección de nuevo ping en DB a T+5s → responde en ~6s con el nuevo ping, SIN `stale`.

### Seguridad:
- Profesor intentando acceder a `/api/representante/children` → 403.
- Representante intentando acceder a `/api/representante/location?estudianteId=<no-propio>` → 403.

## Lint & TypeScript
- `bun run lint`: pasa limpio para todos los archivos representante. El único error restante es el preexistente en `src/app/page.tsx:15` (no modificable).
- `bunx tsc --noEmit`: mis archivos no tienen errores TS (errores restantes son en examples/, skills/, next.config.ts — archivos de terceros no relacionados).
