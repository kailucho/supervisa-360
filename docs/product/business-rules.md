# Reglas de negocio — Supervisa 360

Convención: cada regla tiene un identificador `RN-XX`. Se marca cada regla como
**[Confirmado]** (definido explícitamente en el brief funcional o en las respuestas
del usuario), **[Supuesto]** (interpretación razonable no confirmada aún) o
**[Pendiente]** (requiere validación futura con el dueño del producto).

## 1. Estados de asociación

`NUEVA`, `NORMAL`, `MORA`, `DESERCION`, `REORGANIZACION`, `PROCESO_DISOLUCION`,
`DISUELTA`.

- **RN-01 [Confirmado]** — Son **supervisables** (pueden recibir visitas):
  `NUEVA`, `NORMAL`, `MORA`, `DESERCION`.
- **RN-02 [Confirmado]** — **No son supervisables** (no pueden recibir visitas):
  `REORGANIZACION`, `PROCESO_DISOLUCION`, `DISUELTA`. La app debe impedir programar
  una visita a una asociación en cualquiera de estos tres estados.
- **RN-03 [Confirmado]** — El estado de la asociación y el asesor asignado pueden
  editarse desde la aplicación (no solo por reimportación de CSV). Código de banca,
  nombre y región **no son editables** desde la app en el MVP; solo se actualizan
  mediante reimportación de CSV.
- **RN-04 [Pendiente]** — No se definió la matriz exacta de transiciones válidas
  entre estados (p. ej. si `DISUELTA` es un estado terminal, o si `DESERCION` puede
  volver a `NORMAL`). **Regla por defecto para el MVP:** cualquier estado puede
  cambiar a cualquier otro estado, sin restricción de transición, ya que solo hay
  dos usuarias (ambas supervisoras capacitadas) y no hay un flujo de aprobación en
  este MVP. Debe validarse con el dueño del producto antes de asumirse como
  definitivo.

## 2. Estados de visita

`PROGRAMADA`, `REPROGRAMADA`, `CANCELADA`, `REALIZADA`, `NO_REALIZADA`.

- **RN-05 [Confirmado]** — `PROGRAMADA` y `REPROGRAMADA` son estados **activos**.
  Solo puede existir una visita activa por asociación a la vez (ver sección 4).
- **RN-06 [Confirmado]** — `CANCELADA`, `REALIZADA` y `NO_REALIZADA` son estados
  **finales**; no cuentan como visita activa.
- **RN-07 [Confirmado]** — Reprogramar una visita **actualiza el mismo registro**:
  cambia la fecha/hora y el estado pasa a `REPROGRAMADA`. No se crea un registro
  nuevo. Una visita puede reprogramarse más de una vez; el registro conserva
  únicamente los datos vigentes (no un log de cada reprogramación en el MVP).
- **RN-08 [Supuesto]** — El paso a `NO_REALIZADA` es una acción **manual** de la
  supervisora (p. ej., llegó el día programado y la asociación no atendió). No existe
  un proceso automático que marque visitas vencidas como `NO_REALIZADA`, ya que el
  MVP no tiene backend propio ni tareas programadas.
- **RN-09 [Confirmado]** — No existen visitas parcialmente realizadas: una visita
  está `REALIZADA` o no lo está.

### Transiciones permitidas de estado de visita

| Desde          | Hacia                                                                   |
| -------------- | ----------------------------------------------------------------------- |
| `PROGRAMADA`   | `REPROGRAMADA`, `CANCELADA`, `REALIZADA`, `NO_REALIZADA`                |
| `REPROGRAMADA` | `REPROGRAMADA` (de nuevo), `CANCELADA`, `REALIZADA`, `NO_REALIZADA`     |
| `CANCELADA`    | _(final, sin transición)_                                               |
| `REALIZADA`    | _(final; el contenido del resultado puede editarse, pero no el estado)_ |
| `NO_REALIZADA` | _(final; puede reprogramarse creando una nueva visita si corresponde)_  |

## 3. Tipos de visita y repetibilidad

`ORDINARIA`, `SEGUIMIENTO`, `MORA`, `DESERCION`, `CIERRE`.

- **RN-10 [Confirmado]** — Una asociación puede recibir más de una visita en el
  mismo año cuando el tipo es `SEGUIMIENTO`, `MORA`, `DESERCION` o `CIERRE`, a
  criterio de la supervisora, sin plazo obligatorio entre visitas.
- **RN-11 [Supuesto]** — Una asociación solo puede recibir **una visita `ORDINARIA`
  por año**. Esto se infiere porque el brief solo habilita repetición explícita para
  los otros cuatro tipos. Debe confirmarse.

## 4. Prevención de duplicidad (regla crítica)

- **RN-12 [Confirmado]** — Una asociación no puede tener más de una visita activa
  (`PROGRAMADA` o `REPROGRAMADA`) al mismo tiempo. Esta es una regla crítica del
  negocio: debe implementarse en la aplicación y, más adelante, también en la base
  de datos (restricción a nivel de base de datos).
- **RN-13 [Confirmado]** — Si una supervisora intenta programar una asociación que
  ya tiene una visita activa, la aplicación debe impedir la acción y mostrar: qué
  supervisora la programó, la fecha programada y la hora (si existe).
- **RN-14 [Confirmado]** — Si la asociación ya fue visitada en el año (sin importar
  el tipo), la aplicación muestra una advertencia al intentar programar una nueva
  visita, pero **permite continuar** si el nuevo tipo es `SEGUIMIENTO`, `MORA`,
  `DESERCION` o `CIERRE` (ver RN-11 para `ORDINARIA`).

## 5. Modalidad y característica

`VIRTUAL` / `PRESENCIAL`; `ANUNCIADA` / `ANONIMA` / `SORPRESIVA`.

- **RN-15 [Confirmado]** — Todas las combinaciones de modalidad y característica son
  válidas, sin restricción (VIRTUAL o PRESENCIAL combinada libremente con ANUNCIADA,
  ANONIMA o SORPRESIVA).
- **RN-16 [Confirmado]** — No se registra ubicación GPS. Hora de inicio y hora de
  fin son opcionales e independientes entre sí.

## 6. Asesor responsable en la visita

- **RN-17 [Confirmado]** — El asesor responsable de una asociación puede cambiar
  durante el año. Cada visita conserva el asesor que era responsable **en el
  momento en que se programó la visita** (snapshot tomado al crear/programar el
  registro de visita), independientemente de que la asociación cambie luego de
  asesor.
- **RN-18 [Riesgo aceptado]** — Si el asesor de la asociación cambia **entre la
  fecha de programación y la fecha real de la visita**, el registro de la visita
  seguirá mostrando el asesor vigente al momento de programar, no al momento real
  de la visita. Esto es una decisión explícita del usuario (no un supuesto) y debe
  comunicarse a las supervisoras como comportamiento esperado.

## 7. Registro del resultado

- **RN-19 [Confirmado]** — La puntuación general es un **número entero de 0 a 5**
  (sin decimales, sin escalas alternas).
- **RN-20 [Confirmado]** — Cada visita tiene una sola puntuación general y un solo
  comentario general (texto libre). No existen puntuaciones ni observaciones por
  aspecto en esta aplicación.
- **RN-21 [Confirmado]** — La puntuación y el comentario general solo son
  obligatorios cuando el estado de la visita es `REALIZADA`. No aplican a
  `NO_REALIZADA` ni `CANCELADA`.
- **RN-22 [Supuesto]** — Una visita `REALIZADA` puede editarse posteriormente
  (corregir puntuación/comentario) por cualquiera de las dos supervisoras, ya que
  ambas tienen visibilidad y permisos completos. No hay un log de auditoría de
  cambios en el MVP.

## 8. Metas

- **RN-23 [Confirmado]** — Cada supervisora tiene una meta mensual individual
  (referencia inicial: 15 visitas/mes), configurable mes a mes.
- **RN-24 [Confirmado]** — La meta conjunta del mes es la suma de las metas
  individuales vigentes ese mes.
- **RN-25 [Confirmado]** — Una visita cuenta para la meta (individual de quien la
  hizo, y conjunta) **solo cuando su estado es `REALIZADA`**.
- **RN-26 [Confirmado]** — Visitas `ORDINARIA` y de seguimiento (`SEGUIMIENTO`,
  `MORA`, `DESERCION`, `CIERRE`) cuentan igual para la meta. `VIRTUAL` y
  `PRESENCIAL` cuentan de la misma manera. No existen visitas parciales ni
  ponderaciones distintas por tipo o modalidad.
- **RN-27 [Confirmado]** — No se requiere mostrar un indicador de "asociaciones
  únicas visitadas"; la meta se mide en cantidad de visitas realizadas, sin
  deduplicar por asociación.
