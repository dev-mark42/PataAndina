/* Prueba de interfaz con jsdom + Supabase falso:  node tests/ui.test.js  (requiere: npm i jsdom) */
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..'); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pata-'));
fs.cpSync(root, tmp, { recursive: true, filter: s => !s.includes('node_modules') });
fs.writeFileSync(path.join(tmp, 'js/config.js'), 'window.PATA_CONFIG={SUPABASE_URL:"https://fake.supabase.co",SUPABASE_ANON_KEY:"' + 'x'.repeat(60) + '"};');
fs.writeFileSync(path.join(tmp, 'js/vendor/supabase.js'), fs.readFileSync(path.join(__dirname, 'fake-supabase.js')));
const sql = fs.readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8');
const services = [...sql.matchAll(/^\('([^']+)','((?:[^']|'')*)','([^']+)','((?:[^']|'')*)','((?:[^']|'')*)',(\d+),'((?:[^']|'')*)',(null|[\d.]+),'((?:[^']|'')*)','((?:[^']|'')*)','([^']+)',(\d+)\)/gm)].map(m => ({ id: m[1], name: m[2].replace(/''/g, "'"), category: m[3], description: m[4].replace(/''/g, "'"), details: m[5].replace(/''/g, "'"), duration_min: +m[6], price_label: m[7], tag: m[9], species: m[10], icon: m[11], sort_order: +m[12] }));
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const server = http.createServer((q, r) => { let f = path.join(tmp, decodeURIComponent(q.url.split('?')[0])); if (fs.statSync(f, { throwIfNoEntry: false })?.isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); } r.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f)); });
const wait = async (fn, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = fn(); if (v) return v; } catch (_) { } await new Promise(r => setTimeout(r, 25)); } throw new Error('timeout: ' + fn); };
async function open(page, pre) {
  const errs = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(e.message)); vc.on('error', e => errs.push(String(e)));
  const dom = await JSDOM.fromURL(`http://localhost:${server.address().port}/${page}`, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc, beforeParse(w) { w.__SERVICES = services; w.HTMLElement.prototype.scrollTo = function () { }; w.scrollTo = () => { }; w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() { }, addEventListener() { } })); pre && pre(w); } });
  dom.errs = errs; return dom;
}
const fill = (w, sel, val) => { const e = w.document.querySelector(sel); e.value = val; e.dispatchEvent(new w.Event('input', { bubbles: true })); e.dispatchEvent(new w.Event('change', { bubbles: true })); e.dispatchEvent(new w.Event('blur')); };
const click = (w, sel) => { const e = typeof sel === 'string' ? w.document.querySelector(sel) : sel; e.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const submit = (w, sel) => w.document.querySelector(sel).dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));

(async () => {
  await new Promise(r => server.listen(0, r));
  console.log('Servicios en schema.sql:', services.length); ok(services.length === 16, '16 servicios en el catálogo');

  console.log('\n[LOGIN]'); let d = await open('index.html'); let w = d.window;
  await wait(() => w.document.querySelector('#heroDog svg')); ok(true, 'login carga con mascotas animadas');
  ok(w.document.querySelector('#cfgWarn').hidden, 'sin aviso de configuración (config válida)');
  submit(w, '#loginForm'); ok(w.document.querySelectorAll('#loginForm .field.invalid').length === 2, 'login vacío muestra 2 errores');
  fill(w, '#lEmail', 'mal'); fill(w, '#lPass', 'x'); submit(w, '#loginForm'); ok(w.document.querySelector('#lEmail').closest('.field').classList.contains('invalid'), 'correo inválido rechazado');
  click(w, '[data-tab=register]'); ok(!w.document.querySelector('#regForm').hidden, 'pestaña registro');
  submit(w, '#regForm'); ok(w.document.querySelectorAll('#regForm .field.invalid').length === 5 && w.document.querySelector('#termsErr').textContent, 'registro vacío: 5 errores + términos');
  fill(w, '#rName', 'Ana Pérez'); fill(w, '#rPhone', '51234567'); fill(w, '#rEmail', 'ana@test.com'); fill(w, '#rPass', 'abc'); fill(w, '#rPass2', 'abd');
  ok(w.document.querySelector('#rPhone').closest('.field').classList.contains('invalid'), 'celular que no empieza con 6/7 rechazado');
  ok(w.document.querySelector('#rPass').closest('.field').classList.contains('invalid'), 'contraseña débil rechazada');
  fill(w, '#rPhone', '71234567'); fill(w, '#rPass', 'Clave1234'); fill(w, '#rPass2', 'Clave1234'); w.document.querySelector('#rTerms').checked = true;
  submit(w, '#regForm'); await wait(() => !w.document.querySelector('#regMsg').hidden);
  ok(/confirmar/.test(w.document.querySelector('#regMsg').textContent), 'registro OK pide confirmar correo');
  ok(w.__lastSignUp.data.full_name === 'Ana Pérez' && w.__lastSignUp.data.phone === '71234567', 'metadatos enviados a signUp');
  click(w, '[data-tab=recover]'); fill(w, '#cEmail', 'ana@test.com'); submit(w, '#recForm'); await wait(() => !w.document.querySelector('#recMsg').hidden);
  ok(w.__reset.email === 'ana@test.com' && /index\.html/.test(w.__reset.o.redirectTo), 'recuperación envía correo con redirectTo a index.html');
  click(w, '[data-tab=login]'); fill(w, '#lEmail', 'ana@test.com'); fill(w, '#lPass', 'equivocada'); submit(w, '#loginForm'); await wait(() => !w.document.querySelector('#loginMsg').hidden);
  ok(/incorrectos/.test(w.document.querySelector('#loginMsg').textContent), 'credenciales malas: mensaje claro');
  ok(d.errs.filter(e => !/navigation/i.test(e)).length === 0, 'sin errores JS en login: ' + d.errs.join('|')); w.close();

  console.log('\n[CAMBIO DE CONTRASEÑA FINAL]'); d = await open('index.html#access_token=x&type=recovery'); w = d.window;
  await wait(() => !w.document.querySelector('#newPassForm').hidden); ok(true, 'enlace de recuperación abre el formulario de nueva contraseña');
  fill(w, '#nPass', 'corta'); fill(w, '#nPass2', 'otra'); submit(w, '#newPassForm'); ok(w.document.querySelectorAll('#newPassForm .field.invalid').length === 2, 'valida contraseña nueva');
  fill(w, '#nPass', 'Nueva1234'); fill(w, '#nPass2', 'Nueva1234'); submit(w, '#newPassForm'); await wait(() => w.__newPass); ok(w.__newPass === 'Nueva1234', 'updateUser guarda la nueva contraseña'); w.close();

  console.log('\n[APP: tutor]'); const uid = 'u-1';
  d = await open('app.html', w0 => { w0.__SESSION = { user: { id: uid, email: 'ana@test.com' } }; w0.__PROFILES = [{ id: uid, full_name: 'Ana Pérez', phone: '71234567', address: null, role: 'tutor' }]; w0.__USERS = [{ id: uid, email: 'ana@test.com', password: 'Clave1234' }]; });
  w = d.window; await wait(() => w.__db);
  await wait(() => w.document.querySelector('#side [data-nav=inicio]')); click(w, '[data-nav=inicio]'); await wait(() => /Ana/.test(w.document.querySelector('.greeting')?.textContent || '')); ok(true, 'Inicio saluda por nombre');
  ok(w.document.querySelectorAll('#side [data-nav]').length === 7, 'menú sin "Personal" para tutor (7 ítems)');
  click(w, '#side [data-nav=mascotas]'); await wait(() => w.document.querySelector('#addPet')); click(w, '#addPet');
  submit(w, '#pf'); ok(w.document.querySelectorAll('#pf .field.invalid').length === 2, 'mascota vacía: nombre y especie obligatorios');
  fill(w, '#pName', 'Luna'); fill(w, '#pSpecies', 'gato'); fill(w, '#pWeight', '500'); ok(w.document.querySelector('#pWeight').closest('.field').classList.contains('invalid'), 'peso 500 kg rechazado');
  fill(w, '#pWeight', '3.5'); fill(w, '#pBirth', '2099-01-01'); ok(w.document.querySelector('#pBirth').closest('.field').classList.contains('invalid'), 'nacimiento futuro rechazado');
  fill(w, '#pBirth', '2022-05-01'); submit(w, '#pf'); await wait(() => w.__db.pets.length === 1); ok(w.__db.pets[0].name === 'Luna', 'mascota guardada en BD');
  await wait(() => w.document.querySelector('[data-pet]')); ok(true, 'lista de mascotas se refresca');

  click(w, '#side [data-nav=reservar]'); await wait(() => w.document.querySelector('.pick[data-pet]')); click(w, '.pick[data-pet]');
  await wait(() => w.document.querySelector('#svcGroups')); ok(w.document.querySelectorAll('#svcGroups .acc').length === 5, 'servicios agrupados en 5 categorías desplegables');
  click(w, '#svcGroups .acc-head'); click(w, '.pick[data-svc=consulta-general]'); ok(!w.document.querySelector('[data-next]').disabled, 'siguiente habilitado al elegir servicio'); click(w, '[data-next]');
  await wait(() => w.document.querySelector('#wDate'));
  let day = w.Pata.addDays(w.Pata.todayLP(), 1); if (w.Pata.dow(day) === 0) day = w.Pata.addDays(day, 1);
  const sun = (() => { let x = w.Pata.todayLP(); while (w.Pata.dow(x) !== 0) x = w.Pata.addDays(x, 1); return x; })();
  fill(w, '#wDate', sun); await wait(() => /domingos/.test(w.document.querySelector('#slots').textContent)); ok(true, 'domingo bloqueado');
  fill(w, '#wDate', day); await wait(() => w.document.querySelectorAll('.slot').length > 0); ok(w.document.querySelectorAll('.slot').length >= 14, 'grilla de horarios generada: ' + w.document.querySelectorAll('.slot').length);
  ok(!w.document.querySelector('.slot[data-time="13:00"]') && !w.document.querySelector('.slot[data-time="12:45"]'), 'no hay horarios en la hora de almuerzo');
  click(w, '.slot[data-time="10:00"]'); click(w, '[data-next]'); await wait(() => w.document.querySelector('#wGo'));
  click(w, '#wGo'); ok(w.__db.appointment_requests.length === 0, 'no reserva sin aceptar la casilla'); w.document.querySelector('#wOk').checked = true; click(w, '#wGo');
  await wait(() => w.__db.appointment_requests.length === 1); ok(w.__db.appointment_requests[0].status === 'pendiente', 'cita creada como pendiente');
  await wait(() => w.document.querySelector('.acc-head .badge')); ok(true, 'redirige a Mis citas');
  // otra cita en el mismo horario (otro tutor) => debe fallar y la grilla debe mostrarlo ocupado
  w.__db.appointment_requests.push({ id: 'x', owner_id: 'otro', pet_id: w.__db.pets[0].id, service_id: 'consulta-general', starts_at: w.Pata.toISO(day, '11:00'), ends_at: w.Pata.toISO(day, '11:30').replace('11:30:00-04:00', '11:30:00-04:00'), status: 'confirmada' });
  w.__db.appointment_requests[1].ends_at = new Date(Date.parse(w.Pata.toISO(day, '11:00')) + 1800000).toISOString();
  click(w, '#side [data-nav=reservar]'); await wait(() => w.document.querySelector('.pick[data-pet]')); click(w, '.pick[data-pet]'); await wait(() => w.document.querySelector('#svcGroups')); click(w, '#svcGroups .acc-head'); click(w, '.pick[data-svc=consulta-general]'); click(w, '[data-next]');
  await wait(() => w.document.querySelector('#wDate')); fill(w, '#wDate', day); await wait(() => w.document.querySelector('.slot'));
  ok(w.document.querySelector('.slot[data-time="11:00"]').disabled && w.document.querySelector('.slot[data-time="10:00"]').disabled, 'horarios ocupados deshabilitados (10:00 propio y 11:00 ajeno)');
  ok(!w.document.querySelector('.slot[data-time="10:30"]').disabled, 'horario libre 10:30 disponible');
  click(w, '#side [data-nav=turnos]'); await wait(() => w.document.querySelector('[data-f]')); click(w, '#main .acc-head'); click(w, '[data-cancel]'); await wait(() => w.document.querySelector('[data-ok]')); click(w, '.modal [data-ok]');
  await wait(() => w.__db.appointment_requests[0].status === 'cancelada'); ok(true, 'cancelar cita funciona');

  console.log('\n[APP: personal]'); click(w, '#side [data-nav=perfil]'); await wait(() => w.document.querySelector('#stf'));
  fill(w, '#sCode', 'MALO-1234'); submit(w, '#stf'); await wait(() => w.document.querySelector('#sCode').closest('.field').classList.contains('invalid')); ok(true, 'código de personal inválido rechazado');
  w.__db.appointment_requests.push({ id: 'p1', owner_id: uid, pet_id: w.__db.pets[0].id, service_id: 'vacuna-felina', starts_at: w.Pata.toISO(day, '15:00'), ends_at: w.Pata.toISO(day, '15:20'), status: 'pendiente' });
  fill(w, '#sCode', 'PATA-STAFF-2026'); submit(w, '#stf'); await wait(() => w.document.querySelector('#side [data-nav=personal]')); ok(true, 'código válido activa el rol y aparece el menú Personal');
  await wait(() => w.document.querySelector('[data-ok]')); click(w, '[data-no]'); await wait(() => w.document.querySelector('#rWhy')); submit(w, '#rf'); ok(w.document.querySelector('#rWhy').closest('.field').classList.contains('invalid'), 'rechazar exige motivo');
  click(w, '.modal [data-close]'); click(w, '[data-ok]'); await wait(() => w.__db.appointment_requests.find(a => a.id === 'p1').status === 'confirmada'); ok(true, 'confirmar cita');
  click(w, '[data-tab=agenda]'); await wait(() => w.document.querySelector('[data-af=todas]')); click(w, '[data-af=todas]'); await wait(() => w.document.querySelector('[data-att]')).catch(e => { console.log('DEBUG:', w.document.querySelector('#sp').textContent.slice(0, 300), JSON.stringify(w.__db.appointment_requests.map(a => [a.id, a.status, a.starts_at]))); throw e; }); click(w, '[data-att="p1"]'); await wait(() => w.document.querySelector('#aDx'));
  submit(w, '#af'); ok(w.document.querySelector('#aDx').closest('.field').classList.contains('invalid'), 'diagnóstico obligatorio');
  fill(w, '#aDx', 'Control general, sin hallazgos'); fill(w, '#aW', '3.6'); submit(w, '#af'); await wait(() => w.__db.pet_medical_records.length === 1); ok(w.__db.appointment_requests.find(a => a.id === 'p1').status === 'completada', 'atención registrada y cita completada');
  click(w, '#side [data-nav=historial]'); await wait(() => /sin hallazgos/.test(w.document.querySelector('#recs')?.textContent || '')); ok(true, 'el tutor ve el historial médico');
  click(w, '#side [data-nav=servicios]'); await wait(() => w.document.querySelectorAll('.grid .acc').length === 16); ok(true, 'Servicios muestra los 16 del catálogo');
  ok(d.errs.length === 0, 'sin errores JS en la app: ' + d.errs.join(' | ')); w.close(); server.close();
  console.log(fails ? `\n${fails} PRUEBA(S) FALLARON` : '\nTODAS LAS PRUEBAS OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
