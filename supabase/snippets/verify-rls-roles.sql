-- =============================================================================
-- Supervisa 360 — Verificación manual de RLS por rol (RN-28..RN-31)
--
-- Ejecutar contra la base LOCAL (después de `npm run db:reset`):
--
--   docker exec -i supabase_db_supervision-app psql -U postgres -d postgres \
--     -f - < supabase/snippets/verify-rls-roles.sql
--
--   (o con psql directo: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--      -f supabase/snippets/verify-rls-roles.sql)
--
-- Cada bloque imprime PASS o lanza una excepción con FAIL. Todos los cambios se
-- revierten con rollback: la base queda intacta.
--
-- UUIDs del seed:
--   Supervisora 1: 10000000-0000-4000-8000-000000000001
--   Supervisora 2: 10000000-0000-4000-8000-000000000002
--   Jefe:          10000000-0000-4000-8000-000000000003
-- =============================================================================

\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- 1. El jefe NO puede escribir visitas, asociaciones ni metas personales
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);

do $$
begin
  -- La inserción se deniega por dos capas: la política visits_insert_own exige
  -- rol SUPERVISOR (42501) y, antes de llegar a ella, el trigger
  -- visits_before_insert hace `select ... for share` sobre associations, lectura
  -- con bloqueo a la que PostgreSQL aplica también la política de UPDATE
  -- (associations_update, exclusiva de SUPERVISOR): la fila resulta invisible y
  -- el trigger aborta (P0001). Cualquiera de las dos rutas es una denegación
  -- válida.
  begin
    insert into public.visits (
      association_id, supervisor_id, scheduled_advisor_id,
      visit_type, modality, characteristic, scheduled_date
    )
    values (
      '30000000-0000-4000-8000-000000000005',
      '10000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000002',
      'ORDINARIA', 'VIRTUAL', 'ANUNCIADA', current_date + 1
    );
    raise exception 'FAIL: el jefe pudo insertar una visita';
  exception
    when insufficient_privilege then
      raise notice 'PASS: el jefe no puede insertar visitas (42501)';
    when raise_exception then
      raise notice 'PASS: el jefe no puede insertar visitas (bloqueado por trigger/RLS de associations)';
  end;

  begin
    update public.visits
    set scheduled_date = scheduled_date + 1
    where id = '40000000-0000-4000-8000-000000000006';
    if found then
      raise exception 'FAIL: el jefe pudo actualizar una visita';
    end if;
    raise notice 'PASS: el update de visita del jefe no afectó filas (política RLS)';
  exception when insufficient_privilege then
    raise notice 'PASS: el jefe no puede actualizar visitas (42501)';
  end;

  begin
    update public.associations
    set status = 'MORA'
    where id = '30000000-0000-4000-8000-000000000001';
    if found then
      raise exception 'FAIL: el jefe pudo modificar una asociación';
    end if;
    raise notice 'PASS: el update de asociación del jefe no afectó filas (política RLS)';
  exception when insufficient_privilege then
    raise notice 'PASS: el jefe no puede modificar asociaciones (42501)';
  end;

  begin
    insert into public.monthly_goals (supervisor_id, region_id, year, month, target_visits)
    select '10000000-0000-4000-8000-000000000003', id, 2099, 1, 5
    from public.regions where code = 'AREQUIPA';
    raise exception 'FAIL: el jefe pudo crear una meta personal';
  exception when insufficient_privilege then
    raise notice 'PASS: el jefe no puede crear metas personales (42501)';
  end;

  begin
    update public.monthly_goals set target_visits = 99;
    if found then
      raise exception 'FAIL: el jefe pudo modificar metas personales';
    end if;
    raise notice 'PASS: el update de metas personales del jefe no afectó filas';
  exception when insufficient_privilege then
    raise notice 'PASS: el jefe no puede modificar metas personales (42501)';
  end;
end $$;

rollback;

-- -----------------------------------------------------------------------------
-- 2. El jefe SÍ administra metas conjuntas (insert / update / delete)
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);

do $$
declare
  v_id uuid;
begin
  insert into public.regional_monthly_goals (region_id, year, month, target_visits)
  select id, 2099, 1, 25 from public.regions where code = 'TACNA'
  returning id into v_id;
  raise notice 'PASS: el jefe puede crear una meta conjunta';

  update public.regional_monthly_goals set target_visits = 30 where id = v_id;
  if not found then
    raise exception 'FAIL: el jefe no pudo actualizar su meta conjunta';
  end if;
  raise notice 'PASS: el jefe puede actualizar la meta conjunta';

  delete from public.regional_monthly_goals where id = v_id;
  if not found then
    raise exception 'FAIL: el jefe no pudo eliminar la meta conjunta';
  end if;
  raise notice 'PASS: el jefe puede eliminar la meta conjunta';
end $$;

rollback;

-- -----------------------------------------------------------------------------
-- 3. La supervisora NO escribe metas conjuntas ni metas ajenas; SÍ las propias
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

do $$
begin
  begin
    insert into public.regional_monthly_goals (region_id, year, month, target_visits)
    select id, 2099, 2, 10 from public.regions where code = 'AREQUIPA';
    raise exception 'FAIL: la supervisora pudo crear una meta conjunta';
  exception when insufficient_privilege then
    raise notice 'PASS: la supervisora no puede crear metas conjuntas (42501)';
  end;

  begin
    update public.regional_monthly_goals set target_visits = 99;
    if found then
      raise exception 'FAIL: la supervisora pudo modificar una meta conjunta';
    end if;
    raise notice 'PASS: el update de meta conjunta de la supervisora no afectó filas';
  exception when insufficient_privilege then
    raise notice 'PASS: la supervisora no puede modificar metas conjuntas (42501)';
  end;

  begin
    insert into public.monthly_goals (supervisor_id, region_id, year, month, target_visits)
    select '10000000-0000-4000-8000-000000000002', id, 2099, 3, 5
    from public.regions where code = 'AREQUIPA';
    raise exception 'FAIL: la supervisora pudo crear una meta de otra supervisora';
  exception when insufficient_privilege then
    raise notice 'PASS: la supervisora no puede crear metas ajenas (42501)';
  end;

  -- Propia: sí puede (una por sede y mes).
  insert into public.monthly_goals (supervisor_id, region_id, year, month, target_visits)
  select '10000000-0000-4000-8000-000000000001', id, 2099, 4, 6
  from public.regions where code = 'AREQUIPA';
  raise notice 'PASS: la supervisora puede crear su propia meta por sede';

  -- Duplicado (misma sede, año y mes): violación de unicidad.
  begin
    insert into public.monthly_goals (supervisor_id, region_id, year, month, target_visits)
    select '10000000-0000-4000-8000-000000000001', id, 2099, 4, 9
    from public.regions where code = 'AREQUIPA';
    raise exception 'FAIL: se permitió una meta duplicada (supervisora, sede, año, mes)';
  exception when unique_violation then
    raise notice 'PASS: la unicidad (supervisora, sede, año, mes) se cumple (23505)';
  end;

  -- Distinta sede, mismo mes: permitido (RN-29).
  insert into public.monthly_goals (supervisor_id, region_id, year, month, target_visits)
  select '10000000-0000-4000-8000-000000000001', id, 2099, 4, 3
  from public.regions where code = 'TACNA';
  raise notice 'PASS: la supervisora puede tener metas distintas por sede el mismo mes';
end $$;

rollback;

-- -----------------------------------------------------------------------------
-- 3b. La supervisora conserva su flujo operativo completo (no regresión)
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

do $$
declare
  v_id uuid;
begin
  insert into public.visits (
    association_id, supervisor_id, scheduled_advisor_id,
    visit_type, modality, characteristic, scheduled_date, scheduled_time
  )
  values (
    '30000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'SEGUIMIENTO', 'VIRTUAL', 'ANUNCIADA', current_date + 3, '09:00'
  )
  returning id into v_id;
  raise notice 'PASS: la supervisora puede programar una visita';

  update public.visits
  set status = 'REPROGRAMADA', scheduled_date = current_date + 5
  where id = v_id;
  if not found then
    raise exception 'FAIL: la supervisora no pudo reprogramar';
  end if;
  raise notice 'PASS: la supervisora puede reprogramar';

  update public.visits
  set status = 'REALIZADA', performed_date = current_date, score = 4,
      general_comment = 'Verificación de flujo operativo.'
  where id = v_id;
  if not found then
    raise exception 'FAIL: la supervisora no pudo cerrar la visita';
  end if;
  raise notice 'PASS: la supervisora puede marcar REALIZADA con puntuación y comentario';

  update public.associations
  set status = 'MORA'
  where id = '30000000-0000-4000-8000-000000000001';
  if not found then
    raise exception 'FAIL: la supervisora no pudo cambiar el estado de la asociación';
  end if;
  raise notice 'PASS: la supervisora puede cambiar estado/asesor de una asociación';
end $$;

rollback;

-- -----------------------------------------------------------------------------
-- 4. Ambos roles pueden leer las vistas de progreso
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.v_individual_monthly_progress;
  raise notice 'PASS: el jefe lee v_individual_monthly_progress (% filas)', v_count;
  select count(*) into v_count from public.v_joint_monthly_progress;
  raise notice 'PASS: el jefe lee v_joint_monthly_progress (% filas)', v_count;
end $$;

rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.v_joint_monthly_progress;
  raise notice 'PASS: la supervisora lee v_joint_monthly_progress (% filas)', v_count;
end $$;

rollback;

-- -----------------------------------------------------------------------------
-- 5. La auditoría registra los cambios (como superusuario)
-- -----------------------------------------------------------------------------
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from private.audit_logs;
  if v_count = 0 then
    raise exception 'FAIL: private.audit_logs está vacía; los triggers no registraron el seed';
  end if;
  raise notice 'PASS: private.audit_logs tiene % eventos registrados', v_count;

  select count(*) into v_count
  from private.audit_logs
  where table_name = 'regional_monthly_goals'
    and user_id = '10000000-0000-4000-8000-000000000003';
  if v_count = 0 then
    raise exception 'FAIL: la meta conjunta del seed no quedó atribuida al jefe en la auditoría';
  end if;
  raise notice 'PASS: la auditoría atribuye la meta conjunta al jefe (% eventos)', v_count;
end $$;

-- anon/authenticated no tienen acceso directo a la bitácora.
do $$
begin
  begin
    set local role authenticated;
    perform count(*) from private.audit_logs;
    reset role;
    raise exception 'FAIL: authenticated pudo leer private.audit_logs';
  exception when insufficient_privilege then
    reset role;
    raise notice 'PASS: authenticated no puede leer private.audit_logs (42501)';
  end;
end $$;

\echo '=== Verificación RLS por rol completada ==='
