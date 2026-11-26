\set ON_ERROR_STOP on
\i tests/stub.sql
\i tests/stub2.sql
\i supabase/schema.sql
\i supabase/02-admin-y-datos-demo.sql
\i supabase/02-admin-y-datos-demo.sql
select role, count(*) from profiles group by 1 order by 1;
select count(*) pets from pets; select status, count(*) from appointment_requests group by 1 order by 1; select count(*) records from pet_medical_records;
set role authenticated; set request.jwt.claim.sub=(select id from auth.users where email='admin@pataandina.com' limit 1);
