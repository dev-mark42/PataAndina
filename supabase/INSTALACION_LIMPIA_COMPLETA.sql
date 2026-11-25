-- =====================================================================
-- PATA ANDINA VET · REINICIO LIMPIO + DATOS DEMOSTRATIVOS
-- Ejecutar una sola vez en Supabase > SQL Editor > Run.
--
-- BORRA los datos operativos de public: perfiles, mascotas, citas,
-- historiales, servicios y bitácora. NO borra auth.users ni contraseñas.
-- Los usuarios Auth se conservan y sus perfiles se vuelven a generar.
-- Invitado: solo puede leer services_catalog activos (RLS + GRANT).
-- =====================================================================
begin;


-- =====================================================================
-- PATA ANDINA VET · Esquema completo para Supabase (PostgreSQL)
-- Ejecutar UNA VEZ en: Supabase > SQL Editor > New query > Run
-- Es idempotente: se puede volver a ejecutar sin romper datos.
-- Zona horaria de negocio: America/La_Paz (UTC-4, sin horario de verano)
-- =====================================================================
create extension if not exists btree_gist;

-- ---------- PERFILES (tutores y personal) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null check (char_length(btrim(full_name)) between 2 and 80),
  phone       text check (phone is null or phone ~ '^[67][0-9]{7}$'),
  address     text check (address is null or char_length(address) <= 160),
  role        text not null default 'tutor' check (role in ('tutor','staff')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Crea el perfil automáticamente al registrarse (funciona aunque haya confirmación de correo)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text; v_phone text;
begin
  v_name  := btrim(coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  v_phone := nullif(btrim(coalesce(new.raw_user_meta_data->>'phone','')), '');
  if char_length(v_name) < 2 then v_name := 'Tutor'; end if;
  if v_phone is not null and v_phone !~ '^[67][0-9]{7}$' then v_phone := null; end if;
  insert into public.profiles(id, full_name, phone) values (new.id, left(v_name,80), v_phone)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ¿El usuario actual es personal? (security definer evita recursión de RLS)
create or replace function public.is_staff() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'staff');
$$;

-- ---------- MASCOTAS ----------
create table if not exists public.pets (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  species     text not null check (species in ('perro','gato','otro')),
  breed       text check (breed is null or char_length(breed) <= 60),
  sex         text check (sex in ('macho','hembra')),
  birth_date  date check (birth_date is null or birth_date <= current_date),
  weight_kg   numeric(5,2) check (weight_kg is null or (weight_kg > 0 and weight_kg < 120)),
  notes       text check (notes is null or char_length(notes) <= 300),
  created_at  timestamptz not null default now()
);
create index if not exists pets_owner_idx on public.pets(owner_id);

-- ---------- CATÁLOGO DE SERVICIOS ----------
create table if not exists public.services_catalog (
  id           text primary key,
  name         text not null,
  category     text not null,
  description  text not null,
  details      text,
  duration_min int  not null check (duration_min between 10 and 180),
  price_label  text not null,
  price_value  numeric(8,2),
  tag          text,
  species      text,
  icon         text,
  active       boolean not null default true,
  sort_order   int not null default 0
);

-- ---------- SOLICITUDES DE CITA ----------
create table if not exists public.appointment_requests (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  pet_id      uuid not null references public.pets(id) on delete cascade,
  service_id  text not null references public.services_catalog(id),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      text not null default 'pendiente'
              check (status in ('pendiente','confirmada','rechazada','cancelada','completada')),
  note        text check (note is null or char_length(note) <= 300),
  staff_note  text check (staff_note is null or char_length(staff_note) <= 300),
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at),
  -- PROTECCIÓN CONTRA SUPERPOSICIÓN: un solo consultorio, ninguna cita activa puede cruzarse
  constraint no_overlap exclude using gist (tstzrange(starts_at, ends_at) with &&)
    where (status in ('pendiente','confirmada'))
);
create index if not exists appt_owner_idx on public.appointment_requests(owner_id, starts_at);
create index if not exists appt_status_idx on public.appointment_requests(status, starts_at);

-- Validaciones de negocio al crear una solicitud
create or replace function public.validate_appointment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_dur int; v_local timestamp; v_end timestamp; v_dow int; v_t time; v_te time; v_active int;
begin
  if not exists (select 1 from public.pets where id = new.pet_id and owner_id = new.owner_id) then
    raise exception 'La mascota no pertenece a este tutor' using errcode = 'P0001';
  end if;
  select duration_min into v_dur from public.services_catalog where id = new.service_id and active;
  if v_dur is null then raise exception 'Servicio no disponible' using errcode = 'P0001'; end if;
  new.ends_at := new.starts_at + make_interval(mins => v_dur);
  if new.starts_at <= now() + interval '30 minutes' then
    raise exception 'Elige un horario con al menos 30 minutos de anticipación' using errcode = 'P0001';
  end if;
  if new.starts_at > now() + interval '90 days' then
    raise exception 'Solo se puede reservar hasta 90 días adelante' using errcode = 'P0001';
  end if;
  v_local := new.starts_at at time zone 'America/La_Paz';
  v_end   := new.ends_at   at time zone 'America/La_Paz';
  v_dow   := extract(dow from v_local);               -- 0 = domingo
  v_t := v_local::time; v_te := v_end::time;
  if v_dow = 0 then raise exception 'La clínica no atiende los domingos' using errcode = 'P0001'; end if;
  if v_local::date <> v_end::date
     or not ((v_t >= time '09:00' and v_te <= time '13:00') or (v_t >= time '14:00' and v_te <= time '18:00')) then
    raise exception 'Horario fuera de atención (09:00-13:00 y 14:00-18:00, lunes a sábado)' using errcode = 'P0001';
  end if;
  if extract(minute from v_local) not in (0,30) then
    raise exception 'Las citas inician en punto o y media' using errcode = 'P0001';
  end if;
  select count(*) into v_active from public.appointment_requests
   where owner_id = new.owner_id and status in ('pendiente','confirmada') and starts_at > now();
  if v_active >= 5 then
    raise exception 'Ya tienes 5 citas activas. Cancela o espera a que se atiendan.' using errcode = 'P0001';
  end if;
  new.status := 'pendiente';
  new.staff_note := null;
  return new;
end $$;
drop trigger if exists appt_validate on public.appointment_requests;
create trigger appt_validate before insert on public.appointment_requests
  for each row execute function public.validate_appointment();

-- Horarios ocupados de un día (sin datos personales) para pintar la grilla
create or replace function public.get_busy_slots(p_day date)
returns table(starts_at timestamptz, ends_at timestamptz)
language sql security definer stable set search_path = public as $$
  select a.starts_at, a.ends_at from public.appointment_requests a
   where a.status in ('pendiente','confirmada')
     and a.starts_at >= (p_day::timestamp at time zone 'America/La_Paz')
     and a.starts_at <  ((p_day + 1)::timestamp at time zone 'America/La_Paz')
   order by a.starts_at;
$$;

-- El tutor cancela su propia cita
create or replace function public.cancel_my_appointment(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v public.appointment_requests;
begin
  select * into v from public.appointment_requests where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'Cita no encontrada' using errcode = 'P0001'; end if;
  if v.status not in ('pendiente','confirmada') then
    raise exception 'Esta cita ya no se puede cancelar' using errcode = 'P0001'; end if;
  if v.starts_at < now() then raise exception 'La cita ya pasó' using errcode = 'P0001'; end if;
  update public.appointment_requests set status = 'cancelada' where id = p_id;
end $$;

-- Personal: confirmar o rechazar
create or replace function public.staff_set_status(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v public.appointment_requests;
begin
  if not public.is_staff() then raise exception 'Solo el personal puede hacer esto' using errcode = '42501'; end if;
  if p_status not in ('confirmada','rechazada') then raise exception 'Estado inválido' using errcode = 'P0001'; end if;
  if p_status = 'rechazada' and (p_note is null or char_length(btrim(p_note)) < 3) then
    raise exception 'Indica el motivo del rechazo' using errcode = 'P0001'; end if;
  select * into v from public.appointment_requests where id = p_id;
  if not found then raise exception 'Cita no encontrada' using errcode = 'P0001'; end if;
  if v.status <> 'pendiente' then raise exception 'Solo se pueden resolver citas pendientes' using errcode = 'P0001'; end if;
  update public.appointment_requests
     set status = p_status, staff_note = left(nullif(btrim(coalesce(p_note,'')),''),300) where id = p_id;
end $$;

-- ---------- HISTORIAL MÉDICO ----------
create table if not exists public.pet_medical_records (
  id             uuid primary key default gen_random_uuid(),
  pet_id         uuid not null references public.pets(id) on delete cascade,
  appointment_id uuid references public.appointment_requests(id) on delete set null,
  visit_date     date not null default (now() at time zone 'America/La_Paz')::date,
  diagnosis      text not null check (char_length(btrim(diagnosis)) between 3 and 500),
  treatment      text check (treatment is null or char_length(treatment) <= 500),
  prescription   text check (prescription is null or char_length(prescription) <= 500),
  weight_kg      numeric(5,2) check (weight_kg is null or (weight_kg > 0 and weight_kg < 120)),
  next_visit     date,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  check (next_visit is null or next_visit >= visit_date)
);
create index if not exists records_pet_idx on public.pet_medical_records(pet_id, visit_date desc);

-- ---------- VACUNACIÓN Y DESPARASITACIÓN ----------
create table if not exists public.pet_vaccinations (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  vaccine_name text not null check (char_length(btrim(vaccine_name)) between 2 and 100),
  applied_on date not null,
  next_due date,
  batch text check (batch is null or char_length(batch) <= 60),
  notes text check (notes is null or char_length(notes) <= 300),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (next_due is null or next_due >= applied_on)
);
create index if not exists vaccinations_pet_idx on public.pet_vaccinations(pet_id, applied_on desc);

create table if not exists public.pet_deworming (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  product_name text not null check (char_length(btrim(product_name)) between 2 and 100),
  applied_on date not null,
  next_due date,
  weight_kg numeric(5,2) check (weight_kg is null or (weight_kg > 0 and weight_kg < 120)),
  notes text check (notes is null or char_length(notes) <= 300),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (next_due is null or next_due >= applied_on)
);
create index if not exists deworming_pet_idx on public.pet_deworming(pet_id, applied_on desc);


-- Personal: registrar atención (y completar la cita asociada si existe)
create or replace function public.staff_register_attention(
  p_pet uuid, p_appointment uuid, p_diagnosis text, p_treatment text,
  p_prescription text, p_weight numeric, p_next date) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_appt public.appointment_requests;
begin
  if not public.is_staff() then raise exception 'Solo el personal puede hacer esto' using errcode = '42501'; end if;
  if p_appointment is not null then
    select * into v_appt from public.appointment_requests where id = p_appointment;
    if not found then raise exception 'Cita no encontrada' using errcode = 'P0001'; end if;
    if v_appt.status <> 'confirmada' then
      raise exception 'Solo se atiende una cita confirmada' using errcode = 'P0001'; end if;
    p_pet := v_appt.pet_id;
  end if;
  if not exists (select 1 from public.pets where id = p_pet) then
    raise exception 'Mascota no encontrada' using errcode = 'P0001'; end if;
  insert into public.pet_medical_records(pet_id, appointment_id, diagnosis, treatment, prescription, weight_kg, next_visit, created_by)
  values (p_pet, p_appointment, btrim(p_diagnosis), nullif(btrim(coalesce(p_treatment,'')),''),
          nullif(btrim(coalesce(p_prescription,'')),''), p_weight, p_next, auth.uid())
  returning id into v_id;
  if p_appointment is not null then
    update public.appointment_requests set status = 'completada' where id = p_appointment;
  end if;
  if p_weight is not null then update public.pets set weight_kg = p_weight where id = p_pet; end if;
  return v_id;
end $$;

-- ---------- ACTIVACIÓN DE PERSONAL (tabla interna, sin acceso desde el cliente) ----------
create table if not exists public.staff_activation_codes (
  code        text primary key,
  active      boolean not null default true,
  used_by     uuid references public.profiles(id),
  used_at     timestamptz
);
-- >>> CAMBIA este código antes de entregar el proyecto <<<
insert into public.staff_activation_codes(code) values ('PATA-STAFF-2026') on conflict do nothing;

create or replace function public.activate_staff(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_ok int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión primero' using errcode = '42501'; end if;
  update public.staff_activation_codes set used_by = auth.uid(), used_at = now(), active = false
   where code = upper(btrim(p_code)) and active;
  get diagnostics v_ok = row_count;
  if v_ok = 0 then raise exception 'Código inválido o ya utilizado' using errcode = 'P0001'; end if;
  update public.profiles set role = 'staff' where id = auth.uid();
  return true;
end $$;

-- ---------- SEGURIDAD (RLS) ----------
alter table public.profiles              enable row level security;
alter table public.pets                  enable row level security;
alter table public.services_catalog      enable row level security;
alter table public.appointment_requests  enable row level security;
alter table public.pet_medical_records   enable row level security;
alter table public.staff_activation_codes enable row level security;  -- sin políticas = nadie accede

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists pets_select on public.pets;
create policy pets_select on public.pets for select to authenticated
  using (owner_id = auth.uid() or public.is_staff());
drop policy if exists pets_insert on public.pets;
create policy pets_insert on public.pets for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists pets_update on public.pets;
create policy pets_update on public.pets for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists pets_delete on public.pets;
create policy pets_delete on public.pets for delete to authenticated using (owner_id = auth.uid());

drop policy if exists services_select on public.services_catalog;
create policy services_select on public.services_catalog for select to anon, authenticated using (active);

drop policy if exists appt_select on public.appointment_requests;
create policy appt_select on public.appointment_requests for select to authenticated
  using (owner_id = auth.uid() or public.is_staff());
drop policy if exists appt_insert on public.appointment_requests;
create policy appt_insert on public.appointment_requests for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists records_select on public.pet_medical_records;
create policy records_select on public.pet_medical_records for select to authenticated
  using (public.is_staff() or exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()));

-- Permisos por columna/tabla: el cliente NO puede cambiar su rol ni escribir historial ni cambiar estados
revoke all on public.profiles, public.pets, public.services_catalog, public.appointment_requests,
              public.pet_medical_records, public.staff_activation_codes from anon, authenticated;
grant select on public.services_catalog to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone, address) on public.profiles to authenticated;
grant select, insert, delete on public.pets to authenticated;
grant update (name, species, breed, sex, birth_date, weight_kg, notes) on public.pets to authenticated;
grant select on public.appointment_requests to authenticated;
grant insert (pet_id, service_id, starts_at, ends_at, note, owner_id) on public.appointment_requests to authenticated;
grant select on public.pet_medical_records to authenticated;

revoke all on function public.get_busy_slots(date), public.cancel_my_appointment(uuid),
  public.staff_set_status(uuid,text,text), public.staff_register_attention(uuid,uuid,text,text,text,numeric,date),
  public.activate_staff(text), public.is_staff() from public, anon;
grant execute on function public.get_busy_slots(date), public.cancel_my_appointment(uuid),
  public.staff_set_status(uuid,text,text), public.staff_register_attention(uuid,uuid,text,text,text,numeric,date),
  public.activate_staff(text), public.is_staff() to authenticated;

-- Crear la bitácora antes del borrado para que la limpieza sea completa.
create table if not exists public.audit_events (
  id bigserial primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id text,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- Evitar que la limpieza genere eventos falsos.
drop trigger if exists audit_pets_changes on public.pets;
drop trigger if exists audit_appointments_changes on public.appointment_requests;
drop trigger if exists audit_records_changes on public.pet_medical_records;

delete from public.audit_events;
delete from public.pet_medical_records;
delete from public.appointment_requests;
delete from public.pets;
delete from public.profiles;
delete from public.services_catalog;
delete from public.staff_activation_codes;
insert into public.staff_activation_codes(code,active) values ('PATA-STAFF-2026',true);



-- ---------- CATÁLOGO: 16 servicios ----------
insert into public.services_catalog(id,name,category,description,details,duration_min,price_label,price_value,tag,species,icon,sort_order) values
('consulta-general','Consulta veterinaria general','consulta','Revisión clínica inicial para perros y gatos, con orientación para el siguiente paso.','La atención incluye entrevista al tutor y evaluación clínica presencial. El diagnóstico y plan de manejo los define el profesional veterinario.',30,'Bs 60*',60,'ESENCIAL','Perros y gatos','consulta',0),
('consulta-felina','Consulta felina','consulta','Atención pensada para reducir el estrés durante la visita de tu gato.','Se recomienda transportar al gato en un kennel seguro. La duración puede variar según su comportamiento y evaluación.',35,'Bs 70*',70,'GATITOS','Gatos','gato',1),
('control-cachorro','Control de cachorro o gatito','prevencion','Seguimiento de crecimiento, hábitos y plan preventivo según edad.','El profesional revisa antecedentes, peso y condición general para orientar el calendario preventivo individual.',25,'Bs 50*',50,'PREVENCIÓN','Cachorros y gatitos','control',2),
('vacuna-canina','Vacunación canina','prevencion','Revisión previa y aplicación de vacunas indicadas para cada paciente.','La vacuna, dosis, intervalo y precio dependen del historial, edad, estado de salud y criterio veterinario. Lleva su carnet si lo tiene.',20,'Desde Bs 80*',80,'CUIDADO','Perros','vacuna',3),
('vacuna-felina','Vacunación felina','prevencion','Evaluación y vacunación felina según antecedentes y recomendación profesional.','La vacuna que corresponde se determina durante la evaluación. Trae el carnet de vacunación si está disponible.',20,'Desde Bs 85*',85,'CUIDADO','Gatos','vacuna',4),
('desparasitacion','Desparasitación','prevencion','Orientación y control antiparasitario individual según especie y peso.','El producto y la pauta deben ser indicados por un profesional después de evaluar al animal. No se recomienda automedicar.',15,'Desde Bs 40*',40,'PREVENCIÓN','Perros y gatos','prevencion',5),
('profilaxis-dental','Evaluación y limpieza dental','consulta','Valoración de salud oral y propuesta de higiene o profilaxis.','La limpieza profesional puede requerir evaluación previa y, según el caso, anestesia y exámenes. El alcance se define presencialmente.',45,'Desde Bs 180*',180,'SALUD ORAL','Perros y gatos','odontologia',6),
('esterilizacion','Evaluación para esterilización','procedimientos','Consulta prequirúrgica para revisar condiciones y requisitos del procedimiento.','La cirugía no se confirma desde esta página. El profesional determina indicación, exámenes, riesgos, preparación y cuidados posteriores.',30,'Cotización tras evaluación',null,'PREQUIRÚRGICO','Perros y gatos','cirugia',7),
('cirugia','Valoración quirúrgica','procedimientos','Primera valoración para procedimientos programados o evaluación de una lesión.','La indicación, complejidad, riesgos, equipo y presupuesto se explican después del examen clínico. No se garantiza disponibilidad quirúrgica.',40,'Cotización según caso',null,'VALORACIÓN','Perros y gatos','cirugia',8),
('curaciones','Curaciones y control ambulatorio','procedimientos','Revisión y cuidado de heridas o controles indicados por el profesional.','Si el animal ya recibió atención, lleva las indicaciones previas. El tipo de curación y material se define según evaluación.',25,'Desde Bs 70*',70,'SEGUIMIENTO','Perros y gatos','curaciones',9),
('laboratorio','Toma de muestra y laboratorio','diagnostico','Coordinación de muestras y pruebas complementarias cuando estén indicadas.','El veterinario define qué prueba se necesita y si el procesamiento se realiza en el centro o con un laboratorio externo.',20,'Según prueba solicitada',null,'DIAGNÓSTICO','Perros y gatos','laboratorio',10),
('imagenologia','Ecografía o radiografía','diagnostico','Coordinación de apoyo por imagen según indicación y disponibilidad.','El estudio puede realizarse en un centro aliado. Se debe confirmar equipo disponible, preparación, horario y costo antes de acudir.',30,'Consultar disponibilidad',null,'IMÁGENES','Perros y gatos','imagenologia',11),
('consulta-domicilio','Consulta a domicilio','consulta','Atención programada en domicilio, sujeta a zona y disponibilidad.','La cobertura, costo de traslado y tipo de atención deben confirmarse antes de reservar. No es servicio de ambulancia.',45,'Desde Bs 100*',100,'A DOMICILIO','Perros y gatos','domicilio',12),
('peluqueria','Baño y peluquería higiénica','bienestar','Baño, cepillado y cuidado estético de acuerdo con pelaje y tolerancia.','Servicio opcional. Se debe informar sobre alergias, lesiones o sensibilidad; si existe un problema de piel, primero corresponde evaluación veterinaria.',60,'Desde Bs 90*',90,'BIENESTAR','Principalmente perros','peluqueria',13),
('nutricion','Orientación nutricional','bienestar','Consejos de alimentación de acuerdo con edad, condición y estilo de vida.','El plan se personaliza tras conocer antecedentes y condición corporal. No reemplaza una consulta por enfermedad.',25,'Bs 50*',50,'HÁBITOS','Perros y gatos','nutricion',14),
('microchip','Microchip de identificación','prevencion','Implantación de microchip para identificar a tu mascota si se pierde.','Incluye registro de datos del tutor. El procedimiento es rápido y se realiza en consulta.',20,'Bs 120*',120,'IDENTIDAD','Perros y gatos','control',15)
on conflict (id) do update set name=excluded.name, category=excluded.category, description=excluded.description, details=excluded.details, duration_min=excluded.duration_min, price_label=excluded.price_label, price_value=excluded.price_value, tag=excluded.tag, species=excluded.species, icon=excluded.icon, sort_order=excluded.sort_order;

-- =====================================================================
-- PATA ANDINA VET · CATÁLOGO AMPLIADO + BITÁCORA + DATOS DEMO
-- Ejecutar DESPUÉS de supabase/schema.sql en Supabase SQL Editor.
-- Genera 34 servicios extra (50 en total junto al catálogo inicial),
-- 200 eventos de demostración y registra eventos reales desde ahora.
-- Los 200 eventos se marcan is_demo=true: NO son actividad real de clientes.
-- =====================================================================


-- 1. Catálogo: 34 servicios adicionales con precios referenciales en Bs.
insert into public.services_catalog
(id,name,category,description,details,duration_min,price_label,price_value,tag,species,icon,sort_order,active)
values
('eco-abdominal','Ecografía abdominal','diagnostico','Estudio de imagen para apoyar la evaluación de órganos abdominales.','Requiere indicación y preparación según el caso. El resultado debe interpretarlo el profesional.',45,'Desde Bs 180',180,'DIAGNÓSTICO','Perros y gatos','imagenologia',20,true),
('eco-gestacion','Ecografía de gestación','diagnostico','Evaluación ecográfica reproductiva cuando está indicada.','La edad gestacional y la visibilidad dependen del momento del estudio.',35,'Desde Bs 160',160,'IMAGEN','Perros y gatos','imagenologia',21,true),
('hemograma','Hemograma completo','diagnostico','Análisis sanguíneo de apoyo para evaluar parámetros hematológicos.','La toma de muestra y lectura se coordinan con el veterinario.',30,'Desde Bs 120',120,'LABORATORIO','Perros y gatos','laboratorio',22,true),
('perfil-bioquimico','Perfil bioquímico','diagnostico','Pruebas de laboratorio para apoyar la evaluación metabólica y orgánica.','Los parámetros incluidos se confirman al solicitar el estudio.',30,'Desde Bs 190',190,'LABORATORIO','Perros y gatos','laboratorio',23,true),
('coproparasitologico','Examen coproparasitológico','diagnostico','Análisis de muestra fecal para búsqueda de parásitos intestinales.','Traer muestra reciente en recipiente limpio y cerrado.',20,'Desde Bs 65',65,'LABORATORIO','Perros y gatos','laboratorio',24,true),
('analisis-orina','Análisis general de orina','diagnostico','Evaluación de muestra urinaria como apoyo diagnóstico.','La muestra y conservación deben seguir las indicaciones de la clínica.',25,'Desde Bs 75',75,'LABORATORIO','Perros y gatos','laboratorio',25,true),
('radiografia','Radiografía simple','diagnostico','Estudio radiográfico para evaluación de estructuras según indicación.','La región y número de proyecciones determinan el costo final.',35,'Desde Bs 140',140,'IMAGEN','Perros y gatos','imagenologia',26,true),
('control-postvacuna','Control posterior a vacuna','prevencion','Revisión breve para seguimiento después de la vacunación.','Ante signos intensos o dificultad respiratoria acudir a urgencias.',15,'Bs 35',35,'SEGUIMIENTO','Perros y gatos','control',27,true),
('plan-vacunacion','Plan de vacunación individual','prevencion','Organización del calendario preventivo según edad y antecedentes.','No sustituye la evaluación presencial ni el carnet sanitario.',25,'Bs 45',45,'PREVENCIÓN','Perros y gatos','vacuna',28,true),
('antipulgas','Control de pulgas y garrapatas','prevencion','Evaluación y orientación para control de ectoparásitos.','Producto y dosis se seleccionan por especie, peso y edad.',20,'Desde Bs 55',55,'PREVENCIÓN','Perros y gatos','prevencion',29,true),
('esterilizacion-macho','Evaluación prequirúrgica macho','procedimientos','Valoración previa para determinar aptitud y estudios necesarios.','La cirugía solo se programa tras evaluación y consentimiento informado.',30,'Desde Bs 90',90,'CIRUGÍA','Perros y gatos','cirugia',30,true),
('esterilizacion-hembra','Evaluación prequirúrgica hembra','procedimientos','Revisión clínica previa a procedimiento de esterilización.','Puede requerir análisis preoperatorios según edad y estado general.',35,'Desde Bs 100',100,'CIRUGÍA','Perros y gatos','cirugia',31,true),
('curacion-herida','Curación de herida simple','procedimientos','Limpieza y cuidado local de heridas superficiales evaluadas.','Heridas profundas, sangrado persistente o mordeduras requieren evaluación urgente.',25,'Desde Bs 70',70,'CUIDADOS','Perros y gatos','curaciones',32,true),
('retiro-sutura','Retiro de puntos','procedimientos','Control de cicatrización y retiro de suturas cuando corresponde.','Solo se realiza si la herida está apta según evaluación.',20,'Desde Bs 50',50,'SEGUIMIENTO','Perros y gatos','curaciones',33,true),
('fluidoterapia','Fluidoterapia supervisada','procedimientos','Administración de fluidos bajo supervisión veterinaria.','Indicación, volumen y duración dependen del estado clínico.',60,'Desde Bs 150',150,'TRATAMIENTO','Perros y gatos','consulta',34,true),
('nebulizacion','Nebulización veterinaria','procedimientos','Apoyo respiratorio mediante nebulización cuando está indicada.','No reemplaza atención urgente ante dificultad respiratoria.',25,'Desde Bs 65',65,'TRATAMIENTO','Perros y gatos','consulta',35,true),
('limpieza-oidos','Limpieza de oídos','bienestar','Higiene externa y revisión básica del oído.','Dolor, mal olor o secreción requieren diagnóstico antes de limpiar.',20,'Desde Bs 45',45,'HIGIENE','Perros y gatos','curaciones',36,true),
('corte-unas','Corte de uñas','bienestar','Corte cuidadoso de uñas y revisión de almohadillas.','El manejo se adapta al temperamento y tamaño de la mascota.',15,'Desde Bs 30',30,'HIGIENE','Perros y gatos','peluqueria',37,true),
('cepillado','Cepillado y deslanado','bienestar','Cepillado para retirar pelo suelto y ayudar al cuidado del manto.','Tiempo y costo dependen del tipo y estado del pelaje.',35,'Desde Bs 45',45,'ESTÉTICA','Perros y gatos','peluqueria',38,true),
('bano-pequeno','Baño higiénico tamaño pequeño','bienestar','Baño y secado para mascotas de tamaño pequeño.','Precio final según pelaje, nudos y condición de piel.',60,'Desde Bs 55',55,'BAÑO','Perros','peluqueria',39,true),
('bano-mediano','Baño higiénico tamaño mediano','bienestar','Baño y secado para mascotas de tamaño mediano.','Precio final según pelaje, nudos y condición de piel.',75,'Desde Bs 75',75,'BAÑO','Perros','peluqueria',40,true),
('bano-grande','Baño higiénico tamaño grande','bienestar','Baño y secado para mascotas de tamaño grande.','Precio final según pelaje, nudos y condición de piel.',90,'Desde Bs 100',100,'BAÑO','Perros','peluqueria',41,true),
('corte-pelo','Corte de pelo higiénico','bienestar','Arreglo higiénico del pelaje según raza y comodidad del animal.','El estilo se acuerda con el tutor y se prioriza el bienestar.',75,'Desde Bs 90',90,'ESTÉTICA','Perros','peluqueria',42,true),
('consulta-domicilio-extendida','Consulta veterinaria a domicilio','consulta','Atención programada en domicilio dentro de la zona de cobertura.','Disponibilidad y costo de traslado se confirman antes de reservar.',50,'Desde Bs 160',160,'DOMICILIO','Perros y gatos','domicilio',43,true),
('teleorientacion','Orientación veterinaria inicial','consulta','Orientación inicial para determinar el tipo de atención necesaria.','No sustituye diagnóstico presencial ni atención de urgencia.',20,'Desde Bs 50',50,'ORIENTACIÓN','Perros y gatos','consulta',44,true),
('control-peso','Control de peso y condición corporal','prevencion','Seguimiento de peso y recomendaciones generales de bienestar.','El plan nutricional debe individualizarse.',20,'Bs 40',40,'PREVENCIÓN','Perros y gatos','control',45,true),
('asesoria-nutricional','Asesoría nutricional','bienestar','Orientación sobre alimentación según etapa de vida y condición corporal.','No se recomiendan cambios bruscos ni dietas caseras sin formulación.',35,'Desde Bs 80',80,'NUTRICIÓN','Perros y gatos','nutricion',46,true),
('consulta-geronte','Consulta de mascota adulta mayor','consulta','Evaluación general orientada a pacientes senior.','Puede recomendarse control periódico y pruebas complementarias.',40,'Desde Bs 85',85,'SENIOR','Perros y gatos','consulta',47,true),
('consulta-cachorro','Primera consulta de cachorro','consulta','Primera revisión de cachorro, crecimiento y cuidados iniciales.','Traer antecedentes, carnet y datos de alimentación si están disponibles.',35,'Desde Bs 60',60,'CACHORROS','Perros','consulta',48,true),
('consulta-gatito','Primera consulta de gatito','consulta','Primera revisión de gatito y orientación de adaptación y prevención.','Transportar en kennel seguro para reducir el estrés.',35,'Desde Bs 65',65,'GATITOS','Gatos','gato',49,true),
('segunda-opinion','Consulta de segunda opinión','consulta','Revisión de antecedentes y estudios previos para orientar próximos pasos.','Traer informes, recetas y resultados anteriores.',40,'Desde Bs 100',100,'CONSULTA','Perros y gatos','consulta',50,true),
('certificado-salud','Evaluación para certificado de salud','consulta','Examen clínico para valorar el estado general.','La emisión del certificado depende de la evaluación y finalidad solicitada.',30,'Desde Bs 80',80,'EVALUACIÓN','Perros y gatos','consulta',51,true),
('microchip-lectura','Lectura de microchip','prevencion','Verificación de identificación mediante lector compatible.','Confirmar disponibilidad de lector y registro antes de acudir.',15,'Consultar',null,'IDENTIFICACIÓN','Perros y gatos','control',52,true),
('asesoria-viaje','Orientación para viaje con mascota','consulta','Revisión de requisitos generales y planificación de controles previos.','Los requisitos oficiales dependen del destino y deben verificarse con la autoridad competente.',30,'Desde Bs 70',70,'VIAJES','Perros y gatos','consulta',53,true)
on conflict (id) do update set name=excluded.name,category=excluded.category,description=excluded.description,details=excluded.details,duration_min=excluded.duration_min,price_label=excluded.price_label,price_value=excluded.price_value,tag=excluded.tag,species=excluded.species,icon=excluded.icon,sort_order=excluded.sort_order,active=true;

-- 2. Bitácora: tabla privada para personal autorizado.
create table if not exists public.audit_events (
  id bigserial primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id text,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_created_idx on public.audit_events(created_at desc);
create index if not exists audit_events_type_idx on public.audit_events(event_type);
alter table public.audit_events enable row level security;
drop policy if exists audit_staff_read on public.audit_events;
create policy audit_staff_read on public.audit_events for select to authenticated using (public.is_staff());
revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;

-- 3. Registrar actividad real automáticamente desde este momento.
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_id text; v_desc text; v_type text;
begin
  v_type := lower(tg_table_name) || '_' || lower(tg_op);
  if tg_op='DELETE' then v_id := coalesce(to_jsonb(old)->>'id','');
  else v_id := coalesce(to_jsonb(new)->>'id',''); end if;
  v_desc := case
    when tg_table_name='pets' and tg_op='INSERT' then 'Se registró una mascota: '||coalesce(to_jsonb(new)->>'name','(sin nombre)')
    when tg_table_name='pets' and tg_op='UPDATE' then 'Se actualizaron los datos de una mascota'
    when tg_table_name='pets' and tg_op='DELETE' then 'Se eliminó una ficha de mascota'
    when tg_table_name='appointment_requests' and tg_op='INSERT' then 'Nueva solicitud de cita registrada'
    when tg_table_name='appointment_requests' and tg_op='UPDATE' then 'Se actualizó una cita: estado '||coalesce(to_jsonb(new)->>'status','')
    when tg_table_name='appointment_requests' and tg_op='DELETE' then 'Se eliminó una solicitud de cita'
    when tg_table_name='pet_medical_records' and tg_op='INSERT' then 'Se agregó una atención al historial médico'
    else 'Cambio en '||tg_table_name||' ('||tg_op||')' end;
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id,description,metadata,is_demo)
  values(auth.uid(),v_type,tg_table_name,v_id,v_desc,jsonb_build_object('operation',tg_op),false);
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
drop trigger if exists audit_pets_changes on public.pets;
create trigger audit_pets_changes after insert or update or delete on public.pets for each row execute function public.audit_row_change();
drop trigger if exists audit_appointments_changes on public.appointment_requests;
create trigger audit_appointments_changes after insert or update or delete on public.appointment_requests for each row execute function public.audit_row_change();
drop trigger if exists audit_records_changes on public.pet_medical_records;
create trigger audit_records_changes after insert on public.pet_medical_records for each row execute function public.audit_row_change();

-- 4. 200 eventos HISTÓRICOS DE DEMOSTRACIÓN, separados de eventos reales.
insert into public.audit_events(actor_id,event_type,entity_type,entity_id,description,metadata,is_demo,created_at)
select null,
       (array['consulta_registrada','mascota_actualizada','vacunacion_programada','control_peso','resultado_laboratorio','cita_confirmada','seguimiento_realizado','servicio_consultado','historial_actualizado','recordatorio_generado'])[((g-1)%10)+1],
       (array['appointment_requests','pets','services_catalog','pet_medical_records'])[((g-1)%4)+1],
       'DEMO-'||lpad(g::text,4,'0'),
       (array[
        'Se registró una solicitud de consulta general para revisión preventiva.',
        'Se actualizaron los datos de contacto del tutor de la mascota.',
        'Se programó una revisión del carnet de vacunación.',
        'Se registró control de peso y condición corporal.',
        'Se cargó un resultado de laboratorio para revisión profesional.',
        'El personal confirmó una cita de demostración.',
        'Se agregó una nota de seguimiento posterior a la consulta.',
        'El tutor consultó información del catálogo de servicios.',
        'Se actualizó el resumen de historial médico de ejemplo.',
        'Se generó un recordatorio de próxima visita.'
       ])[((g-1)%10)+1],
       jsonb_build_object('source','seed_demo','sequence',g,'note','Evento ficticio de demostración; no representa actividad real'),
       true,
       now() - make_interval(days => ((g-1)%75), hours => ((g*7)%24), mins => ((g*13)%60))
from generate_series(1,200) g
where not exists(select 1 from public.audit_events where is_demo=true and metadata->>'sequence'=g::text);

-- Reconstruir perfiles de las cuentas que YA existen en Supabase Auth.
-- El cliente y el administrador deben existir primero en Authentication > Users.
insert into public.profiles(id, full_name, phone, role)
select
  u.id,
  left(coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
                nullif(split_part(coalesce(u.email,'Tutor'), '@', 1), ''),
                'Tutor'), 80),
  case
    when coalesce(u.raw_user_meta_data->>'phone','') ~ '^[67][0-9]{7}$'
      then u.raw_user_meta_data->>'phone'
    else null
  end,
  case when lower(coalesce(u.email,'')) = 'admin.demo@pataandina.test'
       then 'staff' else 'tutor' end
from auth.users u
on conflict (id) do update
set full_name=excluded.full_name,
    phone=excluded.phone,
    role=excluded.role;

-- Datos clínicos DEMO: 15 mascotas vinculadas al usuario cliente.demo.
-- IMPORTANTE: el usuario debe existir primero en Authentication > Users.
do $$
declare
  v_client uuid;
  v_missing integer;
begin
  select id into v_client from auth.users
   where lower(email)='cliente.demo@pataandina.test' limit 1;
  -- Si el correo demo no existe, usar la primera cuenta con rol tutor ya creada.
  if v_client is null then
    select p.id into v_client
    from public.profiles p join auth.users u on u.id=p.id
    where p.role='tutor' and lower(coalesce(u.email,'')) <> 'admin.demo@pataandina.test'
    order by p.created_at asc limit 1;
  end if;
  if v_client is null then
    raise notice 'No se insertaron mascotas: crea primero al menos una cuenta cliente en Authentication > Users.';
    return;
  end if;

  insert into public.profiles(id,full_name,phone,role)
  values(v_client,'Cliente Demo Pata Andina','71234567','tutor')
  on conflict(id) do update set full_name=excluded.full_name,phone=excluded.phone,role='tutor';

  insert into public.pets(owner_id,name,species,breed,sex,birth_date,weight_kg,notes)
  select v_client,x.name,x.species,x.breed,x.sex,x.birth_date::date,x.weight_kg,x.notes
  from (values
    ('Luna','perro','Mestiza','hembra','2021-04-12',12.40,'Paciente demo: control preventivo.'),
    ('Michi','gato','Doméstico de pelo corto','macho','2022-09-03',4.20,'Paciente demo: control felino.'),
    ('Toby','perro','Golden Retriever','macho','2019-02-20',26.80,'Paciente demo: seguimiento de peso.'),
    ('Nala','gato','Siamés','hembra','2023-05-17',3.70,'Paciente demo: control anual.'),
    ('Rocky','perro','Labrador','macho','2020-02-11',24.50,'Paciente demo: actividad y peso.'),
    ('Mora','perro','Schnauzer','hembra','2023-01-27',8.20,'Paciente demo: revisión dental.'),
    ('Simba','gato','Mestizo','macho','2021-09-09',5.10,'Paciente demo: vacunas.'),
    ('Coco','otro','Conejo','macho','2024-03-03',1.60,'Paciente demo: manejo cuidadoso.'),
    ('Canela','perro','Cocker Spaniel','hembra','2022-07-14',11.30,'Paciente demo: piel y pelaje.'),
    ('Max','perro','Pastor Alemán','macho','2018-11-22',31.20,'Paciente demo: adulto senior.'),
    ('Milu','gato','Persa','hembra','2020-08-08',4.00,'Paciente demo: cuidado del manto.'),
    ('Bobby','perro','Poodle','macho','2024-01-15',5.40,'Paciente demo: cachorro.'),
    ('Pelusa','gato','Angora','hembra','2023-12-02',3.90,'Paciente demo: control felino.'),
    ('Duque','perro','Bulldog francés','macho','2021-06-30',13.10,'Paciente demo: control respiratorio.'),
    ('Kira','perro','Border Collie','hembra','2022-04-09',17.80,'Paciente demo: actividad física.')
  ) as x(name,species,breed,sex,birth_date,weight_kg,notes)
  where not exists(select 1 from public.pets p where p.owner_id=v_client and lower(p.name)=lower(x.name));

  -- Historial clínico ficticio para cada mascota (marcado expresamente como demo).
  insert into public.pet_medical_records(pet_id,visit_date,diagnosis,treatment,prescription,weight_kg,next_visit,created_by)
  select p.id, date '2026-10-15' - ((row_number() over(order by p.name)::int % 45) * interval '1 day'),
         'Control preventivo DEMO · '||p.name,
         'Evaluación general ficticia para probar la ficha clínica.',
         'Dato académico de demostración. No constituye una receta real.',
         p.weight_kg, date '2026-12-15', v_client
  from public.pets p
  where p.owner_id=v_client
    and not exists(select 1 from public.pet_medical_records r where r.pet_id=p.id and r.diagnosis='Control preventivo DEMO · '||p.name);

  insert into public.pet_vaccinations(pet_id,vaccine_name,applied_on,next_due,batch,notes,created_by)
  select p.id, case when p.species='gato' then 'Triple felina (DEMO)' else 'Polivalente (DEMO)' end,
         date '2026-09-15', date '2027-09-15', 'LOTE-DEMO-2026',
         'Registro ficticio para demostración; validar carnet real.', v_client
  from public.pets p where p.owner_id=v_client
    and not exists(select 1 from public.pet_vaccinations v where v.pet_id=p.id and v.vaccine_name like '%(DEMO)');

  insert into public.pet_deworming(pet_id,product_name,applied_on,next_due,weight_kg,notes,created_by)
  select p.id,'Antiparasitario de ejemplo (DEMO)',date '2026-10-01',date '2027-01-01',p.weight_kg,
         'Registro ficticio; producto y pauta reales requieren indicación veterinaria.',v_client
  from public.pets p where p.owner_id=v_client
    and not exists(select 1 from public.pet_deworming d where d.pet_id=p.id and d.product_name='Antiparasitario de ejemplo (DEMO)');

  -- Tres citas futuras de ejemplo en días hábiles; las valida el trigger de agenda.
  if not exists(select 1 from public.appointment_requests a where a.owner_id=v_client and a.note like 'Cita DEMO V26%') then
    with days as (
      select gs.day_ts::date visit_day,row_number() over(order by gs.day_ts) rn
      from generate_series((now() at time zone 'America/La_Paz')::date+1,
                           (now() at time zone 'America/La_Paz')::date+20,interval '1 day') gs(day_ts)
      where extract(isodow from gs.day_ts) between 1 and 6
    ), demo_pets as (
      select id,row_number() over(order by name) rn from public.pets where owner_id=v_client
    )
    insert into public.appointment_requests(owner_id,pet_id,service_id,starts_at,ends_at,note)
    select v_client,dp.id,'consulta-general',
      ((d.visit_day + time '10:00') at time zone 'America/La_Paz'),
      ((d.visit_day + time '10:30') at time zone 'America/La_Paz'),
      'Cita DEMO V26: horario ficticio, confirmar con la clínica.'
    from days d join demo_pets dp on dp.rn=d.rn
    where d.rn<=3;
  end if;
end $$;

-- Comprobación final de carga.
select 'servicios activos' as indicador, count(*)::text as total
  from public.services_catalog where active
union all
select 'eventos demo', count(*)::text
  from public.audit_events where is_demo
union all
select 'usuarios Auth', count(*)::text from auth.users
union all
select 'perfiles', count(*)::text from public.profiles
union all
select 'mascotas', count(*)::text from public.pets
union all
select 'citas', count(*)::text from public.appointment_requests
union all
select 'historiales', count(*)::text from public.pet_medical_records
union all
select 'vacunas', count(*)::text from public.pet_vaccinations
union all
select 'desparasitaciones', count(*)::text from public.pet_deworming;


 
-- Endurecer RLS: eliminar políticas heredadas desconocidas y recrear solo las necesarias.
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname='public'
      and tablename in ('profiles','pets','services_catalog','appointment_requests',
                        'pet_medical_records','pet_vaccinations','pet_deworming','staff_activation_codes','audit_events')
  loop
    execute format('drop policy %I on %I.%I',p.policyname,p.schemaname,p.tablename);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.pets enable row level security;
alter table public.services_catalog enable row level security;
alter table public.appointment_requests enable row level security;
alter table public.pet_medical_records enable row level security;
alter table public.pet_vaccinations enable row level security;
alter table public.pet_deworming enable row level security;
alter table public.staff_activation_codes enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id=auth.uid() or public.is_staff());
create policy profiles_update on public.profiles for update to authenticated
  using (id=auth.uid()) with check (id=auth.uid());

create policy pets_select on public.pets for select to authenticated
  using (owner_id=auth.uid() or public.is_staff());
create policy pets_insert on public.pets for insert to authenticated
  with check (owner_id=auth.uid());
create policy pets_update on public.pets for update to authenticated
  using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy pets_delete on public.pets for delete to authenticated
  using (owner_id=auth.uid());

-- ÚNICA tabla visible sin sesión:
create policy services_select on public.services_catalog for select to anon, authenticated
  using (active=true);

create policy appt_select on public.appointment_requests for select to authenticated
  using (owner_id=auth.uid() or public.is_staff());
create policy appt_insert on public.appointment_requests for insert to authenticated
  with check (owner_id=auth.uid());

create policy records_select on public.pet_medical_records for select to authenticated
  using (public.is_staff() or exists(
    select 1 from public.pets p where p.id=pet_id and p.owner_id=auth.uid()
  ));
create policy records_vaccinations_select on public.pet_vaccinations for select to authenticated
  using (public.is_staff() or exists(select 1 from public.pets p where p.id=pet_id and p.owner_id=auth.uid()));
create policy records_deworming_select on public.pet_deworming for select to authenticated
  using (public.is_staff() or exists(select 1 from public.pets p where p.id=pet_id and p.owner_id=auth.uid()));
create policy audit_staff_read on public.audit_events for select to authenticated
  using (public.is_staff());

revoke all on public.profiles, public.pets, public.services_catalog,
  public.appointment_requests, public.pet_medical_records,
  public.pet_vaccinations, public.pet_deworming, public.staff_activation_codes, public.audit_events from anon, authenticated;

grant select on public.services_catalog to anon, authenticated;
grant select on public.profiles to authenticated;
grant update(full_name,phone,address) on public.profiles to authenticated;
grant select,insert,update,delete on public.pets to authenticated;
grant select,insert on public.appointment_requests to authenticated;
grant select on public.pet_medical_records, public.pet_vaccinations, public.pet_deworming, public.audit_events to authenticated;

-- El rol nunca puede modificarse desde el cliente.
revoke update(role) on public.profiles from authenticated, anon;


-- Comprobación de permisos para invitado:
-- anon: SELECT únicamente sobre services_catalog (active=true).
-- anon: sin SELECT/INSERT/UPDATE/DELETE en perfiles, mascotas, citas,
--       historiales, bitácora o códigos de personal.

commit;
