# Worklog — Sistema de Asistencia Escolar (Lista v3)

Proyecto: Reescritura completa del sistema de asistencia escolar.
Stack: Next.js 16 + Prisma + SQLite (local) / D1 (prod) + shadcn/ui + R2.
4 apps en una sola codebase: Dirección, Profesor, Representante, Alumno.

---
Task ID: 0
Agent: main
Task: Fase 0 — Configurar entorno, worklog, dependencias y schema base

Work Log:
- Analizado repositorio original (Cloudflare Pages Functions + D1 + R2)
- Decidida arquitectura: Next.js 16 + Prisma + SQLite (dev) / D1 (prod) + R2 (fotos)
- GPS tiempo real vía long polling (Durable Objects requiere plan pago)
- Push notifications Android (VAPID Web Push)
- Instaladas dependencias: bcryptjs, jsonwebtoken
- Schema Prisma con 12 modelos: User, Plantel, Section, SectionAssignment, Student, ParentStudent, AttendanceSession, Attendance, ProfessorCheckin, FeedPost, Notification, PushSubscription, LocationPing

Stage Summary:
- Worklog creado en /home/z/my-project/worklog.md
- Prisma schema definido con soporte multi-plantel, multi-hijo, geocerca, feed social, tracking GPS
- Próximo: db:push, auth system, layout base por roles

---
Task ID: 2-a
Agent: general-purpose (Dirección app)
Task: Build admin app — students, sections, plantel geocerca, users management

Work Log:
- Leído contexto previo: schema Prisma (12 modelos), auth (JWT + bcryptjs), Zustand stores (auth + view), AppShell con navegación por rol.
- Detectado trabajo previo de otro agente: profesor views ya integradas en app-shell.tsx y view-store.ts creado.
- Creados 9 endpoints admin bajo `src/app/api/admin/`:
  - `students/route.ts` (GET con paginación+search+sectionId filter, POST con generación UUID de qrCode)
  - `students/[id]/route.ts` (PUT con validación de unicidad, DELETE soft)
  - `sections/route.ts` (GET con _count students, POST con sincronización de SectionAssignment)
  - `sections/[id]/route.ts` (PUT reasigna tutor y sincroniza assignments, DELETE soft)
  - `plantels/route.ts` (GET con sectionCount, POST)
  - `plantels/[id]/route.ts` (PUT — geocerca lat/lng/radioM)
  - `users/route.ts` (GET con filtro rol+search, POST con hashPassword via db-auth)
  - `users/[id]/route.ts` (PUT con re-hash opcional de password, DELETE soft — bloquea auto-desactivación)
  - `stats/route.ts` (GET para dashboard: totals, attendance de hoy, attendance by section últimos 7 días, actividad reciente)
- Todos los endpoints validan `getUserFromRequest(request)` + `rol === 'admin'` → 403 si no.
- Creados 5 componentes admin bajo `src/components/direccion/`:
  - `admin-dashboard.tsx`: 4 stat cards (estudiantes/secciones/profesores/asistencia hoy) + BarChart recharts (presente/ausente/tardanza por sección, 7 días) + lista de actividad reciente con ScrollArea.
  - `students-manager.tsx`: tabla con avatar+iniciales, search con debounce 250ms, filtro por sección, Switch de activo, Dialog create/edit (nombre, apellido, cedulaEscolar, sectionId select, genero, fechaNacimiento), AlertDialog para eliminar.
  - `sections-manager.tsx`: grid de Cards (nombre, plantel, turno, grado, tutor, studentCount) con botones editar/eliminar, Dialog con select de profesores para tutor, aviso si no hay planteles.
  - `plantel-config.tsx`: sidebar de planteles + form (nombre, dirección, lat, lng, radioM, periodo) + visualización circular escalada del radio de geocerca con centrado en Crosshair.
  - `users-manager.tsx`: Tabs (Todos/Admin/Profesores/Representantes/Alumnos), tabla con rol Badge coloreado, Switch activo, Dialog create/edit con cedulaPrefix (V-/E-), rol select, password opcional en edición.
- `UsersManager` acepta prop opcional `defaultRole="profesor"` para reutilizar desde la vista `admin-professors`.
- Editado `src/components/layouts/app-shell.tsx`:
  - Añadidos imports de los 5 componentes admin.
  - Añadido bloque `if (user.rol === 'admin') { switch(view) { ... } }` al inicio del ViewRenderer (preserva el bloque profesor existente y el fallback para representante/alumno).
- Tema visual esmeralda/teal consistente, textos en español Venezuela, sonner para toasts.
- Probado con curl: login admin → 200, todos los GET devuelven datos correctos, POST crea usuario/estudiante correctamente con qrCode UUID generado, AUTH check: profesor → 403 en /api/admin/users, sin token → 403.
- `bun run lint`: 1 error pre-existente en `src/app/page.tsx:15` (setState dentro de useEffect) — NO introducido por este agente, archivo en lista de "DO NOT modify". Mis archivos pasan limpios. TypeScript: mis archivos sin errores.

Stage Summary:
- 9 archivos de API creados en `src/app/api/admin/` (students, sections, plantels, users con [id], +stats).
- 5 componentes creados en `src/components/direccion/` (admin-dashboard, students-manager, sections-manager, plantel-config, users-manager).
- ViewRenderer actualizado con switch admin que cubre 6 vistas (dashboard, students, sections, professors reusing UsersManager, plantel, users).
- Endpoints validados con curl: GET/POST/PUT/DELETE funcionando, autorización admin correcta (403 para no-admin).
- Lint: pasa para todo el código introducido. Error pre-existente en page.tsx no es responsabilidad de este agente.
- Pendiente para próximos agentes: vistas de representante y alumno (placeholders actuales en ViewRenderer).

---
Task ID: 2-b
Agent: full-stack-developer (Profesor app)
Task: Build profesor app — attendance, checkin GPS, feed posting, notifications

Work Log:
- Leído worklog y schema Prisma para entender estructura (User, Section, SectionAssignment, Student, AttendanceSession, Attendance, ProfessorCheckin, FeedPost, Notification, ParentStudent)
- Creadas 5 API routes bajo `src/app/api/profesor/`:
  - `sections/route.ts` — GET lista secciones donde el profesor es tutor o está asignado (vía SectionAssignment). Incluye `studentCount`.
  - `students/route.ts` — GET estudiantes de una sección ordenados por apellido, nombre.
  - `attendance/route.ts` — GET sesión de hoy; POST crea AttendanceSession si no existe + upsert Attendance por estudiante + crea Notification a representantes para ausente/tardanza; PUT cierra sesión y auto-marca ausentes.
  - `checkin/route.ts` — GET estado de hoy + historial 7 días; POST registra entrada (idempotente: si ya existe, devuelve el existente) / salida (requiere entrada previa).
  - `feed/route.ts` — GET publicaciones propias; POST crea FeedPost + crea Notification a todos los representantes principales de la sección.
- Creada `src/app/api/notifications/route.ts` — GET lista notificaciones del usuario (cualquier rol) ordenadas desc, límite 50; PUT marca como leída (por id o todas).
- Creado store de navegación `src/stores/view-store.ts` (zustand) para que componentes hijos puedan cambiar de vista sin prop drilling.
- Creados 5 componentes profesor en `src/components/profesor/`:
  - `profesor-dashboard.tsx` — tarjeta de bienvenida con gradiente emerald, acciones rápidas (Pasar Asistencia, Registrar Entrada, Publicar Aviso), estado de check-in de hoy, lista de secciones asignadas con badge de rol.
  - `attendance-taker.tsx` — selector de sección, grid de stats (total/presentes/ausentes/tardanzas), lista de estudiantes con botones de estado (Presente verde / Ausente rojo / Tardanza ámbar / Justificado azul), botones "Guardar Asistencia" y "Cerrar Sesión", banner cuando sesión cerrada.
  - `profesor-checkin.tsx` — card de estado (entrada/salida), dos botones grandes (Registrar Entrada emerald / Registrar Salida naranja) que usan `navigator.geolocation.getCurrentPosition`, card con ubicación capturada + precisión, historial 7 días.
  - `feed-poster.tsx` — selector de sección + tipo (Texto/Foto/Aviso), textarea con contador, preview de imagen con FileReader, lista de publicaciones recientes con avatar del profesor y badge de tipo.
  - `profesor-notifications.tsx` — lista con iconos por tipo (ausencia/tardanza/feed/checkin/general), botón "Marcar todo como leído", indicador de no leídas.
- Editado `src/components/layouts/app-shell.tsx`:
  - Importados los 5 componentes profesor.
  - Reemplazado `useState` local por `useViewStore` para permitir navegación programática.
  - Añadido `useEffect` para inicializar la vista según el rol del usuario (admin-dashboard, profesor-dashboard, etc.).
  - Añadido switch case en `ViewRenderer` para rol='profesor' (5 vistas + default al dashboard).
  - Refactorizado `SidebarContent` fuera del cuerpo de `AppShell` como componente con props explícitas — esto resuelve errores de lint `react-hooks/static-components` preexistentes.
- Verificado con curl todos los endpoints:
  - Profesor recibe sus secciones y estudiantes correctamente.
  - POST attendance crea sesión + upsert registros + notifica al representante cuando se marca ausente.
  - POST checkin es idempotente y valida entrada antes de salida.
  - POST feed crea notificación para cada representante principal de la sección.
  - PUT notifications marca como leída correctamente.
  - 403 cuando un admin intenta acceder a /api/profesor/*.

Stage Summary:
- 5 endpoints API profesor + 1 endpoint notifications creados y probados con curl.
- 5 componentes profesor construidos con UI responsive, dark mode y tema emerald/teal.
- ViewRenderer conectado para rol profesor; admin/representante/alumno mantienen su fallback intacto.
- Lint: solo queda 1 error preexistente en `src/app/page.tsx` (que por regla no podemos modificar); todos los archivos que creé/modifiqué pasan lint limpio.
- Contexto de tarea guardado en `/agent-ctx/2-b-full-stack-developer-profesor.md`.

---
Task ID: 5
Agent: full-stack-developer (Alumno app)
Task: Build alumno app — carnet QR digital, check-in GPS con geocerca, feed, historial

Work Log:
- Leído worklog previo (Task 0, 2-a, 2-b) y schema Prisma para entender el contexto: 4 apps (admin, profesor, representante, alumno) con un solo AppShell y ViewRenderer por rol. Auth, Zustand stores, sidebar, profesor views y admin views ya estaban integrados.
- Verificado el seed: alumno V-00000002 / alumno123 → Carlos Pérez, student EST-2024-001, sección "1° A" (section-default), plantel Liceo Demo (lat 10.4806, lng -66.9036, radio 200m).
- Instalada dependencia `qrcode.react@4.2.0` para generar QR SVG scannable en el carnet digital.
- Creados 5 endpoints API bajo `src/app/api/alumno/`:
  - `profile/route.ts` — GET devuelve perfil del Student (codigoUnico, cedulaEscolar, nombre, apellido, fechaNacimiento, genero, qrCode, section con plantel). Lookup por `userId === user.id`.
  - `location/route.ts` — POST crea LocationPing (lat, lng, precision opcional); GET devuelve el último LocationPing del estudiante.
  - `checkin/route.ts` — GET devuelve asistencia de hoy + datos del plantel; POST recibe {lat, lng}, calcula distancia Haversine al plantel, valida geocerca (403 con `distancia` y `radioPermitido` si fuera de rango). Idempotente: si ya hay asistencia hoy con origen=gps_auto y estado=presente, la devuelve. Si existe pero fue marcada por el profesor (ausente, etc.), el GPS check-in la **sobrescribe** a presente/gps_auto con las nuevas coords (demostrando presencia física). Si no existe, busca sesión activa de la sección hoy y la enlaza; si no hay sesión, crea la asistencia standalone.
  - `feed/route.ts` — GET lista FeedPost de la sección del alumno, incluye nombre del profesor, ordenados por createdAt desc, límite 50.
  - `attendance/route.ts` — GET historial de asistencia del alumno (últimos 30 días) con datos de la sesión asociada.
- Todos los endpoints validan `getUserFromRequest` + `rol === 'alumno'` → 403 si no.
- Creados 4 componentes en `src/components/alumno/`:
  - `alumno-dashboard.tsx` — tarjeta de bienvenida con gradiente emerald, tarjeta de estado de hoy (Presente/Ausente/No registrado), botón grande de Check-in si no ha registrado, grid de acciones rápidas (Carnet, Check-in, Noticias), fila de stats (avisos sin leer, hora de entrada, geocerca del plantel).
  - `carnet-digital.tsx` — tarjeta de carnet con QR real scannable (QRCodeSVG de qrcode.react, color emerald #047857). Layout: header gradient emerald→teal con nombre del plantel + período, cuerpo con avatar con iniciales, datos en grid (código, cédula, plantel, grado), QR en marco blanco, footer con badge ACTIVO/INACTIVO. Cards adicionales con datos del plantel y personales. Botón "Descargar QR" serializa el SVG a archivo descargable.
  - `alumno-checkin.tsx` — status card grande (presente verde / sin registro ámbar), botón XL "Registrar Entrada" emerald con icono MapPin, on click pide geolocation (enableHighAccuracy, timeout 15s), captura errores (permiso denegado / GPS off / timeout). POST con fetch directo (no api-client) para poder leer el body del 403 y mostrar visualización tipo mapa con el plantel en el centro y la posición del alumno fuera. Cards de coordenadas capturadas con precisión. Historial de últimos 7 días con badges por estado.
  - `alumno-feed.tsx` — feed scrolleable de publicaciones de la sección con avatar del profesor, badge de tipo (texto/foto/aviso), timestamp relativo (hace X min/h/d), contenido con whitespace-pre-wrap, fotos clickeables con lightbox. Botón "Actualizar" con spinner. Empty state amigable.
- Editado `src/components/layouts/app-shell.tsx`:
  - Añadidos imports de los 4 componentes alumno.
  - Añadido bloque `if (user.rol === 'alumno') { switch(view) {...} }` ANTES del fallback, cubriendo `alumno-dashboard`, `alumno-carnet`, `alumno-checkin`, `alumno-feed` con default al dashboard. El fallback original se preserva para el rol `representante` (que sigue en construcción por otro agente en paralelo).
- Probado con curl todos los endpoints:
  - GET /api/alumno/profile → 200 con datos completos de Carlos Pérez + sección + plantel.
  - GET /api/alumno/checkin → 200 con asistencia de hoy (estado, origen, plantel con radioM).
  - POST /api/alumno/checkin con coords lejanas → 403 con `distancia: 112393m`, `radioPermitido: 200m`.
  - POST /api/alumno/checkin con coords cercanas → 200, sobrescribe asistencia previa del profesor (ausente) a `presente/gps_auto` con nuevas coords y sessionId enlazado. `yaExistente: false`.
  - POST /api/alumno/checkin segunda vez → 200 con `yaExistente: true` (idempotente).
  - GET /api/alumno/attendance, GET /api/alumno/feed, POST/GET /api/alumno/location → todos 200.
  - Profesor → 403 en /api/alumno/*. Sin token → 401.
- Tema visual emerald/teal consistente con el resto de la app. Textos en español Venezuela. sonner para toasts.
- Lint: 2 errores PERO ninguno en mis archivos — ambos son pre-existentes/paralelos:
  - `src/app/page.tsx:15` (regla "DO NOT modify" — error ya reportado por Task 2-a).
  - `src/components/representante/representante-dashboard.tsx:138` (archivo creado por otro agente en paralelo, no mi responsabilidad).
  Todos mis archivos (`src/app/api/alumno/*`, `src/components/alumno/*`, edición de `app-shell.tsx`) pasan lint limpio.

Stage Summary:
- 5 endpoints API alumno creados y probados con curl en `src/app/api/alumno/` (profile, location, checkin, feed, attendance).
- 4 componentes alumno creados en `src/components/alumno/` (alumno-dashboard, carnet-digital, alumno-checkin, alumno-feed).
- ViewRenderer actualizado con switch `alumno` que cubre 4 vistas + default al dashboard. Sidebar del alumno ya estaba configurado en `navByRole.alumno` desde Task 0.
- QR scannable real instalado y funcionando (`qrcode.react@4.2.0`).
- Geocerca Haversine funcionando: 403 con `distancia` y `radioPermitido` cuando el alumno está fuera del radio del plantel.
- Sobrescritura de asistencia: si el profesor marcó ausente y el alumno hace check-in GPS válido dentro del plantel, la asistencia se actualiza a `presente/gps_auto`. Idempotente en el segundo check-in.
- Lint pasa para todo el código introducido. Errores pre-existentes en page.tsx y representante-dashboard.tsx no son responsabilidad de este agente.
- Contexto de tarea guardado en `/agent-ctx/5-full-stack-developer-alumno.md`.
- Pendiente para próximos agentes: completar la app de representante (actualmente usa fallback placeholder).

---
Task ID: 3
Agent: full-stack-developer (Representante app)
Task: Build representante app — child selector, GPS location map (long polling), attendance, feed, notifications

Work Log:
- Leído worklog + schema Prisma + app-shell + auth + profesor endpoints para entender el contexto previo (Task 0, 2-a, 2-b) y los patrones existentes (auth con JWT, apiFetch con token automático, AppShell con ViewRenderer por rol).
- Creadas 5 API routes bajo `src/app/api/representante/`:
  - `children/route.ts` — GET lista hijos del representante vía ParentStudent. Incluye section (nombre/grado/turno) + plantel (lat/lng/radioM).
  - `location/route.ts` — GET último LocationPing con soporte de **long polling**: `?wait=true&lastTimestamp=xxx` sondea DB cada 3s hasta 25s. Si llega un ping más nuevo, responde inmediatamente; si timeout, retorna último conocido con `stale: true`.
  - `attendance/route.ts` — GET asistencia del estudiante (últimos 30 días) con info de sesión. Verifica propiedad vía ParentStudent.
  - `feed/route.ts` — GET FeedPosts de todas las secciones de los hijos del representante. Incluye profesor y section. Ordenado por createdAt desc, límite 50.
  - `notifications/route.ts` — GET notificaciones del representante (no leídas primero, luego por fecha desc).
- Creado store `src/stores/representante-store.ts` (Zustand) con children list, selectedChildId, fetchChildren, selectChild — cachea hijos en sesión para evitar re-fetch entre vistas.
- Creados 8 componentes en `src/components/representante/`:
  - `utils.ts` — haversine, formatDistance, formatRelative, estadoStyle, notifStyle.
  - `child-selector.tsx` — DropdownMenu si hay múltiples hijos, card simple si solo uno. Avatar con iniciales.
  - `map-view.tsx` — **mapa SVG custom viewBox 400x300** con plantel como círculo verde (radio proporcional a radioM), estudiante como punto azul pulsante, línea con etiqueta de distancia, cuadrícula N/S/E/O en metros, brújula, leyenda. Auto-escalado basado en max(radioM, distancia).
  - `child-location-map.tsx` — vista con mapa + long polling iniciado en mount, refresco cada 15s como fallback, "Actualizar" button. 3 cards de detalles: última actualización, distancia al plantel con badge dentro/fuera, precisión GPS.
  - `child-attendance.tsx` — calendario 30 días con color coding por estado, stats grid (4 cards: % asistencia, presentes, ausentes, tardanzas), barra de progreso segmentada por estado, lista detallada con scroll.
  - `representante-feed.tsx` — feed tipo red social con avatar profesor, badge de tipo (texto/foto/aviso), placeholder `📷 Foto adjunta` con mediaKey para futura integración R2.
  - `representante-notifications.tsx` — lista con iconos por tipo (ausencia/tardanza/feed/salida_plantel/checkin/general), click para marcar como leída (PUT /api/notifications?id=xxx), botón "Marcar todo".
  - `representante-dashboard.tsx` — welcome con gradiente emerald, child selector, status de hoy (Presente/Ausente/Tardanza/No registrado), última ubicación con timestamp, quick links a todas las vistas, card de notificaciones con badge.
- Editado `src/components/layouts/app-shell.tsx`:
  - Importados los 5 componentes representante.
  - Añadido bloque `if (user.rol === 'representante') { switch(view) { ... 5 vistas + default → dashboard } }` en ViewRenderer (preserva admin, profesor, alumno).
  - Renombrado comentario obsoleto "FALLBACK" → "ALUMNO VIEWS".
- Inyectados 5 LocationPing de demo para el estudiante Carlos Pérez (cerca del plantel Liceo Demo) para que el mapa funcione en desarrollo.
- Verificado con curl todos los endpoints:
  - Login como V-00000003 → 200, token válido.
  - GET children → 200, 1 hijo (Carlos Pérez, section-default, plantel-default con lat 10.4806 lng -66.9036 radio 200).
  - GET location (sin wait) → 200, último ping con precision 6m.
  - GET location `?wait=true&lastTimestamp=<pasado>` → tarda 27s, devuelve último conocido con stale:true.
  - GET location `?wait=true&lastTimestamp=<último conocido>` + inyección de nuevo ping a T+5s → responde en ~6s con el nuevo ping, sin stale.
  - GET attendance → 200, 1 registro (ausente, origen profesor).
  - GET feed → 200, 1 post (aviso de María García, "Recordatorio: mañana no hay clases").
  - GET notifications → 200, 2 notificaciones (1 feed no leída + 1 ausente leída), noLeidas=1.
  - Profesor intentando `/api/representante/children` → 403.
  - Representante intentando `/api/representante/location?estudianteId=<otro>` → 403.
- Lint: solo queda 1 error preexistente en `src/app/page.tsx:15` (no modificable, archivo en lista DO NOT modify). Todos mis archivos pasan limpio.
- TypeScript: mis archivos sin errores (`bunx tsc --noEmit` no reporta errores en `src/components/representante/` ni en `src/app/api/representante/`).

Stage Summary:
- 5 endpoints API representante creados y probados (children, location con long polling, attendance, feed, notifications).
- 8 componentes creados en `src/components/representante/` + 1 store en `src/stores/representante-store.ts`.
- ViewRenderer conectado para rol representante con 5 vistas (dashboard, location, attendance, feed, notifications).
- Mapa SVG custom funcional con auto-escalado, geocerca visual, línea de distancia, cuadrícula métrica y brújula.
- Long polling verificado: responde en ~6s cuando llega nuevo ping, timeout de 25s con stale:true como fallback.
- Seguridad verificada: todos los endpoints chequean rol + ParentStudent ownership.
- Contexto de tarea guardado en `/agent-ctx/3-representante-app.md`.

---
Task ID: 4+6 (main agent)
Agent: main
Task: Feed con fotos (R2/local) + Push notifications Android (VAPID) + PWA instalable

Work Log:
- Instalado web-push para notificaciones push (VAPID)
- Generadas claves VAPID y guardadas en .env
- Creado src/lib/push.ts con sendPushNotification() helper
- Creada API /api/push/subscribe (POST/DELETE/GET vapid-public)
- Integrado sendPushNotification en profesor/attendance (ausencia/tardanza) y profesor/feed
- Creado hook usePushNotifications que registra SW + suscribe a push automáticamente
- Integrado hook en AppShell (se activa al hacer login)
- Creado service worker public/sw.js (push + offline cache)
- Creado manifest.json para PWA instalable
- Generados iconos PWA (192x192 y 512x512) con sharp
- Creada API /api/upload para subida de fotos (filesystem local → R2 en prod)
- Integrado upload real en profesor/feed-poster (sube foto vía FormData, obtiene mediaKey)
- Actualizado feed del representante para mostrar <img> real en vez de placeholder
- Actualizado feed del alumno para resolver paths de mediaKey correctamente

Stage Summary:
- Push notifications infraestructura completa: VAPID configurado, SW registrado, suscripción automática
- Feed con fotos funcionando end-to-end: profesor sube → representante/alumno ven la imagen
- PWA instalable en Android (manifest + icons + service worker)
- Verificado en browser: profesor publica aviso → representante lo ve en su feed ("hace un momento")
- Service Worker registrado correctamente (scope: http://localhost:3000/)
- Todos los endpoints responden 200 sin errores de consola

---
Task ID: D1-ADAPT
Agent: full-stack-developer (D1 adaptation)
Task: Adapt 28 API routes from Prisma to D1-compatible pattern

Work Log:
- Leído contexto: worklog.md (5 tareas previas), src/lib/d1.ts (adapter), src/app/api/auth/login/route.ts (patrón referencia).
- Verificado que las 28 rutas API bajo src/app/api/ ya usan el patrón directo D1 (isD1 ? d1Query/d1First/d1Run : db.X.findMany/create/update):
  - Auth (1): auth/me/route.ts — d1First SELECT con normalización `activo === 1`
  - Admin (9):
    - admin/students/route.ts (GET con JOIN a v3_sections + sub-batch query a v3_parent_student→v3_users; POST con d1Run INSERT y verificación previa)
    - admin/students/[id]/route.ts (PUT con SET dinámico + JOIN; DELETE soft con `activo = 0`)
    - admin/sections/route.ts (GET con subquery `(SELECT COUNT(*) FROM v3_students WHERE sectionId = s.id AND activo = 1) AS studentCount`; POST con upsert manual de SectionAssignment)
    - admin/sections/[id]/route.ts (PUT reasigna tutor + sincroniza SectionAssignment; DELETE soft con `activa = 0`)
    - admin/plantels/route.ts (GET con subquery sectionCount; POST con d1Run INSERT)
    - admin/plantels/[id]/route.ts (PUT con SET dinámico para geocerca lat/lng/radioM)
    - admin/users/route.ts (GET con filtro LIKE; POST con hashPassword + verificación unicidad)
    - admin/users/[id]/route.ts (PUT con re-hash opcional; DELETE soft bloqueando auto-desactivación)
    - admin/stats/route.ts (GET con 4 COUNT paralelos + JOIN v3_attendance→v3_students para agrupar por sección + actividad reciente con 3 queries JOIN)
  - Profesor (5):
    - profesor/sections/route.ts (GET con subqueries para studentCount y assignmentRole; JOIN v3_sections + v3_plantels + v3_section_assignments)
    - profesor/students/route.ts (GET con checkSectionAccess via JOIN + listado ordenado)
    - profesor/attendance/route.ts (GET con JOIN attendance→students; POST con upsert manual por (estudianteId, sessionId); PUT con auto-marcar ausentes + notificaciones)
    - profesor/checkin/route.ts (GET estado hoy + historial 7 días; POST idempotente entrada/salida)
    - profesor/feed/route.ts (GET con JOIN a sections; POST con notificaciones a representantes principales vía JOIN v3_parent_student→v3_students)
  - Representante (5):
    - representante/children/route.ts (GET con JOIN 4 tablas: parent_student→students→sections→plantels)
    - representante/location/route.ts (GET con long polling 25s; verifyOwnership helper con isD1)
    - representante/attendance/route.ts (GET con JOIN v3_attendance→v3_attendance_sessions)
    - representante/feed/route.ts (GET con batch: recopila sectionIds de hijos, luego JOIN v3_feed_posts→v3_users→v3_sections)
    - representante/notifications/route.ts (GET con `ORDER BY leida ASC, createdAt DESC`)
  - Alumno (5):
    - alumno/profile/route.ts (GET con JOIN v3_students→v3_sections→v3_plantels; normalización `activo === 1`)
    - alumno/checkin/route.ts (GET estado + datos plantel; POST con Haversine, geocerca 403 con distancia/radioPermitido, idempotencia y sobrescritura, búsqueda/creación de sesión)
    - alumno/location/route.ts (GET último ping; POST crea LocationPing)
    - alumno/feed/route.ts (GET con JOIN v3_feed_posts→v3_users→v3_sections)
    - alumno/attendance/route.ts (GET historial 30 días con LEFT JOIN a v3_attendance_sessions)
  - General (3):
    - notifications/route.ts (GET lista; PUT marca-leída individual o todas con `leida = 1`)
    - push/subscribe/route.ts (GET vapid-public; POST upsert por endpoint; DELETE por endpoint+userId)
    - upload/route.ts (POST: en prod usa R2 bucket via Symbol.for('__cloudflare-context__') en globalThis sin sharp; en dev usa filesystem + sharp opcional)
- Confirmado con `git status`: 27 archivos modificados + 1 nuevo (upload) = 28 rutas. Cambios sin commitear todavía.
- Auditoría grep: cada ruta con `include:` (14 archivos) y `_count` (3 archivos: admin/plantels, admin/sections, profesor/sections) tiene su correspondiente rama `if (isD1())` con JOIN/subqueries.
- Helpers compartidos (checkSectionAccess en profesor/feed y profesor/attendance; verifyOwnership en representante/location) también bifurcan isD1().
- Booleanos D1 (INTEGER 0/1) normalizados a boolean en todas las respuestas (`activo === 1`, `activa === 1`, `leida === 1`, `esPrincipal === 1`).
- Lógica de negocio preservada en ambas ramas: JWT, bcrypt, haversine, geocerca, idempotencia, push notifications VAPID (web-push lite), long polling 25s.
- Lint final: 0 errores en `src/` (todos los 887 errores y 8924 warnings provienen de `.open-next/` y `.next/` artefactos de build generados, no del código fuente).

Stage Summary:
- 28 rutas API verificadas con el patrón directo D1 (isD1() ? SQL crudo : Prisma), bifurcando en cada llamada Prisma que usa include/relations/_count.
- Cada rama D1 usa JOINs explícitos o subqueries correlacionadas para resolver relaciones y agregaciones.
- Booleanos INTEGER normalizados en cada respuesta.
- upload/route.ts correctamente configurado: R2 en prod (vía getCloudflareContext + Symbol.for('__cloudflare-context__'), sin sharp), filesystem+sharp en dev.
- Lint source limpio; todos los errores reportados son artefactos de build en `.open-next/` (auto-generados por @opennextjs/cloudflare, no código fuente).
- Dev server corre sin errores de compilación; rutas responden 200 en peticiones GET /.
- Work pendiente: commitear los cambios (actualmente 27 modified + 1 untracked en src/app/api/).
