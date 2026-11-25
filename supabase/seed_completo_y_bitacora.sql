-- =====================================================================
-- PATA ANDINA VET · CATÁLOGO AMPLIADO + BITÁCORA + DATOS DEMO
-- Ejecutar DESPUÉS de supabase/schema.sql en Supabase SQL Editor.
-- Genera 34 servicios extra (50 en total junto al catálogo inicial),
-- 200 eventos de demostración y registra eventos reales desde ahora.
-- Los 200 eventos se marcan is_demo=true: NO son actividad real de clientes.
-- =====================================================================

begin;

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
('consulta-domicilio','Consulta veterinaria a domicilio','consulta','Atención programada en domicilio dentro de la zona de cobertura.','Disponibilidad y costo de traslado se confirman antes de reservar.',50,'Desde Bs 160',160,'DOMICILIO','Perros y gatos','domicilio',43,true),
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

commit;

-- Resultado esperado: al menos 50 servicios y 200 eventos DEMO.
-- select count(*) as servicios from public.services_catalog where active;
-- select count(*) as eventos_demo from public.audit_events where is_demo;
-- Los eventos reales se registran automáticamente por los triggers a partir de ahora.
