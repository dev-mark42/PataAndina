-- PATA ANDINA · DATOS EXTRA DE DEMOSTRACIÓN (idempotente y no destructivo)
-- Ejecutar después de crear/confirmar cliente.demo@pataandina.test en Authentication.
-- No borra datos ni crea contraseñas Auth. Si el correo no existe, muestra NOTICE y no inserta mascotas.
do $$
declare v_owner uuid; v_pet uuid; r record;
begin
  select p.id into v_owner from public.profiles p join auth.users u on u.id=p.id
  where lower(u.email)='cliente.demo@pataandina.test' limit 1;
  if v_owner is null then
    raise notice 'No existe cliente.demo@pataandina.test. Crea la cuenta en Authentication y vuelve a ejecutar este archivo.';
    return;
  end if;
  for r in select * from (values
    ('Luna','perro','Golden Retriever','hembra','2021-03-12'::date,24.50,'Sociable; control anual.'),
    ('Michi','gato','Europeo de pelo corto','macho','2022-08-04'::date,4.30,'Vive en interior; llevar transportadora.'),
    ('Toby','perro','Mestizo','macho','2020-11-21'::date,18.20,'Actividad moderada.'),
    ('Nala','gato','Siamés','hembra','2023-02-15'::date,3.80,'Revisar salud dental.'),
    ('Rocky','perro','Bulldog francés','macho','2022-05-19'::date,12.10,'Control de peso y respiración.'),
    ('Mora','perro','Cocker spaniel','hembra','2019-09-09'::date,13.60,'Piel sensible; revisar oídos.'),
    ('Simba','gato','Persa','macho','2021-12-01'::date,5.10,'Cepillado frecuente.'),
    ('Coco','perro','Poodle','macho','2024-01-10'::date,5.40,'Cachorro; seguimiento de crecimiento.'),
    ('Canela','gato','Atigrada','hembra','2020-06-25'::date,4.60,'Control preventivo.'),
    ('Max','perro','Labrador','macho','2018-04-17'::date,29.00,'Senior; seguimiento articular.')
  ) as x(name,species,breed,sex,birth_date,weight_kg,notes) loop
    if not exists(select 1 from public.pets p where p.owner_id=v_owner and lower(p.name)=lower(r.name)) then
      insert into public.pets(owner_id,name,species,breed,sex,birth_date,weight_kg,notes)
      values(v_owner,r.name,r.species,r.breed,r.sex,r.birth_date,r.weight_kg,r.notes) returning id into v_pet;
      insert into public.pet_medical_records(pet_id,visit_date,diagnosis,treatment,prescription,weight_kg,next_visit)
      values(v_pet,current_date-interval '45 days','Control preventivo de demostración','Evaluación general y recomendaciones de cuidado','Seguir indicaciones del profesional veterinario.',r.weight_kg,current_date+interval '180 days');
      insert into public.pet_medical_records(pet_id,visit_date,diagnosis,treatment,weight_kg,next_visit)
      values(v_pet,current_date-interval '12 days','Revisión de seguimiento de demostración','Control de evolución y condición corporal',r.weight_kg,current_date+interval '90 days');
    end if;
  end loop;
  raise notice 'Datos demo cargados para el cliente: mascotas y 2 controles por cada mascota nueva.';
end $$;
