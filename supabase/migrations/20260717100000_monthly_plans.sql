-- =============================================================================
-- Supervisa 360 — Planificación mensual de asesores por supervisora y sede
--
-- Contenido:
--   1. Tabla public.monthly_plans (cabecera: supervisora × sede × año × mes).
--   2. Tabla public.monthly_plan_advisor_assignments (historial completo de
--      incorporaciones y retiros; una asignación está activa si removed_at es
--      null).
--   3. Exclusividad: un asesor solo puede estar seleccionado por UNA supervisora
--      para la misma sede y periodo, garantizada con un índice único parcial
--      sobre columnas denormalizadas (region_id, year, month) mantenidas por
--      trigger.
--   4. RPC transaccional public.save_monthly_plan: guarda la selección completa
--      (crea cabecera, cierra retiros, crea incorporaciones) validando rol y
--      propiedad. public.add_advisor_to_monthly_plan agrega un solo asesor (flujo
--      "programar fuera de mi planificación") con la misma lógica.
--   5. RLS: lectura para cualquier perfil activo (las supervisoras necesitan ver
--      qué asesores ya están tomados y la jefatura consulta todo); ninguna
--      escritura directa: todas las mutaciones pasan por las RPC.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Cabecera de planificación
-- -----------------------------------------------------------------------------

create table public.monthly_plans (
  id             uuid primary key default gen_random_uuid(),
  supervisor_id  uuid not null references public.profiles(id) on delete restrict,
  region_id      uuid not null references public.regions(id) on delete restrict,
  year           smallint not null check (year between 2025 and 2100),
  month          smallint not null check (month between 1 and 12),
  -- Momento de la primera configuración del periodo (primer "Guardar").
  configured_at  timestamptz null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint monthly_plans_supervisor_region_period_unique
    unique (supervisor_id, region_id, year, month)
);

comment on table public.monthly_plans is
  'Planificación mensual de una supervisora: qué asesores trabajará en una sede y periodo. La selección puede ser vacía.';

create trigger trg_monthly_plans_set_updated_at
  before update on public.monthly_plans
  for each row
  execute function public.set_updated_at();

create index monthly_plans_region_period_idx
  on public.monthly_plans (region_id, year, month);

-- -----------------------------------------------------------------------------
-- 2. Historial de asignaciones de asesores
-- -----------------------------------------------------------------------------

create table public.monthly_plan_advisor_assignments (
  id               uuid primary key default gen_random_uuid(),
  monthly_plan_id  uuid not null
                     references public.monthly_plans(id) on delete restrict,
  advisor_id       uuid not null references public.advisors(id) on delete restrict,

  -- Denormalizadas desde la cabecera (las fija el trigger, nunca el cliente):
  -- permiten la exclusividad por sede+periodo con un índice único parcial.
  region_id        uuid not null references public.regions(id) on delete restrict,
  year             smallint not null,
  month            smallint not null,

  selected_by      uuid not null references public.profiles(id) on delete restrict,
  selected_at      timestamptz not null default now(),
  removed_by       uuid null references public.profiles(id) on delete restrict,
  removed_at       timestamptz null,

  constraint monthly_plan_assignments_removal_consistency
    check (
      (removed_at is null and removed_by is null)
      or (removed_at is not null and removed_by is not null)
    )
);

comment on table public.monthly_plan_advisor_assignments is
  'Historial completo de incorporaciones y retiros de asesores en una planificación. Activa = removed_at IS NULL. Retirar y volver a agregar crea una fila nueva sin borrar la anterior.';

-- Exclusividad: un asesor no puede tener dos asignaciones activas en la misma
-- sede y periodo (ni con la misma supervisora ni con otra).
create unique index monthly_plan_assignments_active_unique
  on public.monthly_plan_advisor_assignments (advisor_id, region_id, year, month)
  where removed_at is null;

create index monthly_plan_assignments_plan_idx
  on public.monthly_plan_advisor_assignments (monthly_plan_id);

create index monthly_plan_assignments_advisor_idx
  on public.monthly_plan_advisor_assignments (advisor_id);

-- Mantiene las columnas denormalizadas coherentes con la cabecera y las vuelve
-- inmutables ante updates directos.
create or replace function public.monthly_plan_assignments_sync_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_plan public.monthly_plans%rowtype;
begin
  select * into v_plan
  from public.monthly_plans mp
  where mp.id = new.monthly_plan_id;

  if not found then
    raise exception 'No existe la planificación con id %', new.monthly_plan_id;
  end if;

  new.region_id := v_plan.region_id;
  new.year := v_plan.year;
  new.month := v_plan.month;

  if tg_op = 'UPDATE' then
    if new.monthly_plan_id is distinct from old.monthly_plan_id
       or new.advisor_id is distinct from old.advisor_id
       or new.selected_by is distinct from old.selected_by
       or new.selected_at is distinct from old.selected_at then
      raise exception
        'Una asignación solo admite registrar su retiro (removed_by / removed_at)';
    end if;
    if old.removed_at is not null then
      raise exception 'La asignación ya fue retirada y es inmutable';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_monthly_plan_assignments_sync_plan
  before insert or update on public.monthly_plan_advisor_assignments
  for each row
  execute function public.monthly_plan_assignments_sync_plan();

-- -----------------------------------------------------------------------------
-- 3. RPC transaccional para guardar la selección completa
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER: las tablas no conceden INSERT/UPDATE a authenticated; toda
-- mutación pasa por aquí, que valida rol SUPERVISOR y que la planificación sea
-- la del propio usuario (auth.uid()). El bloqueo FOR UPDATE de la cabecera
-- serializa guardados concurrentes de la misma supervisora; el índice único
-- parcial cubre la carrera entre supervisoras distintas.
create or replace function public.save_monthly_plan(
  p_region_id uuid,
  p_year int,
  p_month int,
  p_advisor_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_plan_id uuid;
  v_conflict_advisor text;
  v_conflict_supervisor text;
begin
  if (select public.current_app_role()) is distinct from 'SUPERVISOR' then
    raise exception 'Solo una supervisora activa puede modificar su planificación'
      using errcode = '42501';
  end if;

  if p_year not between 2025 and 2100 or p_month not between 1 and 12 then
    raise exception 'Periodo inválido: %-%', p_year, p_month;
  end if;

  -- Cabecera: crear si no existe (la planificación puede ser vacía).
  insert into public.monthly_plans (supervisor_id, region_id, year, month)
  values (v_user, p_region_id, p_year, p_month)
  on conflict (supervisor_id, region_id, year, month) do nothing;

  select mp.id into v_plan_id
  from public.monthly_plans mp
  where mp.supervisor_id = v_user
    and mp.region_id = p_region_id
    and mp.year = p_year
    and mp.month = p_month
  for update;

  -- Cerrar asignaciones activas que ya no están en la selección.
  update public.monthly_plan_advisor_assignments a
  set removed_by = v_user,
      removed_at = now()
  where a.monthly_plan_id = v_plan_id
    and a.removed_at is null
    and a.advisor_id <> all (coalesce(p_advisor_ids, '{}'::uuid[]));

  -- Crear las incorporaciones nuevas (periodo de asignación nuevo si se
  -- retiró y se vuelve a agregar).
  begin
    insert into public.monthly_plan_advisor_assignments (
      monthly_plan_id, advisor_id, selected_by
    )
    select v_plan_id, adv.id, v_user
    from unnest(coalesce(p_advisor_ids, '{}'::uuid[])) as sel(advisor_id)
    join public.advisors adv on adv.id = sel.advisor_id
    where not exists (
      select 1
      from public.monthly_plan_advisor_assignments cur
      where cur.monthly_plan_id = v_plan_id
        and cur.advisor_id = adv.id
        and cur.removed_at is null
    );
  exception
    when unique_violation then
      -- Otro guardado tomó un asesor de la lista para esta sede y periodo.
      select adv.full_name, p.full_name
      into v_conflict_advisor, v_conflict_supervisor
      from public.monthly_plan_advisor_assignments a
      join public.monthly_plans mp on mp.id = a.monthly_plan_id
      join public.advisors adv on adv.id = a.advisor_id
      join public.profiles p on p.id = mp.supervisor_id
      where a.removed_at is null
        and a.region_id = p_region_id
        and a.year = p_year
        and a.month = p_month
        and mp.supervisor_id <> v_user
        and a.advisor_id = any (coalesce(p_advisor_ids, '{}'::uuid[]))
      limit 1;

      raise exception
        'ADVISOR_TAKEN: El asesor % ya está asignado a % en esta sede y periodo',
        coalesce(v_conflict_advisor, 'seleccionado'),
        coalesce(v_conflict_supervisor, 'otra supervisora');
  end;

  update public.monthly_plans mp
  set configured_at = coalesce(mp.configured_at, now()),
      updated_at = now()
  where mp.id = v_plan_id;

  return v_plan_id;
end;
$$;

comment on function public.save_monthly_plan(uuid, int, int, uuid[]) is
  'Guarda la selección completa de asesores de la supervisora autenticada para una sede y periodo. Crea la cabecera si no existe, cierra retiros y crea incorporaciones de forma transaccional.';

-- Agrega un único asesor a la planificación (flujo "programar visita fuera de
-- mi planificación"): misma lógica y garantías que save_monthly_plan.
create or replace function public.add_advisor_to_monthly_plan(
  p_region_id uuid,
  p_year int,
  p_month int,
  p_advisor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_plan_id uuid;
  v_conflict_supervisor text;
begin
  if (select public.current_app_role()) is distinct from 'SUPERVISOR' then
    raise exception 'Solo una supervisora activa puede modificar su planificación'
      using errcode = '42501';
  end if;

  insert into public.monthly_plans (supervisor_id, region_id, year, month)
  values (v_user, p_region_id, p_year, p_month)
  on conflict (supervisor_id, region_id, year, month) do nothing;

  select mp.id into v_plan_id
  from public.monthly_plans mp
  where mp.supervisor_id = v_user
    and mp.region_id = p_region_id
    and mp.year = p_year
    and mp.month = p_month
  for update;

  begin
    insert into public.monthly_plan_advisor_assignments (
      monthly_plan_id, advisor_id, selected_by
    )
    select v_plan_id, p_advisor_id, v_user
    where not exists (
      select 1
      from public.monthly_plan_advisor_assignments cur
      where cur.monthly_plan_id = v_plan_id
        and cur.advisor_id = p_advisor_id
        and cur.removed_at is null
    );
  exception
    when unique_violation then
      select p.full_name into v_conflict_supervisor
      from public.monthly_plan_advisor_assignments a
      join public.monthly_plans mp on mp.id = a.monthly_plan_id
      join public.profiles p on p.id = mp.supervisor_id
      where a.removed_at is null
        and a.region_id = p_region_id
        and a.year = p_year
        and a.month = p_month
        and a.advisor_id = p_advisor_id
      limit 1;

      raise exception
        'ADVISOR_TAKEN: El asesor ya está asignado a % en esta sede y periodo',
        coalesce(v_conflict_supervisor, 'otra supervisora');
  end;

  update public.monthly_plans mp
  set configured_at = coalesce(mp.configured_at, now()),
      updated_at = now()
  where mp.id = v_plan_id;

  return v_plan_id;
end;
$$;

comment on function public.add_advisor_to_monthly_plan(uuid, int, int, uuid) is
  'Incorpora un asesor a la planificación de la supervisora autenticada (sede + periodo), creando la cabecera si hace falta. Falla con ADVISOR_TAKEN si otra supervisora ya lo tiene activo.';

revoke all on function public.save_monthly_plan(uuid, int, int, uuid[])
  from public, anon;
grant execute on function public.save_monthly_plan(uuid, int, int, uuid[])
  to authenticated;

revoke all on function public.add_advisor_to_monthly_plan(uuid, int, int, uuid)
  from public, anon;
grant execute on function public.add_advisor_to_monthly_plan(uuid, int, int, uuid)
  to authenticated;

-- -----------------------------------------------------------------------------
-- 4. RLS y privilegios
-- -----------------------------------------------------------------------------

alter table public.monthly_plans enable row level security;
alter table public.monthly_plan_advisor_assignments enable row level security;

revoke all privileges on table public.monthly_plans
  from anon, authenticated;
revoke all privileges on table public.monthly_plan_advisor_assignments
  from anon, authenticated;

-- Lectura para cualquier perfil activo: las supervisoras necesitan ver las
-- selecciones de la otra supervisora (exclusividad visible en la interfaz) y
-- la jefatura consulta todas las planificaciones sin poder modificarlas.
create policy monthly_plans_select
  on public.monthly_plans
  for select
  to authenticated
  using ((select public.current_app_role()) is not null);

create policy monthly_plan_assignments_select
  on public.monthly_plan_advisor_assignments
  for select
  to authenticated
  using ((select public.current_app_role()) is not null);

grant select on table public.monthly_plans to authenticated;
grant select on table public.monthly_plan_advisor_assignments to authenticated;

-- Sin INSERT/UPDATE/DELETE directos para nadie (incluida la jefatura): las
-- únicas escrituras posibles son las RPC SECURITY DEFINER de arriba, que
-- validan rol SUPERVISOR y propiedad de la planificación.

-- -----------------------------------------------------------------------------
-- 5. Auditoría
-- -----------------------------------------------------------------------------

create trigger trg_monthly_plans_audit
  after insert or update or delete on public.monthly_plans
  for each row
  execute function private.log_audit_event();

create trigger trg_monthly_plan_assignments_audit
  after insert or update or delete on public.monthly_plan_advisor_assignments
  for each row
  execute function private.log_audit_event();
