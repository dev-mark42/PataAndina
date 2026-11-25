/* Página de acceso: login, registro, recuperación y cambio final de contraseña. */
(function () {
  'use strict';
  const { $, $$, v, sb, toast, errMsg, btnBusy, setField, liveValidate } = Pata;
  $('#heroCat').innerHTML = ART.cat(); $('#heroDog').innerHTML = ART.dog();
  $('#walkDog').innerHTML = ART.dog(); $('#walkCat').innerHTML = ART.cat();
  $('#miniPets').innerHTML = ART.cat() + ART.dog(); $('#ecg').innerHTML = ART.ecg(); Pata.paws($('#paws'));
  Pata.initTheme($('#themeBtn')); Pata.initPWA($('#installBtn'));
  Pata.onNet = on => { $('#offWarn').hidden = on; }; Pata.initNet(null);
  if (!Pata.configured) $('#cfgWarn').hidden = false;

  /* ---- Pestañas ---- */
  function show(name) {
    $$('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== name; if (!p.hidden) { p.classList.remove('pane'); void p.offsetWidth; p.classList.add('pane'); } });
    $$('#authTabs .tab').forEach(t => { const on = t.dataset.tab === name; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
    $('#authTabs').hidden = name === 'newpass';
  }
  $('#authTabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) show(t.dataset.tab); });
  document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) show(g.dataset.go); const b = e.target.closest('.eye-btn'); if (b) { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? '👁️' : '🙈'; } });
  const msg = (el, text, kind) => { el.hidden = !text; el.textContent = text || ''; el.className = 'notice' + (kind ? ' ' + kind : ''); };
  const meter = (inp, bar, txt) => inp.addEventListener('input', () => { const s = v.strength(inp.value); bar.style.width = s * 25 + '%'; bar.style.background = ['#b4483a', '#b4483a', '#b7791f', '#2f7d57', '#2f7d57'][s]; if (txt) txt.textContent = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Excelente'][s]; });
  meter($('#rPass'), $('#meter'), $('#meterTxt')); meter($('#nPass'), $('#nMeter'));
  $('#rPhone').addEventListener('input', e => e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8));

  /* ---- Ingresar (con bloqueo temporal tras 5 intentos fallidos) ---- */
  let fails = 0, lockUntil = 0;
  const vLogin = liveValidate($('#loginForm'), { lEmail: x => v.email(x.trim()) ? '' : 'Escribe un correo válido.', lPass: x => x ? '' : 'Escribe tu contraseña.' });
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault(); msg($('#loginMsg'), '');
    if (!vLogin()) return;
    if (!Pata.configured) return msg($('#loginMsg'), 'La app no está configurada con Supabase (js/config.js).', 'bad');
    if (Date.now() < lockUntil) return msg($('#loginMsg'), `Demasiados intentos. Espera ${Math.ceil((lockUntil - Date.now()) / 1000)} s.`, 'bad');
    const b = $('#loginBtn'); btnBusy(b, true);
    const { error } = await sb.auth.signInWithPassword({ email: $('#lEmail').value.trim(), password: $('#lPass').value });
    btnBusy(b, false);
    if (error) { if (++fails >= 5) { lockUntil = Date.now() + 30000; fails = 0; } return msg($('#loginMsg'), errMsg(error), 'bad'); }
    Pata.confetti(16); setTimeout(() => location.replace('./app.html'), 450);
  });

  /* ---- Registro ---- */
  const vReg = liveValidate($('#regForm'), {
    rName: x => v.name(x) ? '' : 'Escribe tu nombre (solo letras, mínimo 2).',
    rPhone: x => v.phone(x) ? '' : 'Celular boliviano: 8 dígitos que empiezan con 6 o 7.',
    rEmail: x => v.email(x.trim()) ? '' : 'Escribe un correo válido.',
    rPass: x => v.pass(x) ? '' : 'Mínimo 8 caracteres, con letras y números.',
    rPass2: (x, el) => x === $('#rPass').value && x ? '' : 'Las contraseñas no coinciden.'
  });
  $('#regForm').addEventListener('submit', async e => {
    e.preventDefault(); msg($('#regMsg'), ''); $('#termsErr').textContent = '';
    let ok = vReg(); if (!$('#rTerms').checked) { $('#termsErr').textContent = 'Debes aceptar para continuar.'; ok = false; }
    if (!ok) return;
    if (!Pata.configured) return msg($('#regMsg'), 'La app no está configurada con Supabase (js/config.js).', 'bad');
    const b = $('#regBtn'); btnBusy(b, true);
    const { data, error } = await sb.auth.signUp({ email: $('#rEmail').value.trim(), password: $('#rPass').value, options: { data: { full_name: $('#rName').value.trim().replace(/\s+/g, ' '), phone: $('#rPhone').value }, emailRedirectTo: new URL('index.html', location.href).href } });
    btnBusy(b, false);
    if (error) return msg($('#regMsg'), errMsg(error), 'bad');
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return msg($('#regMsg'), 'Ese correo ya tiene una cuenta. Ingresa o recupera tu contraseña.', 'bad');
    Pata.confetti();
    if (data.session) { toast('¡Cuenta creada! Bienvenido/a.'); setTimeout(() => location.replace('./app.html'), 700); }
    else { msg($('#regMsg'), '¡Cuenta creada! Te enviamos un correo para confirmarla. Ábrelo y luego ingresa.', 'ok'); $('#regForm').reset(); $$('#regForm .field').forEach(f => f.classList.remove('valid')); }
  });

  /* ---- Recuperar contraseña (envía el correo) ---- */
  const vRec = liveValidate($('#recForm'), { cEmail: x => v.email(x.trim()) ? '' : 'Escribe un correo válido.' });
  let recLock = 0;
  $('#recForm').addEventListener('submit', async e => {
    e.preventDefault(); msg($('#recMsg'), ''); if (!vRec()) return;
    if (!Pata.configured) return msg($('#recMsg'), 'La app no está configurada con Supabase (js/config.js).', 'bad');
    if (Date.now() < recLock) return msg($('#recMsg'), `Espera ${Math.ceil((recLock - Date.now()) / 1000)} s para pedir otro enlace.`, 'bad');
    const b = $('#recBtn'); btnBusy(b, true);
    const { error } = await sb.auth.resetPasswordForEmail($('#cEmail').value.trim(), { redirectTo: new URL('index.html', location.href).href });
    btnBusy(b, false);
    if (error) return msg($('#recMsg'), errMsg(error), 'bad');
    recLock = Date.now() + 60000;
    msg($('#recMsg'), 'Si el correo está registrado, recibirás un enlace en unos minutos. Revisa también spam.', 'ok');
  });

  /* ---- Cambio final de contraseña (flujo que faltaba) ---- */
  const vNew = liveValidate($('#newPassForm'), { nPass: x => v.pass(x) ? '' : 'Mínimo 8 caracteres, con letras y números.', nPass2: x => x === $('#nPass').value && x ? '' : 'Las contraseñas no coinciden.' });
  $('#newPassForm').addEventListener('submit', async e => {
    e.preventDefault(); msg($('#newMsg'), ''); if (!vNew()) return;
    const b = $('#newBtn'); btnBusy(b, true);
    const { error } = await sb.auth.updateUser({ password: $('#nPass').value });
    btnBusy(b, false);
    if (error) return msg($('#newMsg'), errMsg(error), 'bad');
    Pata.confetti(); msg($('#newMsg'), '¡Contraseña actualizada! Entrando…', 'ok'); setTimeout(() => location.replace('./app.html'), 1200);
  });

  /* ---- Estado inicial: ¿viene del correo de recuperación? ¿ya hay sesión? ---- */
  const hash = location.hash + location.search;
  let recovery = /type=recovery/.test(hash);
  if (recovery) show('newpass');
  if (Pata.configured) {
    sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') { recovery = true; show('newpass'); } });
    sb.auth.getSession().then(({ data }) => { if (data.session && !recovery) location.replace('./app.html'); });
    if (/error_description=/.test(hash)) { const m = decodeURIComponent((hash.match(/error_description=([^&]+)/) || [])[1] || '').replace(/\+/g, ' '); show('login'); msg($('#loginMsg'), /expired|invalid/i.test(m) ? 'El enlace venció o ya fue usado. Pide uno nuevo en "Olvidé mi clave".' : m, 'bad'); }
  }
})();
