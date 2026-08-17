# Task STUDENT-CARNET — Student management + Carnet PDF

## Agent
full-stack-developer (Student management + Carnet PDF)

## Task
Edit/delete with double confirmation + photo in edit + printable carnet PDF (front + back on one A6 page, foldable).

## Context read
- `/home/z/my-project/worklog.md` (Tasks 0, 2-a, 2-b, 3, 5, D1-ADAPT, FEED-ENHANCE, PROFILES-WHATSAPP)
- `/home/z/my-project/prisma/schema.prisma` (Student.fotoKey, qrCode, codigoUnico, section → plantel relations)
- `/home/z/my-project/src/lib/d1.ts` (isD1, d1Query, d1First, d1Run, getCloudflareContext pattern via `Symbol.for('__cloudflare-context__')`)
- `/home/z/my-project/src/app/api/auth/login/route.ts` (isD1 pattern with SQL + Prisma branches)
- `/home/z/my-project/src/app/api/admin/students/route.ts` + `[id]/route.ts` (existing student CRUD)
- `/home/z/my-project/src/components/direccion/students-manager.tsx` (current student management UI)
- `/home/z/my-project/src/components/alumno/carnet-digital.tsx` (current carnet view with QR + photo)
- `/home/z/my-project/src/app/api/alumno/photo/route.ts` (existing photo upload API; supports admin and alumno)
- `/home/z/my-project/src/app/api/files/[...path]/route.ts` (R2/fs file serving)
- `/home/z/my-project/src/app/api/alumno/profile/route.ts` (alumno profile with section + plantel + representantes)
- `/home/z/my-project/src/lib/auth.ts` (JWT, getUserFromRequest, verifyToken)
- `/home/z/my-project/src/lib/api-client.ts` (apiFetch + api helpers; noticed it always sets `Content-Type: application/json`)

## Work Log
- Instaladas dependencias faltantes: `pdf-lib@1.17.1`, `qrcode@1.5.4`, `@types/qrcode@1.5.6` (la tarea las daba por instaladas pero no estaban en package.json).
- Creado `src/lib/carnet-pdf.ts` (lib compartida):
  - `fetchStudentDataForCarnet(studentId)`: JOIN v3_students → v3_sections → v3_plantels (D1) / Prisma include (dev). Devuelve `{ id, codigoUnico, cedulaEscolar, nombre, apellido, fechaNacimiento, genero, qrCode, fotoKey, section, plantel }`.
  - `fetchPhotoBuffer(fotoKey)`: R2 bucket en prod (`Symbol.for('__cloudflare-context__')` → `env.BUCKET.get(key).arrayBuffer()`), filesystem en dev (`fs.readFile('public/uploads/<key>')`). Devuelve `{ bytes: Uint8Array, format: 'png'|'jpg' } | null`. Solo acepta png/jpg/jpeg.
  - `buildCarnetPdf(data)`: genera PDF A6 portrait (297×420 pt, ~4.13"×5.83") dividido en 2 mitades por línea de pliegue punteada. Frontal: header emerald (#0a7857) con "CARNET ESTUDIANTIL", nombre plantel + período; cuerpo claro con foto (o initials box si no hay), nombre (auto-fit), cédula escolar, sección + turno, grado + período, género + edad. Reverso: banda emerald oscuro "VERIFICACIÓN", QR PNG (300px, color #065740, error correction M) centrado con marco emerald, "Escanea este código para verificar", código del estudiante en mono bold, validez del período, dirección del plantel en footer, marca "Lista · Sistema de Asistencia". Helpers: drawInitialsBox, drawDashedLine, truncateToWidth (binary search para truncar con ellipsis respetando ancho).
  - Bug encontrado: WinAnsi no puede encodear U+2702 (✂). Cambiado a ASCII puro: `'- - - - - - - - pliegue - - - - - - - -'`.
- Creado `src/app/api/admin/students/[id]/carnet-pdf/route.ts`: GET. Auth dual: `Authorization: Bearer <token>` header O `?token=<token>` query param (para que `window.open` funcione sin headers custom). Solo rol `admin`. Devuelve `Content-Type: application/pdf`, `Content-Disposition: inline; filename="carnet-{codigoUnico}.pdf"`, `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`. 404 si estudiante no existe.
- Creado `src/app/api/alumno/carnet-pdf/route.ts`: GET. Auth dual (header o query). Solo rol `alumno`. Busca `studentId` por `v3_students.userId = ?` (D1) o `db.student.findFirst({ where: { userId } })` (dev). Misma respuesta PDF.
- Modificado `src/app/api/admin/students/route.ts` GET: añadido `fotoKey` al SELECT D1 (ya venía por `s.*`, solo faltaba exponerlo en el mapeo de respuesta) y al response object. Dev (Prisma) ya lo incluía por defecto.
- Modificado `src/components/direccion/students-manager.tsx`:
  - `StudentRow` interface: añadido `fotoKey: string | null`.
  - Tabla: Avatar con `AvatarImage` (`/api/files/${fotoKey}`) si fotoKey, `AvatarFallback` con iniciales si no. Avatar className `w-9 h-9 border border-emerald-100`.
  - Acciones por fila: Editar (Pencil, ghost), Carnet PDF (FileText, emerald, abre `/api/admin/students/{id}/carnet-pdf?token=...` en nueva pestaña con `window.open`; spinner 800ms), Eliminar (Trash2, red).
  - Edit dialog: añadido sección de foto (Avatar 80×80 + botón "Subir/Cambiar foto" que abre file input hidden; preview con `URL.createObjectURL(file)`; botón "Cancelar" para revertir). Validación: solo imágenes, max 5MB.
  - Edit doble confirmación: Dialog con form → click "Guardar cambios" → abre `AlertDialog` "¿Confirmas que los datos son correctos?" con "Sí, guardar" / "No, revisar" → `performSave()` sube foto (si hay) vía `fetch('/api/alumno/photo', { method:'POST', headers:{Authorization}, body:formData })` DIRECTO (no apiFetch, porque apiFetch siempre pone `Content-Type: application/json` lo que rompe multipart), luego PUT al estudiante.
  - Delete doble confirmación: click Eliminar → `AlertDialog` paso 1 "¿Eliminar a {nombre}?" Cancelar/Continuar → `AlertDialog` paso 2 "Esta acción no se puede deshacer" con Input de texto + instrucciones + código `<code>` mostrando el nombre esperado + indicador en vivo "✓ El nombre coincide" / "El nombre debe coincidir exactamente". Botón "Eliminar definitivamente" deshabilitado hasta que el texto coincida exacto (case-insensitive, trim). Enter en el input también dispara delete si coincide.
  - Estado: `photoFile`, `photoPreview`, `uploadingPhoto`, `photoInputRef`, `confirmEditOpen`, `deleteTarget`, `deleteConfirmName`, `deleteStep2`, `deleting`, `pdfLoadingId`.
  - Imports: Avatar/AvatarFallback/AvatarImage, FileText, Camera, Upload, AlertTriangle, CheckCircle2, Loader2, useAuthStore.
- Modificado `src/components/alumno/carnet-digital.tsx`:
  - Añadido import `FileText` de lucide-react.
  - Nuevo handler `handleDownloadCarnetPdf()`: lee token de `useAuthStore.getState().token`, abre `/api/alumno/carnet-pdf?token=...` en nueva pestaña, toast success.
  - Header: contenedor flex con 2 botones — "Descargar Carnet PDF" (emerald, FileText) + "Descargar QR" (outline, Download) existente.
- Bug encontrado y documentado: `apiFetch` en `src/lib/api-client.ts` siempre añade `Content-Type: application/json`, lo que rompe subidas multipart/form-data. Ya estaba afectando a `carnet-digital.tsx` (handlePhotoUpload vía apiFetch). En `students-manager.tsx` bypassé apiFetch y usé `fetch` directo con solo el header Authorization. NO modifiqué api-client.ts (es lib compartida; modificarlo podría romper otras rutas que dependen del comportamiento actual). El dev log confirma este bug: `Alumno photo upload error: TypeError: Content-Type was not one of "multipart/form-data" or "application/x-www-form-urlencoded"`.
- Pruebas con curl (todas exitosas):
  - GET `/api/admin/students/{id}/carnet-pdf` con Authorization header → 200, PDF 6760 bytes, `PDF document, version 1.7`.
  - GET `/api/admin/students/{id}/carnet-pdf?token=...` → 200, mismo PDF (compatible con window.open).
  - GET `/api/admin/students/{id}/carnet-pdf` sin auth → 401.
  - GET `/api/admin/students/{id}/carnet-pdf` con token de alumno → 403.
  - GET `/api/admin/students/{id}/carnet-pdf` con id inexistente → 404.
  - GET `/api/admin/students?limit=5` → 200, respuesta ahora incluye `fotoKey` field.
  - GET `/api/alumno/carnet-pdf` con Authorization header → 200, PDF 6978 bytes (sin foto) / 7174 bytes (con foto embebida).
  - GET `/api/alumno/carnet-pdf?token=...` → 200.
  - GET `/api/alumno/carnet-pdf` con token admin → 403.
- Limpieza: reseteado fotoKey del estudiante Carlos Pérez (V-00000002) a NULL; borrado archivo `public/uploads/profile-bd7f61c6-3a34-4adb-b085-e041ccdab534.png` de prueba; borrados PDFs temporales en /tmp/.
- Lint: `bun run lint` exit code 0 — limpio.
- Nota sobre concurrencia: otro agente corrió concurrentemente y añadió un feature de "reporte mensual de asistencia PDF" al mismo archivo `students-manager.tsx` (estado `attendancePdfTarget`, función `openAttendancePdf`, Dialog con `<input type="month">`, ruta `/api/admin/students/[id]/attendance-pdf`). Sus cambios coexisten con los míos sin conflicto — ambos features usan state y dialogs separados. Sus imports (`Download` icon) ya están presentes, no requiere acción de mi parte.

## Stage Summary
- **3 archivos API creados**: `src/lib/carnet-pdf.ts`, `src/app/api/admin/students/[id]/carnet-pdf/route.ts`, `src/app/api/alumno/carnet-pdf/route.ts`.
- **1 archivo API modificado**: `src/app/api/admin/students/route.ts` (fotoKey expuesto en GET response).
- **2 componentes modificados**: `src/components/direccion/students-manager.tsx` (foto en tabla + edit con doble confirmación + upload foto + delete con doble confirmación + Carnet PDF button), `src/components/alumno/carnet-digital.tsx` (Descargar Carnet PDF button).
- **2 dependencias instaladas**: pdf-lib, qrcode (+ @types/qrcode dev).
- **Lint**: exit code 0, sin errores ni warnings en archivos nuevos/modificados.
- **Endpoints probados**: 200 OK con PDF válido (admin + alumno, con header y con query token), 401/403/404 en casos no autorizados/inexistentes.
- **Compatible con Cloudflare Workers** (D1 + R2 bucket binding) y **dev local** (Prisma + filesystem).
- **Tema**: emerald/teal consistente, español Venezuela, shadcn/ui + lucide-react.
- **Sin modificar** (respetado): `src/lib/d1.ts`, `src/lib/auth.ts`, `src/lib/db.ts`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/components/profesor/*`, `src/components/representante/*`.
