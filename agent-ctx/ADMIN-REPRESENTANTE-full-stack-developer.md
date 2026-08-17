# Task ADMIN-REPRESENTANTE — Admin representante management

## Agent
full-stack-developer (Admin representante management)

## Task
Crear representante + asignar múltiples alumnos (hermanos) — Feature 1: dedicated "Crear Representante" button in admin. Feature 2: assign multiple students to a representante (including hermanos). Feature 3: verify representante child-selector works with multiple children.

## Work Log
- Leído contexto previo: worklog (Tasks 0, 2-a, 2-b, 3, 5, PROFILES-WHATSAPP, D1-ADAPT), prisma/schema.prisma, src/lib/d1.ts, src/lib/db-auth.ts, src/lib/api-client.ts, src/app/api/auth/login/route.ts, src/app/api/admin/users/route.ts + [id]/route.ts, src/app/api/admin/students/route.ts + [id]/route.ts, src/components/direccion/users-manager.tsx, src/components/representante/representante-dashboard.tsx + child-selector.tsx.
- Verificada columna `whatsapp` en v3_users (TEXT) y schema v3_parent_student (con @@unique([representanteId, estudianteId])) vía PRAGMA table_info.

### Archivos creados
- `src/app/api/admin/representantes/route.ts` — GET (lista representantes con studentsCount vía subquery + search por nombre/apellido/cédula/email/whatsapp), POST (crea representante con rol forzado, hashPassword bcrypt, validación unicidad).
- `src/app/api/admin/representantes/[id]/students/route.ts` — GET (JOIN v3_parent_student → v3_students → v3_sections), POST (asigna estudiante, valida parentesco, demote esPrincipal del principal anterior del estudiante).
- `src/app/api/admin/representantes/[id]/students/[studentId]/route.ts` — DELETE (hard delete v3_parent_student row, 404 si no existe).
- `src/components/direccion/representante-students.tsx` — Vista admin-representante-students: grid 2 col (sidebar representantes + panel estudiantes), Combobox (Popover + Command) para buscar estudiantes, badges parentesco + principal, count por representante, AlertDialog de confirmación para desvincular.

### Archivos modificados
- `src/app/api/admin/users/route.ts` — añadido `whatsapp` al SELECT (GET), INSERT (POST), y SELECT de retorno (POST). Mismo en rama D1 y Prisma.
- `src/app/api/admin/users/[id]/route.ts` — añadido `whatsapp` al PUT dinámico (sets SQL + Prisma data) y al SELECT de retorno.
- `src/components/direccion/users-manager.tsx`:
  - Helpers nuevos: `generateRandomPassword(length=8)` (alfanumérico legible, sin 0/O/1/I/l, usa crypto.getRandomValues), `buildInvitationLink(cedula)` (`${origin}/?cedula=V-123`), `buildWhatsAppMessage`, `buildWhatsAppUrl`.
  - Estado nuevo: `repDialogOpen`, `repForm` (RepFormValues con whatsapp), `repSubmitting`, `repCopied`, `repResult`.
  - UserFormValues extendido con `whatsapp` (form genérico de create/edit también lo persiste ahora).
  - Botón "Crear Representante" (emerald, UserPlus icon) visible cuando rolFilter ∈ {all, representante}.
  - Dialog dedicado para crear representante: cédula con prefix V-/E-, nombre, apellido, email opcional, teléfono, WhatsApp (solo dígitos), contraseña auto-generada con botones Regenerar (RefreshCw) + Copiar (Copy/Check). Botón submit "Crear y generar link de invitación".
  - Tras crear: vista de éxito con cédula (readonly), contraseña temporal (con copiar), enlace de invitación (con copiar), botón "Abrir WhatsApp" si tiene número, "Crear otro" para encadenar.
  - Refactorizado `openInvite` (era async y llamaba a /admin/representantes/{id}/invite — endpoint inexistente) → ahora client-side: genera URL + mensaje WhatsApp en JS, sin llamada al backend. El Dialog de invitación para representantes existentes conserva su UX.
  - Form create/edit genérico ahora persiste whatsapp en POST/PUT a /admin/users.
- `src/components/layouts/app-shell.tsx`:
  - Importado `RepresentanteStudents`.
  - Añadido `{ id: 'representante-students', label: 'Asignar Representantes', icon: Users, view: 'admin-representante-students' }` al sidebar admin (después de "Enviar PDF", antes de "Usuarios").
  - Añadido `case 'admin-representante-students': return <RepresentanteStudents />` en ViewRenderer admin.

### Tests con curl (dev server)
- Login admin (V-00000000/admin123) → token Bearer.
- GET /api/admin/representantes?includeInactive=true → 200 con Ana Rodríguez (studentsCount=1).
- GET sin token → 403.
- POST /api/admin/representantes {cedula:V-99999999, nombre, apellido, whatsapp:584120000000, password} → 201, devuelve user sin password.
- POST cédula duplicada → 409.
- GET /api/admin/representantes/{id}/students → 200, Ana tiene 1 (Carlos Pérez, esPrincipal=true).
- POST /api/admin/representantes/{NEW_REP}/students {estudianteId:carlos, parentesco:tutor, esPrincipal:true} → 201. Verificado: Ana's Carlos demovido a esPrincipal=false (reemplazo automático del principal anterior del estudiante).
- POST asignación duplicada → 409 "Este estudiante ya está asignado a este representante".
- POST segunda asignación al mismo rep con esPrincipal=false (hermano Lucía) → 201. GET → 2 estudiantes (Carlos principal + Lucía).
- DELETE /api/admin/representantes/{id}/students/{lucia_id} → 200, GET posterior muestra 1.
- GET /api/admin/users?rol=profesor&search=Wpp → devuelve whatsapp. POST /api/admin/users con whatsapp → 201 con whatsapp en respuesta.
- Search representantes por whatsapp="58415" → encuentra el rep correcto.
- Login representante de prueba tras soft-delete → 401 (activo=false bloquea login). Correcto.
- Verificación representante app con múltiples hijos:
  - Asignados 2 hijos a Ana (Carlos principal + Lucía secundaria).
  - GET /api/representante/children (como Ana) → count=2, con esPrincipal correcto por hijo.
  - child-selector.tsx renderiza DropdownMenu cuando length>1 (verificado por code review), y representante-dashboard.tsx recarga detail vía useEffect dependiente de selectedChild?.id.
- Limpieza: borradas asociaciones de prueba, re-asignado Carlos Pérez a Ana como principal (esPrincipal=true), soft-delete de usuarios de prueba.

## Stage Summary
- 3 archivos API creados en `src/app/api/admin/representantes/` (route.ts, [id]/students/route.ts, [id]/students/[studentId]/route.ts) — isD1 pattern en todos, hashPassword bcrypt en POST.
- 2 archivos API modificados (users/route.ts y users/[id]/route.ts) — añadido campo `whatsapp` a GET/POST/PUT.
- 1 componente nuevo: `src/components/direccion/representante-students.tsx` (Combobox shadcn + AlertDialog + grid 2 col responsive).
- 1 componente modificado: `src/components/direccion/users-manager.tsx` (botón UserPlus + Dialog dedicado con password auto-generada + invite link client-side + whatsapp form field).
- 1 layout modificado: `src/components/layouts/app-shell.tsx` (sidebar + ViewRenderer case).
- Todos los endpoints probados con curl: 200/201 OK, 403 sin auth, 404/409 en casos de error, esPrincipal replacement (demote automático del principal anterior del estudiante al asignar uno nuevo como principal).
- Representante child-selector verificado para múltiples hermanos (2 hijos).
- Lint: `bunx eslint src/app/api/admin src/components/direccion src/components/layouts src/app/api/auth src/lib` → exit code 0. Lint completo del proyecto OOMs en sandbox (4GB RAM), pero todos los archivos nuevos/modificados pasan limpios.
- Tema emerald/teal consistente. Iconos lucide-react. shadcn/ui (Dialog, AlertDialog, Popover, Command, Select, Checkbox, Badge, Avatar, Skeleton). Spanish (Venezuela). sonner toasts.
