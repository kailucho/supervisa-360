-- =============================================================================
-- Supervisa 360 — Rol Jefe de Supervisión, metas por sede y auditoría
--
-- Contenido:
--   1. Enum public.app_role y columna profiles.role.
--   2. Metas personales por sede: monthly_goals.region_id (NOT NULL) y unicidad
--      (supervisor_id, region_id, year, month). Los datos locales existentes se
--      eliminan (entorno de desarrollo; el seed los recrea). En un entorno con
--      datos reales habría que poblar region_id manualmente antes del NOT NULL.
--   3. Tabla public.regional_monthly_goals (meta conjunta por sede y mes).
--   4. Función public.current_app_role() para RLS.
--   5. Reescritura de políticas RLS con control por rol (RN-28..RN-31).
--   6. Reemplazo de private.create_monthly_goals_for_active_supervisors
--      (ahora crea meta 0 por supervisora activa × sede activa).
--   7. Vistas v_individual_monthly_progress y v_joint_monthly_progress
--      (reemplazan v_monthly_progress; la sede de una visita es la sede de su
--      asociación).
--   8. Auditoría: private.audit_logs + trigger genérico en 5 tablas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Rol de aplicación
-- -----------------------------------------------------------------------------

create type public.app_role as enum (
  'SUPERVISOR',
  'SUPERVISION_MANAGER'
);

alter table public.profiles
  add column role public.app_role not null default 'SUPERVISOR';

comment on column public.profiles.role is
  'Rol de aplicación. SUPERVISOR opera visitas y sus metas personales; SUPERVISION_MANAGER solo consulta y administra metas conjuntas por sede.';

-- -----------------------------------------------------------------------------
-- 2. Metas personales por sede
-- -----------------------------------------------------------------------------

-- La vista existente depende de monthly_goals; se elimina antes de alterarla.
drop view public.v_monthly_progress;

-- Solo existen datos locales de desarrollo (decisión registrada): se recrean
-- desde el seed. Con datos reales, este DELETE debería sustituirse por un
-- backfill manual de region_id.
delete from public.monthly_goals;

alter table public.monthly_goals
  add column region_id uuid not null
    references public.regions(id) on delete restrict;

alter table public.monthly_goals
  drop constraint monthly_goals_supervisor_period_unique;

alter table public.monthly_goals
  add constraint monthly_goals_supervisor_region_period_unique
    unique (supervisor_id, region_id, year, month);

create index monthly_goals_region_idx
  on public.monthly_goals (region_id);

-- El grant de INSERT original enumera columnas; se añade la nueva.
grant insert (region_id)
  on table public.monthly_goals
  to authenticated;

comment on column public.monthly_goals.region_id is
  'Sede de la meta personal. Una supervisora puede tener una meta distinta por sede en el mismo mes (RN-29).';

-- -----------------------------------------------------------------------------
-- 3. Meta conjunta mensual por sede
-- -----------------------------------------------------------------------------

create table public.regional_monthly_goals (
  id             uuid primary key default gen_random_uuid(),
  region_id      uuid not null
                   references public.regions(id) on delete restrict,
  year           smallint not null check (year between 2025 and 2100),
  month          smallint not null check (month between 1 and 12),
  target_visits  smallint not null check (target_visits >= 0),

  -- Administradas por trigger a partir de auth.uid(); nullable para permitir
  -- escrituras de mantenimiento sin JWT (seed, service_role).
  created_by     uuid null references public.profiles(id) on delete restrict,
  updated_by     uuid null references public.profiles(id) on delete restrict,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint regional_monthly_goals_region_period_unique
    unique (region_id, year, month)
);

comment on table public.regional_monthly_goals is
  'Meta conjunta mensual definida por el Jefe de Supervisión para una sede. Si no existe fila, la meta efectiva es la suma de metas personales (RN-30).';

create trigger trg_regional_monthly_goals_set_updated_at
  before update on public.regional_monthly_goals
  for each row
  execute function public.set_updated_at();

create or replace function public.regional_monthly_goals_set_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  else
    new.created_by := old.created_by;
  end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger trg_regional_monthly_goals_set_actor
  before insert or update on public.regional_monthly_goals
  for each row
  execute function public.regional_monthly_goals_set_actor();

-- -----------------------------------------------------------------------------
-- 4. Función de rol para RLS
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER para leer profiles sin recursión de RLS. Devuelve NULL si el
-- usuario no tiene perfil activo, de modo que un solo predicado cubre rol y
-- actividad. Vive en public porque las políticas se evalúan como el invocador y
-- authenticated no tiene USAGE sobre el esquema private. Solo revela el rol del
-- propio usuario autenticado.
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active
$$;

revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Políticas RLS por rol
-- -----------------------------------------------------------------------------

-- profiles_select se conserva tal cual (resolución de nombres para cualquier
-- usuario autenticado; sigue sin haber escrituras sobre profiles).

drop policy regions_select            on public.regions;
drop policy advisors_select           on public.advisors;
drop policy associations_select       on public.associations;
drop policy visits_select             on public.visits;
drop policy monthly_goals_select      on public.monthly_goals;
drop policy associations_update       on public.associations;
drop policy visits_insert_own         on public.visits;
drop policy visits_update             on public.visits;
drop policy monthly_goals_insert_own  on public.monthly_goals;
drop policy monthly_goals_update_own  on public.monthly_goals;

-- Lecturas: cualquier perfil activo (ambos roles).

create policy regions_select
  on public.regions
  for select
  to authenticated
  using ((select public.current_app_role()) is not null);

create policy advisors_select
  on public.advisors
  for select
  to authenticated
  using ((select public.current_app_role()) is not null);

create policy associations_select
  on public.associations
  for select
  to authenticated
  using ((select public.current_app_role()) is not null);

create policy visits_select
  on public.visits
  for select
  to authenticated
  using ((select public.current_app_role()) is not null);

create policy monthly_goals_select
  on public.monthly_goals
  for select
  to authenticated
  using ((select public.current_app_role()) is not null);

-- Escrituras operativas: exclusivas del rol SUPERVISOR.

create policy associations_update
  on public.associations
  for update
  to authenticated
  using ((select public.current_app_role()) = 'SUPERVISOR')
  with check ((select public.current_app_role()) = 'SUPERVISOR');

create policy visits_insert_own
  on public.visits
  for insert
  to authenticated
  with check (
    supervisor_id = (select auth.uid())
    and (select public.current_app_role()) = 'SUPERVISOR'
  );

create policy visits_update
  on public.visits
  for update
  to authenticated
  using ((select public.current_app_role()) = 'SUPERVISOR')
  with check ((select public.current_app_role()) = 'SUPERVISOR');

create policy monthly_goals_insert_own
  on public.monthly_goals
  for insert
  to authenticated
  with check (
    supervisor_id = (select auth.uid())
    and (select public.current_app_role()) = 'SUPERVISOR'
  );

create policy monthly_goals_update_own
  on public.monthly_goals
  for update
  to authenticated
  using (
    supervisor_id = (select auth.uid())
    and (select public.current_app_role()) = 'SUPERVISOR'
  )
  with check (
    supervisor_id = (select auth.uid())
    and (select public.current_app_role()) = 'SUPERVISOR'
  );

-- regional_monthly_goals: consulta para perfiles activos, escritura solo jefe.

alter table public.regional_monthly_goals enable row level security;

revoke all privileges on table public.regional_monthly_goals
  from anon, authenticated;

create policy regional_monthly_goals_select
  on public.regional_monthly_goals
  for select
  to authenticated
  using ((select public.current_app_role()) is not null);

create policy regional_monthly_goals_insert
  on public.regional_monthly_goals
  for insert
  to authenticated
  with check ((select public.current_app_role()) = 'SUPERVISION_MANAGER');

create policy regional_monthly_goals_update
  on public.regional_monthly_goals
  for update
  to authenticated
  using ((select public.current_app_role()) = 'SUPERVISION_MANAGER')
  with check ((select public.current_app_role()) = 'SUPERVISION_MANAGER');

create policy regional_monthly_goals_delete
  on public.regional_monthly_goals
  for delete
  to authenticated
  using ((select public.current_app_role()) = 'SUPERVISION_MANAGER');

grant select on table public.regional_monthly_goals to authenticated;
grant insert (region_id, year, month, target_visits)
  on table public.regional_monthly_goals to authenticated;
grant update (target_visits)
  on table public.regional_monthly_goals to authenticated;
grant delete on table public.regional_monthly_goals to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Automatización mensual por sede
-- -----------------------------------------------------------------------------

-- Misma firma: el job pg_cron 'create-monthly-goals' sigue siendo válido.
create or replace function private.create_monthly_goals_for_active_supervisors(
  p_year smallint default
    extract(
      year from timezone('America/Lima', now())
    )::smallint,
  p_month smallint default
    extract(
      month from timezone('America/Lima', now())
    )::smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_year not between 2025 and 2100 then
    raise exception 'Año inválido: %', p_year;
  end if;

  if p_month not between 1 and 12 then
    raise exception 'Mes inválido: %', p_month;
  end if;

  insert into public.monthly_goals (
    supervisor_id,
    region_id,
    year,
    month,
    target_visits
  )
  select
    p.id,
    r.id,
    p_year,
    p_month,
    0
  from public.profiles p
  cross join public.regions r
  where p.is_active = true
    and p.role = 'SUPERVISOR'
    and r.is_active = true
  on conflict (supervisor_id, region_id, year, month) do nothing;
end;
$$;

comment on function
  private.create_monthly_goals_for_active_supervisors(smallint, smallint)
is
  'Crea target_visits = 0 para cada combinación de supervisora activa × sede activa que todavía no tenga meta en el año y mes indicados.';

-- -----------------------------------------------------------------------------
-- 7. Vistas de progreso por sede
-- -----------------------------------------------------------------------------

-- Progreso individual por supervisora y sede. La sede de una visita es la sede
-- de su asociación (RN-31). Las claves provienen de la UNIÓN de metas y visitas,
-- de modo que una visita cuenta aunque la supervisora no tenga meta configurada.
create view public.v_individual_monthly_progress
with (security_invoker = true)
as
with visit_buckets as (
  select
    a.region_id,
    v.supervisor_id,
    extract(year from v.performed_date)::smallint  as year,
    extract(month from v.performed_date)::smallint as month,
    1 as done,
    0 as active
  from public.visits v
  join public.associations a on a.id = v.association_id
  where v.status = 'REALIZADA'

  union all

  select
    a.region_id,
    v.supervisor_id,
    extract(year from v.scheduled_date)::smallint,
    extract(month from v.scheduled_date)::smallint,
    0,
    1
  from public.visits v
  join public.associations a on a.id = v.association_id
  where v.status in ('PROGRAMADA', 'REPROGRAMADA')
),
visit_agg as (
  select
    region_id,
    supervisor_id,
    year,
    month,
    sum(done)::int   as individual_done,
    sum(active)::int as individual_active
  from visit_buckets
  group by region_id, supervisor_id, year, month
),
keys as (
  select supervisor_id, region_id, year, month
  from public.monthly_goals

  union

  select supervisor_id, region_id, year, month
  from visit_agg
)
select
  k.region_id,
  r.name                            as region_name,
  k.supervisor_id,
  p.full_name                       as supervisor_name,
  k.year,
  k.month,
  coalesce(g.target_visits, 0)      as individual_target,
  coalesce(va.individual_done, 0)   as individual_done,
  coalesce(va.individual_active, 0) as individual_active,
  (g.id is not null)                as has_goal
from keys k
join public.regions r  on r.id = k.region_id
join public.profiles p on p.id = k.supervisor_id
left join public.monthly_goals g
  on g.supervisor_id = k.supervisor_id
 and g.region_id = k.region_id
 and g.year = k.year
 and g.month = k.month
left join visit_agg va
  on va.supervisor_id = k.supervisor_id
 and va.region_id = k.region_id
 and va.year = k.year
 and va.month = k.month;

revoke all privileges on table public.v_individual_monthly_progress
  from public, anon, authenticated;

grant select on table public.v_individual_monthly_progress
  to authenticated;

-- Progreso conjunto por sede. meta efectiva = meta configurada por el jefe si
-- existe; de lo contrario, la suma de metas personales (sugerida).
create view public.v_joint_monthly_progress
with (security_invoker = true)
as
with agg as (
  select
    region_id,
    year,
    month,
    sum(individual_target)::int as suggested_joint_target,
    sum(individual_done)::int   as joint_done,
    sum(individual_active)::int as joint_active
  from public.v_individual_monthly_progress
  group by region_id, year, month
),
keys as (
  select region_id, year, month from agg

  union

  select region_id, year, month from public.regional_monthly_goals
)
select
  k.region_id,
  r.name                                as region_name,
  k.year,
  k.month,
  coalesce(a.suggested_joint_target, 0) as suggested_joint_target,
  rg.target_visits                      as configured_joint_target,
  coalesce(
    rg.target_visits::int,
    coalesce(a.suggested_joint_target, 0)
  )                                     as effective_joint_target,
  coalesce(a.joint_done, 0)             as joint_done,
  coalesce(a.joint_active, 0)           as joint_active,
  (rg.id is not null)                   as is_configured
from keys k
join public.regions r on r.id = k.region_id
left join agg a
  on a.region_id = k.region_id
 and a.year = k.year
 and a.month = k.month
left join public.regional_monthly_goals rg
  on rg.region_id = k.region_id
 and rg.year = k.year
 and rg.month = k.month;

revoke all privileges on table public.v_joint_monthly_progress
  from public, anon, authenticated;

grant select on table public.v_joint_monthly_progress
  to authenticated;

-- -----------------------------------------------------------------------------
-- 8. Auditoría en base de datos (sin pantalla en la aplicación)
-- -----------------------------------------------------------------------------

create table private.audit_logs (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   uuid not null,
  operation   text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  user_id     uuid null,
  old_value   jsonb null,
  new_value   jsonb null,
  created_at  timestamptz not null default now()
);

comment on table private.audit_logs is
  'Bitácora de cambios en tablas de negocio. Solo accesible con privilegios elevados (Studio/psql); anon y authenticated no tienen acceso. Las filas creadas por el seed o mantenimiento sin JWT quedan con user_id NULL.';

revoke all privileges on table private.audit_logs
  from public, anon, authenticated;

-- SECURITY DEFINER: el trigger inserta en private.audit_logs aunque quien
-- dispara la operación sea authenticated (sin privilegios sobre ese esquema).
-- Serializa solo filas de tablas public; nunca contenido de auth.users.
create or replace function private.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.audit_logs (
    table_name,
    record_id,
    operation,
    user_id,
    old_value,
    new_value
  )
  values (
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    tg_op,
    auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function private.log_audit_event()
  from public, anon, authenticated;

create trigger trg_profiles_audit
  after insert or update or delete on public.profiles
  for each row
  execute function private.log_audit_event();

create trigger trg_associations_audit
  after insert or update or delete on public.associations
  for each row
  execute function private.log_audit_event();

create trigger trg_visits_audit
  after insert or update or delete on public.visits
  for each row
  execute function private.log_audit_event();

create trigger trg_monthly_goals_audit
  after insert or update or delete on public.monthly_goals
  for each row
  execute function private.log_audit_event();

create trigger trg_regional_monthly_goals_audit
  after insert or update or delete on public.regional_monthly_goals
  for each row
  execute function private.log_audit_event();
