<div align="center">

<img src="public/favicon.svg" alt="Notekeeper" width="72" />

# Notekeeper

**Mis notas, listas y cuentas en un solo lugar:** una alternativa a Google Keep que guarda todo en mi propio Postgres.

[![React](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite_8-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Hono](https://img.shields.io/badge/Hono_4-E36002?logo=hono&logoColor=white)](https://hono.dev)
[![Prisma](https://img.shields.io/badge/Prisma_7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![Supabase](https://img.shields.io/badge/Supabase-1C1C1C?logo=supabase&logoColor=3ECF8E)](https://supabase.com)
[![Render](https://img.shields.io/badge/Render-1C1C1C?logo=render&logoColor=white)](https://render.com)

</div>

---

## ✨ Qué hace

| | |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📝 **Notas por bloques**    | Cada nota mezcla texto, listas con checkboxes y bloques de cuenta.                                                                                       |
| 🔐 **Contraseñas cifradas** | Los campos marcados como secretos se guardan cifrados con AES-256-GCM y solo se muestran cuando los pides; se copian con un clic.                         |
| 🏷️ **Etiquetas**           | Etiquetas con contador en la barra lateral, además de Archivo y Papelera.                                                                                 |
| 🎨 **Colores y fijado**     | 18 colores por nota y notas fijadas que aparecen primero en su sección.                                                                                   |
| 🔍 **Búsqueda**             | Filtra al instante por título, texto, campos de cuentas y etiquetas.                                                                                      |
| 📥 **Importar**             | `.txt`, `.md`, notas de Google Keep (Takeout) y backups propios. Varios archivos a la vez, o arrastrándolos a la ventana; las notas repetidas se ignoran. |
| 📤 **Exportar**             | Descarga un único JSON con todas las notas, listo para volver a importar.                                                                                 |
| ↩️ **Deshacer**             | Archivar o mover a la papelera avisa con un botón para revertirlo.                                                                                        |
| 🔄 **Siempre al día**       | Las notas viven en Postgres; al volver a la pestaña, la lista se refresca desde el servidor.                                                              |
| 👤 **Cuentas**              | Inicio de sesión con las mismas cuentas de Supabase que HobbieVault (usuario o email). Cada cuenta ve solo sus notas y etiquetas.                         |
| ⏱️ **Sesiones limitadas**   | Una cuenta puede tener sesiones de N minutos y una espera de X horas entre inicios de sesión (la cuenta `tester`: 5 min y 24 h). Solo vale la sesión abierta desde la app, y la cuenta demo no puede cambiar contraseña, correo ni perfil (`hobbievault/prisma/sql/001_protect_demo_accounts.sql`). |

### Bloques de una nota

| Bloque    | Contenido                                                                   |
| --------- | --------------------------------------------------------------------------- |
| ✍️ Texto  | Párrafos y líneas sueltas.                                                  |
| ☑️ Lista  | Elementos con checkbox y título opcional.                                   |
| 🔑 Cuenta | Pares campo/valor; los marcados como secretos se cifran antes de guardarse. |

---

## 🛠️ Stack

- **Frontend:** React 19 · Vite 8 · TypeScript
- **Estilos:** CSS propio, sin framework · Figtree y JetBrains Mono
- **API:** Hono 4 sobre Node, ejecutada con `tsx`
- **Datos:** Prisma 7 con el driver adapter de `pg`, sobre Postgres (Supabase, esquema `notekeeper`)
- **Cifrado:** AES-256-GCM con `node:crypto`
- **Calidad:** Oxlint · `tsc` en modo build
- **Deploy:** Render (Blueprint) · GitHub

---

## 🚀 Empezar

```bash
npm install                  # también genera el cliente de Prisma
cp .env.example .env.local   # y rellena los valores
npm run db:push              # crea o actualiza las tablas del esquema notekeeper
npm run dev                  # Vite en localhost:5173; la API corre dentro de Vite bajo /api
```

| Variable                 | Para qué                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | Postgres para la app (Supabase transaction pooler, puerto 6543).                                                 |
| `DIRECT_URL`             | Conexión directa para el CLI de Prisma (Supabase session pooler, puerto 5432).                                   |
| `NOTEKEEPER_SECRET_KEY`  | 32 bytes en base64. Cifra los campos secretos: si cambia, las contraseñas ya guardadas dejan de descifrarse.      |
| `SUPABASE_URL`           | URL del proyecto de Supabase (el mismo que HobbieVault). Solo la usa el servidor.                                |
| `SUPABASE_ANON_KEY`      | Clave anon/publishable del proyecto. Solo la usa el servidor.                                                    |
| `HOST`                   | Opcional. `0.0.0.0` en hosting; por defecto escucha en `127.0.0.1`.                                              |
| `ALLOWED_HOSTS`          | Opcional. Dominios públicos extra para la API, separados por comas.                                              |

| Comando               | Para qué                                                        |
| --------------------- | --------------------------------------------------------------- |
| `npm run dev`         | Desarrollo en `localhost:5173`                                  |
| `npm run build`       | Build de producción en `dist/`                                  |
| `npm start`           | Sirve `dist/` y la API en `PORT` (3001 por defecto)             |
| `npm run lint`        | Oxlint                                                          |
| `npm run db:push`     | Aplica el esquema a la base de datos                            |
| `npm run db:generate` | Regenera el cliente de Prisma                                   |
| `npm run session-limit -- <usuario> <min> [horas]` | Limita las sesiones de una cuenta (`<usuario> off` lo quita) |

---

## ☁️ Deploy en Render

`render.yaml` describe el servicio como Blueprint. Antes del primer deploy:

1. El proyecto tiene que estar en un repositorio de GitHub, GitLab o Bitbucket.
2. Apunta el servicio a un Postgres accesible desde Render y ejecuta una vez `create schema if not exists notekeeper;`.
   Prisma no crea esquemas en proyectos `multiSchema`, así que `db push` falla en una base nueva sin ese paso.
3. En Render, elige **New → Blueprint** y selecciona el repo. Rellena `DATABASE_URL`, `DIRECT_URL`,
   `NOTEKEEPER_SECRET_KEY` (reutiliza la clave local: con otra distinta las contraseñas guardadas quedan ilegibles),
   `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
4. Si usas un dominio propio, añádelo a `ALLOWED_HOSTS`. El subdominio `*.onrender.com` se acepta solo, vía
   `RENDER_EXTERNAL_HOSTNAME`.

El plan gratuito no tiene `preDeployCommand` y el servicio se duerme tras ~15 minutos sin tráfico, así que
`prisma db push` corre dentro del build; en un plan de pago, muévelo a `preDeployCommand`.

### Cuentas

Quién puede entrar lo decide la tabla `notekeeper.users` (mismo id que `auth.users`, igual que `hobbievault.users`).
La sesión vive en cookies `httpOnly` propias (`notekeeper-auth`), así que no se mezcla con la de HobbieVault.
Cerrar sesión sube `auth_version` y cierra la sesión de Notekeeper en todos los dispositivos.
`prisma/sql/001_users.sql` es la migración que creó la tabla y pasó las notas existentes a `daniellerma12`.

---

## 📁 Estructura

```text
src/            UI en React (App, hooks y utilidades de notas)
src/components/ editor, tarjetas, barra de herramientas y toasts
server/         API en Hono, acceso a datos con Prisma y cifrado
prisma/         esquema de la base de datos y migraciones SQL puntuales
public/         favicon
render.yaml     blueprint del deploy
```
