\set ON_ERROR_STOP on
\i tests/stub.sql
\i tests/stub2.sql
\i supabase/schema.sql
\i supabase/02-admin-pagos-bitacora.sql
\i supabase/02-admin-pagos-bitacora.sql
\i supabase/03-datos-masivos.sql
\i supabase/03-datos-masivos.sql
select (select count(*) from profiles) users,(select count(*) from pets) pets,(select count(*) from appointment_requests) appts,(select count(*) from pet_medical_records) records,(select count(*) from pet_vaccines) vacc,(select count(*) from payments) pays,(select count(*) from audit_log) logs;
select status,count(*) from appointment_requests group by 1 order by 1;
select status,count(*) from payments group by 1;
