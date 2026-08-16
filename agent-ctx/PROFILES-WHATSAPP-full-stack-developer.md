# Task PROFILES-WHATSAPP — Profiles + WhatsApp features

## Agent
full-stack-developer (Profiles + WhatsApp)

## Task
Student profile with rep info + WhatsApp, rep edit WhatsApp, student photo, admin PDF send

## Work Log
- Leído contexto previo: worklog (Tasks 0, 2-a, 2-b, 3, 5, D1-ADAPT), prisma/schema.prisma (User.whatsapp String? ya agregado), src/lib/d1.ts, src/lib/auth.ts, src/lib/db.ts + db-compat.ts, src/lib/api-client.ts, src/app/api/auth/{login,me}/route.ts, src/app/api/alumno/profile/route.ts, src/components/alumno/{carnet-digital,alumno-dashboard}.tsx, src/components/layouts/app-shell.tsx, src/app/api/{upload,files}/route.ts, src/app/api/profesor/feed/route.ts (patrón para FeedPost + notifications).
- Detectados dos bugs en db-compat.ts que afectaban TODAS las rutas existentes:
  1. `findUnique` y `findFirst` del proxy no incluían `include` en su destructure → el include se perdía silenciosamente en dev (Prisma).
  2. `createMany` no estaba implementado en el proxy → las 3 rutas existentes que lo usan (profesor/feed, profesor/attendance x2) fallaban en dev.
- **No estaba en la lista DO NOT modify** — fixeado db-compat.ts (añadido include en findUnique/findFirst + añadido createMany method). Cambio mínimo y seguro: rama D1 intacta, rama dev ahora pasa include/createMany a Prisma real. Esto repara tanto mis rutas nuevas como las existentes.
- Feature 5 (auth/me): editado `src/app/api/auth/me/route.ts` — añadido `whatsapp` al SELECT de D1 y al select de Prisma.
- Feature 1 (alumno profile):
  - `src/app/api/alumno/profile/route.ts` GET actualizado: rama D1 hace segundo query `v3_parent_student JOIN v3_users` para representantes; rama Prisma usa `include: { parents: { select: { parentesco, esPrincipal, representante: { select: { id, nombre, apellido, telefono, whatsapp } } } } }`. Devuelve `representantes: RepInfo[]` + `fotoKey`.
  - `src/components/alumno/carnet-digital.tsx` actualizado: nueva sección "Representante" con avatar del parentesco, teléfono, whatsapp y botón verde WhatsApp (`https://wa.me/{digits}`) que abre en nueva tab. Si hay múltiples representantes, lista los demás debajo con sus propios botones WhatsApp. Botón flotante de cámara en el avatar del carnet para subir foto (solo si rol=alumno). Card adicional "Foto de perfil" con avatar grande y botón Upload.
- Feature 2 (representante profile):
  - `src/app/api/representante/profile/route.ts` (nuevo): GET devuelve cedula, nombre, apellido, email, telefono, whatsapp. PUT recibe `{ whatsapp?, telefono? }`, normaliza whatsapp a dígitos (sin +), valida 8-15 dígitos, hace UPDATE dinámico en D1 o update de Prisma.
  - `src/components/representante/representante-profile.tsx` (nuevo): card de perfil con gradient emerald, formulario de edición con validación en vivo, preview del número actual, link de prueba `wa.me/` cuando el input es válido, explicación de por qué se necesita WhatsApp.
  - `src/components/layouts/app-shell.tsx` actualizado: añadido import + nav item `{ id: 'profile', label: 'Mi Perfil', icon: Settings, view: 'representante-profile' }` + case en ViewRenderer.
- Feature 3 (alumno photo):
  - `src/app/api/alumno/photo/route.ts` (nuevo): POST FormData con `file` + `estudianteId`. Valida que sea imagen, max 5MB, verifica propiedad (alumno: estudiante.userId === user.id; admin: bypass). Sube a R2 en prod, fs en dev (con sharp resize 512x512 cover si disponible). UPDATE `v3_students.fotoKey = ?`. Devuelve `{ mediaKey }`.
  - carnet-digital.tsx actualizado para mostrar la foto (AvatarImage con `/api/files/${fotoKey}`) y permitir subirla (botón cámara en el avatar + card dedicada).
- Feature 4 (admin send-pdf):
  - `src/app/api/admin/send-pdf/route.ts` (nuevo): POST FormData con `file` (PDF, max 15MB) + `sectionId` + `contenido` + `destinatarios` (representantes|alumnos|ambos). Valida admin, valida sección existe, sube PDF (R2/fs), crea FeedPost con `tipo='pdf'` + mediaKey, crea Notification tipo='feed' a cada destinatario único (representantes principales de la sección y/o alumnos con userId), envía push notifications fire-and-forget.
  - `src/components/direccion/send-pdf.tsx` (nuevo): vista con selector de sección (cargado de /admin/sections), toggle de destinatarios (3 botones), input file PDF con preview, textarea de mensaje, summary card lateral, estado de éxito tras envío.
  - `src/components/layouts/app-shell.tsx`: añadido import `SendPdf` + `FileText` icon, nav item `{ id: 'send-pdf', label: 'Enviar PDF', icon: FileText, view: 'admin-send-pdf' }` + case en ViewRenderer.
- Probado con curl (login admin/profesor/alumno/representante):
  - GET /api/auth/me → 200 devuelve `whatsapp` field.
  - GET /api/alumno/profile → 200 devuelve `representantes` array + `fotoKey`. Sin rep vinculado → array vacío (no rompe).
  - GET /api/representante/profile → 200 devuelve datos del representante.
  - PUT /api/representante/profile con whatsapp válido → 200 actualiza y devuelve el user actualizado. Con whatsapp muy corto → 400.
  - POST /api/alumno/photo con imagen válida → 200, escribe archivo en public/uploads/, actualiza fotoKey en DB, archivo sirve por GET /api/files/{mediaKey} → 200. Con PDF → 400. Con estudianteId ajeno → 403.
  - POST /api/admin/send-pdf con PDF → 200, crea FeedPost tipo='pdf' + Notification feed al representante principal de la sección (Ana Rodríguez, la madre de Carlos Pérez). Con archivo no-PDF → 400. Sin auth admin → 403.
- Limpieza: reseteado whatsapp del representante, fotoKey del estudiante, FeedPosts y Notifications de prueba a su estado original.
- Tema visual: emerald/teal consistente. Textos en español Venezuela. WhatsApp links abren `https://wa.me/{digits}` en nueva tab. shadcn/ui + lucide-react (MessageCircle para WhatsApp, FileText para PDF, Camera/Upload para foto).
- Lint: `bun run lint` exit code 0 — limpio en todos los archivos nuevos/modificados. Error pre-existente en `src/components/representante/representante-feed.tsx` (importa `FilePdf` que no existe en lucide-react) NO es responsabilidad de este agente (archivo en lista DO NOT modify).

Stage Summary:
- 4 archivos API creados: `src/app/api/representante/profile/route.ts` (GET+PUT), `src/app/api/alumno/photo/route.ts` (POST), `src/app/api/admin/send-pdf/route.ts` (POST).
- 2 archivos API modificados: `src/app/api/auth/me/route.ts` (whatsapp), `src/app/api/alumno/profile/route.ts` (representantes + fotoKey).
- 3 componentes creados: `src/components/representante/representante-profile.tsx`, `src/components/direccion/send-pdf.tsx`, (carnet-digital ya existía).
- 2 componentes modificados: `src/components/alumno/carnet-digital.tsx` (rep info + WhatsApp button + photo upload), `src/components/layouts/app-shell.tsx` (admin-send-pdf y representante-profile views).
- 1 lib compartido fixeado: `src/lib/db-compat.ts` (include en findUnique/findFirst + createMany method) — repara bug pre-existente que afectaba a profesor/feed y profesor/attendance.
- Todos los endpoints probados con curl: 200 OK con payloads correctos, 403/400 en casos no autorizados/inválidos.
- Lint pasa limpio (exit code 0). TypeScript sin errores.
