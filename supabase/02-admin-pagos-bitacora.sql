-- =====================================================================
-- PATA ANDINA VET · PASO 2: ADMINISTRADOR, pagos QR, bitácora, carnet de vacunas, ajustes
-- Ejecutar DESPUÉS de schema.sql y ANTES de 03-datos-masivos.sql, en Supabase > SQL Editor > Run.
-- Es idempotente (se puede repetir sin duplicar datos).
-- =====================================================================
set search_path = public, extensions;

-- ---------- 1) Roles y especies ----------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('tutor','staff','admin'));
alter table public.pets drop constraint if exists pets_species_check;
alter table public.pets add constraint pets_species_check check (species in ('perro','gato','ave','otro'));

create or replace function public.is_staff() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('staff','admin'));
$$;
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- 2) Funciones del administrador ----------
create or replace function public.admin_stats() returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede ver esto' using errcode = '42501'; end if;
  select jsonb_build_object(
    'users',   (select count(*) from profiles),
    'tutors',  (select count(*) from profiles where role = 'tutor'),
    'staff',   (select count(*) from profiles where role = 'staff'),
    'admins',  (select count(*) from profiles where role = 'admin'),
    'pets',    (select count(*) from pets),
    'records', (select count(*) from pet_medical_records),
    'upcoming',(select count(*) from appointment_requests where status in ('pendiente','confirmada') and starts_at > now()),
    'by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from appointment_requests group by status) x), '{}'::jsonb),
    'by_species', coalesce((select jsonb_object_agg(species, n) from (select species, count(*) n from pets group by species) x), '{}'::jsonb),
    'top_services', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'n', n) order by n desc) from (
        select s.name, count(*) n from appointment_requests a join services_catalog s on s.id = a.service_id group by s.name order by n desc limit 5) t), '[]'::jsonb)
  ) into r;
  return r;
end $$;

create or replace function public.admin_list_users()
returns table(id uuid, full_name text, phone text, role text, email text, created_at timestamptz, pets bigint)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede ver esto' using errcode = '42501'; end if;
  return query select p.id, p.full_name, p.phone, p.role, u.email::text, p.created_at,
                      (select count(*) from public.pets x where x.owner_id = p.id)
                 from public.profiles p left join auth.users u on u.id = p.id order by p.created_at desc;
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede hacer esto' using errcode = '42501'; end if;
  if p_role not in ('tutor','staff','admin') then raise exception 'Rol inválido' using errcode = 'P0001'; end if;
  if p_user = auth.uid() then raise exception 'No puedes cambiar tu propio rol (evita quedarte sin administrador)' using errcode = 'P0001'; end if;
  update public.profiles set role = p_role where id = p_user;
end $$;

create or replace function public.admin_create_code(p_code text default null) returns text
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede hacer esto' using errcode = '42501'; end if;
  v := upper(btrim(coalesce(nullif(p_code,''), 'PATA-' || substr(replace(gen_random_uuid()::text,'-',''),1,8))));
  if char_length(v) < 6 then raise exception 'El código debe tener al menos 6 caracteres' using errcode = 'P0001'; end if;
  insert into public.staff_activation_codes(code) values (v) on conflict (code) do update set active = true, used_by = null, used_at = null;
  return v;
end $$;

create or replace function public.admin_set_service(p_id text, p_active boolean, p_price_label text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede hacer esto' using errcode = '42501'; end if;
  if p_price_label is null or char_length(btrim(p_price_label)) < 2 then raise exception 'Escribe el precio o la etiqueta del precio' using errcode = 'P0001'; end if;
  update public.services_catalog set active = p_active, price_label = left(btrim(p_price_label), 60) where id = p_id;
  if not found then raise exception 'Servicio no encontrado' using errcode = 'P0001'; end if;
end $$;

drop policy if exists services_admin_select on public.services_catalog;
create policy services_admin_select on public.services_catalog for select to authenticated using (public.is_admin());

revoke all on function public.admin_stats(), public.admin_list_users(), public.admin_set_role(uuid,text),
  public.admin_create_code(text), public.admin_set_service(text,boolean,text), public.is_admin() from public, anon;
grant execute on function public.admin_stats(), public.admin_list_users(), public.admin_set_role(uuid,text),
  public.admin_create_code(text), public.admin_set_service(text,boolean,text), public.is_admin() to authenticated;


-- ---------- 3) Servicios: grupos (3), popularidad (Top 10) y video propio ----------
alter table public.services_catalog add column if not exists grp text not null default 'salud';
alter table public.services_catalog add column if not exists popularity int not null default 0;
alter table public.services_catalog add column if not exists video_url text;
update public.services_catalog s set grp = v.g, popularity = v.p from (values
  ('esterilizacion','cirugia',100),('vacuna-canina','salud',98),('vacuna-felina','salud',96),('consulta-general','salud',94),
  ('desparasitacion','salud',90),('profilaxis-dental','cirugia',86),('consulta-felina','salud',84),('control-cachorro','salud',80),
  ('laboratorio','diagnostico',76),('peluqueria','diagnostico',72),('imagenologia','diagnostico',66),('microchip','salud',62),
  ('nutricion','diagnostico',58),('curaciones','cirugia',54),('cirugia','cirugia',50),('consulta-domicilio','salud',46)
) v(id,g,p) where s.id = v.id;

-- ---------- 4) Ajustes de la clínica (contacto y QR de pago) ----------
create table if not exists public.clinic_settings (
  id int primary key default 1 check (id = 1),
  clinic_name text not null default 'Pata Andina Vet',
  whatsapp text not null default '59170000000',
  address text not null default 'La Paz, Bolivia',
  pay_holder text not null default 'Pata Andina Vet',
  pay_note text not null default 'Escanea el QR, paga el monto exacto y escribe el código de operación.',
  pay_qr text
);
insert into public.clinic_settings(id) values (1) on conflict do nothing;
alter table public.clinic_settings enable row level security;
drop policy if exists settings_read on public.clinic_settings;
create policy settings_read on public.clinic_settings for select to anon, authenticated using (true);
revoke all on public.clinic_settings from anon, authenticated; grant select on public.clinic_settings to anon, authenticated;

create or replace function public.admin_save_settings(p_name text, p_whatsapp text, p_address text, p_holder text, p_note text, p_qr text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede hacer esto' using errcode = '42501'; end if;
  if p_whatsapp !~ '^[0-9]{8,15}$' then raise exception 'WhatsApp: solo dígitos con código de país (ej. 59171234567)' using errcode = 'P0001'; end if;
  if p_qr is not null and (char_length(p_qr) > 400000 or p_qr !~ '^data:image/') then raise exception 'La imagen del QR es inválida o muy pesada' using errcode = 'P0001'; end if;
  update public.clinic_settings set clinic_name = left(btrim(p_name),60), whatsapp = p_whatsapp, address = left(btrim(p_address),120),
         pay_holder = left(btrim(p_holder),60), pay_note = left(btrim(p_note),200), pay_qr = coalesce(p_qr, pay_qr) where id = 1;
end $$;
create or replace function public.admin_set_video(p_id text, p_url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede hacer esto' using errcode = '42501'; end if;
  if p_url is not null and p_url <> '' and p_url !~ '^https://' then raise exception 'El enlace del video debe empezar con https://' using errcode = 'P0001'; end if;
  update public.services_catalog set video_url = nullif(btrim(p_url),'') where id = p_id;
end $$;

-- ---------- 5) Bitácora de eventos ----------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid, actor_name text, action text not null, entity text, entity_id text, detail text
);
create index if not exists audit_at_idx on public.audit_log(at desc);
alter table public.audit_log enable row level security;
drop policy if exists audit_admin on public.audit_log;
create policy audit_admin on public.audit_log for select to authenticated using (public.is_admin());
revoke all on public.audit_log from anon, authenticated; grant select on public.audit_log to authenticated;

create or replace function public.audit(p_action text, p_entity text, p_id text, p_detail text) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if current_setting('app.seeding', true) = 'on' then return; end if;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.audit_log(actor, actor_name, action, entity, entity_id, detail)
  values (auth.uid(), coalesce(v_name, 'Sistema'), p_action, p_entity, p_id, left(p_detail, 300));
end $$;
revoke all on function public.audit(text,text,text,text) from public, anon, authenticated;

-- el cliente solo puede registrar inicio/cierre de sesión
create or replace function public.log_event(p_action text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_action not in ('inicio_sesion','cierre_sesion','invitado_visita') then raise exception 'Evento no permitido' using errcode = 'P0001'; end if;
  perform public.audit(p_action, 'sesion', auth.uid()::text, null);
end $$;
revoke all on function public.log_event(text) from public, anon; grant execute on function public.log_event(text) to authenticated;

create or replace function public.t_audit_appt() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then perform public.audit('cita_creada','cita',new.id::text,'Servicio '||new.service_id||' · '||to_char(new.starts_at at time zone 'America/La_Paz','DD/MM HH24:MI'));
  elsif new.status is distinct from old.status then perform public.audit('cita_'||new.status,'cita',new.id::text,coalesce(new.staff_note,'')); end if;
  return new;
end $$;
drop trigger if exists audit_appt on public.appointment_requests;
create trigger audit_appt after insert or update on public.appointment_requests for each row execute function public.t_audit_appt();

create or replace function public.t_audit_misc() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'pets' then
    if tg_op = 'INSERT' then perform public.audit('mascota_creada','mascota',new.id::text,new.name||' ('||new.species||')');
    elsif tg_op = 'DELETE' then perform public.audit('mascota_eliminada','mascota',old.id::text,old.name); end if;
  elsif tg_table_name = 'pet_medical_records' then perform public.audit('atencion_registrada','historial',new.id::text,left(new.diagnosis,120));
  elsif tg_table_name = 'profiles' then
    if tg_op = 'UPDATE' and new.role is distinct from old.role then perform public.audit('rol_cambiado','usuario',new.id::text,old.role||' → '||new.role); end if;
  elsif tg_table_name = 'services_catalog' then
    if tg_op = 'UPDATE' and (new.price_label is distinct from old.price_label or new.active is distinct from old.active) then perform public.audit('servicio_editado','servicio',new.id,new.price_label||' · activo='||new.active); end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists audit_pets on public.pets; create trigger audit_pets after insert or delete on public.pets for each row execute function public.t_audit_misc();
drop trigger if exists audit_rec on public.pet_medical_records; create trigger audit_rec after insert on public.pet_medical_records for each row execute function public.t_audit_misc();
drop trigger if exists audit_prof on public.profiles; create trigger audit_prof after update on public.profiles for each row execute function public.t_audit_misc();
drop trigger if exists audit_svc on public.services_catalog; create trigger audit_svc after update on public.services_catalog for each row execute function public.t_audit_misc();

-- ---------- 6) Carnet de vacunas ----------
create table if not exists public.pet_vaccines (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  vaccine text not null check (char_length(btrim(vaccine)) between 2 and 80),
  applied_on date not null default current_date check (applied_on <= current_date),
  next_due date, lot text check (lot is null or char_length(lot) <= 30), vet text,
  created_at timestamptz not null default now(),
  check (next_due is null or next_due >= applied_on)
);
create index if not exists vacc_pet_idx on public.pet_vaccines(pet_id, applied_on desc);
alter table public.pet_vaccines enable row level security;
drop policy if exists vacc_select on public.pet_vaccines;
create policy vacc_select on public.pet_vaccines for select to authenticated
  using (public.is_staff() or exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()));
revoke all on public.pet_vaccines from anon, authenticated; grant select on public.pet_vaccines to authenticated;
create or replace function public.staff_add_vaccine(p_pet uuid, p_vaccine text, p_applied date, p_next date, p_lot text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid; v_name text;
begin
  if not public.is_staff() then raise exception 'Solo el personal puede hacer esto' using errcode = '42501'; end if;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.pet_vaccines(pet_id, vaccine, applied_on, next_due, lot, vet) values (p_pet, btrim(p_vaccine), coalesce(p_applied, current_date), p_next, nullif(btrim(coalesce(p_lot,'')),''), v_name) returning id into v;
  perform public.audit('vacuna_registrada','mascota',p_pet::text,p_vaccine);
  return v;
end $$;
revoke all on function public.staff_add_vaccine(uuid,text,date,date,text) from public, anon; grant execute on function public.staff_add_vaccine(uuid,text,date,date,text) to authenticated;

-- ---------- 7) Pagos (QR / efectivo) con validación y recibo ----------
create sequence if not exists public.receipt_seq start 1000;
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointment_requests(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(8,2) not null check (amount > 0 and amount < 100000),
  method text not null check (method in ('qr','transferencia','efectivo')),
  reference text check (reference is null or reference ~ '^[A-Za-z0-9-]{5,24}$'),
  proof text check (proof is null or (char_length(proof) < 300000 and proof ~ '^data:image/')),
  status text not null default 'pendiente' check (status in ('pendiente','validado','rechazado')),
  note text, receipt_no text unique, validated_by uuid references public.profiles(id), validated_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists pay_ref_unique on public.payments (lower(reference)) where reference is not null and status <> 'rechazado';
create index if not exists pay_status_idx on public.payments(status, created_at desc);
alter table public.payments enable row level security;
drop policy if exists pay_select on public.payments;
create policy pay_select on public.payments for select to authenticated using (owner_id = auth.uid() or public.is_staff());
revoke all on public.payments from anon, authenticated; grant select on public.payments to authenticated;

create or replace function public.submit_payment(p_appointment uuid, p_amount numeric, p_method text, p_reference text, p_proof text) returns uuid
language plpgsql security definer set search_path = public as $$
declare a public.appointment_requests; v uuid;
begin
  select * into a from public.appointment_requests where id = p_appointment and owner_id = auth.uid();
  if not found then raise exception 'Cita no encontrada' using errcode = 'P0001'; end if;
  if a.status not in ('pendiente','confirmada','completada') then raise exception 'Esta cita no admite pagos' using errcode = 'P0001'; end if;
  if p_method not in ('qr','transferencia') then raise exception 'Método inválido' using errcode = 'P0001'; end if;
  if p_reference is null or p_reference !~ '^[A-Za-z0-9-]{5,24}$' then raise exception 'Escribe el código de operación (5 a 24 letras o números)' using errcode = 'P0001'; end if;
  if exists (select 1 from public.payments where appointment_id = p_appointment and status in ('pendiente','validado')) then raise exception 'Esta cita ya tiene un pago registrado' using errcode = 'P0001'; end if;
  insert into public.payments(appointment_id, owner_id, amount, method, reference, proof) values (p_appointment, auth.uid(), p_amount, p_method, upper(p_reference), p_proof) returning id into v;
  perform public.audit('pago_enviado','pago',v::text,'Bs '||p_amount||' · ref '||upper(p_reference));
  return v;
end $$;

create or replace function public.staff_validate_payment(p_id uuid, p_ok boolean, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare p public.payments; r text;
begin
  if not public.is_staff() then raise exception 'Solo el personal puede hacer esto' using errcode = '42501'; end if;
  select * into p from public.payments where id = p_id;
  if not found then raise exception 'Pago no encontrado' using errcode = 'P0001'; end if;
  if p.status <> 'pendiente' then raise exception 'Este pago ya fue resuelto' using errcode = 'P0001'; end if;
  if p_ok then
    r := 'PA-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.receipt_seq')::text, 6, '0');
    update public.payments set status = 'validado', receipt_no = r, validated_by = auth.uid(), validated_at = now(), note = left(p_note,200) where id = p_id;
    perform public.audit('pago_validado','pago',p_id::text,'Recibo '||r||' · Bs '||p.amount);
    return r;
  end if;
  if p_note is null or char_length(btrim(p_note)) < 3 then raise exception 'Indica el motivo del rechazo' using errcode = 'P0001'; end if;
  update public.payments set status = 'rechazado', validated_by = auth.uid(), validated_at = now(), note = left(p_note,200) where id = p_id;
  perform public.audit('pago_rechazado','pago',p_id::text,p_note);
  return null;
end $$;

create or replace function public.staff_register_cash(p_appointment uuid, p_amount numeric) returns text
language plpgsql security definer set search_path = public as $$
declare a public.appointment_requests; v uuid; r text;
begin
  if not public.is_staff() then raise exception 'Solo el personal puede hacer esto' using errcode = '42501'; end if;
  select * into a from public.appointment_requests where id = p_appointment;
  if not found then raise exception 'Cita no encontrada' using errcode = 'P0001'; end if;
  if exists (select 1 from public.payments where appointment_id = p_appointment and status in ('pendiente','validado')) then raise exception 'Esta cita ya tiene un pago registrado' using errcode = 'P0001'; end if;
  r := 'PA-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.receipt_seq')::text, 6, '0');
  insert into public.payments(appointment_id, owner_id, amount, method, status, receipt_no, validated_by, validated_at)
  values (p_appointment, a.owner_id, p_amount, 'efectivo', 'validado', r, auth.uid(), now()) returning id into v;
  perform public.audit('pago_efectivo','pago',v::text,'Recibo '||r||' · Bs '||p_amount);
  return r;
end $$;
revoke all on function public.submit_payment(uuid,numeric,text,text,text), public.staff_validate_payment(uuid,boolean,text), public.staff_register_cash(uuid,numeric),
  public.admin_save_settings(text,text,text,text,text,text), public.admin_set_video(text,text) from public, anon;
grant execute on function public.submit_payment(uuid,numeric,text,text,text), public.staff_validate_payment(uuid,boolean,text), public.staff_register_cash(uuid,numeric),
  public.admin_save_settings(text,text,text,text,text,text), public.admin_set_video(text,text) to authenticated;

-- estadísticas ampliadas (reemplaza la función anterior)
create or replace function public.admin_stats() returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede ver esto' using errcode = '42501'; end if;
  select jsonb_build_object(
    'users',(select count(*) from profiles),'tutors',(select count(*) from profiles where role='tutor'),
    'staff',(select count(*) from profiles where role='staff'),'admins',(select count(*) from profiles where role='admin'),
    'pets',(select count(*) from pets),'records',(select count(*) from pet_medical_records),
    'upcoming',(select count(*) from appointment_requests where status in ('pendiente','confirmada') and starts_at > now()),
    'revenue',coalesce((select sum(amount) from payments where status='validado'),0),
    'pay_pending',(select count(*) from payments where status='pendiente'),
    'revenue_30d',coalesce((select sum(amount) from payments where status='validado' and validated_at > now() - interval '30 days'),0),
    'by_status',coalesce((select jsonb_object_agg(status,n) from (select status,count(*) n from appointment_requests group by status) x),'{}'::jsonb),
    'by_species',coalesce((select jsonb_object_agg(species,n) from (select species,count(*) n from pets group by species) x),'{}'::jsonb),
    'top_services',coalesce((select jsonb_agg(jsonb_build_object('name',name,'n',n) order by n desc) from (
        select s.name,count(*) n from appointment_requests a join services_catalog s on s.id=a.service_id group by s.name order by n desc limit 6) t),'[]'::jsonb),
    'by_month',coalesce((select jsonb_agg(jsonb_build_object('m',m,'n',n) order by m) from (
        select to_char(starts_at at time zone 'America/La_Paz','YYYY-MM') m, count(*) n from appointment_requests where starts_at > now() - interval '6 months' group by 1) z),'[]'::jsonb)
  ) into r;
  return r;
end $$;
