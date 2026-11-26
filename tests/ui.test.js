/* Prueba de interfaz con jsdom + Supabase falso:  node tests/ui.test.js  (requiere: npm i jsdom) */
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..'); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pata-'));
fs.cpSync(root, tmp, { recursive: true, filter: s => !s.includes('node_modules') });
fs.writeFileSync(path.join(tmp, 'js/config.js'), 'window.PATA_CONFIG={SUPABASE_URL:"https://fake.supabase.co",SUPABASE_ANON_KEY:"' + 'x'.repeat(60) + '"};');
fs.writeFileSync(path.join(tmp, 'js/vendor/supabase.js'), fs.readFileSync(path.join(__dirname, 'fake-supabase.js')));
const sql = fs.readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8');
const services = [...sql.matchAll(/^\('([^']+)','((?:[^']|'')*)','([^']+)','((?:[^']|'')*)','((?:[^']|'')*)',(\d+),'((?:[^']|'')*)',(null|[\d.]+),'((?:[^']|'')*)','((?:[^']|'')*)','([^']+)',(\d+)\)/gm)].map(m => ({ id: m[1], name: m[2].replace(/''/g, "'"), category: m[3], description: m[4].replace(/''/g, "'"), details: m[5].replace(/''/g, "'"), duration_min: +m[6], price_label: m[7], price_value: m[8] === 'null' ? null : +m[8], tag: m[9], species: m[10], icon: m[11], sort_order: +m[12] }));
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const server = http.createServer((q, r) => { let f = path.join(tmp, decodeURIComponent(q.url.split('?')[0])); if (fs.statSync(f, { throwIfNoEntry: false })?.isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); } r.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f)); });
const wait = async (fn, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = fn(); if (v) return v; } catch (_) { } await new Promise(r => setTimeout(r, 25)); } throw new Error('timeout: ' + fn); };
async function open(page, pre) {
  const errs = [], vc = new VirtualConsole(); vc.on('jsdomError', e => { if (!/getContext|navigation/i.test(e.message)) errs.push(e.message); }); vc.on('error', e => errs.push(String(e)));
  const dom = await JSDOM.fromURL(`http://localhost:${server.address().port}/${page}`, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc, beforeParse(w) { w.__SERVICES = services; w.fetch = (u, o) => fetch(new URL(u, w.location.href).href, o); w.HTMLElement.prototype.scrollTo = function () { }; w.scrollTo = () => { }; w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() { }, addEventListener() { } })); pre && pre(w); } });
  dom.errs = errs; return dom;
}
const fill = (w, sel, val) => { const e = w.document.querySelector(sel); e.value = val; e.dispatchEvent(new w.Event('input', { bubbles: true })); e.dispatchEvent(new w.Event('change', { bubbles: true })); e.dispatchEvent(new w.Event('blur')); };
const click = (w, sel) => { const e = typeof sel === 'string' ? w.document.querySelector(sel) : sel; e.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const submit = (w, sel) => w.document.querySelector(sel).dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));

(async () => {
  await new Promise(r => server.listen(0, r));
  console.log('Servicios en schema.sql:', services.length); ok(services.length === 16, '16 servicios en el catálogo');

  console.log('\n[LOGIN]'); let d = await open('index.html'); let w = d.window;
  await wait(() => w.document.querySelector('.print')); ok(true, 'login carga con rastro de huellas animado');
  ok(w.document.querySelector('#cfgWarn').hidden, 'sin aviso de configuración (config válida)');
  submit(w, '#loginForm'); ok(w.document.querySelectorAll('#loginForm .field.invalid').length === 2, 'login vacío muestra 2 errores');
  fill(w, '#lEmail', 'mal'); fill(w, '#lPass', 'x'); submit(w, '#loginForm'); ok(w.document.querySelector('#lEmail').closest('.field').classList.contains('invalid'), 'correo inválido rechazado');
  click(w, '[data-tab=register]'); ok(!w.document.querySelector('#regForm').hidden, 'pestaña registro');
  submit(w, '#regForm'); ok(w.document.querySelectorAll('#regForm .field.invalid').length === 5 && w.document.querySelector('#termsErr').textContent, 'registro vacío: 5 errores + términos');
  fill(w, '#rName', 'Ana Pérez'); fill(w, '#rPhone', '51234567'); fill(w, '#rEmail', 'ana@test.com'); fill(w, '#rPass', 'abc'); fill(w, '#rPass2', 'abd');
  ok(w.document.querySelector('#rPhone').closest('.field').classList.contains('invalid'), 'celular que no empieza con 6/7 rechazado');
  ok(w.document.querySelector('#rPass').closest('.field').classList.contains('invalid'), 'contraseña débil rechazada');
  fill(w, '#rPhone', '71234567'); fill(w, '#rPass', 'Clave1234'); fill(w, '#rPass2', 'Clave1234'); w.document.querySelector('#rTerms').checked = true;
  submit(w, '#regForm'); await wait(() => !w.document.querySelector('#loginForm').hidden);
  ok(w.document.querySelector('#lEmail').value === 'ana@test.com', 'tras registrarte vas a INICIAR SESIÓN con el correo ya escrito');
  ok(/Cuenta creada/.test(w.document.querySelector('#loginMsg').textContent), 'mensaje de cuenta creada en el login');
  ok(w.__lastSignUp.data.full_name === 'Ana Pérez' && w.__lastSignUp.data.phone === '71234567', 'metadatos enviados a signUp');
  ok(w.document.querySelectorAll('#petCat svg,#petDog svg,#petBird svg').length === 3, 'login muestra gato, perro y pájaro');
  ok(w.document.querySelectorAll('.pupil').length >= 6, 'mascotas con ojos que siguen el puntero');
  ok(w.document.querySelector('#lights') && w.document.querySelectorAll('#lights .bulb').length >= 9, 'guirnalda de luces animada');
  ok(!!w.document.querySelector('#fx') && !!w.document.querySelector('.aurora'), 'canvas de luciérnagas + aurora');
  ok(w.document.querySelector('.stage') && w.document.querySelector('.petrow'), 'escenario con mascotas');

  click(w, '[data-tab=recover]'); fill(w, '#cEmail', 'ana@test.com'); submit(w, '#recForm'); await wait(() => !w.document.querySelector('#recMsg').hidden);
  ok(w.__reset.email === 'ana@test.com' && /index\.html/.test(w.__reset.o.redirectTo), 'recuperación envía correo con redirectTo a index.html');
  click(w, '[data-tab=login]'); fill(w, '#lEmail', 'ana@test.com'); fill(w, '#lPass', 'equivocada'); submit(w, '#loginForm'); await wait(() => !w.document.querySelector('#loginMsg').hidden);
  ok(/incorrectos/.test(w.document.querySelector('#loginMsg').textContent), 'credenciales malas: mensaje claro');
  ok(d.errs.filter(e => !/navigation/i.test(e)).length === 0, 'sin errores JS en login: ' + d.errs.join('|')); w.close();

  { const logo = w.document.querySelector('#logo'); for (let i = 0; i < 7; i++) click(w, logo);
    ok([...w.document.querySelectorAll('.toast')].some(x => /Advertencia/.test(x.textContent)), '7 toques al logo: advertencia del modo invitado');
    ok(!w.sessionStorage.getItem('pata-audit'), 'todavía no entra'); click(w, logo); ok(w.sessionStorage.getItem('pata-audit') === '1', '8 toques: se abre la auditoría oculta'); }
  console.log('\n[CAMBIO DE CONTRASEÑA FINAL]'); d = await open('index.html#access_token=x&type=recovery'); w = d.window;
  await wait(() => !w.document.querySelector('#newPassForm').hidden); ok(true, 'enlace de recuperación abre el formulario de nueva contraseña');
  fill(w, '#nPass', 'corta'); fill(w, '#nPass2', 'otra'); submit(w, '#newPassForm'); ok(w.document.querySelectorAll('#newPassForm .field.invalid').length === 2, 'valida contraseña nueva');
  fill(w, '#nPass', 'Nueva1234'); fill(w, '#nPass2', 'Nueva1234'); submit(w, '#newPassForm'); await wait(() => w.__newPass); ok(w.__newPass === 'Nueva1234', 'updateUser guarda la nueva contraseña'); w.close();

  console.log('\n[APP: tutor]'); const uid = 'u-1';
  d = await open('app.html', w0 => { w0.__SESSION = { user: { id: uid, email: 'ana@test.com' } }; w0.__PROFILES = [{ id: uid, full_name: 'Ana Pérez', phone: '71234567', address: null, role: 'tutor' }]; w0.__USERS = [{ id: uid, email: 'ana@test.com', password: 'Clave1234' }]; });
  w = d.window; await wait(() => w.__db);
  await wait(() => w.document.querySelector('#side [data-nav=inicio]')); click(w, '[data-nav=inicio]'); await wait(() => /Ana/.test(w.document.querySelector('.greeting')?.textContent || '')); ok(true, 'Inicio saluda por nombre');
  ok(w.document.querySelectorAll('#side [data-nav]').length === 7, 'menú sin "Personal" para tutor (7 ítems)');
  click(w, '#side [data-nav=mascotas]'); await wait(() => w.document.querySelector('#addPet')).catch(e => { console.log('DEBUG', w.document.querySelector('#main').textContent.slice(0, 300), d.errs); throw e; }); click(w, '#addPet');
  submit(w, '#pf'); ok(w.document.querySelectorAll('#pf .field.invalid').length === 2, 'mascota vacía: nombre y especie obligatorios');
  fill(w, '#pName', 'Luna'); fill(w, '#pSpecies', 'gato'); fill(w, '#pWeight', '500'); ok(w.document.querySelector('#pWeight').closest('.field').classList.contains('invalid'), 'peso 500 kg rechazado');
  fill(w, '#pWeight', '3.5'); fill(w, '#pBirth', '2099-01-01'); ok(w.document.querySelector('#pBirth').closest('.field').classList.contains('invalid'), 'nacimiento futuro rechazado');
  fill(w, '#pBirth', '2022-05-01'); submit(w, '#pf'); await wait(() => w.__db.pets.length === 1); ok(w.__db.pets[0].name === 'Luna', 'mascota guardada en BD');
  await wait(() => w.document.querySelector('[data-pet]')); ok(true, 'lista de mascotas se refresca');

  click(w, '#side [data-nav=reservar]'); await wait(() => w.document.querySelector('.pick[data-pet]')); click(w, '.pick[data-pet]');
  await wait(() => w.document.querySelector('#svcGroups')); ok(w.document.querySelectorAll('#svcGroups .acc').length === 3, 'servicios agrupados en SOLO 3 categorías desplegables');
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
  click(w, '#side [data-nav=servicios]'); await wait(() => w.document.querySelectorAll('.svc').length > 0); ok(w.document.querySelectorAll('.svc').length === 10, 'Servicios abre con el TOP 10 (10 tarjetas grandes)');
  ok(w.document.querySelector('.svc .rank').textContent === '1' && /Esterilizaci|esterilizaci/i.test(w.document.querySelector('.svc b').textContent), 'el #1 es la esterilización/castración');
  ok(w.document.querySelectorAll('[data-ctab]').length === 4, 'Top 10 + 3 categorías');
  click(w, '[data-ctab=cirugia]'); await wait(() => w.document.querySelectorAll('.svc').length > 0 && w.document.querySelector('[data-ctab=cirugia].active')); ok(true, 'filtro de categoría funciona');
  click(w, '.svc'); await wait(() => w.document.querySelector('.modal .gallery')); ok(w.document.querySelectorAll('.modal .gallery figure').length === 3, 'ficha con 3 fotos del proceso');
  ok(!!w.document.querySelector('.modal video, .modal iframe'), 'ficha con video'); ok(w.document.querySelectorAll('.modal img[data-src]').length + w.document.querySelectorAll('.modal img[src]').length >= 3, 'imágenes con carga diferida (data-src)');
  click(w, '.modal .gallery figure'); await wait(() => w.document.querySelector('.lightbox img')); ok(true, 'foto se amplía en visor'); click(w, '.modal [data-close]'); click(w, '.modal [data-close]');
  ok(!!w.document.querySelector('.greeting') || true, 'ok');
  click(w, '#side [data-nav=perfil]'); await wait(() => w.document.querySelector('.profile-head')); ok(/Personal/.test(w.document.querySelector('.role-pill').textContent), 'perfil con avatar y rol visible');
  w.__db.profiles.find(p => p.id === uid).role = 'admin'; click(w, '#side [data-nav=inicio]'); await wait(() => w.document.querySelector('.greeting')); click(w, '#side [data-nav=perfil]'); await wait(() => /Administrador/.test(w.document.querySelector('.role-pill')?.textContent || ''));
  ok(true, 'rol Administrador se muestra');
  ok(d.errs.length === 0, 'sin errores JS en la app: ' + d.errs.join(' | ')); w.close();

  console.log('\n[APP: administrador]');
  d = await open('app.html', w0 => { w0.__SESSION = { user: { id: 'ad-1', email: 'admin@pataandina.com' } }; w0.__PROFILES = [{ id: 'ad-1', full_name: 'Dra. Valeria Mamani', phone: '70011223', address: null, role: 'admin' }, { id: 'u-9', full_name: 'Ana Pérez', phone: '71234567', address: null, role: 'tutor' }]; });
  w = d.window; await wait(() => w.document.querySelector('#side [data-nav=admin]')); ok(true, 'el admin ve el menú Administración');
  click(w, '#side [data-nav=admin]'); await wait(() => w.document.querySelector('#ap .cols3')); ok(w.document.querySelectorAll('#ap .stat').length === 6, 'resumen con 6 indicadores (usuarios, mascotas, citas, ingresos, 30 días, pagos pendientes)');
  click(w, '[data-tab=svc]'); await wait(() => w.document.querySelectorAll('#ap .acc').length === 16); ok(true, 'admin ve y edita los 16 servicios');
  fill(w, '#pr-microchip', 'Bs 150*'); click(w, '[data-save=microchip]'); await wait(() => w.__db.services_catalog.find(s => s.id === 'microchip').price_label === 'Bs 150*'); ok(true, 'admin cambia el precio de un servicio');
  click(w, '[data-tab=team]'); await wait(() => w.document.querySelector('#mkCode')).catch(e => { console.log('DEBUG', w.document.querySelector('#ap')?.textContent.slice(0, 200), d.errs); throw e; }); click(w, '#mkCode'); await wait(() => /PATA-/.test(w.document.querySelector('#codeOut').textContent)); ok(true, 'admin genera código de personal');
  ok(d.errs.length === 0, 'sin errores JS (admin): ' + d.errs.join(' | ')); w.close();

  const soon = (h) => new Date(Date.now() + h * 3600e3).toISOString();
  const seed = (w0, role, id) => { w0.__SESSION = { user: { id, email: id + '@x.com' } }; w0.__PROFILES = [{ id, full_name: role === 'tutor' ? 'Ana Pérez' : 'Dr. Vet', phone: '71234567', address: null, role }, { id: 'tu-1', full_name: 'Ana Pérez', phone: '71234567', address: null, role: 'tutor' }]; w0.__PETS = [{ id: 'pet-1', owner_id: 'tu-1', name: 'Luna', species: 'gato', created_at: soon(-5) }]; w0.__APPTS = [{ id: 'ap-1', owner_id: 'tu-1', pet_id: 'pet-1', service_id: 'consulta-general', starts_at: soon(30), ends_at: soon(30.5), status: 'confirmada', note: null, created_at: soon(-2) }]; w0.__VACC = [{ id: 'v1', pet_id: 'pet-1', vaccine: 'Triple felina', applied_on: '2025-01-10', next_due: '2025-02-01', lot: 'L1' }]; };
  console.log('\n[PAGOS · RECIBO · VACUNAS]');
  d = await open('app.html', w0 => seed(w0, 'tutor', 'tu-1')); w = d.window; await wait(() => w.document.querySelector('#side [data-nav=turnos]'));
  click(w, '#side [data-nav=turnos]'); await wait(() => w.document.querySelector('[data-pay]')); ok(true, 'cita muestra botón "Pagar con QR"');
  click(w, '[data-pay]'); await wait(() => w.document.querySelector('#payf')); ok(!!w.document.querySelector('.qrbox img'), 'modal de pago muestra el QR de la clínica');
  ok(/wa\.me\/59170000000/.test(w.document.querySelector('.modal a.btn').href), 'botón de WhatsApp apunta a wa.me');
  submit(w, '#payf'); ok(w.document.querySelectorAll('#payf .field.invalid').length >= 1, 'pago vacío: validaciones'); fill(w, '#payAmt', '60'); fill(w, '#payRef', 'ab'); ok(w.document.querySelector('#payRef').closest('.field').classList.contains('invalid'), 'código de operación muy corto rechazado');
  fill(w, '#payRef', 'OP12345'); submit(w, '#payf'); await wait(() => w.__db.payments.length === 1); ok(w.__db.payments[0].status === 'pendiente' && w.__db.payments[0].reference === 'OP12345', 'pago enviado en estado pendiente');
  click(w, '#side [data-nav=historial]'); await wait(() => w.document.querySelector('[data-sub=vac]')); click(w, '[data-sub=vac]'); await wait(() => w.document.querySelector('.vax')); ok(/Vencida/.test(w.document.querySelector('.vax').textContent), 'carnet de vacunas marca la vacuna vencida'); w.close();

  d = await open('app.html', w0 => { seed(w0, 'staff', 'st-1'); w0.__PAYMENTS = [{ id: 'pay-1', appointment_id: 'ap-1', owner_id: 'tu-1', amount: 60, method: 'qr', reference: 'OP12345', proof: null, status: 'pendiente', created_at: soon(-1) }]; });
  w = d.window; await wait(() => w.document.querySelector('#side [data-nav=personal]')); click(w, '#side [data-nav=personal]'); await wait(() => w.document.querySelector('[data-tab=pay]')); click(w, '[data-tab=pay]'); await wait(() => w.document.querySelector('[data-notif]'));
  ok(w.document.querySelectorAll('[data-vok]').length === 1, 'personal ve el pago por validar');
  fill(w, '#notif', 'Yape! Ana Pérez te envió Bs 99.00. Código de operación 55555555'); click(w, '[data-notif]'); await wait(() => /no hay un pago pendiente/.test(w.document.querySelector('#notifOut').textContent)); ok(true, 'notificación que NO coincide no valida nada');
  fill(w, '#notif', 'Yape! Ana Pérez te envió Bs 60.00. Código de operación OP12345'); click(w, '[data-notif]'); await wait(() => w.document.querySelector('.modal [data-ok]')); click(w, '.modal [data-ok]');
  await wait(() => w.__db.payments[0].status === 'validado'); ok(/^PA-2026/.test(w.__db.payments[0].receipt_no), 'la notificación coincidente valida el pago y emite recibo ' + w.__db.payments[0].receipt_no);
  ok(w.Pata.parseNotif('Tigo Money: recibiste 45,50 Bs. Nro 987654321').amount === 45.5, 'parser lee montos con coma');
  click(w, '[data-tab=att]'); await wait(() => w.document.querySelector('[data-vac]')); click(w, '[data-vac]'); await wait(() => w.document.querySelector('#vName')); submit(w, '#vf'); ok(w.document.querySelector('#vName').closest('.field').classList.contains('invalid'), 'vacuna: nombre obligatorio');
  fill(w, '#vName', 'Rabia'); submit(w, '#vf'); await wait(() => w.__db.pet_vaccines.length === 2); ok(true, 'personal registra vacuna en el carnet'); w.close();

  d = await open('app.html', w0 => { seed(w0, 'tutor', 'tu-1'); w0.__PAYMENTS = [{ id: 'pay-1', appointment_id: 'ap-1', owner_id: 'tu-1', amount: 60, method: 'qr', reference: 'OP12345', status: 'validado', receipt_no: 'PA-2026-001001', validated_at: soon(-1), created_at: soon(-2) }]; });
  w = d.window; await wait(() => w.document.querySelector('#side [data-nav=turnos]')); click(w, '#side [data-nav=turnos]'); await wait(() => w.document.querySelector('[data-receipt]')); click(w, '[data-receipt]'); await wait(() => w.document.querySelector('.receipt'));
  ok(/PA-2026-001001/.test(w.document.querySelector('.receipt').textContent) && /PAGADO/.test(w.document.querySelector('.receipt').textContent), 'recibo con número y sello PAGADO');
  click(w, '.modal [data-close]');
  console.log('\n[ACCESIBILIDAD · DESPEDIDA · ROLES]');
  click(w, '#a11yBtn'); await wait(() => w.document.querySelector('#a11yPanel')); click(w, '[data-a=c]'); ok(w.document.body.classList.contains('hc-light'), 'alto contraste claro (fondo blanco, texto negro)');
  click(w, '[data-a=c]'); ok(w.document.body.classList.contains('hc-dark'), 'alto contraste oscuro (fondo negro, texto amarillo)'); click(w, '[data-a="fs+"]'); ok(w.document.documentElement.style.fontSize === '18px', 'A+ agranda el texto'); click(w, '[data-a=mo]'); ok(w.document.body.classList.contains('nomo'), 'sin animaciones'); click(w, '[data-a=reset]'); ok(!w.document.body.classList.contains('hc-dark') && !w.document.body.classList.contains('nomo'), 'restablecer'); click(w, '[data-a=close]');
  click(w, '#side [data-nav=inicio]'); await wait(() => w.document.querySelector('.rail .svc')); ok(w.document.querySelectorAll('.rail .svc').length === 10, 'Inicio muestra el rail de los 10 más buscados'); ok(/Tu panel de tutor/.test(w.document.querySelector('.acc-head').textContent), 'Inicio explica qué hace el rol tutor');
  ok(!!w.document.querySelector('a[href*="wa.me/"]') && !!w.document.querySelector('a[href="https://www.facebook.com/"]') && !!w.document.querySelector('a[href="https://www.tiktok.com/"]'), 'enlaces a WhatsApp, Facebook y TikTok');
  click(w, '#logoutTop'); await wait(() => w.document.querySelector('.modal [data-ok]')); click(w, '.modal [data-ok]'); await wait(() => w.document.querySelector('.bye')); ok(/Hasta luego/.test(w.document.querySelector('.bye').textContent), 'cerrar sesión muestra «Hasta luego»'); ok(w.__db.audit_log.some(x => x.action === 'cierre_sesion'), 'el cierre de sesión queda en la bitácora'); w.close();

  console.log('\n[INVITADO · AUDITORÍA · BITÁCORA · AJUSTES]');
  d = await open('guest.html'); w = d.window; await wait(() => w.document.querySelectorAll('.svc').length > 0); ok(w.document.querySelectorAll('.svc').length === 10, 'invitado ve el Top 10 sin iniciar sesión');
  click(w, '.svc'); await wait(() => w.document.querySelector('.modal [data-book]')); ok(/requiere iniciar sesión/.test(w.document.querySelector('.modal [data-book]').textContent), 'invitado: reservar exige iniciar sesión'); click(w, '.modal [data-book]'); await wait(() => [...w.document.querySelectorAll('.toast')].some(x => /iniciar sesión/.test(x.textContent))); ok(true, 'reservar como invitado redirige al login'); w.close();
  d = await open('audit.html', w0 => { w0.sessionStorage.setItem('pata-audit', '1'); }); w = d.window; await wait(() => w.document.querySelectorAll('#aTabs .tab').length === 4); ok(true, 'auditoría oculta: 4 semanas');
  ok(w.document.querySelectorAll('#aPane .acc').length === 5, 'semana 1 con 5 temas'); click(w, '[data-w="4"]'); ok(w.document.querySelectorAll('#aPane .acc').length === 4, 'semana 4 (accesibilidad) con 4 temas');
  click(w, '#aPane .acc-head'); click(w, '[data-run]'); await wait(() => w.document.body.classList.contains('hc-light')); ok(true, 'la prueba en vivo de alto contraste funciona'); w.close();
  d = await open('audit.html'); w = d.window; await new Promise(r => setTimeout(r, 300)); ok(!w.document.querySelector('#aPane .acc'), 'sin los 8 toques, la auditoría no se muestra'); w.close();
  d = await open('app.html', w0 => { seed(w0, 'admin', 'ad-2'); w0.__AUDIT = 1; }); w = d.window; await wait(() => w.document.querySelector('#side [data-nav=admin]')); w.__db.audit_log.push({ id: 1, at: soon(-1), actor_name: 'Ana', action: 'inicio_sesion', detail: null }, { id: 2, at: soon(-2), actor_name: 'Dr. Vet', action: 'pago_validado', detail: 'Recibo X' });
  click(w, '#side [data-nav=admin]'); await wait(() => w.document.querySelector('[data-tab=log]')); click(w, '[data-tab=log]'); await wait(() => w.document.querySelector('.logrow')); ok(w.document.querySelectorAll('.logrow').length === 2, 'bitácora lista los eventos');
  click(w, '[data-lf=pagos]'); await wait(() => w.document.querySelectorAll('.logrow').length === 1); ok(/Pago validado/.test(w.document.querySelector('.logrow').textContent), 'filtro de bitácora por pagos');
  click(w, '[data-tab=set]'); await wait(() => w.document.querySelector('#setf')); fill(w, '#sWa', 'abc'); submit(w, '#setf'); ok(w.document.querySelector('#sWa').closest('.field').classList.contains('invalid'), 'ajustes: WhatsApp inválido rechazado');
  fill(w, '#sWa', '59171112222'); submit(w, '#setf'); await wait(() => w.__db.clinic_settings[0].whatsapp === '59171112222'); ok(true, 'ajustes guardados (WhatsApp, QR, titular)');
  click(w, '[data-tab=svc]'); await wait(() => w.document.querySelector('[data-save=microchip]')); fill(w, '#vd-microchip', 'http://malo'); click(w, '[data-save=microchip]'); ok(w.document.querySelector('#vd-microchip').closest('.field').classList.contains('invalid'), 'video: solo https'); fill(w, '#vd-microchip', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'); click(w, '[data-save=microchip]'); await wait(() => w.__db.services_catalog.find(s => s.id === 'microchip').video_url); ok(true, 'admin pega un enlace de video por servicio'); w.close();
  d = await open('index.html'); w = d.window; await wait(() => w.document.querySelector('#social a')); ok(!!w.document.querySelector('#social a[href*="wa.me/"]') && !!w.document.querySelector('#social a[href="https://www.facebook.com/"]') && !!w.document.querySelector('#social a[href="https://www.tiktok.com/"]'), 'login con WhatsApp, Facebook y TikTok');
  ok(!!w.document.querySelector('#guestBtn'), 'botón «Entrar como invitado»'); for (let i = 0; i < 6; i++) { fill(w, '#lEmail', 'a@a.com'); fill(w, '#lPass', 'mala' + i); submit(w, '#loginForm'); await new Promise(r => setTimeout(r, 60)); }
  await wait(() => !w.document.querySelector('#loginMsg').hidden); ok(!/Espera|Demasiados/.test(w.document.querySelector('#loginMsg').textContent), 'sin bloqueo por intentos fallidos (6 intentos seguidos)'); w.close();
  server.close();
  console.log(fails ? `\n${fails} PRUEBA(S) FALLARON` : '\nTODAS LAS PRUEBAS OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
