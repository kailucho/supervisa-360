# Diseño de base de datos — Supervisa 360

Diseño **físico** de la base de datos del MVP sobre PostgreSQL/Supabase. Los
identificadores `RN-XX` remiten a [business-rules.md](../product/business-rules.md) y
los `HU-XX` a [initial-backlog.md](../backlog/initial-backlog.md).

Los fragmentos de SQL de este documento son **bocetos ilustrativos**, no la migración.
La migración real se escribe en una etapa posterior (HU-03) a partir de este diseño.

El esquema tiene **seis tablas principales**: `profiles`, `regions`, `advisors`,
`associations`, `visits` y `monthly_goals`.

## 1. Decisiones transversales

- **Claves primarias:** `uuid` con `gen_random_uuid()` en todas las tablas, salvo
  `profiles`, cuyo `id` es el `id` del usuario en Supabase Auth (relación 1 a 1).
- **Fechas de calendario:** `scheduled_date` y `performed_date` son `date`, y las horas
  son `time` **sin zona**. No se usa `timestamptz` para ellas: son fechas de calendario
  local y `timestamptz` desplazaría "12 de marzo" al 11 o al 13 según la zona del
  navegador o del servidor. Solo los campos de auditoría (`created_at`, `updated_at`)
  son `timestamptz`.
- **Catálogos cerrados:** se implementan como **enums nativos de PostgreSQL** solo cuando
  el conjunto de valores está realmente cerrado por el negocio (sección 2). La región
  **no** es uno de ellos: es una tabla (`regions`), porque la aplicación puede extenderse
  a otras sedes.
- **Timestamps:** las seis tablas tienen `created_at` y `updated_at`
  (`timestamptz NOT NULL DEFAULT now()`).
  - En **cinco tablas** (`profiles`, `regions`, `advisors`, `associations`,
    `monthly_goals`), `updated_at` lo mantiene la función compartida `set_updated_at()`
    en un trigger `BEFORE UPDATE`.
  - En **`visits` no se usa esa función**: `updated_at` se asigna dentro de su trigger
    especializado (sección 5). Dos triggers `BEFORE UPDATE` sobre la misma tabla se
    ejecutan en orden alfabético de nombre, y hacer depender la corrección del diseño de
    cómo se llamen los triggers es una trampa silenciosa. En `visits` hay **un solo
    trigger** `BEFORE UPDATE` que valida y, si todo es válido, asigna `updated_at`.
- **Sin borrado físico:** ninguna tabla concede `DELETE` al rol `authenticated`, y todas
  las FK son `ON DELETE RESTRICT` (sección 4). El MVP cancela visitas, cambia estados y
  desactiva filas; no elimina registros.
- **Sin log de cambios general** (RN-22): el MVP no lleva `created_by`/`updated_by` en
  ninguna tabla ni una tabla de auditoría genérica. La única excepción, deliberadamente
  acotada, es `visits.performed_by`/`visits.result_updated_at` (sección 3): no llevan un
  historial de ediciones, solo la autoría y el momento de la **última** edición del
  resultado — la trazabilidad mínima que RN-22 necesita, sin convertirse en un log de
  cambios.

## 2. Enumeraciones

Solo se usan enums nativos para los cinco catálogos que el negocio define como cerrados:

| Enum                   | Valores                                                                                    | Regla        |
| ---------------------- | ------------------------------------------------------------------------------------------ | ------------ |
| `association_status`   | `NUEVA`, `NORMAL`, `MORA`, `DESERCION`, `REORGANIZACION`, `PROCESO_DISOLUCION`, `DISUELTA` | RN-01, RN-02 |
| `visit_type`           | `ORDINARIA`, `SEGUIMIENTO`, `MORA`, `DESERCION`, `CIERRE`                                  | RN-10, RN-11 |
| `visit_modality`       | `VIRTUAL`, `PRESENCIAL`                                                                    | RN-15        |
| `visit_characteristic` | `ANUNCIADA`, `ANONIMA`, `SORPRESIVA`                                                       | RN-15        |
| `visit_status`         | `PROGRAMADA`, `REPROGRAMADA`, `CANCELADA`, `REALIZADA`, `NO_REALIZADA`                     | RN-05, RN-06 |

**La región no es un enum**: es la tabla `regions` (sección 3). Añadir una sede nueva debe
ser un `INSERT`, no una migración de tipo.

## 3. Tablas

### `profiles`

Una fila por usuaria/o de la aplicación (supervisoras y jefatura). Su `id` es el `id` de
Supabase Auth.

| Columna      | Tipo                                     | Notas                                          |
| ------------ | ---------------------------------------- | ---------------------------------------------- |
| `id`         | `uuid` PK                                | `REFERENCES auth.users(id) ON DELETE RESTRICT` |
| `full_name`  | `text NOT NULL`                          | `CHECK (length(btrim(full_name)) > 0)`         |
| `is_active`  | `boolean NOT NULL DEFAULT true`          | ver "Ciclo de vida de una supervisora"         |
| `role`       | `app_role NOT NULL DEFAULT 'SUPERVISOR'` | `SUPERVISOR` \| `SUPERVISION_MANAGER` (RN-28)  |
| `created_at` | `timestamptz NOT NULL DEFAULT now()`     |                                                |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()`     |                                                |

Las filas se crean manualmente junto con las cuentas de Auth (HU-05). Todas las
supervisoras son equivalentes entre sí; el rol solo distingue supervisoras de la
jefatura (ver "Rol de jefatura, metas por sede y auditoría" al final de este
documento).

#### Ciclo de vida de una supervisora

Una supervisora con historial **nunca se elimina**. Si deja el puesto:

1. Se marca `profiles.is_active = false`. La app deja de ofrecerla en filtros y selectores,
   y no se le crean metas nuevas.
2. Se **bloquea su acceso desde Supabase Auth** (banear/deshabilitar el usuario).
   `is_active` **no bloquea el login por sí solo**: es el reflejo del estado en la
   aplicación, no un control de autenticación. La revocación real del acceso ocurre en Auth.
3. **No se borra su fila de `profiles` ni su usuario de `auth.users`.** Sus visitas y sus
   metas históricas se conservan íntegras.

Si una supervisora se **reactiva** (o se da de alta por primera vez) a mitad de mes, no
espera al próximo ciclo de `pg_cron`: el trigger `profiles_after_activate` (sección 11) le
crea de inmediato la meta del mes en curso.

Ver la sección 4 para la política de borrado que hace de esto una garantía del esquema.

### `regions`

Sedes donde opera ADRA. Sustituye al antiguo enum `region` porque la aplicación puede
extenderse a otras sedes, y añadir una sede no debe requerir una migración de tipo.

| Columna      | Tipo                                 | Notas                                                  |
| ------------ | ------------------------------------ | ------------------------------------------------------ |
| `id`         | `uuid` PK                            |                                                        |
| `code`       | `text NOT NULL UNIQUE`               | `AREQUIPA`, `TACNA`. `CHECK (length(btrim(code)) > 0)` |
| `name`       | `text NOT NULL`                      | nombre para mostrar. `CHECK (length(btrim(name)) > 0)` |
| `is_active`  | `boolean NOT NULL DEFAULT true`      | una sede cerrada se desactiva, no se borra             |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` |                                                        |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` |                                                        |

Se carga con dos filas (`AREQUIPA`, `TACNA`) en la importación inicial (sección 10). No se
administra desde la app.

### `advisors`

| Columna      | Tipo                                 | Notas                                                                            |
| ------------ | ------------------------------------ | -------------------------------------------------------------------------------- |
| `id`         | `uuid` PK                            |                                                                                  |
| `code`       | `text NOT NULL UNIQUE`               | normalizado (trim + mayúsculas) al importar. `CHECK (length(btrim(code)) > 0)`   |
| `full_name`  | `text NOT NULL`                      | `CHECK (length(btrim(full_name)) > 0)`                                           |
| `is_active`  | `boolean NOT NULL DEFAULT true`      | permite retirar un asesor del selector sin romper las visitas que lo referencian |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` |                                                                                  |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` |                                                                                  |

### `associations`

| Columna      | Tipo                                                       | Notas                                                                                                     |
| ------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `id`         | `uuid` PK                                                  |                                                                                                           |
| `bank_code`  | `text NOT NULL UNIQUE`                                     | `CHECK (bank_code ~ '^[0-9]{5}$')`. Texto, no entero: preserva ceros a la izquierda                       |
| `name`       | `text NOT NULL`                                            | `CHECK (length(btrim(name)) > 0)`. Único, pero el índice se crea **después** de limpiar el CSV (riesgo 2) |
| `region_id`  | `uuid NOT NULL REFERENCES regions(id) ON DELETE RESTRICT`  | sustituye al antiguo enum `region`                                                                        |
| `status`     | `association_status NOT NULL DEFAULT 'NUEVA'`              | editable desde la app (RN-03)                                                                             |
| `advisor_id` | `uuid NOT NULL REFERENCES advisors(id) ON DELETE RESTRICT` | asesor **actual**; editable desde la app (RN-03)                                                          |
| `created_at` | `timestamptz NOT NULL DEFAULT now()`                       |                                                                                                           |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()`                       |                                                                                                           |

La identidad técnica de la asociación es `bank_code`, no `name`.

### `visits`

| Columna                | Tipo                                                           | Notas                                                                                         |
| ---------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `id`                   | `uuid` PK                                                      |                                                                                               |
| `association_id`       | `uuid NOT NULL REFERENCES associations(id) ON DELETE RESTRICT` | **inmutable** tras el `INSERT`                                                                |
| `supervisor_id`        | `uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT`     | **inmutable** tras el `INSERT`                                                                |
| `scheduled_advisor_id` | `uuid NOT NULL REFERENCES advisors(id) ON DELETE RESTRICT`     | **snapshot** del asesor (RN-17); lo fija el trigger, no el cliente                            |
| `visit_type`           | `visit_type NOT NULL`                                          | corregible mientras la visita está activa                                                     |
| `modality`             | `visit_modality NOT NULL`                                      | corregible mientras la visita está activa                                                     |
| `characteristic`       | `visit_characteristic NOT NULL`                                | corregible mientras la visita está activa                                                     |
| `scheduled_date`       | `date NOT NULL`                                                | se modifica al reprogramar (RN-07)                                                            |
| `scheduled_time`       | `time NULL`                                                    | opcional                                                                                      |
| `status`               | `visit_status NOT NULL DEFAULT 'PROGRAMADA'`                   | **toda visita nace `PROGRAMADA`** (sección 5)                                                 |
| `performed_date`       | `date NULL`                                                    | solo si `REALIZADA`; obligatoria en ese estado (RN-21)                                        |
| `start_time`           | `time NULL`                                                    | opcional, pero **solo puede tener valor si `REALIZADA`** (RN-16)                              |
| `end_time`             | `time NULL`                                                    | opcional, pero **solo puede tener valor si `REALIZADA`** (RN-16)                              |
| `score`                | `smallint NULL`                                                | solo si `REALIZADA`; `CHECK (score BETWEEN 0 AND 5)` (RN-19)                                  |
| `general_comment`      | `text NULL`                                                    | solo si `REALIZADA`; obligatorio y no vacío en ese estado (RN-21)                             |
| `performed_by`         | `uuid NULL REFERENCES profiles(id) ON DELETE RESTRICT`         | quién hizo la **última** edición del resultado; lo fija el trigger (sección 5), no el cliente |
| `result_updated_at`    | `timestamptz NULL`                                             | cuándo se hizo esa última edición; lo fija el trigger (sección 5)                             |
| `created_at`           | `timestamptz NOT NULL DEFAULT now()`                           |                                                                                               |
| `updated_at`           | `timestamptz NOT NULL DEFAULT now()`                           | lo asigna el trigger especializado, no `set_updated_at()`                                     |

El nombre `scheduled_advisor_id` (y no `advisor_id`) es intencional: hace evidente en cada
consulta que **no** es el asesor actual de la asociación, sino el congelado al programar.
Es la defensa más barata contra un `JOIN` por el asesor equivocado.

`supervisor_id` es inmutable porque **quien programa la visita es quien la realiza**: no
existe el caso de una supervisora que cierre la visita de la otra, y por tanto la
atribución de la meta (RN-25) es directa y no ambigua. Una supervisora sí puede **editar**
el resultado de una visita ajena (RN-22), pero no puede reasignársela.

`association_id` es inmutable porque una visita **es** la visita a una asociación concreta:
cambiarla de asociación convertiría el registro en otro distinto, alteraría el historial de
dos asociaciones a la vez y podría burlar el índice de visita activa única (sección 6). Si
la asociación estaba equivocada, se cancela la visita y se programa otra.

`start_time` y `end_time` son las horas **reales** de la visita, no de la planificación: por
eso solo existen cuando la visita está `REALIZADA`. La hora prevista es `scheduled_time`.

`performed_by` y `result_updated_at` dan la trazabilidad mínima que pedía el riesgo 3
(sección 12, ahora resuelto): quién hizo la **última** edición del resultado de la visita y
cuándo, sin llevar un historial completo de cambios. Se descartó una tabla
`visit_result_history` (una fila por edición, con `visit_id`, `edited_by`, `edited_at` y los
valores anteriores) porque el propio diseño excluye a propósito un log de cambios general
(sección 1); dos columnas en `visits` dan visibilidad de autoría sin abrir esa puerta. El
precio es que solo se conserva la **última** edición, no todas: si algún día se necesita el
historial completo de ediciones, la tabla de historial sigue siendo la vía natural, pero no
es lo que RN-22 exige hoy.

Ambas columnas son `NULL` mientras la visita no tiene resultado, y las fija el trigger
`BEFORE UPDATE` (sección 5) cada vez que cambia alguna columna de resultado (`score`,
`general_comment`, `start_time`, `end_time`, `performed_date`), igual que ese mismo trigger
fija `updated_at`. El cliente no puede escribirlas directamente: no tienen `GRANT UPDATE`
(sección 9).

### `monthly_goals`

| Columna         | Tipo                                                       | Notas                                |
| --------------- | ---------------------------------------------------------- | ------------------------------------ |
| `id`            | `uuid` PK                                                  |                                      |
| `supervisor_id` | `uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT` |                                      |
| `region_id`     | `uuid NOT NULL REFERENCES regions(id) ON DELETE RESTRICT`  | sede de la meta (RN-29)              |
| `year`          | `smallint NOT NULL`                                        | `CHECK (year BETWEEN 2025 AND 2100)` |
| `month`         | `smallint NOT NULL`                                        | `CHECK (month BETWEEN 1 AND 12)`     |
| `target_visits` | `smallint NOT NULL`                                        | `CHECK (target_visits >= 0)` (RN-23) |
| `created_at`    | `timestamptz NOT NULL DEFAULT now()`                       |                                      |
| `updated_at`    | `timestamptz NOT NULL DEFAULT now()`                       |                                      |
|                 | `UNIQUE (supervisor_id, region_id, year, month)`           | una meta por supervisora, sede y mes |

**La meta es por sede** (RN-29): una supervisora puede trabajar en varias sedes y tener
una meta distinta en cada una el mismo mes. La unicidad incluye `region_id`.

**`target_visits` admite cero.** Un mes de vacaciones, licencia o cambio de puesto es una
meta legítima de 0 visitas, y forzar un mínimo de 1 obligaría a inventar un dato falso o a
no crear la fila. Lo que el `CHECK` prohíbe es un valor **negativo**, que nunca tiene
sentido. A diferencia de la vista original, las vistas actuales
(`v_individual_monthly_progress`) construyen sus claves con la **unión** de metas y
visitas, así que una visita realizada aparece en el reporte aunque no exista fila de meta
para esa supervisora y sede.

La **meta conjunta sí se almacena ahora**, por sede, en `regional_monthly_goals`
(RN-30): la suma de metas personales es la _meta sugerida_ y la fila del jefe, si existe,
es la _meta definida_; la efectiva es `COALESCE(definida, sugerida)`.

## 4. Relaciones y política de borrado

- `regions` 1 —— N `associations`.
- `advisors` 1 —— N `associations` (asesor actual).
- `advisors` 1 —— N `visits` (asesor congelado al programar, independiente del asesor actual
  de la asociación — RN-17).
- `associations` 1 —— N `visits`.
- `profiles` 1 —— N `visits` (supervisora que programó y realizará la visita).
- `profiles` 1 —— N `monthly_goals`.
- `auth.users` 1 —— 1 `profiles`.

**Todas las claves foráneas del esquema son `ON DELETE RESTRICT`**, incluida la de `profiles`
hacia `auth.users` y la de `monthly_goals` hacia `profiles`. No hay ni una sola cascada.

Conviene ser preciso sobre lo que eso significa. Un `DELETE` en PostgreSQL ocurre **dentro de
una transacción**: si una FK `RESTRICT` impide la operación, **la sentencia completa falla y se
revierte**. Nunca queda un borrado parcial confirmado, ni con `CASCADE` ni con `RESTRICT`. El
motivo para usar `RESTRICT` de forma uniforme no es evitar un borrado a medias — eso no puede
ocurrir — sino:

- **hacer explícita la política de conservación histórica**: el esquema declara que estos datos
  no se borran, en lugar de dejarlo escrito solo en un documento;
- **evitar borrados inesperados**: con `CASCADE`, eliminar un usuario de Auth arrastraría en
  silencio su perfil y sus metas; con `RESTRICT`, la operación falla y obliga a detenerse a
  pensar;
- **simplificar el modelo**: una sola regla para todo el esquema, sin excepciones que recordar;
- **obligar a desactivar en vez de eliminar**: `is_active` es el mecanismo previsto (sección 3).

## 5. Restricciones CHECK y triggers

### Completitud del resultado (RN-16, RN-19, RN-21)

```sql
-- boceto, no migración
CONSTRAINT visits_result_completeness CHECK (
  (status = 'REALIZADA'
     AND performed_date IS NOT NULL
     AND score IS NOT NULL
     AND length(btrim(coalesce(general_comment, ''))) > 0)
  OR
  (status <> 'REALIZADA'
     AND performed_date IS NULL
     AND start_time IS NULL
     AND end_time IS NULL
     AND score IS NULL
     AND general_comment IS NULL)
)
```

- Si `status = 'REALIZADA'`: `performed_date`, `score` y `general_comment` (no vacío) son
  **obligatorios**; `start_time` y `end_time` siguen siendo **opcionales** e independientes
  entre sí (RN-16).
- Si `status <> 'REALIZADA'`: `performed_date`, `start_time`, `end_time`, `score` y
  `general_comment` deben ser **`NULL`**.

La rama negativa incluye ahora las horas reales, y no es un detalle cosmético: sin ella, una
visita `CANCELADA` podría conservar un `start_time` de un intento anterior y una visita
`NO_REALIZADA` podría afirmar que empezó a las 09:00, que es exactamente lo que su estado
niega. Las horas reales son datos de resultado, igual que la puntuación.

La puntuación se mantiene entre 0 y 5 con su propio `CHECK` (RN-19).

### Coherencia de horas

```sql
-- boceto, no migración
CHECK (start_time IS NULL OR end_time IS NULL OR end_time >= start_time)
```

### Trigger `BEFORE INSERT` sobre `visits` (uno solo)

Un **único** trigger `BEFORE INSERT` hace tres cosas, en este orden:

1. **Rechaza cualquier estado inicial distinto de `PROGRAMADA`.** Toda visita nace
   `PROGRAMADA` (sección "Toda visita nace PROGRAMADA", abajo).
2. **Rechaza la asociación no supervisable** (RN-01, RN-02): consulta el `status` de la
   asociación y falla si es `REORGANIZACION`, `PROCESO_DISOLUCION` o `DISUELTA`.
3. **Fija el snapshot del asesor** (RN-17, sección 7), sobrescribiendo siempre lo que haya
   enviado el cliente.

Agruparlos en una sola función evita depender del orden alfabético de varios triggers del
mismo evento.

#### Toda visita nace `PROGRAMADA`

Una visita nueva **solo puede insertarse con estado `PROGRAMADA`**. Sin esta regla, un cliente
podría crear directamente una visita `REALIZADA` (inventando una visita que nunca se planificó
ni se hizo, y que contaría para la meta) o una visita `CANCELADA`/`NO_REALIZADA` (que nacería
ya cerrada, sin haber existido nunca como visita activa), y `REPROGRAMADA` sobre una visita
recién creada no significa nada.

Se protege en tres niveles:

1. **Columna:** `status visit_status NOT NULL DEFAULT 'PROGRAMADA'`.
2. **Permiso:** `authenticated` **no tiene `INSERT` sobre la columna `status`** (sección 9), así
   que ni siquiera puede enviarla; el `DEFAULT` se aplica siempre.
3. **Trigger:** el `BEFORE INSERT` **rechaza con una excepción** si `NEW.status <> 'PROGRAMADA'`.

```sql
-- boceto, no migración
IF NEW.status <> 'PROGRAMADA' THEN
  RAISE EXCEPTION 'Una visita nueva solo puede crearse con estado PROGRAMADA (recibido: %)',
    NEW.status;
END IF;
```

Se **rechaza** en lugar de sobrescribir en silencio: si el frontend alguna vez envía un estado
inválido, eso es un error del frontend y debe verse, no repararse a escondidas. La capa 3 parece
redundante frente a la capa 2, pero cubre el camino administrativo (`service_role` o SQL directo,
sección 9), que ignora los `GRANT` de columna pero **no** los triggers.

### Trigger `BEFORE UPDATE` sobre `visits` (uno solo)

También un **único** trigger, que valida y, si todo es correcto, asigna `NEW.updated_at := now()`
y, además, `NEW.performed_by := auth.uid()` y `NEW.result_updated_at := now()` **si** cambia alguna
columna de resultado, y retorna `NEW`. `visits` **no usa** `set_updated_at()` (sección 1).

```sql
-- boceto, no migración
IF NEW.score IS DISTINCT FROM OLD.score
   OR NEW.general_comment IS DISTINCT FROM OLD.general_comment
   OR NEW.start_time IS DISTINCT FROM OLD.start_time
   OR NEW.end_time IS DISTINCT FROM OLD.end_time
   OR NEW.performed_date IS DISTINCT FROM OLD.performed_date
THEN
  NEW.performed_by := auth.uid();
  NEW.result_updated_at := now();
END IF;
```

Ese `IF` cubre tanto la sentencia que **cierra** la visita (cambia `status` a `REALIZADA` y llena
el resultado por primera vez) como cualquier corrección posterior (RN-22): en los dos casos cambia
alguna columna de resultado. El cliente nunca envía `performed_by` ni `result_updated_at` — no
tienen `GRANT UPDATE` (sección 9) —, así que llegan a `NEW` como el valor de `OLD` hasta que el
trigger las reasigna.

El propio trigger es quien fija `updated_at`, `performed_by` y `result_updated_at`, así que **nunca
puede rechazar una actualización por culpa de esos cambios**: esas tres columnas quedan fuera de
todas las comparaciones de inmutabilidad.

Valida, en este orden:

**a) Identidad — inmutable en cualquier estado**, incluso con la visita activa:

- `association_id` — una visita no puede cambiar de asociación.
- `supervisor_id` — quien programa es quien realiza.
- `scheduled_advisor_id` — el snapshot de RN-17 es inmutable por definición.

**b) Transiciones de estado** (RN-05 a RN-09): si `OLD.status` ya es final (`CANCELADA`,
`REALIZADA`, `NO_REALIZADA`), `status` no puede cambiar a ningún otro valor.

**c) Columnas editables según el estado anterior** — la matriz que sigue.

### Matriz de columnas editables por estado

`OLD.status` determina qué puede cambiar. Un `UPDATE` es válido si —y solo si— todas las columnas
que modifica están permitidas para el estado anterior de la fila.

| Columna                                                                | `PROGRAMADA` / `REPROGRAMADA` (activa) | `REALIZADA`             | `CANCELADA` / `NO_REALIZADA` |
| ---------------------------------------------------------------------- | -------------------------------------- | ----------------------- | ---------------------------- |
| `association_id`, `supervisor_id`, `scheduled_advisor_id`              | ✗ (identidad)                          | ✗                       | ✗                            |
| `scheduled_date`, `scheduled_time`                                     | ✓ (reprogramar — RN-07)                | ✗                       | ✗                            |
| `visit_type`, `modality`, `characteristic`                             | ✓ (corregir)                           | ✗                       | ✗                            |
| `status`                                                               | ✓ (a cualquier estado válido)          | ✗ (final)               | ✗ (final)                    |
| `performed_date`, `start_time`, `end_time`, `score`, `general_comment` | ✗ (el `CHECK` los exige `NULL`)        | ✓ (RN-22)               | ✗ (`NULL` por `CHECK`)       |
| `performed_by`, `result_updated_at`                                    | ✗ (los fija el trigger)                | ✗ (los fija el trigger) | ✗ (los fija el trigger)      |

Lecturas de la matriz:

- **Visita activa:** se reprograma (fecha y hora) y se corrigen tipo, modalidad y característica.
  Las columnas de resultado no se tocan aquí: se rellenan **en la misma sentencia** que cambia
  `status` a `REALIZADA` (ese `UPDATE` parte de un estado activo, así que la matriz lo permite, y
  el `CHECK` de completitud garantiza que llegue completo).
- **Visita `REALIZADA`:** solo se corrige el resultado (RN-22). El plan queda como constancia
  histórica de lo que se había planificado.
- **Visita `CANCELADA` o `NO_REALIZADA`:** **completamente congelada**. Sus columnas de resultado
  y sus horas ya son `NULL` por el `CHECK` de completitud, y todo lo demás está bloqueado por la
  matriz: no queda nada editable. Una visita cancelada es un hecho del pasado, no un borrador.
- **`performed_by` y `result_updated_at`:** el cliente nunca las escribe directamente (fila
  siempre ✗); las fija el propio trigger cuando cambia alguna columna de resultado, igual que
  hace con `updated_at`.

Los `GRANT` de columna de la sección 9 son coherentes con esta matriz: las tres columnas de
identidad no tienen `UPDATE` concedido a `authenticated` en ningún caso, así que están protegidas
por permisos **y** por trigger.

### Asociación supervisable (RN-01, RN-02)

Validada en el `BEFORE INSERT` (arriba). **No se aplica en el `UPDATE` de `associations`**: una
asociación puede pasar a un estado no supervisable teniendo una visita activa, y la base de datos
**no lo impide a propósito**. Un trigger que rechazara ese cambio estaría bloqueando un hecho real
del negocio (la asociación se disolvió) por culpa de un dato de planificación. Lo correcto es que
la aplicación **advierta** y ofrezca cancelar la visita activa; el detalle de ese aviso es una
decisión de negocio pendiente (sección 15).

### RN-11 (una visita `ORDINARIA` por año): no se implementa en la base de datos

RN-11 sigue marcada como **[Supuesto]** en las reglas de negocio. Un índice único es lo más caro de
revertir si el supuesto resulta falso, así que la validación vive **solo en el frontend** (HU-17)
hasta que el dueño de producto la confirme (sección 15).

## 6. Regla crítica: una sola visita activa por asociación (RN-12)

```sql
-- boceto, no migración
CREATE UNIQUE INDEX visits_one_active_per_association
  ON visits (association_id)
  WHERE status IN ('PROGRAMADA', 'REPROGRAMADA');
```

Debe ser un **índice único parcial**, no un `UNIQUE CONSTRAINT`: las constraints no admiten
cláusula `WHERE`.

- Es la única defensa real ante concurrencia. La verificación previa del frontend ("¿ya hay una
  visita activa?") tiene una ventana de carrera entre el `SELECT` y el `INSERT`; el índice no.
- Cancelar una visita la saca del predicado del índice y libera la asociación automáticamente, sin
  borrar nada. Reprogramar (RN-07) actualiza la misma fila, que sigue dentro del predicado, sin
  conflicto consigo misma.
- La inmutabilidad de `association_id` (sección 5) protege este índice: sin ella se podría mover una
  visita activa a otra asociación que ya tuviera la suya.

### Cómo debe tratar el frontend la violación (RN-13)

PostgreSQL genera el código de error **`23505`** (violación de unicidad). Eso es estable y está
garantizado por el estándar.

Lo que **no** conviene dar por garantizado es que la respuesta de PostgREST traiga siempre una
propiedad estructurada llamada exactamente `constraint`: el formato del error depende de la versión
de PostgREST y del cliente, y el nombre del índice puede llegar dentro de `message` o de `details` en
lugar de en un campo propio. Construir la lógica de RN-13 sobre esa suposición es frágil.

Estrategia robusta para el frontend:

1. Comprobar `error.code === '23505'`.
2. Si el nombre del índice está disponible (en `constraint`, `message` o `details`), comprobar que sea
   `visits_one_active_per_association`.
3. Si el nombre **no** está disponible, no adivinar: consultar la visita activa de esa asociación.
4. Mostrar el mensaje de duplicidad de RN-13 (qué supervisora la programó, fecha y hora) **solo si esa
   consulta confirma** que ya existe una visita activa. Si no la confirma, se trata de otra violación de
   unicidad y debe mostrarse un error genérico.

El paso 3 es obligatorio de todos modos: los datos de RN-13 (quién y cuándo) **no vienen en el error de
PostgreSQL**, hay que consultarlos. El nombre `visits_one_active_per_association` sigue siendo estable y
no debe renombrarse a la ligera, pero deja de ser el **único** punto del que depende el manejo del error.

## 7. Conservación del asesor responsable (RN-17, RN-18)

`visits.scheduled_advisor_id` es una FK independiente que se copia desde `associations.advisor_id` en el
momento del `INSERT` y **nunca se actualiza**. Reasignar el asesor de una asociación (HU-12) toca
`associations.advisor_id` y no propaga nada a `visits`, que es exactamente lo que exige RN-17.

**La base de datos es la fuente de verdad del snapshot.** Lo fija el trigger `BEFORE INSERT` (sección 5),
no el cliente:

```sql
-- boceto, no migración
NEW.scheduled_advisor_id := (
  SELECT advisor_id
  FROM associations
  WHERE id = NEW.association_id
);
```

El trigger **ignora y sobrescribe siempre** cualquier valor que haya enviado el cliente. Si el frontend
fijara el snapshot, existiría una ventana en la que envía un asesor desactualizado (leyó la asociación
hace cinco minutos; la otra supervisora reasignó el asesor hace dos), y además podría elegir
arbitrariamente un asesor que no es el de la asociación.

### Tipos TypeScript generados por Supabase

`scheduled_advisor_id` es `NOT NULL` y **no tiene `DEFAULT`**: lo rellena el trigger. El generador de tipos
de Supabase no puede saberlo, así que lo marcará como campo **obligatorio** en el tipo `Insert` de `visits`
y el frontend se verá obligado a enviar algo.

Solución para el MVP: **que lo envíe.** `authenticated` sí tiene `INSERT` sobre esa columna (sección 9) —a
diferencia de `status`, que no lo tiene—, el cliente manda el `advisor_id` que leyó de la asociación, y el
trigger lo descarta y pone el correcto. El valor enviado es irrelevante: solo satisface al tipo generado,
y la base de datos sigue siendo la única autoridad sobre el snapshot.

Es una asimetría deliberada respecto de `status`: `status` **no se puede** enviar (tiene `DEFAULT`, así que
el tipo generado lo marca opcional y no hay fricción al revocarlo), mientras que `scheduled_advisor_id`
**hay que** enviarlo porque el tipo generado lo exige. Revocar también su `INSERT` obligaría a pelearse con
el tipo generado en cada llamada, sin ganar ninguna garantía que el trigger no dé ya.

Una función RPC (`schedule_visit(...)`) que reciba solo los datos reales eliminaría el campo fantasma, pero
es una **mejora futura**, no un requisito del MVP.

## 8. Índices

| Índice                                                                  | Para qué                                           |
| ----------------------------------------------------------------------- | -------------------------------------------------- |
| `visits (association_id) WHERE status IN ('PROGRAMADA','REPROGRAMADA')` | RN-12 (único parcial, sección 6)                   |
| `visits (scheduled_date)`                                               | agenda ordenada por fecha (HU-13)                  |
| `visits (status, scheduled_date)`                                       | filtros de agenda y "pendientes de cerrar" (HU-14) |
| `visits (association_id, scheduled_date DESC)`                          | historial por asociación (HU-22) y soporte del FK  |
| `visits (supervisor_id, status, performed_date)`                        | conteo de metas por supervisora y mes (RN-25)      |
| `visits (scheduled_advisor_id)`                                         | soporte del FK                                     |
| `associations (region_id)`                                              | filtro por región (HU-10, HU-14) y soporte del FK  |
| `associations (status)`                                                 | filtro por estado (HU-10, HU-14)                   |
| `associations (advisor_id)`                                             | soporte del FK                                     |
| `associations (bank_code)` · `advisors (code)` · `regions (code)`       | únicos (creados por la restricción `UNIQUE`)       |
| `monthly_goals (supervisor_id, year, month)`                            | único; cubre las consultas del panel               |

No hay índices redundantes: `visits (association_id, scheduled_date DESC)` ya da soporte al FK
`association_id`, y `associations (region_id)` sirve a la vez de filtro y de soporte del FK.

El índice único normalizado de `associations.name` se crea **después** de la limpieza del CSV (riesgo 2).

### Sin `pg_trgm` en el MVP

La búsqueda por nombre (HU-10) se resuelve con `ILIKE '%texto%'` y un seq-scan. Con ~330 asociaciones eso
es instantáneo, y crear la extensión `pg_trgm` más un índice GIN sería una optimización prematura:
infraestructura permanente para un problema que no existe. Queda como mejora posterior, para cuando el
catálogo crezca de verdad o se mida un problema real de rendimiento.

## 9. Seguridad: RLS y permisos por columna

RLS habilitado en las **seis tablas**. El rol `anon` no tiene acceso a ninguna: sin sesión no se lee ni se
escribe nada. Todas las políticas son `TO authenticated` y envuelven la función como `(SELECT auth.uid())`,
para que PostgreSQL la evalúe una vez como InitPlan y no una vez por fila.

RLS y `GRANT` son **dos capas distintas y complementarias**: RLS decide **qué filas**, los `GRANT` de columna
deciden **qué columnas**. RN-03 y la inmutabilidad de la identidad de la visita son reglas de _columna_, así
que se implementan con `GRANT`, no con RLS.

| Tabla           | SELECT | INSERT                                             | UPDATE                       | DELETE |
| --------------- | ------ | -------------------------------------------------- | ---------------------------- | ------ |
| `profiles`      | todas  | ✗                                                  | ✗                            | ✗      |
| `regions`       | todas  | ✗                                                  | ✗                            | ✗      |
| `advisors`      | todas  | ✗                                                  | ✗                            | ✗      |
| `associations`  | todas  | ✗                                                  | sí, por columna (ver abajo)  | ✗      |
| `visits`        | todas  | sí, por columna + RLS `supervisor_id = auth.uid()` | sí, por columna              | ✗      |
| `monthly_goals` | todas  | sí, por columna + RLS propia                       | sí, por columna + RLS propia | ✗      |

### `associations` — solo estado y asesor (RN-03)

```sql
-- boceto, no migración
REVOKE INSERT, UPDATE ON associations FROM authenticated;
GRANT  UPDATE (status, advisor_id) ON associations TO authenticated;
```

Sin esto, una supervisora podría cambiar el `bank_code` o la `region_id` con una llamada directa a PostgREST
aunque la interfaz no lo ofrezca. Es la diferencia entre "la app no lo permite" y "la base de datos no lo
permite".

### `visits` — permisos por columna alineados con la matriz de estados

```sql
-- boceto, no migración
REVOKE INSERT, UPDATE ON visits FROM authenticated;

GRANT INSERT (
  association_id,
  supervisor_id,
  scheduled_advisor_id,   -- el trigger lo sobrescribe; se concede solo por el tipo Insert generado (sección 7)
  visit_type,
  modality,
  characteristic,
  scheduled_date,
  scheduled_time
) ON visits TO authenticated;

GRANT UPDATE (
  status,
  scheduled_date,
  scheduled_time,
  visit_type,
  modality,
  characteristic,
  performed_date,
  start_time,
  end_time,
  score,
  general_comment
) ON visits TO authenticated;
```

Lo que **no** se concede es tan importante como lo que sí:

- **`status` no es insertable** → toda visita nace `PROGRAMADA` por el `DEFAULT` (sección 5).
- **`association_id`, `supervisor_id` y `scheduled_advisor_id` no son actualizables** → la identidad de la
  visita está protegida por permisos, además de por el trigger. Dos capas para la regla más difícil de
  reparar si se rompe.
- **`id`, `created_at`, `updated_at`, `performed_by` y `result_updated_at` no se conceden nunca.** Las
  tres últimas las fija el trigger especializado, que no está sujeto a los permisos de columna del
  cliente.

Los `GRANT` no distinguen el estado de la fila (SQL no puede): un `UPDATE` de `score` está permitido por
permisos aunque la visita esté `PROGRAMADA`. Quien impone la matriz por estado es el **trigger** (sección 5),
y el `CHECK` de completitud lo respalda. Los permisos son el filtro grueso; el trigger, el fino.

La política RLS de `INSERT` exige `supervisor_id = (SELECT auth.uid())`: una supervisora no puede crear una
visita a nombre de la otra. La de `UPDATE` no restringe filas: ambas pueden editar el resultado de cualquier
visita (RN-22), pero no pueden reasignarla porque `supervisor_id` no es actualizable.

### `monthly_goals` — solo la meta propia, y solo el valor

```sql
-- boceto, no migración
REVOKE INSERT, UPDATE ON monthly_goals FROM authenticated;
GRANT  INSERT (supervisor_id, year, month, target_visits) ON monthly_goals TO authenticated;
GRANT  UPDATE (target_visits) ON monthly_goals TO authenticated;
```

`UPDATE` solo sobre `target_visits`: una meta **no se muda** de supervisora ni de mes. Cambiar `supervisor_id`,
`year` o `month` de una fila existente sería una forma silenciosa de reescribir el pasado; si la meta era de
otro mes, se crea la fila de ese mes.

Las políticas RLS de `INSERT` y `UPDATE` exigen `supervisor_id = (SELECT auth.uid())`: cada supervisora
gestiona **solo su propia meta**. El `SELECT`, en cambio, es de **todas** las filas — es obligatorio: RN-24
calcula la meta conjunta como suma de las individuales, y el cliente no puede sumar lo que no puede leer.

### `profiles` — solo lectura desde la app

No hay necesidad funcional en el MVP de que una supervisora edite su `full_name`: son dos cuentas fijas,
creadas a mano, con nombres que no cambian (HU-05), y no existe pantalla de perfil en el backlog. Conceder
`UPDATE` solo para no usarlo es superficie de ataque gratis. **`profiles` se administra únicamente desde
Supabase.** Si más adelante aparece una pantalla de perfil, se concede `UPDATE (full_name)` sobre la fila
propia en su momento.

### Ninguna tabla concede `DELETE`

El MVP cancela, cambia estados y desactiva; no borra (sección 4).

### Qué pasa por el camino administrativo

Las altas y correcciones puntuales de regiones, asociaciones y asesores se hacen **fuera de la app**
(sección 10):

- El **SQL Editor de Supabase** y una conexión administrativa por **`psql`** se ejecutan con un **rol
  privilegiado de PostgreSQL**.
- Las llamadas administrativas hechas **por API** pueden usar la clave **`service_role`**.
- Según el rol utilizado, **ambos caminos pueden omitir la RLS y los `GRANT` de columna**.
- **Ninguno de los dos evita las restricciones estructurales**: `CHECK`, claves foráneas, `UNIQUE`, índices
  únicos y **triggers** se aplican siempre, sea cual sea el rol.

De ahí que RN-12, RN-19, RN-21, la validación de asociación supervisable, el estado inicial obligatorio y las
reglas de inmutabilidad estén implementadas como **restricciones y triggers**, y no solo como permisos: en el
camino administrativo son la única red que queda.

## 10. Importación desde CSV

**Carga única.** El CSV se importa una sola vez, al inicio. Después, las altas y correcciones puntuales se
hacen de una en una desde el panel de Supabase o por SQL (no desde la app — ver
[out-of-scope.md](../product/out-of-scope.md)). No hay reimportación periódica y, por tanto, no existe el
riesgo de que una recarga pise los cambios de estado o de asesor hechos desde la app.

**No se desarrolla ninguna pantalla de importación.**

Estrategia, ejecutada desde el SQL Editor o `psql` con un rol privilegiado (sección 9):

1. **Staging con todas las columnas en `text`** (`staging_regions`, `staging_advisors`,
   `staging_associations`). Cargar todo como texto es lo que salva los ceros a la izquierda del `bank_code`:
   si el importador infiere el tipo, `01234` se convierte en el entero `1234` y el dato queda destruido antes
   de que ninguna restricción pueda protegerlo. Como Excel suele haber hecho ya ese daño en el origen, la
   importación aplica `lpad(bank_code, 5, '0')` de todos modos.
2. **Normalización en SQL:** `btrim` en todo; `upper` en los códigos; colapso de espacios internos en los
   nombres (`regexp_replace(btrim(name), '\s+', ' ', 'g')`); y mapeo de texto a enum y a `regions.code`
   tolerando tildes y minúsculas (`DESERCIÓN` → `DESERCION`, `Arequipa` → `AREQUIPA`), vía `unaccent` + `upper`.
   **Los nombres se guardan ya normalizados**, no solo se normalizan para comparar (riesgo 2).
3. **Validación:** las filas cuyo `bank_code` no cumpla `^[0-9]{5}$`, cuyo valor no mapee a un enum válido, o
   cuya región o asesor no existan en el catálogo, se quedan en staging con una columna `import_error`. Se
   reportan y se corrige el CSV; no se cargan a medias.
4. **Carga, en este orden** (dictado por las FK): **`regions` → `advisors` → `associations`**. Las regiones son
   solo dos filas (`AREQUIPA`, `TACNA`) y pueden insertarse directamente, sin staging, si el CSV no trae una
   columna de región normalizada.
5. **Revisión de nombres duplicados** y, si procede, creación del índice único normalizado (riesgo 2).
6. **Metas iniciales:** ejecutar `create_monthly_goals_for_active_supervisors()` (sección 11) para el mes
   en curso: crea la fila de `monthly_goals` de cada supervisora activa; sin ella, la supervisora no
   aparece en el panel. Los meses siguientes ya no requieren este paso manual (sección 11).

### Extensión `unaccent`

```sql
-- boceto, no migración
CREATE EXTENSION IF NOT EXISTS unaccent;
```

`unaccent` se usa **exclusivamente en la carga y normalización inicial** (paso 2): mapear `DESERCIÓN` al valor
de enum `DESERCION`, o `Arequipa` al código de región `AREQUIPA`.

Esto **no** implica que el buscador de la aplicación sea insensible a tildes. La búsqueda de asociaciones
(HU-10) usa `ILIKE '%texto%'` sobre el texto tal cual está guardado y **sigue siendo sensible a tildes**. Un
buscador insensible a tildes requeriría un índice sobre `unaccent(name)` y cambiar la consulta del frontend:
queda **fuera del MVP**.

## 11. Vista de apoyo: `v_monthly_progress`

Una fila por supervisora y mes con lo justo para el panel de HU-24: meta individual, visitas realizadas del
mes, visitas activas del mes, y los totales conjuntos (RN-24).

**Criterio temporal — es lo que hace correcta la vista:**

- Una visita **`REALIZADA` cuenta en el mes de su `performed_date`**, no en el de su fecha programada. Una
  visita programada para junio y realizada en julio cuenta en **julio** (RN-25).
- Una visita **activa** (`PROGRAMADA`/`REPROGRAMADA`) cuenta en el mes de su **`scheduled_date`**, que es la
  única fecha que tiene.

```sql
-- boceto, no migración
CREATE VIEW public.v_monthly_progress
WITH (security_invoker = true)
AS
WITH goals AS (
  SELECT
    g.supervisor_id,
    g.year,
    g.month,
    g.target_visits,
    make_date(g.year, g.month, 1)                              AS month_start,
    (make_date(g.year, g.month, 1) + interval '1 month')::date AS next_month_start
  FROM monthly_goals g
)
SELECT
  g.supervisor_id,
  g.year,
  g.month,
  g.target_visits                                              AS individual_target,
  c.individual_done,
  c.individual_active,
  sum(g.target_visits)   OVER (PARTITION BY g.year, g.month)   AS joint_target,
  sum(c.individual_done) OVER (PARTITION BY g.year, g.month)   AS joint_done,
  sum(c.individual_active) OVER (PARTITION BY g.year, g.month) AS joint_active
FROM goals g
LEFT JOIN LATERAL (
  SELECT
    count(*) FILTER (
      WHERE v.status = 'REALIZADA'
        AND v.performed_date >= g.month_start
        AND v.performed_date <  g.next_month_start
    ) AS individual_done,
    count(*) FILTER (
      WHERE v.status IN ('PROGRAMADA', 'REPROGRAMADA')
        AND v.scheduled_date >= g.month_start
        AND v.scheduled_date <  g.next_month_start
    ) AS individual_active
  FROM visits v
  WHERE v.supervisor_id = g.supervisor_id
) c ON true;

REVOKE ALL ON public.v_monthly_progress FROM PUBLIC, anon;
GRANT SELECT ON public.v_monthly_progress TO authenticated;
```

Dos detalles del boceto que no son opcionales:

**El `LATERAL` agrega antes de unir, y por eso no infla los conteos.** Un `LEFT JOIN` directo entre
`monthly_goals` y `visits` produciría una fila por visita, y cualquier agregado sobre `target_visits`
—incluida la suma de la meta conjunta— quedaría multiplicado por el número de visitas. Con la subconsulta
lateral, cada meta se une a **una sola fila** ya agregada. Un CTE agregado aparte o subconsultas escalares
serían igual de válidos; lo que no vale es agregar sobre el producto cartesiano.

**Los rangos son `>= inicio_de_mes` y `< inicio_del_mes_siguiente`**, construidos con `make_date`. Es más
correcto y más rápido que `extract(month ...)`: funciona con el índice sobre la columna de fecha y no falla en
diciembre.

### `monthly_goals` es la tabla base

La vista parte de `monthly_goals`. Una supervisora **sin fila de meta para ese mes no aparece en el panel**, y
sus visitas no suman en los totales conjuntos. Por eso debe existir **una fila por supervisora activa y por
mes, incluso con `target_visits = 0`** (sección 3). Ya **no** es una tarea manual: la crea
`create_monthly_goals_for_active_supervisors()` (abajo), programada con `pg_cron`.

### Automatización: `create_monthly_goals_for_active_supervisors()`

```sql
-- boceto, no migración
CREATE OR REPLACE FUNCTION create_monthly_goals_for_active_supervisors(
  p_year  smallint DEFAULT extract(year  FROM now())::smallint,
  p_month smallint DEFAULT extract(month FROM now())::smallint
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO monthly_goals (supervisor_id, year, month, target_visits)
  SELECT p.id, p_year, p_month, 0
  FROM profiles p
  WHERE p.is_active = true
  ON CONFLICT (supervisor_id, year, month) DO NOTHING;
$$;
```

- **Idempotente:** `ON CONFLICT DO NOTHING` hace que ejecutarla dos veces el mismo mes no duplique
  filas ni pise una meta que la supervisora ya haya editado.
- **`target_visits = 0` es el valor de partida**, no una meta definitiva: cada supervisora ajusta su
  propio valor desde la app (sección 9). La función solo garantiza que la fila exista para que la
  supervisora aparezca en el panel.
- **`SECURITY DEFINER`** es necesario porque `pg_cron` no ejecuta con la sesión de ninguna supervisora
  autenticada: sin ella, la RLS de `monthly_goals` (`supervisor_id = auth.uid()`, sección 9) bloquearía
  el `INSERT` de la meta de la otra. `SET search_path = public` es obligatorio junto con `SECURITY
DEFINER` para no quedar expuesta a un `search_path` manipulado.

**Programación con `pg_cron`:**

```sql
-- boceto, no migración
SELECT cron.schedule(
  'create-monthly-goals',
  '0 5 1 * *',  -- 05:00 UTC el día 1 de cada mes
  $$SELECT create_monthly_goals_for_active_supervisors()$$
);
```

`pg_cron` está disponible como extensión de Supabase. Si el plan del proyecto no la ofrece, la
alternativa equivalente es una **Edge Function programada** (Cron Triggers de Supabase, fuera de la
base de datos) que invoque `create_monthly_goals_for_active_supervisors()` por RPC el día 1 de cada
mes: la función SQL es la misma en ambos casos, solo cambia quién la dispara.

**Alta o reactivación a mitad de mes.** Si se crea o reactiva una supervisora el día 15, el cron del
día 1 ya pasó: sin nada más, la supervisora esperaría hasta el **próximo** ciclo y pasaría el resto del
mes fuera del panel. Se decide **no** esperar: un trigger sobre `profiles` llama a la misma función
para el mes en curso en cuanto `is_active` pasa a `true` (alta o reactivación), de modo que la meta del
mes en curso se crea de inmediato, con `target_visits = 0` hasta que la propia supervisora la ajuste.

```sql
-- boceto, no migración
CREATE OR REPLACE FUNCTION profiles_create_current_month_goal()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_active = true AND (TG_OP = 'INSERT' OR OLD.is_active = false) THEN
    PERFORM create_monthly_goals_for_active_supervisors(); -- año/mes = los actuales, por defecto
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_after_activate
AFTER INSERT OR UPDATE OF is_active ON profiles
FOR EACH ROW
EXECUTE FUNCTION profiles_create_current_month_goal();
```

Llamar a la función completa (para todas las supervisoras activas) en vez de insertar solo la fila de
`NEW` es intencional: es la misma función que usa `pg_cron`, así que no hay dos caminos que puedan
divergir, y `ON CONFLICT DO NOTHING` hace que repetir el `INSERT` de una supervisora que ya tenía su
fila sea gratis. Este trigger se dispara desde el camino administrativo (sección 9): `profiles` es de
solo lectura desde la app, así que el alta y la reactivación ya ocurren en Supabase.

### `security_invoker` es obligatorio, no opcional

Sin esa opción, una vista de PostgreSQL se ejecuta con los permisos de **su propietario** (normalmente
`postgres`), no con los de quien la consulta: **saltaría las políticas RLS** de `monthly_goals` y `visits` y
devolvería filas a quien no debería verlas. Sería una puerta trasera que anula toda la sección 9.

Con `WITH (security_invoker = true)` la vista se evalúa con los permisos y las políticas de la supervisora
autenticada que la consulta. Es la única forma segura de exponer una vista a través de PostgREST, y **cualquier
vista futura sobre tablas con RLS debe declararla igual**.

Reglas que la vista cumple por diseño:

- **Respeta la RLS de las tablas subyacentes** (`security_invoker`).
- **`anon` no tiene acceso** (`REVOKE ALL ... FROM PUBLIC, anon`).
- **`authenticated` solo tiene `SELECT`**: nunca se escribe a través de la vista.
- **Expone únicamente lo que necesita el dashboard**: identificadores, período, meta y conteos agregados. No
  incluye comentarios, puntuaciones individuales ni datos de asociaciones.
- **No expone nada que la supervisora no pudiera consultar directamente**: es una agregación de datos que ya
  son legibles para ella (metas de ambas — RN-24 — y visitas de ambas), no un atajo a datos privilegiados.

## 12. Riesgos

1. **Evolución de los enums nativos.** `ALTER TYPE … ADD VALUE` no puede usarse en la misma transacción que
   luego inserta ese valor, y **no existe `DROP VALUE`**: quitar o renombrar un valor obliga a recrear el tipo
   y reescribir las columnas. Se acepta para los cinco catálogos que el negocio da por cerrados. El caso que sí
   era previsible —la región— ya no es un enum, sino la tabla `regions`.
2. **El nombre único de asociación depende de un dato sucio.** Funcionalmente el nombre **debe ser único**, pero
   viene de un Excel escrito a mano, con mayúsculas inconsistentes, espacios finales y espacios internos
   dobles. **Se resuelve por secuencia:**

   1. La migración inicial crea `associations` **sin** índice único sobre `name`.
   2. Se carga el CSV en staging, se limpia y **se normalizan físicamente los nombres al guardarlos**
      (`btrim` + colapso de espacios internos), para que lo almacenado y lo que indexa el índice coincidan.
   3. Se verifica si quedan **nombres legítimamente repetidos**.
   4. Si no los hay, se crea el índice **después** de la limpieza:

   ```sql
   -- boceto, no migración
   CREATE UNIQUE INDEX associations_unique_normalized_name
     ON associations (
       lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
     );
   ```

   La normalización del índice colapsa espacios internos además de recortar los extremos y unificar
   mayúsculas: `"Asoc.  Los  Andes "` y `"asoc. los andes"` colisionan, como deben. **`bank_code` sigue siendo
   la identidad técnica principal**: es lo que usan las FK y lo que identifica a la asociación. Si durante la
   carga se descubre que dos asociaciones **pueden compartir legalmente el mismo nombre**, la regla debe volver
   a validarse con el dueño de producto **antes** de crear el índice (sección 15).

3. ~~**RLS uniforme = cero trazabilidad.**~~ **Resuelto** (sección 13, decisión 21). Cualquiera de las dos
   supervisoras puede seguir editando la puntuación de una visita de la otra (RN-22 lo permite), pero ahora
   `visits.performed_by` y `visits.result_updated_at` registran quién hizo la última edición del resultado y
   cuándo, sin abrir un log de cambios general.
4. **Una asociación puede volverse no supervisable teniendo una visita activa.** El trigger impide _programar_
   sobre una asociación `DISUELTA`, pero nada impide pasar a `DISUELTA` una asociación que ya tiene una visita
   `PROGRAMADA`. No se bloquea en la base de datos a propósito (sección 5); la app debe advertirlo y ofrecer
   cancelar la visita. El detalle del aviso es una decisión de negocio pendiente (sección 15).
5. **El manejo del error `23505` depende del formato de respuesta de PostgREST** (sección 6). Mitigado con la
   estrategia de cuatro pasos: el código `23505` es estable, el nombre del índice es una pista, y la
   confirmación real viene de consultar la visita activa.
6. **El snapshot del asesor es una FK, no una copia del nombre** (sección 7): corregir el nombre de un asesor
   cambia cómo se muestran las visitas históricas. Aceptable en el MVP. La alternativa, si alguna vez se
   requiere fidelidad histórica literal, es añadir `scheduled_advisor_code` y `scheduled_advisor_name`
   desnormalizados en `visits`.
7. **El tipo `Insert` generado por Supabase para `visits` pide un campo que la base de datos ignora**
   (`scheduled_advisor_id`, sección 7). Es cosmético y está documentado, pero puede confundir a quien lea el
   frontend sin conocer el trigger.
8. ~~**El panel depende de que existan las filas de `monthly_goals`.**~~ **Resuelto** (sección 13, decisión
   22). `create_monthly_goals_for_active_supervisors()`, programada con `pg_cron` el día 1 de cada mes, crea
   las filas faltantes; un trigger sobre `profiles` cubre el alta o la reactivación a mitad de mes (sección
   11). Ya no depende de que alguien lo recuerde.
9. **La búsqueda por nombre no tiene índice** (sección 8). Correcto hoy con ~330 filas; revisable si el catálogo
   crece.

## 13. Decisiones tomadas

| #   | Pregunta                                                                                      | Decisión                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ¿Matriz de transiciones de estado de asociación (RN-04)?                                      | No. Cualquier transición es válida; no se implementa trigger. Sigue pendiente de validar con el dueño de producto.                                                                                                              |
| 2   | ¿`REALIZADA` exige puntuación y comentario en la base de datos?                               | **Sí**, con `visits_result_completeness`, que además exige `NULL` en horas reales si no está `REALIZADA`.                                                                                                                       |
| 3   | ¿Historial de asignación asesor–asociación?                                                   | No en el MVP. El snapshot en `visits` es suficiente.                                                                                                                                                                            |
| 4   | ¿`advisors` tiene estado activo/inactivo?                                                     | **Sí**, columna `is_active`.                                                                                                                                                                                                    |
| 5   | ¿Borrado físico de registros?                                                                 | No. Ningún `GRANT DELETE`, y todas las FK son `ON DELETE RESTRICT` (sección 4).                                                                                                                                                 |
| 6   | ¿La visita cuenta para quien la programó o para quien la realizó?                             | **Quien programa la visita es quien la realiza.** `supervisor_id` es inmutable.                                                                                                                                                 |
| 7   | ¿Se reimporta el CSV periódicamente?                                                          | No. **Carga única**; después, alta y edición de una en una fuera de la app.                                                                                                                                                     |
| 8   | ¿Una visita `NO_REALIZADA` puede llevar un motivo?                                            | No en el MVP; el `CHECK` de completitud lo prohíbe.                                                                                                                                                                             |
| 9   | ¿Puede una supervisora editar la meta mensual de la otra?                                     | No. Solo la propia, y solo su `target_visits` (sección 9).                                                                                                                                                                      |
| 10  | ¿Puede una visita cambiar de asociación?                                                      | **No.** `association_id` es inmutable, por trigger **y** por permisos de columna.                                                                                                                                               |
| 11  | ¿La región es un enum o una tabla?                                                            | **Tabla `regions`**, para admitir sedes nuevas sin migración de tipo.                                                                                                                                                           |
| 12  | ¿Una meta mensual puede ser 0?                                                                | **Sí** (`>= 0`). Además, **debe existir la fila** de cada supervisora activa cada mes (sección 11).                                                                                                                             |
| 13  | ¿Se elimina una supervisora que deja el puesto?                                               | **No.** `is_active = false` + bloqueo en Supabase Auth. El historial se conserva.                                                                                                                                               |
| 14  | ¿Puede una supervisora editar su `full_name` desde la app?                                    | **No.** `profiles` es de solo lectura desde la app; se administra en Supabase.                                                                                                                                                  |
| 15  | ¿`pg_trgm` para la búsqueda por nombre?                                                       | **No en el MVP.** `ILIKE` sobre ~330 filas es suficiente.                                                                                                                                                                       |
| 16  | ¿`unaccent`?                                                                                  | **Sí, solo para la importación.** El buscador de la app sigue siendo sensible a tildes.                                                                                                                                         |
| 17  | ¿Con qué estado nace una visita?                                                              | **Siempre `PROGRAMADA`.** `DEFAULT` + sin `INSERT` sobre `status` + trigger que **rechaza** cualquier otro estado.                                                                                                              |
| 18  | ¿Cómo se protege la identidad de la visita?                                                   | **Dos capas:** sin `UPDATE` de columna para `association_id`/`supervisor_id`/`scheduled_advisor_id`, y trigger.                                                                                                                 |
| 19  | ¿Quién mantiene `visits.updated_at`?                                                          | **Su trigger especializado**, no `set_updated_at()`. Un solo trigger `BEFORE UPDATE` por evento en `visits`.                                                                                                                    |
| 20  | ¿Cómo detecta el frontend la duplicidad (RN-13)?                                              | `23505` + nombre del índice **si está disponible** + **confirmación** consultando la visita activa (sección 6).                                                                                                                 |
| 21  | ¿Cómo se da trazabilidad mínima de quién editó el resultado de una visita (RN-22)?            | **Dos columnas** en `visits`: `performed_by` y `result_updated_at`, fijadas por el trigger `BEFORE UPDATE` (sección 5). No una tabla de historial: sería el log de cambios general que el MVP excluye a propósito (sección 1).  |
| 22  | ¿Cómo se garantiza que exista la fila de `monthly_goals` de cada supervisora activa cada mes? | **Automatizado.** `create_monthly_goals_for_active_supervisors()` vía `pg_cron` el día 1 de cada mes, más un trigger en `profiles` que la ejecuta para el mes en curso al activar o dar de alta a una supervisora (sección 11). |

RN-11 (una visita `ORDINARIA` por año) sigue marcada como **[Supuesto]** y **no** se refuerza en la base de
datos (sección 5).

## 14. Resumen de cambios aplicados

| Cambio                                                                                                    | Motivo                                                                                                                                            | Impacto                                                                                                                               |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `visits_result_completeness` exige también `start_time IS NULL` y `end_time IS NULL` si no es `REALIZADA` | Las horas reales son datos de resultado: una visita `CANCELADA` no puede afirmar que empezó a las 09:00                                           | `CANCELADA`/`NO_REALIZADA` quedan sin ningún dato de resultado. Las horas siguen opcionales en `REALIZADA`                            |
| Toda visita nace `PROGRAMADA` (`DEFAULT` + sin `INSERT` en `status` + trigger que **rechaza**)            | El diseño anterior permitía insertar una visita ya `REALIZADA` (contaría para la meta sin haber existido) o ya cerrada                            | Tres capas de defensa. Se rechaza con excepción, no se corrige en silencio, para que los errores del frontend se vean                 |
| Permisos por columna en `visits` (`INSERT` y `UPDATE`)                                                    | La identidad de la visita no debe depender solo de un trigger, y `status` no debe ser insertable                                                  | La identidad queda protegida por permisos **y** por trigger. Los `GRANT` son coherentes con la matriz de estados                      |
| Permisos por columna en `monthly_goals`                                                                   | Una meta no se muda de supervisora ni de mes: eso sería reescribir el pasado                                                                      | `UPDATE` solo sobre `target_visits`; `INSERT` solo de la meta propia (RLS)                                                            |
| Matriz explícita de columnas editables por estado                                                         | La descripción en prosa del trigger dejaba margen a interpretaciones y podía contradecir los permisos                                             | Sección 5. El trigger, los `GRANT` y el `CHECK` se leen ahora contra una única tabla de verdad                                        |
| Un solo trigger `BEFORE UPDATE` en `visits`, que además fija `updated_at`                                 | Dos triggers del mismo evento se ejecutan por orden alfabético de nombre: hacer depender la corrección de eso es una trampa silenciosa            | `set_updated_at()` se aplica a **cinco** tablas, no a seis. El trigger nunca rechaza un `UPDATE` por su propio cambio de `updated_at` |
| Un solo trigger `BEFORE INSERT` en `visits` (estado + supervisable + snapshot)                            | Mismo motivo: no depender del orden de disparo                                                                                                    | Tres validaciones en una función, en orden explícito                                                                                  |
| Índice de nombre normalizado con `regexp_replace(btrim(name), '\s+', ' ', 'g')`                           | `lower(btrim(...))` no colapsaba espacios internos: `"Asoc.  Los  Andes"` y `"Asoc. Los Andes"` habrían convivido                                 | Además, los nombres se **guardan** ya normalizados, para que lo almacenado y lo indexado coincidan                                    |
| `CHECK (length(btrim(col)) > 0)` en `regions.code/name`, `advisors.code/full_name`, `associations.name`   | `NOT NULL` no impide guardar `''` ni `'   '`                                                                                                      | Los catálogos no pueden tener filas con nombre vacío                                                                                  |
| Redacción precisa sobre `service_role` y el camino administrativo                                         | El SQL Editor y `psql` usan un **rol privilegiado**, no literalmente `service_role`; la clave `service_role` es de la API                         | La conclusión no cambia: pueden omitir RLS y `GRANT`, pero **nunca** `CHECK`, FK, `UNIQUE` ni triggers                                |
| Redacción precisa sobre `CASCADE` vs `RESTRICT`                                                           | Era falso decir que un borrado quedaría "a medio camino": el `DELETE` es transaccional y se revierte entero                                       | Se mantiene `RESTRICT` en todo el esquema, ahora por los motivos correctos (política explícita, sin sorpresas)                        |
| `v_monthly_progress`: `performed_date` para realizadas, `scheduled_date` para activas, con `make_date`    | Una visita programada en junio y realizada en julio debe contar en **julio** (RN-25). El boceto anterior no lo distinguía                         | Rangos `>= mes` / `< mes+1`, aptos para índice                                                                                        |
| `v_monthly_progress`: `LEFT JOIN LATERAL` con agregados                                                   | Un `LEFT JOIN` directo habría multiplicado `target_visits` por el número de visitas al sumar la meta conjunta                                     | Cada meta se une a una sola fila ya agregada. Se añaden `joint_done` y `joint_active` para el panel                                   |
| Debe existir una fila de `monthly_goals` por supervisora activa y mes, aunque sea 0                       | La vista usa `monthly_goals` como tabla base: sin fila, la supervisora desaparece del panel                                                       | Tarea de mantenimiento mensual. Documentada como riesgo 8                                                                             |
| Manejo del `23505` en cuatro pasos, sin depender de la propiedad `constraint`                             | El formato del error de PostgREST varía según versión: el nombre del índice puede venir en `message` o `details`                                  | El nombre del índice sigue siendo estable, pero la confirmación real es la consulta de la visita activa                               |
| `visits.performed_by` y `visits.result_updated_at`, fijados por el trigger `BEFORE UPDATE`                | RN-22 permite que cualquiera de las dos supervisoras edite el resultado de una visita ajena, sin que quedara registro de quién lo hizo (riesgo 3) | Trazabilidad de la **última** edición, sin abrir un log de cambios general. Sin `GRANT` de columna para el cliente (sección 9)        |
| `create_monthly_goals_for_active_supervisors()` programada con `pg_cron`, más trigger en `profiles`       | El panel dependía de que alguien recordara crear a mano la meta mensual de cada supervisora activa; el olvido era silencioso (riesgo 8)           | Filas de `monthly_goals` garantizadas cada mes; el alta o reactivación a mitad de mes no espera al próximo ciclo (sección 11)         |

## 15. Decisiones pendientes de negocio

Solo estas cuatro siguen abiertas. Ninguna impide escribir la migración.

1. **RN-11 — ¿una sola visita `ORDINARIA` por asociación y año?** Sigue siendo un **[Supuesto]**. Mientras no se
   confirme, se valida solo en el frontend (HU-17). Si se confirma, se añade un índice único parcial; si se
   descarta, no hay nada que deshacer. **Confirmar antes de que haya volumen de datos reales.**
2. **¿Puede repetirse legítimamente el nombre de una asociación?** El negocio dice que es único, pero debe
   verificarse contra el CSV real antes de crear `associations_unique_normalized_name` (riesgo 2).
3. **¿Qué hace la app cuando una asociación pasa a un estado no supervisable teniendo una visita activa?** La
   base de datos permite el cambio (riesgo 4). Falta definir la conducta: ¿solo advierte?, ¿ofrece cancelar la
   visita?, ¿la cancela automáticamente? El esquema soporta las tres sin cambios.
4. **RN-04 — matriz de transiciones de estado de asociación.** Sigue **[Pendiente]** en las reglas de negocio.
   Por defecto, cualquier transición es válida y no hay trigger.

## 16. Lista de comprobación final

**¿Diseño listo para escribir la migración? — Sí.** Ninguna de las decisiones pendientes bloquea el SQL inicial:
las cuatro son aditivas (un índice que se crea después, un trigger que podría no existir nunca, o conducta de la
app).

**Contradicciones encontradas y resueltas en esta revisión:**

- El `CHECK` de completitud dejaba que una visita no realizada conservara `start_time`/`end_time`, mientras el
  documento afirmaba que quedaba "sin datos de resultado". **Resuelta:** las horas reales entran en la rama
  negativa del `CHECK`.
- Nada impedía insertar una visita ya `REALIZADA` o ya cerrada, pese a que la matriz de transiciones asumía que
  toda visita empieza activa. **Resuelta:** `DEFAULT` + permiso denegado + trigger que rechaza.
- Los permisos por columna existían en `associations` pero no en `visits` ni en `monthly_goals`, así que la
  inmutabilidad de la identidad dependía solo del trigger. **Resuelta:** `GRANT` por columna en las tres tablas.
- `set_updated_at()` y el trigger de validación de `visits` competían en el mismo evento, con el orden decidido
  por el nombre. **Resuelta:** un único trigger `BEFORE UPDATE` en `visits`; la función compartida queda para las
  otras cinco tablas.
- El documento afirmaba que un borrado con `CASCADE`/`RESTRICT` mezclados quedaría "a medio camino". Es falso: el
  `DELETE` es transaccional. **Resuelta:** se mantiene `RESTRICT` uniforme, con la justificación correcta.
- El documento decía que el SQL Editor y `psql` usan `service_role`. Impreciso: usan un rol privilegiado de
  PostgreSQL; `service_role` es la clave de la API. **Resuelta.**
- La vista contaba las visitas realizadas por el mes de la meta sin distinguir `performed_date` de
  `scheduled_date`, y su `LEFT JOIN` habría multiplicado la meta conjunta. **Resueltas ambas.**
- El índice de nombre normalizado no colapsaba espacios internos. **Resuelta** con `regexp_replace`.

**Riesgos que continúan** (sección 12): evolución de los cinco enums; asociación que se vuelve no supervisable
con una visita activa; dependencia parcial del formato de error de PostgREST para RN-13; el snapshot de asesor
como FK y no como copia del nombre; el campo fantasma `scheduled_advisor_id` en el tipo `Insert` generado; y la
búsqueda por nombre sin índice. Los riesgos 3 (trazabilidad de RN-22) y 8 (creación manual de `monthly_goals`)
quedaron **resueltos** en esta revisión (decisiones 21 y 22, sección 13).

**Decisiones que conviene confirmar antes de escribir el SQL:** ninguna es bloqueante. La más barata de confirmar
ahora, y la única que evitaría rehacer datos más adelante, es **RN-11**. Las dos que se resuelven **con el CSV en
la mano**, no antes, son la unicidad del nombre de asociación y los valores reales de región a cargar en
`regions`.

**Verificación de los criterios de aceptación:** seis tablas principales ✓ · toda visita nace `PROGRAMADA` ✓ ·
una sola visita activa por asociación ✓ · asesor congelado por trigger ✓ · `association_id`, `supervisor_id` y
`scheduled_advisor_id` inmutables ✓ · transiciones completamente definidas (matriz de la sección 5) ✓ · las
visitas no realizadas no conservan resultado ni horas reales ✓ · solo una visita `REALIZADA` puede modificar su
resultado ✓ · permisos por columna en `visits` ✓ · permisos por columna en `monthly_goals` ✓ ·
`visits.updated_at` dentro del trigger especializado ✓ · vista con `security_invoker = true` ✓ · realizadas por
`performed_date` ✓ · activas por `scheduled_date` ✓ · sin borrado físico ✓ · trazabilidad de autoría del
resultado con `performed_by`/`result_updated_at` ✓ · creación de `monthly_goals` automatizada con `pg_cron` y
trigger de activación en `profiles` ✓ · listo para migración ✓.

---

## 14. Rol de jefatura, metas por sede y auditoría

Añadido por la migración `20260716120000_add_supervision_manager_role.sql`, que **no
modifica** la migración inicial: todo se agrega o se reescribe encima. Implementa
RN-28..RN-32.

### 14.1 Rol de aplicación

```sql
create type public.app_role as enum ('SUPERVISOR', 'SUPERVISION_MANAGER');
alter table public.profiles add column role public.app_role not null default 'SUPERVISOR';
```

El default hace la migración segura para las filas existentes: toda cuenta previa sigue
siendo supervisora. Para promover a jefatura:

```sql
update public.profiles set role = 'SUPERVISION_MANAGER' where id = '<uuid>';
```

### 14.2 `public.current_app_role()` — el predicado único de las políticas

```sql
create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p
  where p.id = auth.uid() and p.is_active
$$;
```

- **`security definer`**: lee `profiles` sin depender de la RLS de esa tabla.
- **Vive en `public`, no en `private`**: las políticas se evalúan con los privilegios del
  invocador, y `authenticated` no tiene `USAGE` sobre `private`. Solo revela el rol del
  propio usuario autenticado, así que exponerla como RPC es inocuo.
- **Devuelve `NULL` si el perfil no existe o está inactivo**, de modo que un solo
  predicado cubre "perfil activo" **y** rol: `(select public.current_app_role()) is not null`
  sustituye al viejo `EXISTS (... is_active ...)`, y `= 'SUPERVISOR'` restringe escrituras.
- **`stable` + patrón `(select fn())`**: PostgreSQL lo evalúa como InitPlan una vez por
  sentencia, no una vez por fila.

### 14.3 Matriz de políticas resultante

| Tabla                    | SELECT        | INSERT                | UPDATE                | DELETE                |
| ------------------------ | ------------- | --------------------- | --------------------- | --------------------- |
| `profiles`               | autenticado   | ✗                     | ✗                     | ✗                     |
| `regions`                | perfil activo | ✗                     | ✗                     | ✗                     |
| `advisors`               | perfil activo | ✗                     | ✗                     | ✗                     |
| `associations`           | perfil activo | ✗                     | `SUPERVISOR`          | ✗                     |
| `visits`                 | perfil activo | `SUPERVISOR` y propia | `SUPERVISOR`          | ✗                     |
| `monthly_goals`          | perfil activo | `SUPERVISOR` y propia | `SUPERVISOR` y propia | ✗                     |
| `regional_monthly_goals` | perfil activo | `SUPERVISION_MANAGER` | `SUPERVISION_MANAGER` | `SUPERVISION_MANAGER` |

El jefe **lee todo y no escribe nada** salvo `regional_monthly_goals`. Los `GRANT` por
columna de la migración inicial siguen vigentes y se suman a estas políticas: la
restricción efectiva es la intersección de ambas capas. La migración añade
`GRANT INSERT (region_id) ON monthly_goals` (sin él, el insert fallaría con 42501 pese a
pasar la política).

> **Efecto colateral documentado.** `visits_before_insert()` hace
> `select ... from associations ... for share`. PostgreSQL aplica a las lecturas con
> bloqueo también la política de **UPDATE** de la tabla leída. Como `associations_update`
> es ahora exclusiva de `SUPERVISOR`, un intento de inserción por parte del jefe falla en
> el trigger (`P0001`, "No existe la asociación") antes de llegar al `WITH CHECK` de
> `visits` (`42501`). La inserción queda denegada por ambas vías; solo cambia el código de
> error. No afecta a la supervisora, que sí pasa la política de UPDATE.

### 14.4 `regional_monthly_goals`

| Columna         | Tipo                                                      | Notas                                 |
| --------------- | --------------------------------------------------------- | ------------------------------------- |
| `id`            | `uuid` PK                                                 |                                       |
| `region_id`     | `uuid NOT NULL REFERENCES regions(id) ON DELETE RESTRICT` |                                       |
| `year`          | `smallint NOT NULL`                                       | `CHECK (year BETWEEN 2025 AND 2100)`  |
| `month`         | `smallint NOT NULL`                                       | `CHECK (month BETWEEN 1 AND 12)`      |
| `target_visits` | `smallint NOT NULL`                                       | `CHECK (target_visits >= 0)`          |
| `created_by`    | `uuid NULL REFERENCES profiles(id)`                       | lo fija el trigger desde `auth.uid()` |
| `updated_by`    | `uuid NULL REFERENCES profiles(id)`                       | lo fija el trigger desde `auth.uid()` |
| `created_at`    | `timestamptz NOT NULL DEFAULT now()`                      |                                       |
| `updated_at`    | `timestamptz NOT NULL DEFAULT now()`                      |                                       |
|                 | `UNIQUE (region_id, year, month)`                         | una sola meta conjunta por sede y mes |

`created_by`/`updated_by` los administra `regional_monthly_goals_set_actor()` (BEFORE
INSERT OR UPDATE) y están **excluidos de los GRANT por columna**: el cliente nunca puede
suplantar al autor. Son nullable para permitir escrituras de mantenimiento sin JWT (seed,
`service_role`).

### 14.5 Vistas de progreso

`v_monthly_progress` se elimina y la reemplazan dos vistas, ambas con
`security_invoker = true` (la RLS de las tablas base aplica al usuario que consulta):

**`v_individual_monthly_progress`** — `(region_id, region_name, supervisor_id,
supervisor_name, year, month, individual_target, individual_done, individual_active,
has_goal)`.

- La sede de una visita es la de **su asociación** (`visits → associations.region_id`),
  nunca una sede del perfil (RN-31).
- Realizadas por mes de `performed_date` con estado `REALIZADA`; activas por mes de
  `scheduled_date` con estado `PROGRAMADA`/`REPROGRAMADA`.
- Las claves salen de la **UNIÓN** de `monthly_goals` y el agregado de visitas: una visita
  realizada nunca desaparece del reporte por falta de meta (`has_goal = false`,
  `individual_target = 0`).

**`v_joint_monthly_progress`** — `(region_id, region_name, year, month,
suggested_joint_target, configured_joint_target, effective_joint_target, joint_done,
joint_active, is_configured)`.

- `suggested_joint_target` = suma de metas personales de la sede.
- `effective_joint_target` = `COALESCE(configurada, sugerida)` (RN-30).
- `is_configured` distingue "Meta definida" de "Meta sugerida" en la interfaz.
- Consultar la vista **no crea** filas de meta conjunta; solo se crean cuando el jefe
  confirma el valor.

Ambas se consultan de una sola vez por pantalla (una fila por sede), evitando N+1 desde
React.

### 14.6 Automatización mensual

`private.create_monthly_goals_for_active_supervisors(p_year, p_month)` se reemplaza con
`create or replace` **manteniendo la firma**, de modo que el job `pg_cron`
`create-monthly-goals` sigue siendo válido sin reprogramarlo. Ahora inserta una meta 0 por
cada combinación de **supervisora activa × sede activa**, filtrando `role = 'SUPERVISOR'`
(el jefe no tiene metas personales).

### 14.7 Auditoría (`private.audit_logs`)

```sql
create table private.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id  uuid not null,
  operation  text not null check (operation in ('INSERT','UPDATE','DELETE')),
  user_id    uuid null,
  old_value  jsonb null,
  new_value  jsonb null,
  created_at timestamptz not null default now()
);
```

- Un único trigger genérico `private.log_audit_event()` (`security definer`, `TG_OP` /
  `TG_TABLE_NAME`, `to_jsonb(old/new)`) montado AFTER INSERT OR UPDATE OR DELETE sobre
  `profiles`, `associations`, `visits`, `monthly_goals` y `regional_monthly_goals`.
- `security definer` es lo que permite que un `authenticated` sin privilegios sobre
  `private` dispare la inserción en la bitácora.
- Sin acceso para `anon`/`authenticated` y **sin pantalla en la aplicación** (RN-32): se
  consulta desde Studio o psql.
- Solo serializa filas de tablas `public`; **nunca** contenido de `auth.users` ni
  contraseñas.
- `user_id` queda `NULL` cuando el cambio ocurre sin JWT (seed, mantenimiento), lo cual es
  esperado y esperable.

### 14.8 Migración de metas antiguas

En el entorno local la migración **borra** las filas de `monthly_goals` antes de añadir
`region_id NOT NULL`, y el seed las recrea por sede (decisión registrada: solo había datos
de desarrollo). En un entorno con datos reales el `DELETE` debe sustituirse por un
backfill manual: añadir `region_id` como nullable, asignar la sede correcta a cada meta
histórica con conocimiento del negocio (**nunca** repartir automáticamente una meta
general entre sedes ni asignar una sede arbitraria) y recién entonces aplicar el
`NOT NULL` en una migración posterior.

### 14.9 Verificación

`supabase/snippets/verify-rls-roles.sql` ejecuta 24 comprobaciones sobre la base local
(qué puede y qué no puede cada rol, unicidad de metas por sede, no regresión del flujo
operativo de la supervisora, lectura de vistas y registro de auditoría). Ver
[docs/development/local-supabase.md](../development/local-supabase.md) §10b.
