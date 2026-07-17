# Supervisa 360

Aplicación web (SPA) para que las dos supervisoras de ADRA en Arequipa y Tacna coordinen las
visitas de supervisión a ~330 asociaciones: agenda compartida, programación/reprogramación/
cancelación de visitas con bloqueo de duplicidad, registro de resultado (puntuación y
comentario), historial por asociación, y metas mensuales individuales y conjuntas.

Contexto de producto y reglas de negocio completas en [`docs/`](docs/) (ver
[`docs/product/mvp.md`](docs/product/mvp.md) y
[`docs/product/business-rules.md`](docs/product/business-rules.md)).

## Funcionalidades del MVP

- Autenticación (2 cuentas fijas, sin registro público) con sesión persistida y rutas
  protegidas.
- Panel inicial: avance individual y conjunto de la meta del mes, próximas visitas,
  pendientes de cerrar y reprogramadas.
- Catálogo de asesores (solo lectura).
- Asociaciones: listado con búsqueda/filtros, detalle, edición de estado y asesor actual,
  historial completo de visitas.
- Agenda compartida con filtros por mes, supervisora, estado y región.
- Programar visita, con bloqueo de visita activa duplicada (RN-12) y advertencia/bloqueo de
  repetición anual (RN-10/11/14).
- Reprogramar y cancelar visitas activas.
- Registrar resultado: marcar realizada (fecha, horas opcionales, puntuación 0-5, comentario
  obligatorio) o no realizada; editar el resultado de una visita ya realizada.
- Metas mensuales por supervisora, con meta conjunta calculada como suma (no almacenada).

Lo que queda explícitamente fuera del MVP está documentado en
[`docs/product/out-of-scope.md`](docs/product/out-of-scope.md). El estado detallado
historia por historia está en [`docs/backlog/status.md`](docs/backlog/status.md).

## Tecnologías

- React 19 + TypeScript + Vite.
- MUI (`@mui/material` + `@emotion/*`) para la interfaz, sin librería de íconos adicional.
- React Router para el ruteo.
- React Hook Form + Zod para formularios y validación (esquemas compartidos entre
  formularios y pruebas en `src/shared/utils/schemas.ts`).
- Supabase (`@supabase/supabase-js`) como backend: Auth, PostgreSQL con RLS, API
  autogenerada (PostgREST). Sin backend propio.
- Vitest + React Testing Library para pruebas.

## Requisitos

- Node.js (ver `engines`/versión usada en CI: Node 24).
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — solo si vas a correr
  Supabase localmente (recomendado para desarrollar).

## Instalación

```sh
npm install
```

## Configurar `.env.local`

```sh
cp .env.example .env.local
```

Completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los valores de tu instancia de
Supabase (local o remota). **Nunca** la clave `service_role`. Detalle completo en
[`docs/development/local-supabase.md`](docs/development/local-supabase.md).

## Iniciar Supabase local

```sh
npm run supabase:start   # requiere Docker
npm run db:reset          # migraciones + seed.sql
```

El seed crea, entre otros datos ficticios, tres cuentas de prueba:

| Correo                            | Contraseña      | Rol                   |
| --------------------------------- | --------------- | --------------------- |
| `supervisora1@supervisa360.local` | `Supervisa360!` | `SUPERVISOR`          |
| `supervisora2@supervisa360.local` | `Supervisa360!` | `SUPERVISOR`          |
| `jefe@supervisa360.local`         | `Supervisa360!` | `SUPERVISION_MANAGER` |

Estas credenciales son **solo para desarrollo local**; no existen en producción.

El rol vive en `profiles.role` (enum `app_role`, default `SUPERVISOR`). Para
asignar el rol de jefe a una cuenta real en producción, tras crear el usuario en
Supabase Auth y su fila en `profiles`:

```sql
update public.profiles set role = 'SUPERVISION_MANAGER' where id = '<uuid-del-usuario>';
```

## Ejecutar el frontend

```sh
npm run dev
```

## Pruebas

```sh
npm run test        # una sola pasada
npx vitest           # modo watch
```

## Build

```sh
npm run build        # tsc -b + vite build
npm run preview       # sirve dist/ localmente para probar el build de producción
```

## Estructura principal

```text
src/
├── app/            # shell de la app: tema MUI, providers, router, layout privado
├── features/       # un directorio por dominio: auth, advisors, associations, visits,
│                    # schedule, goals — páginas + componentes + lógica propia de cada uno
├── services/
│   └── supabase/   # cliente tipado + un módulo por tabla (associations.ts, visits.ts...)
│                    # + errors.ts (traductor central de errores de Postgres/PostgREST)
├── shared/
│   ├── components/ # LoadingState, ErrorState, EmptyState, ConfirmDialog, MonthNavigator...
│   ├── hooks/      # useAsyncData, useDebouncedValue
│   ├── types/      # tipos de dominio derivados de database.types.ts
│   └── utils/      # schemas.ts (Zod), labels.ts (es-PE), date.ts (America/Lima)
├── lib/            # env.ts: valida variables de entorno con Zod
└── types/          # database.types.ts (generado; no editar a mano)
```

Ver también [`docs/architecture/architecture.md`](docs/architecture/architecture.md) y
`CLAUDE.md` para las convenciones completas.

## Importación manual de datos (asesores y asociaciones)

No hay pantalla de importación en el MVP (a propósito). El procedimiento manual con
plantillas CSV y el SQL de carga están en
[`docs/development/data-import.md`](docs/development/data-import.md).

## Preparación para producción / Vercel

`vercel.json` ya incluye el fallback de rutas para el SPA. La guía completa (variables de
entorno, configuración de Supabase Auth, creación de las cuentas reales) está en
[`docs/development/deploy-vercel.md`](docs/development/deploy-vercel.md). **Esta sesión no
despliega nada**: el despliegue real requiere credenciales de Vercel/GitHub y una decisión
consciente de a qué proyecto de Supabase apuntar.

## Advertencias importantes

- La clave `service_role` de Supabase **nunca** debe usarse desde el frontend ni guardarse
  en una variable `VITE_*` (todo lo que empieza con `VITE_` termina en el bundle del
  navegador).
- Nunca ejecutes `supabase db push` ni `supabase db reset --linked` sin una intención
  explícita y consciente de modificar el proyecto remoto — ver
  [`docs/development/local-supabase.md`](docs/development/local-supabase.md) §11.
- No commitees `.env.local` (ya está en `.gitignore`) ni credenciales reales en ningún
  archivo del repositorio.
