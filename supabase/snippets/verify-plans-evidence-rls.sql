-- =============================================================================
-- Verificación automática de RLS y reglas de negocio de la planificación
-- mensual y las evidencias.
--
-- A diferencia de un snippet "para mirar a ojo", cada comprobación FALLA
-- RUIDOSAMENTE: si una garantía no se cumple, el bloque lanza una excepción y,
-- con ON_ERROR_STOP, psql termina con código distinto de cero. Si todo pasa,
-- se ven los NOTICE "OK: ..." y el ROLLBACK final deja la base intacta.
--
-- Ejecutar contra la base local:
--
--   docker exec -i supabase_db_supervision-app \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     -f - < supabase/snippets/verify-plans-evidence-rls.sql
--
-- o, dentro de una sesión psql:  \i supabase/snippets/verify-plans-evidence-rls.sql
--
-- Cada `begin ... exception ... end` de plpgsql abre un savepoint implícito, así
-- que capturar un error esperado NO aborta la transacción externa: todas las
-- comprobaciones corren en una sola transacción que se revierte al final.
--
-- UUID del seed local:
--   sup1: 10000000-0000-4000-8000-000000000001 (SUPERVISOR)
--   sup2: 10000000-0000-4000-8000-000000000002 (SUPERVISOR)
--   jefe: 10000000-0000-4000-8000-000000000003 (SUPERVISION_MANAGER)
--   asesor A: 20000000-0000-4000-8000-000000000001
--   asesor B: 20000000-0000-4000-8000-000000000004
--   visita REALIZADA: 40000000-0000-4000-8000-000000000001
--   visita PROGRAMADA: 40000000-0000-4000-8000-000000000006
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- -----------------------------------------------------------------------------
-- 1. Exclusividad de asesor por sede y periodo (el segundo guardado debe fallar)
-- -----------------------------------------------------------------------------
do $$
declare
  v_region uuid := (select id from public.regions where code = 'AREQUIPA');
begin
  perform set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
  perform public.save_monthly_plan(v_region, 2026, 8,
    array['20000000-0000-4000-8000-000000000001']::uuid[]);

  perform set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
  begin
    perform public.save_monthly_plan(v_region, 2026, 8,
      array['20000000-0000-4000-8000-000000000001']::uuid[]);
    raise exception 'FALLO (1): se esperaba ADVISOR_TAKEN, pero el segundo guardado tuvo éxito';
  exception
    when others then
      if sqlerrm not like '%ADVISOR_TAKEN%' then raise; end if;
      raise notice 'OK (1): la exclusividad bloqueó el guardado de la segunda supervisora';
  end;
end $$;

-- Se limpia el estado de la comprobación 1 para no interferir con la 2.
delete from public.monthly_plan_advisor_assignments
  where year = 2026 and month = 8;
delete from public.monthly_plans
  where year = 2026 and month = 8;

-- -----------------------------------------------------------------------------
-- 2. Historial: retirar y volver a agregar crea un periodo nuevo (2 filas)
-- -----------------------------------------------------------------------------
do $$
declare
  v_region uuid := (select id from public.regions where code = 'TACNA');
  v_total int;
  v_activas int;
  v_retiradas int;
begin
  perform set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
  perform public.save_monthly_plan(v_region, 2026, 8,
    array['20000000-0000-4000-8000-000000000004']::uuid[]);
  perform public.save_monthly_plan(v_region, 2026, 8, '{}'::uuid[]);
  perform public.save_monthly_plan(v_region, 2026, 8,
    array['20000000-0000-4000-8000-000000000004']::uuid[]);

  select count(*),
         count(*) filter (where removed_at is null),
         count(*) filter (where removed_at is not null)
  into v_total, v_activas, v_retiradas
  from public.monthly_plan_advisor_assignments
  where region_id = v_region and year = 2026 and month = 8
    and advisor_id = '20000000-0000-4000-8000-000000000004';

  if v_total <> 2 or v_activas <> 1 or v_retiradas <> 1 then
    raise exception
      'FALLO (2): se esperaban 2 filas (1 activa, 1 retirada), se obtuvieron total=% activas=% retiradas=%',
      v_total, v_activas, v_retiradas;
  end if;
  raise notice 'OK (2): retirar y volver a agregar dejó historial (1 activa + 1 retirada)';
end $$;

-- -----------------------------------------------------------------------------
-- 3. La jefatura no puede guardar planificaciones
-- -----------------------------------------------------------------------------
do $$
declare
  v_region uuid := (select id from public.regions where code = 'AREQUIPA');
begin
  perform set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
  begin
    perform public.save_monthly_plan(v_region, 2026, 9, '{}'::uuid[]);
    raise exception 'FALLO (3): la jefatura pudo guardar una planificación';
  exception
    when others then
      if sqlerrm like 'FALLO (3)%' then raise; end if;
      raise notice 'OK (3): la jefatura no puede modificar planificaciones';
  end;
end $$;

-- -----------------------------------------------------------------------------
-- 4. authenticated no tiene INSERT/UPDATE/DELETE directos sobre las tablas
-- -----------------------------------------------------------------------------
do $$
begin
  if has_table_privilege('authenticated', 'public.monthly_plans', 'INSERT')
     or has_table_privilege('authenticated', 'public.monthly_plans', 'UPDATE')
     or has_table_privilege('authenticated', 'public.monthly_plans', 'DELETE')
     or has_table_privilege('authenticated', 'public.monthly_plan_advisor_assignments', 'INSERT')
     or has_table_privilege('authenticated', 'public.monthly_plan_advisor_assignments', 'UPDATE')
     or has_table_privilege('authenticated', 'public.monthly_plan_advisor_assignments', 'DELETE') then
    raise exception 'FALLO (4): authenticated tiene escritura directa sobre tablas de planificación';
  end if;
  raise notice 'OK (4): sin escrituras directas; solo por RPC SECURITY DEFINER';
end $$;

-- -----------------------------------------------------------------------------
-- 5. Fotografías: tope de 10 y solo en visitas REALIZADA
-- -----------------------------------------------------------------------------
do $$
begin
  perform set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

  insert into public.visit_photos (visit_id, storage_path, original_name, mime_type, size_bytes)
  select '40000000-0000-4000-8000-000000000001',
         '40000000-0000-4000-8000-000000000001/photos/' || g || '.webp',
         'foto' || g || '.webp', 'image/webp', 1000
  from generate_series(1, 10) g;

  begin
    insert into public.visit_photos (visit_id, storage_path, original_name, mime_type, size_bytes)
    values ('40000000-0000-4000-8000-000000000001',
            '40000000-0000-4000-8000-000000000001/photos/extra.webp',
            'extra.webp', 'image/webp', 1000);
    raise exception 'FALLO (5a): se permitió una 11.ª fotografía';
  exception
    when others then
      if sqlerrm not like '%PHOTO_LIMIT_REACHED%' then raise; end if;
      raise notice 'OK (5a): el tope de 10 fotografías se aplicó';
  end;

  begin
    insert into public.visit_photos (visit_id, storage_path, original_name, mime_type, size_bytes)
    values ('40000000-0000-4000-8000-000000000006', 'x/photos/x.webp',
            'x.webp', 'image/webp', 1000);
    raise exception 'FALLO (5b): se permitió foto en una visita no realizada';
  exception
    when others then
      if sqlerrm not like '%EVIDENCE_VISIT_NOT_DONE%' then raise; end if;
      raise notice 'OK (5b): no se aceptan fotografías en visitas no realizadas';
  end;
end $$;

-- Las 10 fotos de la comprobación 5 quedan en la transacción; se limpian para
-- que la comprobación 7 pueda insertar su foto sin topar el límite.
delete from public.visit_photos
  where visit_id = '40000000-0000-4000-8000-000000000001';

-- -----------------------------------------------------------------------------
-- 6. Un único documento de retroalimentación por visita (visit_id UNIQUE)
-- -----------------------------------------------------------------------------
do $$
begin
  perform set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

  insert into public.visit_document_feedback
    (visit_id, storage_path, original_name, mime_type, size_bytes)
  values ('40000000-0000-4000-8000-000000000001',
          '40000000-0000-4000-8000-000000000001/document-feedback/a.pdf',
          'retro.pdf', 'application/pdf', 1000);

  begin
    insert into public.visit_document_feedback
      (visit_id, storage_path, original_name, mime_type, size_bytes)
    values ('40000000-0000-4000-8000-000000000001',
            '40000000-0000-4000-8000-000000000001/document-feedback/b.pdf',
            'retro2.pdf', 'application/pdf', 1000);
    raise exception 'FALLO (6): se permitió un segundo documento para la misma visita';
  exception
    when unique_violation then
      raise notice 'OK (6): solo se admite un documento por visita';
  end;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Evidencia tardía sin impacto en las metas (regresión §9)
-- -----------------------------------------------------------------------------
do $$
declare
  v_antes int;
  v_despues int;
begin
  perform set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

  select coalesce(sum(individual_done), 0) into v_antes
  from public.v_individual_monthly_progress
  where supervisor_id = '10000000-0000-4000-8000-000000000001';

  insert into public.visit_photos (visit_id, storage_path, original_name, mime_type, size_bytes)
  values ('40000000-0000-4000-8000-000000000001',
          '40000000-0000-4000-8000-000000000001/photos/meta.webp',
          'meta.webp', 'image/webp', 1000);

  select coalesce(sum(individual_done), 0) into v_despues
  from public.v_individual_monthly_progress
  where supervisor_id = '10000000-0000-4000-8000-000000000001';

  if v_antes <> v_despues then
    raise exception
      'FALLO (7): subir evidencia cambió el avance de metas (antes=% después=%)',
      v_antes, v_despues;
  end if;
  raise notice 'OK (7): la evidencia tardía no altera el avance de las metas';
end $$;

rollback;

\echo '============================================================'
\echo 'Todas las verificaciones pasaron (base revertida, sin cambios).'
\echo '============================================================'
