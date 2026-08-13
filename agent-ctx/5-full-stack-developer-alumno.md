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
  - `carnet-digital.tsx` — tarjeta de carnet scrolleable con QR real scannable (QRCodeSVG de qrcode.react, color emerald #047857). Layout: header gradient emerald→teal con nombre del plantel + período, cuerpo con avatar con iniciales, datos en grid (código, cédula, plantel, grado), QR en marco blanco, footer con badge ACTIVO/INACTIVO y período. Cards adicionales con datos del plantel y personales. Botón "Descargar QR" que serializa el SVG a un archivo descargable.
  - `alumno-checkin.tsx` — status card grande (presente verde / sin registro ámbar), botón XL "Registrar Entrada" emerald con icono MapPin, on click pide geolocation (enableHighAccuracy, timeout 15s), captura errores (permiso denegado / GPS off / timeout). POST al endpoint con fetch directo (no api-client) para poder leer el body del 403 y mostrar visualización tipo mapa con el plantel en el centro y la posición del alumno fuera. Cards de coordenadas capturadas con precisión. Historial de últimos 7 días con badges por estado.
  - `alumno-feed.tsx` — feed scrolleable de publicaciones de la sección con avatar del profesor, badge de tipo (texto/foto/aviso), timestamp relativo (hace X min/h/d), contenido con whitespace-pre-wrap, fotos clickeables con lightbox. Botón "Actualizar" con spinner. Empty state amigable.
- Editado `src/components/layouts/app-shell.tsx`:
  - Añadidos imports de los 4 componentes alumno.
  - Añadido bloque `if (user.rol === 'alumno') { switch(view) {...} }` ANTES del fallback, cubriendo `alumno-dashboard`, `alumno-carnet`, `alumno-checkin`, `alumno-feed` con default al dashboard. El fallback original se preserva para el rol `representante` (que sigue en construcción por otro agente en paralelo).
- Probado con curl:
  - GET /api/alumno/profile → 200 con datos completos de Carlos Pérez + sección + plantel.
  - GET /api/alumno/checkin → 200 con asistencia de hoy (estado, origen, plantel con radioM).
  - POST /api/alumno/checkin con coords lejanas (10.0, -66.0) → 403 con `distancia: 112393m`, `radioPermitido: 200m`.
  - POST /api/alumno/checkin con coords cercanas (10.48065, -66.90365) → 200, **sobrescribe** la asistencia previa del profesor (ausente) a `presente/gps_auto` con nuevas coords y sessionId enlazado. `yaExistente: false`.
  - POST /api/alumno/checkin segunda vez → 200 con `yaExistente: true` (idempotente).
  - GET /api/alumno/attendance → 200 con historial.
  - GET /api/alumno/feed → 200 con posts de la sección incluyendo nombre del profesor.
  - POST/GET /api/alumno/location → 200 (crea y devuelve LocationPing).
  - Profesor intentando /api/alumno/profile → 403 "Acceso denegado".
  - Sin token → 401 "No autenticado".
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
- Pendiente para próximos agentes: completar la app de representante (actualmente usa fallback placeholder).
