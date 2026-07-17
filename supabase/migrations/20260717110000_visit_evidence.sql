-- =============================================================================
-- Supervisa 360 — Evidencias por visita: fotografías y documento de
-- retroalimentación, con bucket privado de Storage.
--
-- Contenido:
--   1. Tabla public.visit_photos (máx. 10 por visita, solo visitas REALIZADA).
--   2. Tabla public.visit_document_feedback (un único PDF por visita).
--   3. Triggers de integridad: estado REALIZADA, tope de 10 fotos con bloqueo
--      del padre (sin carreras), autoría fijada por el servidor.
--   4. RLS: lectura para perfiles activos (jefatura incluida, solo lectura);
--      escritura exclusiva de la supervisora que realizó la visita.
--   5. Bucket privado `visit-evidence` con MIME y tamaño limitados + políticas
--      de Storage equivalentes. Rutas:
--        {visit_id}/photos/{uuid}.webp
--        {visit_id}/document-feedback/{uuid}.pdf
--
-- Las evidencias nunca modifican la visita (estado, puntuación, fechas) ni las
-- metas: las vistas de progreso solo leen visits.status y visits.performed_date.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Fotografías por visita
-- -----------------------------------------------------------------------------

create table public.visit_photos (
  id             uuid primary key default gen_random_uuid(),
  visit_id       uuid not null references public.visits(id) on delete restrict,
  storage_path   text not null unique check (length(btrim(storage_path)) > 0),
  original_name  text not null check (length(btrim(original_name)) > 0),
  mime_type      text not null check (mime_type in ('image/webp', 'image/jpeg', 'image/png')),
  size_bytes     bigint not null check (size_bytes > 0),
  uploaded_by    uuid not null default auth.uid()
                   references public.profiles(id) on delete restrict,
  created_at     timestamptz not null default now()
);

comment on table public.visit_photos is
  'Fotografías de una visita REALIZADA (máximo 10, sin descripción). Solo la supervisora que realizó la visita puede subir/eliminar; la jefatura solo visualiza.';

create index visit_photos_visit_idx
  on public.visit_photos (visit_id);

-- BEFORE INSERT: la visita debe estar REALIZADA, no superar 10 fotos y la
-- autoría la fija el servidor. SECURITY DEFINER para poder bloquear la fila de
-- visits (serializa inserciones concurrentes sobre la misma visita).
create or replace function public.visit_photos_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.visit_status;
  v_count int;
begin
  select v.status into v_status
  from public.visits v
  where v.id = new.visit_id
  for update;

  if not found then
    raise exception 'No existe la visita con id %', new.visit_id;
  end if;

  if v_status <> 'REALIZADA' then
    raise exception
      'EVIDENCE_VISIT_NOT_DONE: Solo se pueden subir fotografías a una visita realizada';
  end if;

  select count(*) into v_count
  from public.visit_photos p
  where p.visit_id = new.visit_id;

  if v_count >= 10 then
    raise exception
      'PHOTO_LIMIT_REACHED: La visita ya tiene el máximo de 10 fotografías';
  end if;

  new.uploaded_by := coalesce(auth.uid(), new.uploaded_by);
  new.created_at := now();

  return new;
end;
$$;

create trigger trg_visit_photos_before_insert
  before insert on public.visit_photos
  for each row
  execute function public.visit_photos_before_insert();

-- -----------------------------------------------------------------------------
-- 2. Documento de retroalimentación (un PDF por visita)
-- -----------------------------------------------------------------------------

create table public.visit_document_feedback (
  id             uuid primary key default gen_random_uuid(),
  visit_id       uuid not null unique references public.visits(id) on delete restrict,
  storage_path   text not null unique check (length(btrim(storage_path)) > 0),
  original_name  text not null check (length(btrim(original_name)) > 0),
  mime_type      text not null check (mime_type = 'application/pdf'),
  size_bytes     bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by    uuid not null default auth.uid()
                   references public.profiles(id) on delete restrict,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.visit_document_feedback is
  'Documento único de retroalimentación (PDF, máx. 10 MB) de una visita REALIZADA. Al reemplazarlo se conserva solo el archivo actual. No sustituye al comentario general de la visita.';

create trigger trg_visit_document_feedback_set_updated_at
  before update on public.visit_document_feedback
  for each row
  execute function public.set_updated_at();

create or replace function public.visit_document_feedback_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.visit_status;
begin
  select v.status into v_status
  from public.visits v
  where v.id = new.visit_id;

  if not found then
    raise exception 'No existe la visita con id %', new.visit_id;
  end if;

  if v_status <> 'REALIZADA' then
    raise exception
      'EVIDENCE_VISIT_NOT_DONE: Solo se puede adjuntar el documento a una visita realizada';
  end if;

  if tg_op = 'INSERT' then
    new.uploaded_by := coalesce(auth.uid(), new.uploaded_by);
  else
    if new.visit_id is distinct from old.visit_id then
      raise exception 'visit_id es inmutable';
    end if;
    new.uploaded_by := coalesce(auth.uid(), old.uploaded_by);
    new.created_at := old.created_at;
  end if;

  return new;
end;
$$;

create trigger trg_visit_document_feedback_guard
  before insert or update on public.visit_document_feedback
  for each row
  execute function public.visit_document_feedback_guard();

-- -----------------------------------------------------------------------------
-- 3. RLS y privilegios de las tablas de evidencia
-- -----------------------------------------------------------------------------

alter table public.visit_photos enable row level security;
alter table public.visit_document_feedback enable row level security;

revoke all privileges on table public.visit_photos
  from anon, authenticated;
revoke all privileges on table public.visit_document_feedback
  from anon, authenticated;

-- Lectura: cualquier perfil activo (supervisoras y jefatura).
create policy visit_photos_select
  on public.visit_photos
  for select
  to authenticated
  using ((select public.current_app_role()) is not null);

create policy visit_document_feedback_select
  on public.visit_document_feedback
  for select
  to authenticated
  using ((select public.current_app_role()) is not null);

-- Escritura: solo la supervisora responsable de esa visita (rol SUPERVISOR).
create policy visit_photos_insert_own_visit
  on public.visit_photos
  for insert
  to authenticated
  with check (
    (select public.current_app_role()) = 'SUPERVISOR'
    and exists (
      select 1 from public.visits v
      where v.id = visit_id
        and v.supervisor_id = (select auth.uid())
    )
  );

create policy visit_photos_delete_own_visit
  on public.visit_photos
  for delete
  to authenticated
  using (
    (select public.current_app_role()) = 'SUPERVISOR'
    and exists (
      select 1 from public.visits v
      where v.id = visit_id
        and v.supervisor_id = (select auth.uid())
    )
  );

create policy visit_document_feedback_insert_own_visit
  on public.visit_document_feedback
  for insert
  to authenticated
  with check (
    (select public.current_app_role()) = 'SUPERVISOR'
    and exists (
      select 1 from public.visits v
      where v.id = visit_id
        and v.supervisor_id = (select auth.uid())
    )
  );

create policy visit_document_feedback_update_own_visit
  on public.visit_document_feedback
  for update
  to authenticated
  using (
    (select public.current_app_role()) = 'SUPERVISOR'
    and exists (
      select 1 from public.visits v
      where v.id = visit_id
        and v.supervisor_id = (select auth.uid())
    )
  )
  with check (
    (select public.current_app_role()) = 'SUPERVISOR'
    and exists (
      select 1 from public.visits v
      where v.id = visit_id
        and v.supervisor_id = (select auth.uid())
    )
  );

create policy visit_document_feedback_delete_own_visit
  on public.visit_document_feedback
  for delete
  to authenticated
  using (
    (select public.current_app_role()) = 'SUPERVISOR'
    and exists (
      select 1 from public.visits v
      where v.id = visit_id
        and v.supervisor_id = (select auth.uid())
    )
  );

-- uploaded_by no se concede: lo fija el default auth.uid() y el trigger.
grant select on table public.visit_photos to authenticated;
grant insert (visit_id, storage_path, original_name, mime_type, size_bytes)
  on table public.visit_photos to authenticated;
grant delete on table public.visit_photos to authenticated;

grant select on table public.visit_document_feedback to authenticated;
grant insert (visit_id, storage_path, original_name, mime_type, size_bytes)
  on table public.visit_document_feedback to authenticated;
grant update (storage_path, original_name, mime_type, size_bytes)
  on table public.visit_document_feedback to authenticated;
grant delete on table public.visit_document_feedback to authenticated;

-- Auditoría (mismo mecanismo que el resto de tablas de negocio).
create trigger trg_visit_photos_audit
  after insert or update or delete on public.visit_photos
  for each row
  execute function private.log_audit_event();

create trigger trg_visit_document_feedback_audit
  after insert or update or delete on public.visit_document_feedback
  for each row
  execute function private.log_audit_event();

-- -----------------------------------------------------------------------------
-- 4. Bucket privado de Storage
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'visit-evidence',
  'visit-evidence',
  false,
  10485760, -- 10 MB: compatible con el PDF; las fotos se comprimen a ~2 MB en el cliente.
  array['image/webp', 'image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Comprueba que la ruta del objeto ({visit_id}/...) apunte a una visita
-- REALIZADA cuya supervisora responsable es el usuario autenticado.
-- SECURITY DEFINER: se evalúa dentro de políticas de storage.objects sin
-- depender de las políticas de visits, y tolera rutas malformadas.
create or replace function public.can_manage_visit_evidence(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_visit_id uuid;
  v_supervisor uuid;
  v_status public.visit_status;
begin
  begin
    v_visit_id := split_part(p_object_name, '/', 1)::uuid;
  exception
    when others then
      return false;
  end;

  select v.supervisor_id, v.status
  into v_supervisor, v_status
  from public.visits v
  where v.id = v_visit_id;

  if not found then
    return false;
  end if;

  return v_status = 'REALIZADA'
    and v_supervisor = auth.uid()
    and (select public.current_app_role()) = 'SUPERVISOR';
end;
$$;

revoke all on function public.can_manage_visit_evidence(text) from public, anon;
grant execute on function public.can_manage_visit_evidence(text) to authenticated;

-- Lectura (URLs firmadas / descarga): cualquier perfil activo, jefatura incluida.
create policy visit_evidence_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'visit-evidence'
    and (select public.current_app_role()) is not null
  );

-- Subir: solo la supervisora responsable, y solo si la visita está REALIZADA.
create policy visit_evidence_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'visit-evidence'
    and public.can_manage_visit_evidence(name)
  );

-- Reemplazar (upsert de Storage) y eliminar: misma condición.
create policy visit_evidence_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'visit-evidence'
    and public.can_manage_visit_evidence(name)
  )
  with check (
    bucket_id = 'visit-evidence'
    and public.can_manage_visit_evidence(name)
  );

create policy visit_evidence_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'visit-evidence'
    and public.can_manage_visit_evidence(name)
  );
