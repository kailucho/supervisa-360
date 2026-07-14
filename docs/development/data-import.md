# Importar asesores y asociaciones (carga manual)

Según [`out-of-scope.md`](../product/out-of-scope.md) y
[`database-design.md`](../architecture/database-design.md) §10, Supervisa 360
**no tiene pantalla de importación**: la carga inicial de `advisors` y
`associations` se hace una sola vez, a mano, desde **Supabase Studio** (SQL
Editor) contra la base **local** primero y, cuando corresponda, contra la base
de producción. Después de esa carga única, las altas y correcciones puntuales
también se hacen fuera de la app, de una en una.

Este documento es la versión ejecutable de la estrategia descrita en
`database-design.md` §10 (staging + normalización + carga), con las plantillas
concretas de este proyecto.

## 1. Plantillas CSV

En [`supabase/csv-templates/`](../../supabase/csv-templates/):

- [`advisors.csv`](../../supabase/csv-templates/advisors.csv) — columnas
  `code,full_name`.
- [`associations.csv`](../../supabase/csv-templates/associations.csv) —
  columnas `bank_code,name,region_code,status,advisor_code`.

Reglas de cada columna:

| Columna (associations.csv) | Regla                                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `bank_code`                | Exactamente 5 dígitos. Mantenlo como texto en Excel (ceros a la izquierda).                                          |
| `name`                     | No vacío. La unicidad de nombre **no** está forzada en la base todavía (ver aviso más abajo).                        |
| `region_code`              | `AREQUIPA` o `TACNA` (debe existir en `regions.code`).                                                               |
| `status`                   | Uno de: `NUEVA`, `NORMAL`, `MORA`, `DESERCION`, `REORGANIZACION`, `PROCESO_DISOLUCION`, `DISUELTA`. Vacío → `NUEVA`. |
| `advisor_code`             | Debe existir ya en `advisors.code` (carga primero los asesores).                                                     |

**Orden de carga obligatorio: `advisors` antes que `associations`**, porque
`associations.advisor_id` es `NOT NULL` y referencia a `advisors`.

> **Aviso — nombre de asociación:** por diseño (`database-design.md` §12,
> riesgo 2), la migración inicial **no** crea todavía un índice único sobre
> `associations.name`: se espera limpiar el CSV real primero (mayúsculas
> inconsistentes, espacios). Revisa manualmente que no haya nombres
> duplicados antes o después de cargar; el índice único normalizado se agrega
> en una migración posterior, una vez confirmado con el dueño del producto.

## 2. Preparar las tablas de staging

En **Supabase Studio → SQL Editor** (local primero: `http://127.0.0.1:54323`):

```sql
create table if not exists staging_advisors (
  code text,
  full_name text
);

create table if not exists staging_associations (
  bank_code text,
  name text,
  region_code text,
  status text,
  advisor_code text
);
```

## 3. Cargar los CSV a staging

**Table Editor → selecciona `staging_advisors` → Insert → Import data from
CSV** y sube `advisors.csv`. Repite con `staging_associations` y
`associations.csv`.

(Alternativa por línea de comandos, si tienes `psql` a mano:
`\copy staging_advisors from 'advisors.csv' csv header`.)

## 4. Normalizar y cargar `advisors`

```sql
insert into public.advisors (code, full_name)
select
  upper(btrim(code)),
  regexp_replace(btrim(full_name), '\s+', ' ', 'g')
from staging_advisors
where btrim(code) <> ''
on conflict (code) do update
set full_name = excluded.full_name;
```

## 5. Normalizar y cargar `associations`

```sql
insert into public.associations (bank_code, name, region_id, status, advisor_id)
select
  lpad(btrim(s.bank_code), 5, '0'),
  regexp_replace(btrim(s.name), '\s+', ' ', 'g'),
  r.id,
  coalesce(nullif(upper(btrim(s.status)), ''), 'NUEVA')::public.association_status,
  a.id
from staging_associations s
join public.regions r on r.code = upper(btrim(s.region_code))
join public.advisors a on a.code = upper(btrim(s.advisor_code))
where lpad(btrim(s.bank_code), 5, '0') ~ '^[0-9]{5}$'
on conflict (bank_code) do update
set
  name = excluded.name,
  region_id = excluded.region_id,
  status = excluded.status,
  advisor_id = excluded.advisor_id;
```

Si una fila no aparece después de este `INSERT`, revisa: `region_code` mal
escrito, `advisor_code` que no existe todavía, o `bank_code` que no tiene 5
dígitos.

## 6. Verificar y limpiar

```sql
-- Cuántas filas de staging no lograron mapearse (deberían ser 0 antes de dar
-- por buena la carga):
select count(*) from staging_associations s
where not exists (select 1 from public.regions r where r.code = upper(btrim(s.region_code)))
   or not exists (select 1 from public.advisors a where a.code = upper(btrim(s.advisor_code)));

-- Nombres duplicados (revisar a mano; ver el aviso de la sección 1):
select name, count(*) from public.associations group by name having count(*) > 1;

drop table if exists staging_advisors;
drop table if exists staging_associations;
```

## 7. Metas del mes en curso

Una vez que existan las dos supervisoras en `profiles` (ver
[`local-supabase.md`](local-supabase.md) §10), crea las metas del mes actual
para que aparezcan en el panel:

```sql
select private.create_monthly_goals_for_active_supervisors();
```

Los meses siguientes ya no requieren este paso: lo hace automáticamente el job
de `pg_cron` (ver la migración inicial, sección 8).

## 8. Producción

El mismo procedimiento aplica contra el proyecto remoto de Supabase, **desde
el SQL Editor del panel de Supabase en la nube**, nunca desde este repositorio
ni con `supabase db push`/`--linked`. Repite los pasos 2 a 7 ahí, con el CSV
real ya limpio.
