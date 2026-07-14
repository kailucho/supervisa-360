-- =============================================================================
-- Supervisa 360 — Migración inicial corregida
-- PostgreSQL / Supabase
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Extensiones y esquema privado
-- -----------------------------------------------------------------------------

-- Supabase suele disponer del esquema `extensions`; se crea por seguridad local.
create schema if not exists extensions;

-- Se utilizará posteriormente durante la normalización de la carga CSV.
create extension if not exists unaccent with schema extensions;

-- Automatización mensual. Supabase Cron utiliza internamente pg_cron.
create extension if not exists pg_cron;

-- Funciones SECURITY DEFINER y tareas internas fuera del esquema expuesto `public`.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 1. Enumeraciones
-- -----------------------------------------------------------------------------

create type public.association_status as enum (
  'NUEVA',
  'NORMAL',
  'MORA',
  'DESERCION',
  'REORGANIZACION',
  'PROCESO_DISOLUCION',
  'DISUELTA'
);

create type public.visit_type as enum (
  'ORDINARIA',
  'SEGUIMIENTO',
  'MORA',
  'DESERCION',
  'CIERRE'
);

create type public.visit_modality as enum (
  'VIRTUAL',
  'PRESENCIAL'
);

create type public.visit_characteristic as enum (
  'ANUNCIADA',
  'ANONIMA',
  'SORPRESIVA'
);

create type public.visit_status as enum (
  'PROGRAMADA',
  'REPROGRAMADA',
  'CANCELADA',
  'REALIZADA',
  'NO_REALIZADA'
);

-- -----------------------------------------------------------------------------
-- 2. Función compartida para updated_at
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Tablas
-- -----------------------------------------------------------------------------

-- profiles --------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete restrict,
  full_name   text not null check (length(btrim(full_name)) > 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- regions ---------------------------------------------------------------------

create table public.regions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (length(btrim(code)) > 0),
  name        text not null check (length(btrim(name)) > 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_regions_set_updated_at
  before update on public.regions
  for each row
  execute function public.set_updated_at();

-- advisors --------------------------------------------------------------------

create table public.advisors (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (length(btrim(code)) > 0),
  full_name   text not null check (length(btrim(full_name)) > 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_advisors_set_updated_at
  before update on public.advisors
  for each row
  execute function public.set_updated_at();

-- associations ----------------------------------------------------------------

create table public.associations (
  id          uuid primary key default gen_random_uuid(),
  bank_code   text not null unique check (bank_code ~ '^[0-9]{5}$'),
  name        text not null check (length(btrim(name)) > 0),
  region_id   uuid not null references public.regions(id) on delete restrict,
  status      public.association_status not null default 'NUEVA',
  advisor_id  uuid not null references public.advisors(id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- El índice único normalizado de `name` se crea después de limpiar/importar el
-- CSV, para detectar previamente nombres equivalentes o duplicados.

create trigger trg_associations_set_updated_at
  before update on public.associations
  for each row
  execute function public.set_updated_at();

-- visits ----------------------------------------------------------------------

create table public.visits (
  id                    uuid primary key default gen_random_uuid(),
  association_id        uuid not null
                          references public.associations(id) on delete restrict,
  supervisor_id         uuid not null
                          references public.profiles(id) on delete restrict,
  scheduled_advisor_id  uuid not null
                          references public.advisors(id) on delete restrict,

  visit_type            public.visit_type not null,
  modality              public.visit_modality not null,
  characteristic        public.visit_characteristic not null,

  scheduled_date        date not null,
  scheduled_time        time null,
  status                public.visit_status not null default 'PROGRAMADA',

  performed_date        date null,
  start_time            time null,
  end_time              time null,
  score                 smallint null check (score between 0 and 5),
  general_comment       text null,

  -- Auditoría del resultado.
  performed_by          uuid null
                          references public.profiles(id) on delete restrict,
  result_updated_at     timestamptz null,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint visits_hours_order
    check (
      start_time is null
      or end_time is null
      or end_time >= start_time
    ),

  -- Virtual: anunciada o anónima.
  -- Presencial: anunciada o sorpresiva.
  constraint visits_modality_characteristic
    check (
      (modality = 'VIRTUAL'
        and characteristic in ('ANUNCIADA', 'ANONIMA'))
      or
      (modality = 'PRESENCIAL'
        and characteristic in ('ANUNCIADA', 'SORPRESIVA'))
    ),

  constraint visits_result_completeness
    check (
      (
        status = 'REALIZADA'
        and performed_date is not null
        and score is not null
        and length(btrim(coalesce(general_comment, ''))) > 0
      )
      or
      (
        status <> 'REALIZADA'
        and performed_date is null
        and start_time is null
        and end_time is null
        and score is null
        and general_comment is null
        and performed_by is null
        and result_updated_at is null
      )
    )
);

comment on column public.visits.scheduled_advisor_id is
  'Snapshot del asesor al programar la visita. Es inmutable y el trigger BEFORE INSERT reemplaza cualquier valor enviado por el cliente.';

comment on column public.visits.performed_by is
  'Usuario autenticado que modificó por última vez el resultado. Lo fija el trigger; no es editable desde la aplicación.';

-- monthly_goals ---------------------------------------------------------------

create table public.monthly_goals (
  id             uuid primary key default gen_random_uuid(),
  supervisor_id  uuid not null
                   references public.profiles(id) on delete restrict,
  year           smallint not null check (year between 2025 and 2100),
  month          smallint not null check (month between 1 and 12),
  target_visits  smallint not null check (target_visits >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint monthly_goals_supervisor_period_unique
    unique (supervisor_id, year, month)
);

create trigger trg_monthly_goals_set_updated_at
  before update on public.monthly_goals
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Triggers especializados de visits
-- -----------------------------------------------------------------------------

-- BEFORE INSERT:
--   1. Solo permite el estado inicial PROGRAMADA.
--   2. Verifica que existan la asociación y la supervisora.
--   3. Impide programar asociaciones no supervisables.
--   4. Obtiene el asesor actual directamente desde associations.

create or replace function public.visits_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_association_status   public.association_status;
  v_current_advisor_id   uuid;
  v_supervisor_is_active boolean;
begin
  if new.status is distinct from 'PROGRAMADA'::public.visit_status then
    raise exception
      'Una visita nueva solo puede crearse con estado PROGRAMADA (recibido: %)',
      new.status;
  end if;

  select
    a.status,
    a.advisor_id
  into
    v_association_status,
    v_current_advisor_id
  from public.associations a
  where a.id = new.association_id
  for share;

  if not found then
    raise exception
      'No existe la asociación con id %',
      new.association_id;
  end if;

  if v_association_status in (
    'REORGANIZACION',
    'PROCESO_DISOLUCION',
    'DISUELTA'
  ) then
    raise exception
      'No se puede programar una visita: la asociación está en estado %',
      v_association_status;
  end if;

  select p.is_active
  into v_supervisor_is_active
  from public.profiles p
  where p.id = new.supervisor_id;

  if not found then
    raise exception
      'No existe el perfil de la supervisora con id %',
      new.supervisor_id;
  end if;

  if v_supervisor_is_active is not true then
    raise exception
      'La supervisora con id % está inactiva',
      new.supervisor_id;
  end if;

  -- Snapshot real; nunca se confía en el valor enviado por el cliente.
  new.scheduled_advisor_id := v_current_advisor_id;

  -- Las columnas de auditoría son administradas exclusivamente por el trigger.
  new.performed_by := null;
  new.result_updated_at := null;

  return new;
end;
$$;

create trigger trg_visits_before_insert
  before insert on public.visits
  for each row
  execute function public.visits_before_insert();

-- BEFORE UPDATE:
--   - Identidad inmutable.
--   - Estados finales sin reapertura.
--   - CANCELADA y NO_REALIZADA completamente congeladas.
--   - REALIZADA solo permite corregir su resultado.
--   - Auditoría del resultado administrada por el servidor.

create or replace function public.visits_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_is_active_old    boolean;
  v_is_final_old     boolean;
  v_result_changed   boolean;
  v_plan_changed     boolean;
  v_frozen_changed   boolean;
begin
  v_is_active_old := old.status in ('PROGRAMADA', 'REPROGRAMADA');
  v_is_final_old  := old.status in ('CANCELADA', 'REALIZADA', 'NO_REALIZADA');

  v_result_changed :=
       new.score           is distinct from old.score
    or new.general_comment is distinct from old.general_comment
    or new.start_time      is distinct from old.start_time
    or new.end_time        is distinct from old.end_time
    or new.performed_date  is distinct from old.performed_date;

  v_plan_changed :=
       new.scheduled_date  is distinct from old.scheduled_date
    or new.scheduled_time  is distinct from old.scheduled_time
    or new.visit_type      is distinct from old.visit_type
    or new.modality        is distinct from old.modality
    or new.characteristic  is distinct from old.characteristic;

  -- Se ignoran valores enviados directamente a las columnas de auditoría.
  new.performed_by := old.performed_by;
  new.result_updated_at := old.result_updated_at;

  -- a) Identidad inmutable en cualquier estado.
  if new.association_id is distinct from old.association_id then
    raise exception 'association_id es inmutable';
  end if;

  if new.supervisor_id is distinct from old.supervisor_id then
    raise exception 'supervisor_id es inmutable';
  end if;

  if new.scheduled_advisor_id is distinct from old.scheduled_advisor_id then
    raise exception
      'scheduled_advisor_id es inmutable: representa el asesor al programar';
  end if;

  -- b) Ningún estado final puede cambiar a otro estado.
  if v_is_final_old and new.status is distinct from old.status then
    raise exception
      'La visita está en estado final (%) y no puede cambiar de estado',
      old.status;
  end if;

  -- c) CANCELADA y NO_REALIZADA quedan totalmente congeladas.
  if old.status in ('CANCELADA', 'NO_REALIZADA') then
    v_frozen_changed :=
         v_plan_changed
      or v_result_changed;

    if v_frozen_changed then
      raise exception
        'Una visita en estado % no permite modificaciones',
        old.status;
    end if;
  end if;

  -- d) Mientras esté activa, no admite resultado salvo al cerrarse REALIZADA.
  if v_is_active_old
     and new.status <> 'REALIZADA'
     and v_result_changed then
    raise exception
      'No se pueden editar columnas de resultado mientras la visita está activa, salvo al cerrarla como REALIZADA';
  end if;

  -- e) Una visita realizada conserva congelada toda su planificación.
  if old.status = 'REALIZADA' and v_plan_changed then
    raise exception
      'Una visita REALIZADA solo permite corregir el resultado';
  end if;

  -- f) Auditoría del resultado.
  if v_result_changed then
    new.performed_by := auth.uid();
    new.result_updated_at := now();
  end if;

  new.updated_at := now();

  return new;
end;
$$;

create trigger trg_visits_before_update
  before update on public.visits
  for each row
  execute function public.visits_before_update();

-- -----------------------------------------------------------------------------
-- 5. Índices
-- -----------------------------------------------------------------------------

-- Solo puede existir una visita activa por asociación.
create unique index visits_one_active_per_association
  on public.visits (association_id)
  where status in ('PROGRAMADA', 'REPROGRAMADA');

create index visits_scheduled_date_idx
  on public.visits (scheduled_date);

create index visits_status_scheduled_date_idx
  on public.visits (status, scheduled_date);

create index visits_association_scheduled_date_idx
  on public.visits (association_id, scheduled_date desc);

create index visits_supervisor_status_performed_date_idx
  on public.visits (supervisor_id, status, performed_date);

create index visits_scheduled_advisor_idx
  on public.visits (scheduled_advisor_id);

create index associations_region_idx
  on public.associations (region_id);

create index associations_status_idx
  on public.associations (status);

create index associations_advisor_idx
  on public.associations (advisor_id);

-- -----------------------------------------------------------------------------
-- 6. RLS y privilegios
-- -----------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.regions       enable row level security;
alter table public.advisors      enable row level security;
alter table public.associations  enable row level security;
alter table public.visits        enable row level security;
alter table public.monthly_goals enable row level security;

-- Se eliminan primero los privilegios que Supabase concede por defecto.
revoke all privileges on table public.profiles
  from anon, authenticated;
revoke all privileges on table public.regions
  from anon, authenticated;
revoke all privileges on table public.advisors
  from anon, authenticated;
revoke all privileges on table public.associations
  from anon, authenticated;
revoke all privileges on table public.visits
  from anon, authenticated;
revoke all privileges on table public.monthly_goals
  from anon, authenticated;

-- profiles: cualquier usuario autenticado puede resolver nombres/perfiles.
create policy profiles_select
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) is not null);

-- Las demás lecturas requieren un perfil activo.
create policy regions_select
  on public.regions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active = true
    )
  );

create policy advisors_select
  on public.advisors
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active = true
    )
  );

create policy associations_select
  on public.associations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active = true
    )
  );

create policy visits_select
  on public.visits
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active = true
    )
  );

create policy monthly_goals_select
  on public.monthly_goals
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active = true
    )
  );

grant select on table public.profiles
  to authenticated;
grant select on table public.regions
  to authenticated;
grant select on table public.advisors
  to authenticated;
grant select on table public.associations
  to authenticated;
grant select on table public.visits
  to authenticated;
grant select on table public.monthly_goals
  to authenticated;

-- associations: las supervisoras activas pueden cambiar solo estado y asesor.
create policy associations_update
  on public.associations
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active = true
    )
  );

grant update (status, advisor_id)
  on table public.associations
  to authenticated;

-- visits: la creación debe pertenecer al usuario autenticado.
create policy visits_insert_own
  on public.visits
  for insert
  to authenticated
  with check (
    supervisor_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active = true
    )
  );

-- Ambas supervisoras activas pueden coordinar/cerrar visitas.
create policy visits_update
  on public.visits
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active = true
    )
  );

grant insert (
  association_id,
  supervisor_id,
  scheduled_advisor_id,
  visit_type,
  modality,
  characteristic,
  scheduled_date,
  scheduled_time
)
on table public.visits
to authenticated;

grant update (
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
)
on table public.visits
to authenticated;

-- monthly_goals: cada supervisora administra únicamente su meta.
create policy monthly_goals_insert_own
  on public.monthly_goals
  for insert
  to authenticated
  with check (
    supervisor_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active = true
    )
  );

create policy monthly_goals_update_own
  on public.monthly_goals
  for update
  to authenticated
  using (
    supervisor_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active = true
    )
  )
  with check (
    supervisor_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active = true
    )
  );

grant insert (
  supervisor_id,
  year,
  month,
  target_visits
)
on table public.monthly_goals
to authenticated;

grant update (target_visits)
on table public.monthly_goals
to authenticated;

-- No se concede DELETE sobre ninguna tabla.

-- -----------------------------------------------------------------------------
-- 7. Vista de progreso mensual
-- -----------------------------------------------------------------------------

create view public.v_monthly_progress
with (security_invoker = true)
as
with goals as (
  select
    g.supervisor_id,
    g.year,
    g.month,
    g.target_visits,
    make_date(g.year, g.month, 1) as month_start,
    (
      make_date(g.year, g.month, 1)
      + interval '1 month'
    )::date as next_month_start
  from public.monthly_goals g
)
select
  g.supervisor_id,
  g.year,
  g.month,
  g.target_visits as individual_target,
  c.individual_done,
  c.individual_active,
  sum(g.target_visits)
    over (partition by g.year, g.month) as joint_target,
  sum(c.individual_done)
    over (partition by g.year, g.month) as joint_done,
  sum(c.individual_active)
    over (partition by g.year, g.month) as joint_active
from goals g
left join lateral (
  select
    count(*) filter (
      where v.status = 'REALIZADA'
        and v.performed_date >= g.month_start
        and v.performed_date < g.next_month_start
    ) as individual_done,
    count(*) filter (
      where v.status in ('PROGRAMADA', 'REPROGRAMADA')
        and v.scheduled_date >= g.month_start
        and v.scheduled_date < g.next_month_start
    ) as individual_active
  from public.visits v
  where v.supervisor_id = g.supervisor_id
) c on true;

revoke all privileges on table public.v_monthly_progress
  from public, anon, authenticated;

grant select on table public.v_monthly_progress
  to authenticated;

-- -----------------------------------------------------------------------------
-- 8. Automatización de monthly_goals
-- -----------------------------------------------------------------------------

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
    year,
    month,
    target_visits
  )
  select
    p.id,
    p_year,
    p_month,
    0
  from public.profiles p
  where p.is_active = true
  on conflict (supervisor_id, year, month) do nothing;
end;
$$;

comment on function
  private.create_monthly_goals_for_active_supervisors(smallint, smallint)
is
  'Crea target_visits = 0 para cada supervisora activa que todavía no tenga una meta en el año y mes indicados.';

-- No se expone como RPC a anon/authenticated.
revoke all on function
  private.create_monthly_goals_for_active_supervisors(smallint, smallint)
from public, anon, authenticated;

-- El job corre el día 1 de cada mes a las 06:00 UTC (01:00 en Perú).
select cron.schedule(
  'create-monthly-goals',
  '0 6 1 * *',
  $cron$
    select private.create_monthly_goals_for_active_supervisors();
  $cron$
);

-- -----------------------------------------------------------------------------
-- 9. Datos de referencia
-- -----------------------------------------------------------------------------

insert into public.regions (code, name)
values
  ('AREQUIPA', 'Arequipa'),
  ('TACNA', 'Tacna')
on conflict (code)
do update set
  name = excluded.name,
  is_active = true;

-- =============================================================================
-- Pendiente en pasos/migraciones posteriores:
--
-- 1. Crear los usuarios en Supabase Auth y sus filas correspondientes en
--    public.profiles.
-- 2. Cargar advisors y associations mediante staging/CSV.
-- 3. Limpiar los nombres importados.
-- 4. Crear el índice único normalizado de associations.name.
-- 5. Crear las metas del mes en curso, una vez que existan los perfiles:
--
--    select private.create_monthly_goals_for_active_supervisors();
--
-- =============================================================================
