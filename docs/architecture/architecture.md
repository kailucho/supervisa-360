# Arquitectura — Supervisa 360

Este documento describe la arquitectura de alto nivel. No incluye código ni
configuración concreta; eso corresponde a una etapa posterior.

## Arquitectura propuesta de alto nivel

Aplicación **frontend-only** (SPA) que habla directamente con **Supabase** como
backend administrado. No hay servidor propio (sin Node/Express/NestJS separado),
lo cual es consistente con el tamaño del equipo (2 usuarias) y el alcance del MVP.

```
┌─────────────────────────────┐        ┌───────────────────────────┐
│   Cliente (navegador)       │        │        Supabase           │
│   React + TypeScript + Vite │  HTTPS │  - Auth                    │
│   MUI + React Router        │◄──────►│  - PostgreSQL (+ RLS)      │
│   React Hook Form + Zod     │        │  - PostgREST (API auto)    │
└─────────────────────────────┘        └───────────────────────────┘
```

- El frontend consume la API autogenerada de Supabase (PostgREST) para leer y
  escribir datos, y usa Supabase Auth para la sesión.
- Toda regla de negocio que sea **crítica** (p. ej. prevención de duplicidad,
  RN-12) debe validarse en el cliente por usabilidad, **y** reforzarse en la base
  de datos (constraint / índice único parcial) para que sea imposible de violar
  aunque falle una validación en el frontend. El diseño detallado de esa
  restricción se documenta en [database-design.md](database-design.md).

## Responsabilidades del frontend

- Toda la lógica de interfaz, navegación y experiencia de usuario.
- Validación de formularios (React Hook Form + Zod) antes de enviar datos:
  formatos, campos obligatorios, rangos (p. ej. puntuación 0-5), y validaciones de
  negocio "blandas" (p. ej. advertencias de visita ya realizada en el año).
  las cuales tienen contraparte de dato real solo en el servidor (no se puede
  confiar únicamente en el cliente).
- Orquestar las llamadas a Supabase (lectura/escritura) y manejar sus errores,
  incluyendo el error esperado de violar la restricción de duplicidad en la base
  de datos (RN-12), traduciéndolo a un mensaje entendible para la supervisora.
- Mantener el estado de sesión (usuario autenticado) y proteger rutas privadas.

## Responsabilidades de Supabase

- **Auth**: autenticación de las 2 cuentas fijas de supervisoras (sin registro
  público). La creación de cuentas se hace manualmente (panel de Supabase o script
  administrativo), no desde la interfaz de la app.
- **PostgreSQL**: fuente única de verdad de los datos (asociaciones, asesores,
  visitas, metas). Aplica las restricciones críticas de integridad y unicidad
  (ver [database-design.md](database-design.md)).
- **RLS (Row Level Security)**: controla qué filas puede leer/escribir cada usuario
  autenticado. Dado que ambas supervisoras tienen visibilidad y permisos idénticos
  sobre todos los datos, las políticas de RLS son simples: exigir usuario
  autenticado, sin distinción de "propietario de fila".
- **PostgREST**: expone automáticamente la API HTTP sobre las tablas, consumida
  directamente por el frontend.

## Organización por funcionalidades

Se sugiere organizar el código del frontend por dominio funcional (no por tipo de
archivo), por ejemplo:

- `auth/` — inicio de sesión, sesión, rutas protegidas.
- `associations/` — listado, búsqueda, detalle, edición de estado/asesor.
- `advisors/` — catálogo de asesores (solo lectura en el MVP).
- `visits/` — programar, reprogramar, cancelar, registrar resultado.
- `schedule/` — agenda compartida y sus filtros.
- `goals/` — metas individuales y conjunta, panel inicial.
- `shared/` — componentes, tipos y utilidades comunes (p. ej. esquemas Zod
  compartidos entre formularios).

Esta organización favorece que cada funcionalidad del backlog (ver
[initial-backlog.md](../backlog/initial-backlog.md)) se traduzca en una carpeta
identificable, sin necesitar una arquitectura de monorepo ni microservicios.

## Estrategia general de autenticación

- Supabase Auth con correo/contraseña (el mecanismo más simple para 2 cuentas
  fijas administradas manualmente).
- El registro público debe estar **deshabilitado** en la configuración de Supabase
  Auth, ya que no existe ese flujo en el MVP.
- Rutas de la aplicación protegidas: sin sesión válida, se redirige al login
  (`ProtectedRoute`).
- **Dos roles** (`profiles.role`, enum `app_role`): `SUPERVISOR` y
  `SUPERVISION_MANAGER` (RN-28). Las supervisoras son equivalentes entre sí; el
  jefe solo consulta y define metas conjuntas por sede.

### Rutas por rol

| Ruta                                                         | Acceso                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| `/login`                                                     | público                                                         |
| `/`                                                          | `RoleHomeRedirect` → inicio del rol                             |
| `/inicio`                                                    | solo `SUPERVISOR`                                               |
| `/jefatura`                                                  | solo `SUPERVISION_MANAGER`                                      |
| `/jefatura/sedes/:regionId`                                  | solo `SUPERVISION_MANAGER`                                      |
| `/agenda`, `/asociaciones`, `/asociaciones/:id`, `/asesores` | compartidas (lectura completa; las acciones se ocultan al jefe) |
| `/metas`                                                     | compartida; el contenido se ramifica por rol                    |

- `RoleRoute allow={[...]}` (en `src/features/auth/`) envuelve los grupos
  exclusivos y **redirige** al inicio del rol en lugar de mostrar una página
  muerta. `RoleHomeRedirect` resuelve `/` según el rol, así que el default de
  `LoginPage` no necesita conocerlo.
- El menú se construye con `getNavItems(role)`
  (`src/app/layout/navItems.ts`): mismos ítems para ambos roles, pero "Inicio"
  apunta a `/inicio` o `/jefatura`. No existe opción de auditoría.
- Las comprobaciones de permiso están centralizadas en
  `src/shared/utils/permissions.ts` (`isSupervisor`, `isSupervisionManager`,
  `canManageVisits`, `canManageAssociations`, `canManagePersonalGoals`,
  `canManageRegionalGoals`, `homePathForRole`): funciones puras y testeadas, sin
  comparaciones `role === '...'` dispersas por las páginas.

## Estrategia general de seguridad

- Toda tabla con datos de negocio tiene RLS **habilitado**; sin políticas
  explícitas, el acceso por defecto es denegado.
- Las políticas se apoyan en `public.current_app_role()` (`security definer`,
  `stable`), que devuelve el rol del usuario autenticado o `NULL` si su perfil no
  está activo: la lectura exige perfil activo, las escrituras operativas exigen
  `SUPERVISOR` y las metas conjuntas exigen `SUPERVISION_MANAGER`. No se expone
  ninguna tabla al rol `anon`.
- **El gating del frontend es solo UX**: ocultar botones no es una medida de
  seguridad. Toda restricción del jefe está garantizada por RLS y por los `GRANT`
  por columna (ver `database-design.md` §14).
- Las claves/API keys públicas de Supabase (anon key) son seguras de exponer en el
  frontend porque el control de acceso real ocurre vía RLS, no por ocultar la key.
  La _service role key_ (con permisos totales) nunca se usa desde el frontend.
- Variables sensibles (URLs, keys) se gestionan como variables de entorno del
  proyecto en Vercel, no se versionan en el repositorio.
- La restricción crítica de "una visita activa por asociación" se implementa como
  restricción de base de datos (no solo en frontend), para que sea imposible de
  violar incluso por un uso incorrecto o concurrente de la API.

## Estrategia de despliegue

- Repositorio en GitHub; despliegue continuo del frontend en Vercel a partir de la
  rama principal (y, opcionalmente, preview deployments por pull request).
- Supabase aloja la base de datos y Auth de forma administrada; no requiere
  infraestructura propia que desplegar.
- Pruebas (Vitest + React Testing Library) se ejecutan como parte del flujo de
  verificación antes de desplegar (detalle de CI a definir en una etapa posterior,
  fuera de este documento de alto nivel).
