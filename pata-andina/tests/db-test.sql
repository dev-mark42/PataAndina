\set ON_ERROR_STOP on
\i tests/stub.sql
\i supabase/schema.sql
\i supabase/schema.sql
select count(*) services from services_catalog;
insert into auth.users(id,email,raw_user_meta_data) values ('11111111-1111-1111-1111-111111111111','a@a.com','{"full_name":"Ana Perez","phone":"71234567"}'),('22222222-2222-2222-2222-222222222222','b@b.com','{"full_name":"Beto"}');
select full_name, phone, role from profiles order by full_name;
\set VERBOSITY terse
set role authenticated; set request.jwt.claim.sub='11111111-1111-1111-1111-111111111111';
insert into pets(owner_id,name,species) values ('11111111-1111-1111-1111-111111111111','Luna','gato') returning id \gset pet_
-- próximo lunes 10:00 La Paz
select (date_trunc('week', now() at time zone 'America/La_Paz') + interval '7 days' + interval '10 hours') at time zone 'America/La_Paz' as mon10 \gset
\echo 'booking ok:'
insert into appointment_requests(owner_id,pet_id,service_id,starts_at,ends_at) values ('11111111-1111-1111-1111-111111111111',:'pet_id','consulta-general',:'mon10',:'mon10') returning status, ends_at - starts_at;
\echo 'overlap must fail:'
\unset ON_ERROR_STOP
insert into appointment_requests(owner_id,pet_id,service_id,starts_at,ends_at) values ('11111111-1111-1111-1111-111111111111',:'pet_id','consulta-felina',:'mon10',:'mon10');
\echo 'sunday must fail:'
insert into appointment_requests(owner_id,pet_id,service_id,starts_at,ends_at) values ('11111111-1111-1111-1111-111111111111',:'pet_id','consulta-general',:'mon10'::timestamptz - interval '1 day',:'mon10');
\echo 'lunch hour must fail:'
insert into appointment_requests(owner_id,pet_id,service_id,starts_at,ends_at) values ('11111111-1111-1111-1111-111111111111',:'pet_id','consulta-general',:'mon10'::timestamptz + interval '3 hours',:'mon10');
\echo 'role escalation must fail:'
update profiles set role='staff' where id=auth.uid();
\echo 'status tamper must fail:'
update appointment_requests set status='confirmada';
\echo 'staff code table must fail:'
select * from staff_activation_codes;
\echo 'other user sees nothing:'
set request.jwt.claim.sub='22222222-2222-2222-2222-222222222222';
select count(*) from pets; select count(*) from appointment_requests;
select count(*) busy from get_busy_slots((:'mon10'::timestamptz at time zone 'America/La_Paz')::date);
\echo 'cancel other user fails:'
select cancel_my_appointment((select id from (select id from appointment_requests) x limit 1));
\echo 'staff flow:'
select activate_staff('wrong');
select activate_staff('pata-staff-2026');
select is_staff();
select count(*) all_pets from pets; select count(*) all_appts from appointment_requests;
select staff_set_status((select id from appointment_requests where status='pendiente' limit 1),'rechazada',null);
select staff_set_status((select id from appointment_requests where status='pendiente' limit 1),'confirmada',null);
select staff_register_attention(null,(select id from appointment_requests where status='confirmada' limit 1),'Control sano','Ninguno','Vitamina',3.2,current_date+30);
select count(*) records from pet_medical_records; select status from appointment_requests;
set request.jwt.claim.sub='11111111-1111-1111-1111-111111111111';
select count(*) owner_sees_records from pet_medical_records;
select weight_kg from pets;
