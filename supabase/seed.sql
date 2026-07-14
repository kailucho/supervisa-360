-- =============================================================================
-- Supervisa 360 — Datos de prueba para desarrollo local
-- Archivo: supabase/seed.sql
--
-- IMPORTANTE:
-- - Este archivo crea usuarios y datos FICTICIOS para el entorno local.
-- - No debe usarse en producción con estas credenciales.
-- - Se ejecuta automáticamente después de las migraciones con:
--     npx supabase db reset
-- =============================================================================

begin;

-- La instalación local de Supabase normalmente ya incluye pgcrypto.
-- Se declara explícitamente para poder generar hashes bcrypt de prueba.
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. Usuarios de Supabase Auth
-- -----------------------------------------------------------------------------

-- Credenciales locales de prueba:
--   supervisora1@supervisa360.local / Supervisa360!
--   supervisora2@supervisa360.local / Supervisa360!

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_current,
  email_change_token_new,
  email_change,
  phone_change_token,
  phone_change,
  reauthentication_token,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'supervisora1@supervisa360.local',
    extensions.crypt('Supervisa360!', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Supervisora de prueba 1"}'::jsonb,
    false,
    false,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'supervisora2@supervisa360.local',
    extensions.crypt('Supervisa360!', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Supervisora de prueba 2"}'::jsonb,
    false,
    false,
    now(),
    now()
  )
on conflict (id) do update
set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  confirmation_token = '',
  recovery_token = '',
  email_change_token_current = '',
  email_change_token_new = '',
  email_change = '',
  phone_change_token = '',
  phone_change = '',
  reauthentication_token = '',
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  is_sso_user = false,
  is_anonymous = false,
  updated_at = now();

-- Una identidad de proveedor email por cada usuario.
insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    '11000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'sub', '10000000-0000-4000-8000-000000000001',
      'email', 'supervisora1@supervisa360.local',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  ),
  (
    '11000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'sub', '10000000-0000-4000-8000-000000000002',
      'email', 'supervisora2@supervisa360.local',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
on conflict (provider_id, provider) do update
set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  last_sign_in_at = excluded.last_sign_in_at,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- 2. Perfiles de supervisoras
-- -----------------------------------------------------------------------------

insert into public.profiles (id, full_name, is_active)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'Supervisora de prueba 1',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Supervisora de prueba 2',
    true
  )
on conflict (id) do update
set
  full_name = excluded.full_name,
  is_active = excluded.is_active;

-- -----------------------------------------------------------------------------
-- 3. Regiones
-- -----------------------------------------------------------------------------

-- La migración inicial ya inserta estas regiones. El UPSERT hace que el seed
-- también funcione si se ejecuta manualmente de forma independiente.
insert into public.regions (code, name, is_active)
values
  ('AREQUIPA', 'Arequipa', true),
  ('TACNA', 'Tacna', true)
on conflict (code) do update
set
  name = excluded.name,
  is_active = excluded.is_active;

-- -----------------------------------------------------------------------------
-- 4. Asesores ficticios
-- -----------------------------------------------------------------------------

insert into public.advisors (id, code, full_name, is_active)
values
  (
    '20000000-0000-4000-8000-000000000001',
    'ASE-001',
    'Ana María Quispe',
    true
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'ASE-002',
    'Carlos Alberto Mamani',
    true
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'ASE-003',
    'Lucía Elena Torres',
    true
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    'ASE-004',
    'Jorge Luis Flores',
    true
  )
on conflict (id) do update
set
  code = excluded.code,
  full_name = excluded.full_name,
  is_active = excluded.is_active;

-- -----------------------------------------------------------------------------
-- 5. Asociaciones ficticias
-- -----------------------------------------------------------------------------

insert into public.associations (
  id,
  bank_code,
  name,
  region_id,
  status,
  advisor_id
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '10001',
    'Paz y Amor',
    (select id from public.regions where code = 'AREQUIPA'),
    'NORMAL',
    '20000000-0000-4000-8000-000000000001'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '10002',
    'La Esperanza',
    (select id from public.regions where code = 'AREQUIPA'),
    'NUEVA',
    '20000000-0000-4000-8000-000000000001'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '10003',
    'Nuevo Amanecer',
    (select id from public.regions where code = 'AREQUIPA'),
    'MORA',
    '20000000-0000-4000-8000-000000000002'
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    '10004',
    'Unidos por el Futuro',
    (select id from public.regions where code = 'TACNA'),
    'DESERCION',
    '20000000-0000-4000-8000-000000000003'
  ),
  (
    '30000000-0000-4000-8000-000000000005',
    '10005',
    'Sembrando Sueños',
    (select id from public.regions where code = 'AREQUIPA'),
    'NORMAL',
    '20000000-0000-4000-8000-000000000002'
  ),
  (
    '30000000-0000-4000-8000-000000000006',
    '10006',
    'Mujeres Emprendedoras',
    (select id from public.regions where code = 'TACNA'),
    'NORMAL',
    '20000000-0000-4000-8000-000000000004'
  ),
  (
    '30000000-0000-4000-8000-000000000007',
    '10007',
    'Renacer Unido',
    (select id from public.regions where code = 'AREQUIPA'),
    'REORGANIZACION',
    '20000000-0000-4000-8000-000000000003'
  ),
  (
    '30000000-0000-4000-8000-000000000008',
    '10008',
    'Camino al Progreso',
    (select id from public.regions where code = 'TACNA'),
    'PROCESO_DISOLUCION',
    '20000000-0000-4000-8000-000000000004'
  ),
  (
    '30000000-0000-4000-8000-000000000009',
    '10009',
    'Fuerza y Unidad',
    (select id from public.regions where code = 'AREQUIPA'),
    'DISUELTA',
    '20000000-0000-4000-8000-000000000001'
  )
on conflict (id) do update
set
  bank_code = excluded.bank_code,
  name = excluded.name,
  region_id = excluded.region_id,
  status = excluded.status,
  advisor_id = excluded.advisor_id;

-- -----------------------------------------------------------------------------
-- 6. Metas del mes actual y del mes anterior
-- -----------------------------------------------------------------------------

insert into public.monthly_goals (
  supervisor_id,
  year,
  month,
  target_visits
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    extract(year from timezone('America/Lima', now()))::smallint,
    extract(month from timezone('America/Lima', now()))::smallint,
    15
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    extract(year from timezone('America/Lima', now()))::smallint,
    extract(month from timezone('America/Lima', now()))::smallint,
    15
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    extract(
      year from timezone('America/Lima', now()) - interval '1 month'
    )::smallint,
    extract(
      month from timezone('America/Lima', now()) - interval '1 month'
    )::smallint,
    15
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    extract(
      year from timezone('America/Lima', now()) - interval '1 month'
    )::smallint,
    extract(
      month from timezone('America/Lima', now()) - interval '1 month'
    )::smallint,
    15
  )
on conflict (supervisor_id, year, month) do update
set target_visits = excluded.target_visits;

-- -----------------------------------------------------------------------------
-- 7. Visitas de ejemplo
-- -----------------------------------------------------------------------------

-- Permite volver a ejecutar manualmente el seed sin duplicar estas visitas.
delete from public.visits
where id in (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000004',
  '40000000-0000-4000-8000-000000000005',
  '40000000-0000-4000-8000-000000000006'
);

-- Todas las visitas deben nacer PROGRAMADA. El trigger obtiene y congela
-- automáticamente el asesor actual de la asociación.
insert into public.visits (
  id,
  association_id,
  supervisor_id,
  visit_type,
  modality,
  characteristic,
  scheduled_date,
  scheduled_time
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'ORDINARIA',
    'VIRTUAL',
    'ANONIMA',
    date_trunc('month', timezone('America/Lima', now()))::date + 2,
    '09:00'::time
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'ORDINARIA',
    'PRESENCIAL',
    'SORPRESIVA',
    date_trunc('month', timezone('America/Lima', now()))::date + 4,
    '10:30'::time
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'SEGUIMIENTO',
    'VIRTUAL',
    'ANUNCIADA',
    date_trunc('month', timezone('America/Lima', now()))::date + 10,
    '17:00'::time
  ),
  (
    '40000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000002',
    'MORA',
    'PRESENCIAL',
    'ANUNCIADA',
    date_trunc('month', timezone('America/Lima', now()))::date + 12,
    '15:30'::time
  ),
  (
    '40000000-0000-4000-8000-000000000005',
    '30000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000001',
    'DESERCION',
    'VIRTUAL',
    'ANONIMA',
    date_trunc('month', timezone('America/Lima', now()))::date + 14,
    '18:00'::time
  ),
  (
    '40000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000002',
    'CIERRE',
    'PRESENCIAL',
    'ANUNCIADA',
    date_trunc('month', timezone('America/Lima', now()))::date + 20,
    '16:00'::time
  );

-- Visita realizada por la supervisora 1.
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

update public.visits
set
  status = 'REALIZADA',
  performed_date = date_trunc(
    'month',
    timezone('America/Lima', now())
  )::date + 2,
  start_time = '09:05'::time,
  end_time = '10:10'::time,
  score = 4,
  general_comment =
    'La asociación mostró buena participación. Debe mejorar el orden de la documentación antes de la siguiente reunión.'
where id = '40000000-0000-4000-8000-000000000001';

-- Visita realizada por la supervisora 2.
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  true
);

update public.visits
set
  status = 'REALIZADA',
  performed_date = date_trunc(
    'month',
    timezone('America/Lima', now())
  )::date + 4,
  start_time = '10:35'::time,
  end_time = '11:40'::time,
  score = 3,
  general_comment =
    'La asociación se encuentra estable, pero requiere reforzar la preparación previa y el registro de acuerdos.'
where id = '40000000-0000-4000-8000-000000000002';

-- Una visita reprogramada.
update public.visits
set
  status = 'REPROGRAMADA',
  scheduled_date = date_trunc(
    'month',
    timezone('America/Lima', now())
  )::date + 22,
  scheduled_time = '17:30'::time
where id = '40000000-0000-4000-8000-000000000003';

-- Una visita cancelada.
update public.visits
set status = 'CANCELADA'
where id = '40000000-0000-4000-8000-000000000004';

-- Una visita que no pudo realizarse.
update public.visits
set status = 'NO_REALIZADA'
where id = '40000000-0000-4000-8000-000000000005';

-- La sexta visita permanece PROGRAMADA para probar la agenda pendiente.

-- Limpia el usuario simulado de los triggers para el resto de la sesión.
select set_config('request.jwt.claim.sub', '', true);

commit;

-- =============================================================================
-- Resultado esperado después de `npx supabase db reset`:
--
-- - 2 usuarios autenticables y 2 perfiles activos.
-- - 2 regiones.
-- - 4 asesores.
-- - 9 asociaciones con distintos estados.
-- - Meta individual de 15 para cada supervisora.
-- - 2 visitas REALIZADAS.
-- - 1 visita REPROGRAMADA.
-- - 1 visita CANCELADA.
-- - 1 visita NO_REALIZADA.
-- - 1 visita PROGRAMADA.
-- =============================================================================
