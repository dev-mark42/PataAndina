-- PATA ANDINA VET · DATOS DE DEMOSTRACIÓN PARA CLIENTE
-- Registra primero un cliente desde la pantalla Crear cuenta.
-- Cambia p_email por el correo exacto registrado y ejecuta en Supabase SQL Editor.
-- No crea contraseñas ni usuarios Auth: Supabase gestiona las credenciales.
begin;
insert into public.services_catalog
(id,name,category,description,details,duration_min,price_label,price_value,tag,species,icon,sort_order,active)
values
('test-piel','Evaluación dermatológica','consulta','Revisión de piel, pelo, irritaciones y posibles alergias.','La causa y el tratamiento se determinan tras la evaluación clínica.',35,'Desde Bs 85',85,'PIEL SANA','Perros y gatos','consulta',16,true),
('test-oidos','Limpieza y evaluación de oídos','consulta','Evaluación del canal auditivo y limpieza si está indicada.','No introducir hisopos ni productos sin indicación profesional.',25,'Desde Bs 65',65,'PREVENCIÓN','Perros y gatos','curaciones',17,true),
('test-control-senior','Control de mascota senior','prevencion','Seguimiento preventivo para mascotas adultas mayores.','Puede requerir análisis complementarios según evaluación.',40,'Desde Bs 100',100,'ADULTOS MAYORES','Perros y gatos','control',18,true),
('test-nutri','Plan nutricional individual','bienestar','Orientación de alimentación y condición corporal.','El plan se adapta a especie, edad, actividad y antecedentes.',30,'Desde Bs 70',70,'NUTRICIÓN','Perros y gatos','nutricion',19,true),
('test-post','Control postoperatorio','procedimientos','Revisión de evolución y cuidados posteriores a una cirugía.','Llevar indicaciones, medicamentos y fecha de la intervención.',25,'Desde Bs 70',70,'SEGUIMIENTO','Perros y gatos','curaciones',20,true),
('test-chip','Lectura de microchip','prevencion','Verificación de microchip y orientación sobre identificación.','La disponibilidad de lector debe confirmarse al reservar.',15,'Consultar',null,'IDENTIFICACIÓN','Perros y gatos','control',21,true)
on conflict (id) do update set name=excluded.name,category=excluded.category,description=excluded.description,details=excluded.details,duration_min=excluded.duration_min,price_label=excluded.price_label,price_value=excluded.price_value,tag=excluded.tag,species=excluded.species,icon=excluded.icon,sort_order=excluded.sort_order,active=true;
do $$
declare p_email text := lower('cliente.demo@pataandina.test'); -- CAMBIA ESTE CORREO
v_uid uuid;
begin
 select id into v_uid from auth.users where lower(email)=p_email limit 1;
 if v_uid is null then raise notice 'No existe %. Registra primero el usuario desde la app y vuelve a ejecutar.',p_email; return; end if;
 insert into public.pets(owner_id,name,species,breed,sex,birth_date,weight_kg,notes)
 select v_uid,'Luna','perro','Mestiza','hembra',date '2021-04-12',12.40,'Mascota demo para probar el panel.'
 where not exists(select 1 from public.pets where owner_id=v_uid and name='Luna');
 insert into public.pets(owner_id,name,species,breed,sex,birth_date,weight_kg,notes)
 select v_uid,'Michi','gato','Doméstico de pelo corto','macho',date '2022-09-03',4.20,'Gato demo para probar la ficha.'
 where not exists(select 1 from public.pets where owner_id=v_uid and name='Michi');
 insert into public.pets(owner_id,name,species,breed,sex,birth_date,weight_kg,notes)
 select v_uid,'Toby','perro','Golden Retriever','macho',date '2019-02-20',26.80,'Tercera mascota de ejemplo.'
 where not exists(select 1 from public.pets where owner_id=v_uid and name='Toby');
end $$;
commit;
