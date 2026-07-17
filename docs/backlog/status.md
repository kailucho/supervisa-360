# Estado del backlog — Supervisa 360

Resumen de qué historias de [`initial-backlog.md`](initial-backlog.md) están hechas, cuáles
necesitan una acción manual/externa antes de poder darse por completas del todo, y qué queda
fuera del MVP a propósito. No reemplaza el backlog original: es un snapshot de progreso.

## Completadas (código en este repositorio)

| HU      | Historia                                       | Notas                                                                    |
| ------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| `HU-01` | Inicializar proyecto frontend                  | Vite + React + TS + MUI + Router + RHF + Zod + Vitest configurados.      |
| `HU-02` | Configurar proyecto Supabase                   | Cliente tipado, `env.ts`, `.env.example`.                                |
| `HU-03` | Esquema base de datos                          | Migración inicial completa, RN-12 con índice único parcial probado.      |
| `HU-04` | RLS                                            | Habilitado en las 6 tablas, políticas y `GRANT` por columna.             |
| `HU-06` | Pantalla de inicio de sesión                   | Login, sesión persistida, `onAuthStateChange`, rutas protegidas.         |
| `HU-08` | Listado de asesores (solo lectura)             | `/asesores`, búsqueda por código/nombre.                                 |
| `HU-10` | Listado y búsqueda de asociaciones             | `/asociaciones`, búsqueda debounced + filtros región/estado.             |
| `HU-11` | Detalle de asociación                          | `/asociaciones/:id`.                                                     |
| `HU-12` | Editar estado de asociación y reasignar asesor | Verificado que no altera visitas históricas (RN-17).                     |
| `HU-13` | Listado de agenda compartida                   | `/agenda`, ambas supervisoras.                                           |
| `HU-14` | Filtros de agenda                              | Mes/año, supervisora, estado, región.                                    |
| `HU-15` | Programar visita                               | Bloquea asociaciones no supervisables (RN-01/02).                        |
| `HU-16` | Bloquear doble programación                    | Verificación previa + índice único parcial como respaldo ante carrera.   |
| `HU-17` | Advertencia de visita ya realizada en el año   | Bloquea solo `ORDINARIA` repetida; advierte en los demás tipos.          |
| `HU-18` | Reprogramar y cancelar visita                  | Mismo registro, sin crear uno nuevo.                                     |
| `HU-19` | Registrar resultado (realizada / no realizada) |                                                                          |
| `HU-20` | Capturar puntuación y comentario general       | Enteros 0-5, comentario obligatorio no vacío.                            |
| `HU-21` | Editar resultado de una visita realizada       | Solo resultado; identidad/plan/estado siguen bloqueados.                 |
| `HU-22` | Historial de visitas por asociación            | Distingue asesor actual vs. congelado por visita.                        |
| `HU-23` | Definir meta mensual por supervisora           | `/metas`, una fila por supervisora/**sede**/año/mes (RN-29).             |
| `HU-24` | Panel de metas individual y conjunta           | `/inicio`, usa las vistas por sede, más próximas/vencidas/reprogramadas. |
| `HU-25` | Pruebas automatizadas de reglas críticas       | 84 pruebas (Vitest + RTL): schemas, guard, metas, errores, auth, roles.  |

### Rol Jefe de Supervisión (RN-28..RN-32, posterior al MVP inicial)

| Entrega                               | Notas                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Enum `app_role` + `profiles.role`     | Migración `20260716120000_add_supervision_manager_role.sql`; default `SUPERVISOR` (las cuentas previas no cambian).      |
| Metas personales por sede             | `monthly_goals.region_id` + unicidad `(supervisor_id, region_id, year, month)`.                                          |
| Meta conjunta por sede                | Tabla `regional_monthly_goals`; solo el jefe escribe. Efectiva = configurada o sugerida.                                 |
| Vistas de progreso por sede           | `v_individual_monthly_progress` / `v_joint_monthly_progress` (`security_invoker`), reemplazan a `v_monthly_progress`.    |
| RLS por rol                           | `public.current_app_role()` como predicado único; 10 políticas reescritas + 4 nuevas. El jefe no escribe nada operativo. |
| Auditoría en base de datos            | `private.audit_logs` + trigger genérico en 5 tablas. Sin pantalla en la app (RN-32) y sin acceso `anon`/`authenticated`. |
| Rutas y menú por rol                  | `/` redirige según rol; `/inicio` (supervisora) y `/jefatura[/sedes/:regionId]` (jefe); `getNavItems(role)`.             |
| Panel de jefatura y detalle de sede   | `src/features/management/`; año/mes en query params, responsive, sin gráficos.                                           |
| Agenda y asociaciones de solo lectura | Para el jefe se ocultan botones, menús y la columna Acciones; el selector de supervisora excluye a jefatura.             |
| Verificación de RLS                   | `supabase/snippets/verify-rls-roles.sql`: 24 comprobaciones, incluida la no regresión del flujo de la supervisora.       |

## Requieren una acción manual/externa antes de darse por "terminadas" en producción

| HU      | Historia                            | Qué falta (fuera de este repositorio)                                                                                                                                                                                                                                                                   |
| ------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HU-05` | Crear cuentas de las 2 supervisoras | En local ya las crea `seed.sql` (más la del jefe). En producción: crear a mano en Supabase Auth + fila en `profiles` (ver [`deploy-vercel.md`](../development/deploy-vercel.md) §5). Para la cuenta de jefatura, además: `update public.profiles set role = 'SUPERVISION_MANAGER' where id = '<uuid>';` |
| `HU-07` | Importar asesores desde CSV         | Plantilla y procedimiento listos en [`data-import.md`](../development/data-import.md); falta el CSV real de ADRA y ejecutarlo contra producción.                                                                                                                                                        |
| `HU-09` | Importar asociaciones desde CSV     | Igual que `HU-07`. Además: confirmar con el dueño de producto si el nombre de asociación puede repetirse antes de crear el índice único (`database-design.md` §15.2).                                                                                                                                   |
| `HU-26` | Despliegue en Vercel                | `vercel.json` (fallback SPA) y guía completa en [`deploy-vercel.md`](../development/deploy-vercel.md) listos; el despliegue en sí requiere credenciales de Vercel/GitHub que esta sesión no tiene ni debe usar sin autorización explícita.                                                              |

## Fuera del MVP (a propósito, ver `out-of-scope.md`)

Según [`docs/product/out-of-scope.md`](../product/out-of-scope.md): sin acceso de asesores,
sin pantalla de auditoría, sin administración de usuarios desde la app, sin fotos/archivos,
sin modo offline, sin notificaciones, sin exportaciones, sin gráficos de evolución, sin
calendario visual, sin importación desde la interfaz, sin CRUD de asociaciones/asesores.

**La jefatura ya no está fuera de alcance**: se implementó como rol
`SUPERVISION_MANAGER` (ver la tabla de arriba y `business-rules.md` §9).

## Decisiones de negocio pendientes (heredadas de `database-design.md` §15)

Ninguna bloquea el MVP; están documentadas ahí y no se resolvieron unilateralmente en esta
sesión:

1. **RN-11** (¿una sola `ORDINARIA` por asociación y año?) — sigue como `[Supuesto]`, solo
   reforzado en el frontend (`scheduleGuard.ts`), no en la base de datos.
2. **Nombre de asociación único** — el índice único normalizado se crea después de limpiar
   el CSV real (riesgo 2), no antes.
3. **Asociación que pasa a no supervisable con una visita activa** — la base de datos lo
   permite a propósito; falta definir si la app debe advertir, ofrecer cancelar, o cancelar
   automáticamente.
4. **RN-04** (matriz de transiciones de estado de asociación) — sigue `[Pendiente]`; por
   defecto cualquier transición es válida.
