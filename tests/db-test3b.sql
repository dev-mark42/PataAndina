\set VERBOSITY terse
create temp table t as select a.id, a.owner_id from appointment_requests a where status in ('pendiente','confirmada') and not exists(select 1 from payments p where p.appointment_id=a.id) limit 1;
grant select on t to authenticated;
select set_config('request.jwt.claim.sub', (select owner_id::text from t), false) \gset
set role authenticated;
select submit_payment((select id from t), 60, 'qr', 'op-12345', null) is not null as pago_enviado;
select submit_payment((select id from t), 60, 'qr', 'op-99999', null);
select submit_payment((select id from appointment_requests where owner_id<>auth.uid() limit 1), 60, 'qr', 'zz-11111', null);
select count(*) as ve_pagos_ajenos from payments where owner_id <> auth.uid();
reset role;
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email='vet@pataandina.com'), false) \gset
set role authenticated;
select staff_validate_payment((select id from payments where reference='OP-12345'), true) as recibo;
select status, receipt_no from payments where reference='OP-12345';
