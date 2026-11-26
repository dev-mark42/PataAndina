-- =====================================================================
-- PATA ANDINA VET · PASO 3: DATOS MASIVOS DE DEMOSTRACIÓN
-- Ejecutar DESPUÉS de 02-admin-pagos-bitacora.sql. Es idempotente.
-- Crea: 3 cuentas de equipo + 42 tutores, ~80 mascotas, ~350 citas, historial médico,
--       carnet de vacunas, pagos con recibo y cientos de eventos de bitácora.
-- TODAS las contraseñas están en el README (resumen):
--   admin@pataandina.com / Admin2026!    vet@pataandina.com / Vet2026!    vet2@pataandina.com / Vet2026!
--   ana@pataandina.com / Demo2026!       carlos@pataandina.com / Demo2026!
--   tutor01@pataandina.com ... tutor40@pataandina.com / Demo2026!
-- =====================================================================
set search_path = public, extensions;

create or replace function pg_temp.demo_user(p_email text, p_pass text, p_name text, p_phone text, p_role text) returns uuid
language plpgsql as $$
declare v uuid;
begin
  select id into v from auth.users where email = p_email;
  if v is null then
    v := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', p_email,
            crypt(p_pass, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('full_name', p_name, 'phone', p_phone), now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v, v::text, jsonb_build_object('sub', v::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
  end if;
  update public.profiles set role = p_role, full_name = p_name, phone = p_phone where id = v;
  return v;
end $$;

create or replace function pg_temp.h(p_seed text, p_mod int) returns int language sql immutable as $$ select abs(hashtext(p_seed)) % p_mod $$;

do $$
declare
  fn text[] := array['Ana','Carlos','María','Luis','Rosa','Jorge','Lucía','Pedro','Carmen','Miguel','Sofía','Diego','Valentina','Marco','Daniela','Ricardo','Paola','Fernando','Gabriela','Álvaro','Camila','Sergio','Patricia','Hugo','Andrea','Raúl','Natalia','Iván','Elena','Óscar'];
  sn text[] := array['Pérez','Rojas','Mamani','Quispe','Flores','Choque','Condori','Vargas','Gutiérrez','Fernández','Torrez','Callisaya','Huanca','Villca','Limachi','Ramírez','Cruz','Aguilar','Mendoza','Salinas'];
  pn text[] := array['Luna','Max','Kiwi','Rocky','Mishi','Toby','Nala','Simba','Coco','Bella','Thor','Lola','Milo','Pelusa','Canela','Rex','Zeus','Mora','Chispa','Boby','Tina','Lucky','Princesa','Pipo','Nube','Bruno','Kira','Ñoño','Frida','Oso'];
  bd text[] := array['Mestizo','Labrador','Golden Retriever','Bulldog francés','Schnauzer','Poodle','Pastor alemán','Chihuahua','Cocker spaniel','Husky siberiano'];
  bc text[] := array['Mestizo','Siamés','Persa','Angora','Bengalí'];
  bb text[] := array['Periquito australiano','Canario','Cotorra','Agapornis'];
  dx text[] := array['Control sano, sin hallazgos.','Otitis externa leve.','Dermatitis alérgica estacional.','Gastroenteritis aguda leve.','Parásitos intestinales.','Sobrepeso grado 1.','Gingivitis y sarro.','Conjuntivitis leve.','Herida superficial limpia.','Cojera por esguince leve.','Infección urinaria baja.','Tos de las perreras en recuperación.'];
  tx text[] := array['Limpieza y observación.','Gotas óticas por 7 días.','Baño medicado y dieta de eliminación.','Dieta blanda y suero oral.','Desparasitación interna.','Plan de dieta y ejercicio.','Limpieza dental profesional.','Colirio cada 8 horas.','Curación diaria.','Reposo relativo 10 días.','Antibiótico según peso.','Reposo e hidratación.'];
  rx text[] := array['Control en 6 meses.','Aplicar gotas 2 veces al día.','Shampoo medicado 2 veces por semana.','Dieta blanda 3 días.','Repetir dosis en 15 días.','Pesar cada 2 semanas.','Cepillado dental frecuente.','Lavar con suero fisiológico.','Mantener vendaje seco.','Evitar escaleras y saltos.','Completar el tratamiento.','Ambiente ventilado.'];
  vv text[] := array['Rabia','Quíntuple canina','Parvovirus','Triple felina','Leucemia felina','Bordetella'];
  svc text[]; vet1 uuid; vet2 uuid; adm uuid; u uuid; p uuid; a uuid;
  i int; j int; d int; hr int; np int; pets_ids uuid[]; owner_of uuid[]; sp text; br text; nm text; dow int;
  r int; st text; sid text; dur int; price numeric; ts timestamptz; te timestamptz; pid uuid; oid uuid; rid uuid;
  day date; created timestamptz; k int; refc text; rcp text; pst text; vetsel uuid; slots numeric[] := array[9,10,11,15,16,17,9.5,10.5,15.5,16.5];
  t numeric; n_ap int := 0;
begin
  if exists (select 1 from auth.users where email = 'tutor01@pataandina.com') then
    raise notice 'Los datos masivos ya existen: no se duplican.'; return;
  end if;
  perform set_config('app.seeding', 'on', true);

  adm  := pg_temp.demo_user('admin@pataandina.com', 'Admin2026!', 'Dra. Valeria Mamani', '70011223', 'admin');
  vet1 := pg_temp.demo_user('vet@pataandina.com',   'Vet2026!',   'Dr. Rodrigo Quispe', '70099887', 'staff');
  vet2 := pg_temp.demo_user('vet2@pataandina.com',  'Vet2026!',   'Dra. Lucía Fernández','70055441', 'staff');
  select array_agg(id order by popularity desc) into svc from public.services_catalog;

  -- tutores y mascotas
  for i in 0..41 loop
    if i = 0 then u := pg_temp.demo_user('ana@pataandina.com','Demo2026!','Ana Pérez','71234567','tutor');
    elsif i = 1 then u := pg_temp.demo_user('carlos@pataandina.com','Demo2026!','Carlos Rojas','76543210','tutor');
    else u := pg_temp.demo_user('tutor'||lpad((i-1)::text,2,'0')||'@pataandina.com','Demo2026!', fn[1 + (i*7) % 30] || ' ' || sn[1 + (i*3) % 20] || ' ' || sn[1 + (i*11+4) % 20], '7' || lpad(((i*7654321) % 10000000)::text, 7, '0'), 'tutor'); end if;
    update public.profiles set address = 'Zona ' || (array['Sopocachi','Calacoto','Miraflores','San Miguel','Obrajes','Achumani','El Alto Ceja','Villa Fátima'])[1 + i % 8] || ', La Paz', created_at = now() - make_interval(days => 120 - i*2) where id = u;
    for j in 0..(i % 3) loop
      r := (i + j*3) % 7; sp := case when r <= 3 then 'perro' when r <= 5 then 'gato' else 'ave' end;
      br := case sp when 'perro' then bd[1 + (i+j) % 10] when 'gato' then bc[1 + (i+j) % 5] else bb[1 + (i+j) % 4] end;
      insert into public.pets(owner_id,name,species,breed,sex,birth_date,weight_kg,notes,created_at)
      values (u, pn[1 + (i*5 + j*7) % 30], sp, br, case when (i+j)%2=0 then 'macho' else 'hembra' end, current_date - (200 + (i*53 + j*91) % 3000),
              case sp when 'perro' then 4 + ((i*13+j*7) % 300)/10.0 when 'gato' then 2.2 + ((i*7+j) % 40)/10.0 else 0.03 + ((i+j) % 5)/100.0 end,
              (array['Sin alergias conocidas.','Le asusta el ruido.','Come solo alimento seco.','Muy sociable.','Necesita bozal en consulta.','Alérgico a ciertas proteínas.'])[1 + (i+j) % 6],
              now() - make_interval(days => 100 - i))
      returning id into p;
      pets_ids := coalesce(pets_ids, '{}') || p; owner_of := coalesce(owner_of, '{}') || u;
      -- carnet inicial de vacunas
      insert into public.pet_vaccines(pet_id, vaccine, applied_on, next_due, lot, vet)
      values (p, case sp when 'perro' then 'Rabia' when 'gato' then 'Triple felina' else 'Control sanitario aves' end, current_date - (30 + (i*17 + j*5) % 300), current_date + (30 + (i*13) % 330), 'L' || lpad(((i+1)*37 + j)::text, 5, '0'), 'Dr. Rodrigo Quispe');
    end loop;
  end loop;
  np := array_length(pets_ids, 1);

  alter table public.appointment_requests disable trigger appt_validate;
  -- citas desde hace 100 días hasta dentro de 28 días
  for d in -100..28 loop
    day := (now() at time zone 'America/La_Paz')::date + d;
    continue when extract(dow from day) = 0;
    foreach t in array slots loop
      r := pg_temp.h(d::text || '-' || t::text, 100);
      continue when r >= case when d < 0 then 62 else 38 end;
      k := 1 + pg_temp.h('p' || d || t, np); pid := pets_ids[k]; oid := owner_of[k];
      sid := svc[1 + floor(16 * power(pg_temp.h('s' || d || t, 100) / 100.0, 2))::int];
      select duration_min, coalesce(price_value, 80) into dur, price from public.services_catalog where id = sid;
      ts := ((day + make_interval(mins => (t * 60)::int)) at time zone 'America/La_Paz'); te := ts + make_interval(mins => dur);
      r := pg_temp.h('st' || d || t, 100);
      st := case when d < 0 then case when r < 82 then 'completada' when r < 91 then 'cancelada' else 'rechazada' end
                 when d <= 3 then case when r < 60 then 'confirmada' else 'pendiente' end
                 else case when r < 55 then 'pendiente' when r < 90 then 'confirmada' else 'cancelada' end end;
      created := least(now(), ts - make_interval(days => 1 + pg_temp.h('c' || d || t, 7), hours => pg_temp.h('ch' || d || t, 10)));
      begin
        insert into public.appointment_requests(owner_id,pet_id,service_id,starts_at,ends_at,status,note,staff_note,created_at)
        values (oid, pid, sid, ts, te, st,
                (array[null,'Vino con apetito bajo.','Primera visita.','Control de rutina.','Tiene miedo a los ruidos.',null,'Solicito atención con calma.'])[1 + pg_temp.h('n' || d || t, 7)],
                case st when 'rechazada' then 'No había disponibilidad ese día. Reprograma por favor.' else null end, created)
        returning id into a;
      exception when exclusion_violation then continue; end;
      n_ap := n_ap + 1;
      vetsel := case when pg_temp.h('v' || d || t, 2) = 0 then vet1 else vet2 end;
      insert into public.audit_log(at, actor, actor_name, action, entity, entity_id, detail)
        values (created, oid, 'Tutor', 'cita_creada', 'cita', a::text, 'Servicio ' || sid);
      if st in ('confirmada','completada','rechazada','cancelada') then
        insert into public.audit_log(at, actor, actor_name, action, entity, entity_id, detail)
          values (created + interval '3 hours', case when st in ('confirmada','completada') then vetsel when st='rechazada' then vetsel else oid end,
                  case when st='cancelada' then 'Tutor' when vetsel = vet1 then 'Dr. Rodrigo Quispe' else 'Dra. Lucía Fernández' end,
                  case st when 'cancelada' then 'cita_cancelada' when 'rechazada' then 'cita_rechazada' else 'cita_confirmada' end, 'cita', a::text, null);
      end if;
      if st = 'completada' then
        r := pg_temp.h('dx' || d || t, 12);
        insert into public.pet_medical_records(pet_id, appointment_id, visit_date, diagnosis, treatment, prescription, weight_kg, next_visit, created_by)
        values (pid, a, (ts at time zone 'America/La_Paz')::date, dx[1 + r], tx[1 + r], rx[1 + r],
                (select greatest(0.03, round((weight_kg * (0.97 + pg_temp.h('w' || d || t, 7)/100.0))::numeric, 2)) from public.pets where id = pid),
                (ts at time zone 'America/La_Paz')::date + (30 + pg_temp.h('nv' || d || t, 300)), vetsel);
        insert into public.audit_log(at, actor, actor_name, action, entity, entity_id, detail)
          values (te + interval '10 minutes', vetsel, case when vetsel = vet1 then 'Dr. Rodrigo Quispe' else 'Dra. Lucía Fernández' end, 'atencion_registrada', 'historial', a::text, dx[1 + r]);
        if sid like 'vacuna-%' then
          insert into public.pet_vaccines(pet_id, vaccine, applied_on, next_due, lot, vet)
          values (pid, vv[1 + pg_temp.h('vv' || d || t, 6)], (ts at time zone 'America/La_Paz')::date, (ts at time zone 'America/La_Paz')::date + 365, 'L' || lpad(pg_temp.h('lot' || d || t, 99999)::text, 5, '0'), case when vetsel = vet1 then 'Dr. Rodrigo Quispe' else 'Dra. Lucía Fernández' end);
        end if;
      end if;
      -- pagos: citas completadas (casi todas) y algunas confirmadas por adelantado
      if st = 'completada' or (st = 'confirmada' and pg_temp.h('pp' || d || t, 100) < 30) then
        r := pg_temp.h('m' || d || t, 100);
        pst := case when st = 'completada' and d < -7 then 'validado' when st = 'completada' then case when r < 40 then 'pendiente' else 'validado' end else 'pendiente' end;
        refc := 'OP' || lpad(pg_temp.h('ref' || d || t, 99999999)::text, 8, '0');
        rcp := case when pst = 'validado' then 'PA-' || to_char(ts,'YYYY') || '-' || lpad(nextval('public.receipt_seq')::text, 6, '0') end;
        insert into public.payments(appointment_id, owner_id, amount, method, reference, status, receipt_no, validated_by, validated_at, created_at)
        values (a, oid, price, case when r < 55 then 'qr' when r < 80 then 'efectivo' else 'transferencia' end,
                case when r >= 55 and r < 80 then null else refc end, pst, rcp, case when pst = 'validado' then vetsel end,
                case when pst = 'validado' then te + interval '1 hour' end, least(now(), te + interval '20 minutes'));
        if pst = 'validado' then
          insert into public.audit_log(at, actor, actor_name, action, entity, entity_id, detail)
            values (te + interval '1 hour', vetsel, case when vetsel = vet1 then 'Dr. Rodrigo Quispe' else 'Dra. Lucía Fernández' end, 'pago_validado', 'pago', a::text, 'Recibo ' || rcp || ' · Bs ' || price);
        end if;
      end if;
    end loop;
  end loop;
  alter table public.appointment_requests enable trigger appt_validate;

  -- inicios y cierres de sesión de las últimas semanas
  insert into public.audit_log(at, actor, actor_name, action, entity, entity_id)
  select now() - make_interval(mins => g * 83 + (g % 7) * 11), pr.id, pr.full_name,
         case when g % 3 = 0 then 'cierre_sesion' else 'inicio_sesion' end, 'sesion', pr.id::text
    from generate_series(1, 360) g
    join lateral (select id, full_name from public.profiles order by id offset (g * 7) % (select count(*) from public.profiles) limit 1) pr on true;
  insert into public.audit_log(at, actor, actor_name, action, entity, entity_id, detail)
  select now() - make_interval(hours => g * 5), null, 'Visitante', 'invitado_visita', 'sesion', null, 'Exploró el catálogo como invitado' from generate_series(1, 25) g;

  -- ajustes de la clínica
  update public.clinic_settings set whatsapp = '59170000000', address = 'Av. Arce 2345, La Paz, Bolivia', pay_holder = 'Pata Andina Vet',
    pay_qr = 'data:image/png;base64,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' where id = 1;
  raise notice 'Datos masivos creados: % citas.', n_ap;
exception when others then
  begin alter table public.appointment_requests enable trigger appt_validate; exception when others then null; end;
  raise;
end $$;
