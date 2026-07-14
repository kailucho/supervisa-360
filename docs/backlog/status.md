# Estado del backlog — Supervisa 360

Resumen de qué historias de [`initial-backlog.md`](initial-backlog.md) están hechas, cuáles
necesitan una acción manual/externa antes de poder darse por completas del todo, y qué queda
fuera del MVP a propósito. No reemplaza el backlog original: es un snapshot de progreso.

## Completadas (código en este repositorio)

| HU      | Historia                                       | Notas                                                                            |
| ------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `HU-01` | Inicializar proyecto frontend                  | Vite + React + TS + MUI + Router + RHF + Zod + Vitest configurados.              |
| `HU-02` | Configurar proyecto Supabase                   | Cliente tipado, `env.ts`, `.env.example`.                                        |
| `HU-03` | Esquema base de datos                          | Migración inicial completa, RN-12 con índice único parcial probado.              |
| `HU-04` | RLS                                            | Habilitado en las 6 tablas, políticas y `GRANT` por columna.                     |
| `HU-06` | Pantalla de inicio de sesión                   | Login, sesión persistida, `onAuthStateChange`, rutas protegidas.                 |
| `HU-08` | Listado de asesores (solo lectura)             | `/asesores`, búsqueda por código/nombre.                                         |
| `HU-10` | Listado y búsqueda de asociaciones             | `/asociaciones`, búsqueda debounced + filtros región/estado.                     |
| `HU-11` | Detalle de asociación                          | `/asociaciones/:id`.                                                             |
| `HU-12` | Editar estado de asociación y reasignar asesor | Verificado que no altera visitas históricas (RN-17).                             |
| `HU-13` | Listado de agenda compartida                   | `/agenda`, ambas supervisoras.                                                   |
| `HU-14` | Filtros de agenda                              | Mes/año, supervisora, estado, región.                                            |
| `HU-15` | Programar visita                               | Bloquea asociaciones no supervisables (RN-01/02).                                |
| `HU-16` | Bloquear doble programación                    | Verificación previa + índice único parcial como respaldo ante carrera.           |
| `HU-17` | Advertencia de visita ya realizada en el año   | Bloquea solo `ORDINARIA` repetida; advierte en los demás tipos.                  |
| `HU-18` | Reprogramar y cancelar visita                  | Mismo registro, sin crear uno nuevo.                                             |
| `HU-19` | Registrar resultado (realizada / no realizada) |                                                                                  |
| `HU-20` | Capturar puntuación y comentario general       | Enteros 0-5, comentario obligatorio no vacío.                                    |
| `HU-21` | Editar resultado de una visita realizada       | Solo resultado; identidad/plan/estado siguen bloqueados.                         |
| `HU-22` | Historial de visitas por asociación            | Distingue asesor actual vs. congelado por visita.                                |
| `HU-23` | Definir meta mensual por supervisora           | `/metas`, una fila por supervisora/año/mes.                                      |
| `HU-24` | Panel de metas individual y conjunta           | `/`, usa `v_monthly_progress`, más próximas/vencidas/reprogramadas.              |
| `HU-25` | Pruebas automatizadas de reglas críticas       | 60 pruebas (Vitest + RTL): schemas, guard de programación, metas, errores, auth. |

## Requieren una acción manual/externa antes de darse por "terminadas" en producción

| HU      | Historia                            | Qué falta (fuera de este repositorio)                                                                                                                                                                                                      |
| ------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `HU-05` | Crear cuentas de las 2 supervisoras | En local ya las crea `seed.sql`. En producción: crear a mano en Supabase Auth + fila en `profiles` (ver [`deploy-vercel.md`](../development/deploy-vercel.md) §5).                                                                         |
| `HU-07` | Importar asesores desde CSV         | Plantilla y procedimiento listos en [`data-import.md`](../development/data-import.md); falta el CSV real de ADRA y ejecutarlo contra producción.                                                                                           |
| `HU-09` | Importar asociaciones desde CSV     | Igual que `HU-07`. Además: confirmar con el dueño de producto si el nombre de asociación puede repetirse antes de crear el índice único (`database-design.md` §15.2).                                                                      |
| `HU-26` | Despliegue en Vercel                | `vercel.json` (fallback SPA) y guía completa en [`deploy-vercel.md`](../development/deploy-vercel.md) listos; el despliegue en sí requiere credenciales de Vercel/GitHub que esta sesión no tiene ni debe usar sin autorización explícita. |

## Fuera del MVP (a propósito, ver `out-of-scope.md`)

Sin cambios respecto de [`docs/product/out-of-scope.md`](../product/out-of-scope.md): sin
jefatura, sin acceso de asesores, sin fotos/archivos, sin modo offline, sin notificaciones,
sin exportaciones, sin gráficos de evolución, sin calendario visual, sin importación desde la
interfaz, sin CRUD de asociaciones/asesores.

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
