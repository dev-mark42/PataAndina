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
