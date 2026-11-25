-- PATA ANDINA VET · DATOS PARA LAS CUENTAS DE PRUEBA
-- PASO 1: En Supabase > Authentication > Users > Add user crea:
-- CLIENTE: cliente.demo@pataandina.test | contraseña: PataDemo2026!
-- ADMIN:   admin.demo@pataandina.test   | contraseña: AdminPata2026!
-- Marca Email confirmed / Auto Confirm para ambas cuentas.
-- PASO 2: Ejecuta primero schema.sql y seed_completo_y_bitacora.sql.
-- PASO 3: Ejecuta este archivo. No inserta contraseñas en auth.users.
-- PASO 4: Cliente ingresa normalmente. Admin ingresa y activa personal
--         desde Perfil con el código de un solo uso PATA-STAFF-2026.
-- CAMBIA las contraseñas inmediatamente después de la primera prueba.

do $$
declare
  v_client uuid;
begin
  select id into v_client from auth.users where lower(email)='cliente.demo@pataandina.test' limit 1;
  if v_client is null then
    raise notice 'Primero crea cliente.demo@pataandina.test en Authentication > Users.';
    return;
  end if;

  insert into public.profiles(id,full_name,phone,role)
  values(v_client,'Cliente Demo Pata Andina','71234567','tutor')
  on conflict(id) do update set full_name=excluded.full_name,phone=excluded.phone;

  insert into public.pets(owner_id,name,species,breed,sex,birth_date,weight_kg,notes)
  select v_client,'Luna','perro','Mestiza','hembra',date '2021-04-12',12.40,'Paciente de demostración. Datos ficticios para probar fichas y reservas.'
  where not exists(select 1 from public.pets where owner_id=v_client and name='Luna');

  insert into public.pets(owner_id,name,species,breed,sex,birth_date,weight_kg,notes)
  select v_client,'Michi','gato','Doméstico de pelo corto','macho',date '2022-09-03',4.20,'Paciente de demostración. Datos ficticios para probar el panel felino.'
  where not exists(select 1 from public.pets where owner_id=v_client and name='Michi');

  insert into public.pets(owner_id,name,species,breed,sex,birth_date,weight_kg,notes)
  select v_client,'Toby','perro','Golden Retriever','macho',date '2019-02-20',26.80,'Paciente de demostración. Datos ficticios para probar varias mascotas.'
  where not exists(select 1 from public.pets where owner_id=v_client and name='Toby');

  insert into public.pet_medical_records(pet_id,visit_date,diagnosis,treatment,prescription,weight_kg,next_visit,created_by)
  select id,date '2026-10-08','Control preventivo de rutina','Evaluación general de demostración.','Mantener agua fresca y control de peso.',12.40,date '2026-12-08',v_client
  from public.pets where owner_id=v_client and name='Luna'
    and not exists(select 1 from public.pet_medical_records r where r.pet_id=pets.id and r.diagnosis='Control preventivo de rutina');

  insert into public.pet_medical_records(pet_id,visit_date,diagnosis,treatment,prescription,weight_kg,next_visit,created_by)
  select id,date '2026-09-19','Evaluación general felina','Consejos de adaptación y enriquecimiento ambiental.','Control preventivo según calendario individual.',4.20,date '2026-12-19',v_client
  from public.pets where owner_id=v_client and name='Michi'
    and not exists(select 1 from public.pet_medical_records r where r.pet_id=pets.id and r.diagnosis='Evaluación general felina');

  insert into public.pet_medical_records(pet_id,visit_date,diagnosis,treatment,prescription,weight_kg,next_visit,created_by)
  select id,date '2026-08-21','Control de condición corporal','Seguimiento de peso de demostración.','Ajustar ración solo con orientación veterinaria.',26.80,date '2026-11-28',v_client
  from public.pets where owner_id=v_client and name='Toby'
    and not exists(select 1 from public.pet_medical_records r where r.pet_id=pets.id and r.diagnosis='Control de condición corporal');
end $$;

-- Comprobar: 3 mascotas y 3 registros ficticios.
-- select name,species,breed,weight_kg from public.pets
-- where owner_id=(select id from auth.users where email='cliente.demo@pataandina.test');
