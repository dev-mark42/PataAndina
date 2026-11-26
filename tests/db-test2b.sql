\set VERBOSITY terse
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email='admin@pataandina.com'), false);
set role authenticated;
select jsonb_pretty(admin_stats()) ;
select email, role, pets from admin_list_users() order by email;
select admin_create_code('MI-CODIGO-1');
select admin_set_service('microchip', false, 'Bs 130*');
select id, active, price_label from services_catalog where id='microchip';
select admin_set_role((select id from profiles where full_name='Carlos Rojas'),'staff');
select admin_set_role(auth.uid(),'tutor');
select select_count from (select count(*) select_count from appointment_requests) x;
select set_config('request.jwt.claim.sub', (select id::text from profiles where full_name='Ana Pérez'), false);
select count(*) as ana_sees_pets from pets; select admin_stats();
select count(*) as ana_sees_services from services_catalog;
