# Lista — Sistema de Asistencia Escolar

Sistema integral de control de asistencia, notificaciones y comunicación para instituciones educativas. Construido como una PWA (Progressive Web App) con 4 aplicaciones unificadas en una sola codebase, cada una enfocada en un rol específico.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📋 Tabla de Contenidos

- [Visión General](#-visión-general)
- [Las 4 Aplicaciones](#-las-4-aplicaciones)
- [Stack Tecnológico](#-stack-tecnológico)
- [Requisitos](#-requisitos)
- [Instalación](#-instalación)
- [Credenciales de Prueba](#-credenciales-de-prueba)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [API Reference](#-api-reference)
- [Modelo de Datos](#-modelo-de-datos)
- [Despliegue en Cloudflare](#-despliegue-en-cloudflare)
- [Funcionalidades Clave](#-funcionalidades-clave)
- [Licencia](#-licencia)

---

## 🎯 Visión General

**Lista** es una reescritura moderna del sistema de asistencia escolar original (basado en Cloudflare Pages Functions + HTML/JS vanilla). Esta nueva versión unifica las funcionalidades en una sola aplicación Next.js, manteniendo el enfoque en lo esencial:

- ✅ **Asistencia escolar** con marcado manual y automático (GPS)
- ✅ **Notificaciones en tiempo real** a representantes ante ausencias/tardanzas
- ✅ **Feed social** donde los profesores publican avisos y fotos a las secciones
- ✅ **Carnet digital** con QR para los alumnos
- ✅ **Gestión centralizada** desde la Dirección del plantel

Se eliminaron las funcionalidades secundarias del sistema original (notas/calificaciones, constancias, horarios complejos) para enfocar el producto en su núcleo: **asistencia + comunicación + ubicación**.

---

## 📱 Las 4 Aplicaciones

El sistema se presenta como una sola web app que se adapta según el rol del usuario autenticado. Cada rol ve únicamente lo que le corresponde.

### 🏛️ Dirección (Admin)

Panel completo de gestión del plantel:

- **Dashboard** con estadísticas: estudiantes activos, secciones, profesores, tasa de asistencia del día y gráfico de los últimos 7 días por sección.
- **Gestión de Estudiantes**: alta, edición, desactivación, búsqueda y filtrado por sección.
- **Gestión de Secciones**: creación de secciones (grado + turno), asignación de tutor.
- **Configuración del Plantel**: geocerca (latitud, longitud, radio permitido en metros).
- **Gestión de Usuarios**: administración de todos los usuarios con filtro por rol.

### 👨‍🏫 Profesor

Herramientas para el día a día del docente:

- **Pasar Asistencia**: lista de estudiantes con 4 estados (Presente / Ausente / Tardanza / Justificado). Al marcar ausencia o tardanza, se notifica automáticamente a los representantes.
- **Mi Check-in**: registro de entrada/salida con GPS (validación de geocerca).
- **Publicar en el Feed**: envío de avisos, noticias o fotos a los representantes y alumnos de sus secciones.
- **Notificaciones**: bandeja de avisos recibidos.

### 👨‍👩‍👧 Representante

Acceso a la información de sus hijos:

- **Selector multi-hijo** (si tiene varios hijos en el plantel).
- **Ubicación en vivo**: mapa SVG con la última ubicación conocida del hijo, distancia al plantel y precisión GPS. Actualización automática vía long polling.
- **Historial de Asistencia**: últimos 30 días con porcentajes y resumen.
- **Feed de Noticias**: avisos y fotos publicados por los profesores de la sección del hijo.
- **Notificaciones**: alertas de ausencia, tardanza y novedades.

### 📱 Alumno

App informativa para el estudiante:

- **Carnet Digital**: identificación con QR scaneable, código único, sección y datos del plantel.
- **Check-in GPS**: el alumno registra su entrada validando que está dentro del plantel. Si está fuera de rango, se le informa la distancia. Si está dentro, se marca como Presente automáticamente.
- **Feed de Noticias**: publicaciones de sus profesores.
- **Historial de Asistencia**: su propio registro de los últimos 30 días.

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Lenguaje** | TypeScript 5 |
| **Base de datos** | Prisma ORM + SQLite (desarrollo) / Cloudflare D1 (producción) |
| **UI** | shadcn/ui + Tailwind CSS 4 + Radix UI |
| **Iconos** | Lucide React |
| **Gráficos** | Recharts |
| **Estado** | Zustand (cliente) |
| **Auth** | JWT (jsonwebtoken) + bcryptjs |
| **Tiempo real** | Long polling sobre HTTP (gratis en Cloudflare free tier) |
| **Push notifications** | web-push (VAPID) — Android |
| **PWA** | Manifest + Service Worker |
| **Almacenamiento de fotos** | Filesystem local (dev) / Cloudflare R2 (prod) |
| **Package manager** | Bun |

---

## ✅ Requisitos

- Node.js 18+ o Bun 1+
- npm o bun instalado
- Cuenta de Cloudflare (solo para producción)

---

## 🚀 Instalación

```bash
# Clonar el repositorio
git clone <repo-url>
cd Lista

# Instalar dependencias
bun install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores (DATABASE_URL, JWT_SECRET, VAPID keys)

# Crear la base de datos y aplicar el schema
bun run db:push

# Cargar datos semilla (usuarios y estudiantes de ejemplo)
bun run db:seed

# Iniciar el servidor de desarrollo
bun run dev
```

La aplicación estará disponible en `http://localhost:3000`.

---

## 🔑 Credenciales de Prueba

El script de seed crea 4 usuarios con los siguientes roles y credenciales:

| Rol | Cédula | Contraseña |
|---|---|---|
| Administrador | `V-00000000` | `admin123` |
| Profesor | `V-00000001` | `profesor123` |
| Alumno | `V-00000002` | `alumno123` |
| Representante | `V-00000003` | `representante123` |

> ⚠️ **Importante**: cambia estas contraseñas en producción.

---

## 📁 Estructura del Proyecto

```
Lista/
├── prisma/
│   └── schema.prisma              # 12 modelos de datos
├── public/
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                      # Service Worker
│   ├── icon-192.png               # Icono PWA
│   └── icon-512.png               # Icono PWA
├── scripts/
│   └── seed.ts                    # Datos semilla
└── src/
    ├── app/
    │   ├── page.tsx               # Entry: login o app según auth
    │   ├── layout.tsx              # Layout raíz
    │   └── api/                   # 25+ API routes
    │       ├── auth/              # login, me
    │       ├── admin/             # students, sections, plantels, users, stats
    │       ├── profesor/          # attendance, checkin, feed, sections, students
    │       ├── representante/     # children, location, attendance, feed, notifications
    │       ├── alumno/            # profile, checkin, location, feed, attendance
    │       ├── notifications/     # general notifications endpoint
    │       ├── push/              # subscribe, vapid-public
    │       └── upload/            # photo upload (sharp optimization)
    ├── components/
    │   ├── auth/                  # login-form
    │   ├── layouts/               # app-shell (sidebar + view renderer)
    │   ├── direccion/             # 5 vistas del admin
    │   ├── profesor/              # 5 vistas del profesor
    │   ├── representante/          # 5 vistas + mapa SVG
    │   ├── alumno/                # 4 vistas + carnet QR
    │   └── ui/                    # shadcn/ui components
    ├── lib/                       # auth, db, push, api-client, utils
    ├── hooks/                     # use-push-notifications, use-mobile, use-toast
    └── stores/                    # auth-store, view-store (Zustand)
```

---

## 📡 API Reference

Todas las rutas bajo `/api/*` requieren header `Authorization: Bearer <token>` salvo `/api/auth/login`.

### Autenticación
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login con cédula + contraseña |
| GET | `/api/auth/me` | Datos del usuario autenticado |

### Admin (requiere rol `admin`)
| Método | Ruta | Descripción |
|---|---|---|
| GET/POST | `/api/admin/students` | Listar/crear estudiantes |
| PUT/DELETE | `/api/admin/students/[id]` | Actualizar/desactivar |
| GET/POST | `/api/admin/sections` | Listar/crear secciones |
| PUT/DELETE | `/api/admin/sections/[id]` | Actualizar/eliminar |
| GET/POST | `/api/admin/plantels` | Listar/crear planteles |
| PUT | `/api/admin/plantels/[id]` | Actualizar geocerca |
| GET/POST | `/api/admin/users` | Listar/crear usuarios |
| PUT/DELETE | `/api/admin/users/[id]` | Actualizar/desactivar |
| GET | `/api/admin/stats` | Estadísticas del dashboard |

### Profesor (requiere rol `profesor`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/profesor/sections` | Secciones asignadas |
| GET | `/api/profesor/students` | Estudiantes por sección |
| GET/POST/PUT | `/api/profesor/attendance` | Consultar/registrar/cerrar asistencia |
| GET/POST | `/api/profesor/checkin` | Check-in GPS del profesor |
| GET/POST | `/api/profesor/feed` | Publicaciones del feed |

### Representante (requiere rol `representante`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/representante/children` | Hijos del representante |
| GET | `/api/representante/location` | Ubicación en vivo (soporta long polling con `?wait=true`) |
| GET | `/api/representante/attendance` | Historial de asistencia del hijo |
| GET | `/api/representante/feed` | Feed de las secciones de los hijos |
| GET | `/api/representante/notifications` | Notificaciones del representante |

### Alumno (requiere rol `alumno`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/alumno/profile` | Perfil del alumno |
| POST/GET | `/api/alumno/checkin` | Check-in GPS (valida geocerca) |
| POST/GET | `/api/alumno/location` | Reportar/consultar ubicación |
| GET | `/api/alumno/feed` | Feed de su sección |
| GET | `/api/alumno/attendance` | Historial propio |

### Generales
| Método | Ruta | Descripción |
|---|---|---|
| GET/PUT | `/api/notifications` | Listar/marcar como leída |
| GET/POST/DELETE | `/api/push/subscribe` | Suscripción Web Push |
| POST | `/api/upload` | Subir foto (optimizada con sharp) |

---

## 🗄️ Modelo de Datos

El schema Prisma incluye 12 modelos:

- **User** — usuarios con 4 roles (admin, profesor, representante, alumno)
- **Plantel** — colegio con geocerca (lat, lng, radioM)
- **Section** — sección/grado dentro de un plantel
- **SectionAssignment** — relación profesor ↔ sección (tutor/profesor)
- **Student** — perfil del estudiante (con QR único)
- **ParentStudent** — relación representante ↔ estudiante
- **AttendanceSession** — sesión de asistencia por sección y día
- **Attendance** — registro individual (estado, origen: manual/gps_auto/qr/profesor)
- **ProfessorCheckin** — check-in GPS del profesor (entrada/salida)
- **FeedPost** — publicaciones del feed (texto/foto/aviso)
- **Notification** — notificaciones in-app
- **PushSubscription** — suscripciones Web Push
- **LocationPing** — pings de ubicación en tiempo real

---

## ☁️ Despliegue en Cloudflare

El sistema está diseñado para desplegarse 100% en el **free tier de Cloudflare**.

### 1. Crear recursos

```bash
# Instalar wrangler
npm install -g wrangler

# Autenticarse
wrangler login

# Crear base de datos D1
wrangler d1 create lista-db

# Crear bucket R2 para fotos
wrangler r2 bucket create lista-fotos
```

### 2. Configurar `wrangler.toml`

```toml
name = "lista"
compatibility_date = "2024-01-01"
pages_build_output_dir = ".next"

[[d1_databases]]
binding = "DB"
database_name = "lista-db"
database_id = "<tu-d1-id>"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "lista-fotos"
```

### 3. Configurar secrets

```bash
wrangler pages secret put JWT_SECRET
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

### 4. Generar claves VAPID (si no las tienes)

```bash
bun -e "const wp = require('web-push'); console.log(wp.generateVAPIDKeys())"
```

### 5. Desplegar

```bash
# Aplicar schema a D1
wrangler d1 execute lista-db --file=prisma/schema.sql

# Desplegar
wrangler pages deploy
```

---

## ✨ Funcionalidades Clave

### GPS y Geocerca

- El plantel tiene una geocerca configurable (lat, lng, radio en metros).
- Los check-ins (alumno y profesor) validan la distancia con la fórmula de Haversine.
- Si el alumno está dentro del radio permitido, se marca como **Presente** automáticamente (origen `gps_auto`).
- Si está fuera, recibe un error con la distancia calculada.

### Tiempo Real (Long Polling)

- El representante ve la ubicación del hijo actualizarse en vivo.
- Se usa long polling sobre HTTP: el cliente hace `fetch` con `?wait=true&lastTimestamp=xxx`, el servidor mantiene la conexión hasta 25 segundos esperando un nuevo ping.
- Sin costos adicionales (no requiere Durable Objects).

### Notificaciones Push (Android)

- Implementado con **web-push** y claves **VAPID**.
- El service worker (`public/sw.js`) recibe las push y muestra notificaciones del sistema.
- Cuando el profesor marca ausencia/tardanza, se envía push automáticamente a los representantes.
- Cuando el profesor publica en el feed, se notifica a los representantes de esa sección.
- Funciona nativamente en Android (Chrome/Edge). En iOS requiere PWA instalada en home screen (iOS 16.4+).

### Feed Social con Fotos

- Los profesores publican avisos, mensajes o fotos a una sección específica.
- Las fotos se optimizan automáticamente con **sharp** (resize a máximo 1200px, JPEG calidad 80).
- En desarrollo se guardan en `public/uploads/`; en producción van a Cloudflare R2.
- Los representantes y alumnos ven las publicaciones en su feed con la imagen renderizada.

### Carnet Digital con QR

- Cada estudiante tiene un `qrCode` único (UUID).
- El carnet se renderiza con `qrcode.react` generando un QR scaneable real.
- Incluye: nombre, código único, cédula escolar, sección, plantel y periodo escolar.

### PWA Instalable

- `manifest.json` con iconos 192x192 y 512x512.
- Service Worker con cache offline para assets estáticos.
- Instalable en Android como aplicación nativa.

### Seguridad

- Contraseñas hasheadas con **bcrypt** (factor 10).
- JWT con expiración de 7 días.
- Cada endpoint valida el rol del usuario (admin/profesor/representante/alumno).
- Los representantes solo ven datos de sus propios hijos (vía relación `ParentStudent`).
- Los profesores solo ven sus secciones asignadas.

---

## 📜 Licencia

MIT © 2025 Lista
