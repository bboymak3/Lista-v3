# Task: SUPER-ADMIN — Super admin panel for managing multiple liceos

## Context
- Sistema Lista v3 con 5 roles: super_admin, admin, profesor, representante, alumno
- Plantel con campos: descripcion, telefono, email, logoKey, activo
- User con plantelId (nullable, FK a Plantel) — null para super_admin (ve todos)
- Patrón isD1() en todas las APIs (D1 crudo en prod, Prisma en dev)
- Tablas con prefijo v3_, booleanos como INTEGER 0/1

## Files Created

### API (5 new routes)
1. `src/app/api/super-admin/plantels/route.ts` — GET (list all with counts) + POST (create)
2. `src/app/api/super-admin/plantels/[id]/route.ts` — GET (detail+counts) + PUT (update) + DELETE (soft delete)
3. `src/app/api/super-admin/plantels/[id]/students/route.ts` — GET students by liceo
4. `src/app/api/super-admin/plantels/[id]/users/route.ts` — GET users by liceo (?role=)
5. `src/app/api/super-admin/plantels/[id]/sections/route.ts` — GET sections by liceo

### Lib
6. `src/lib/auth-helpers.ts` — getUserPlantelId(request), canAccessPlantel(), requireSuperAdmin(), getAuthUser()

### Store
7. `src/stores/super-admin-store.ts` — useSuperAdminStore (selectedPlantelId for navigation)

### UI
8. `src/components/super-admin/liceos-manager.tsx` — Grid de liceos con cards (logo, stats, activo toggle), búsqueda, filtros, crear/editar dialog con upload de logo, soft-delete con confirmación
9. `src/components/super-admin/liceo-detail.tsx` — Detalle del liceo con tabs: Estudiantes, Profesores, Representantes, Secciones, Estadísticas

## Files Modified

### API (4 routes updated for plantelId filtering)
1. `src/app/api/admin/plantels/route.ts` — GET: admin ve solo su plantel; super_admin ve todos (opcional ?plantelId=). POST: solo super_admin. Retorna descripcion/telefono/email/logoKey/activo.
2. `src/app/api/admin/plantels/[id]/route.ts` — PUT: super_admin edita todo; admin edita campos limitados (sin descripcion/telefono/email/logoKey/activo). DELETE: solo super_admin.
3. `src/app/api/admin/students/route.ts` — GET: admin filtra por su plantelId (JOIN sections→plantelId); super_admin ve todos o ?plantelId=. POST: admin valida que sectionId pertenezca a su plantel.
4. `src/app/api/admin/users/route.ts` — GET: admin filtra por plantelId + excluye super_admin; super_admin ve todos. POST: admin crea usuarios en su plantel; super_admin puede asignar plantelId.
5. `src/app/api/admin/sections/route.ts` — GET: admin filtra por plantelId; super_admin ve todos o ?plantelId=. POST: admin forzar plantelId al suyo; super_admin puede crear en cualquier plantel.

### UI
6. `src/components/layouts/app-shell.tsx` — Añadidos imports LiceosManager + LiceoDetail. navByRole.super_admin ahora tiene 'Liceos' + 'Detalle Liceo' (además del profile existente). ViewRenderer maneja super-admin-liceos y super-admin-liceo-detail. roleLabels.super_admin = 'Super Admin'. activeView inicial para super_admin = 'super-admin-liceos'. Back button respeta la nueva vista inicial.

## Test Results

### Endpoints verificados con curl (login super_admin test → Bearer token):
- ✅ GET /api/super-admin/plantels → 200, lista con counts (sectionCount, studentCount, professorCount, adminCount, representanteCount)
- ✅ GET /api/super-admin/plantels/plantel-default → 200, detalle + counts
- ✅ GET /api/super-admin/plantels/plantel-default/students → 200, lista estudiantes
- ✅ GET /api/super-admin/plantels/plantel-default/sections → 200, lista secciones con tutor + studentCount
- ✅ GET /api/super-admin/plantels/plantel-default/users?role=profesor → 200 (vacío para plantel-default)
- ✅ POST /api/super-admin/plantels → 201, crea liceo con descripcion/telefono/email/logoKey
- ✅ PUT /api/super-admin/plantels/{id} → 200, actualiza campos enviados
- ✅ DELETE /api/super-admin/plantels/{id} → 200, soft delete (activo=0)
- ✅ GET /api/admin/plantels → 200, super_admin ve todos los planteles
- ✅ GET /api/admin/students?plantelId=plantel-default → 200, filtra por plantelId

### Lint
- `bunx eslint src/lib/auth-helpers.ts src/app/api/super-admin src/app/api/admin/plantels src/app/api/admin/students src/app/api/admin/users src/app/api/admin/sections src/components/super-admin src/components/layouts/app-shell.tsx src/stores/super-admin-store.ts` → 0 errors, 0 warnings (after auto-fix of unused eslint-disable directives)

## Notas
- El dev server es inestable en el sandbox (cae cada ~30s) pero los endpoints responden correctamente cuando está up
- Test user `V-SUPER-TEST` / `test12345` creado y limpiado al final
- Test liceo "Liceo Test SuperAdmin" creado y hard-deleteado en cleanup
- Color theme emerald/teal consistente con el resto del sistema
- Spanish (Venezuela) texts
- shadcn/ui + lucide-react icons (School, Building, Users, GraduationCap, Shield, UserCircle, MapPin, Phone, Mail, etc.)
- sonner toasts
