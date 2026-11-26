/* Pata Andina Vet · aplicación principal (SPA con Supabase). */
(async function () {
  'use strict';
  const P = Pata, { $, $$, esc, v, toast, errMsg, btnBusy, fmtDate, fmtTime, fmtDay, todayLP, addDays, toISO, liveValidate, setField } = P;
  if (!P.configured) return location.replace('./index.html');
  const sb = P.sb;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return location.replace('./index.html');
  const uid = session.user.id;
  sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && !window.__leaving) location.replace('./index.html'); });
  P.initTheme($('#themeBtn')); P.initPWA($('#installBtn')); P.initNet($('#net'));
  P.onNet = on => { let b = $('#offBar'); if (!on && !b) { b = document.createElement('div'); b.id = 'offBar'; b.className = 'offline-bar'; b.textContent = 'Sin conexión: puedes ver datos guardados, pero no reservar ni editar.'; $('#main').prepend(b); } if (on && b) b.remove(); };

  const CATS = { consulta: 'Consultas', prevencion: 'Prevención', procedimientos: 'Procedimientos', diagnostico: 'Diagnóstico', bienestar: 'Bienestar' };
  const ST = { pendiente: 'Pendiente', confirmada: 'Confirmada', completada: 'Completada', cancelada: 'Cancelada', rechazada: 'Rechazada' };
  const SPECIES = { perro: 'Perro', gato: 'Gato', ave: 'Ave', otro: 'Otro' };
  const S = { profile: null, pets: [], appts: [], services: [], staff: false, admin: false, media: null };
  const badge = s => `<span class="badge b-${s}">${ST[s]}</span>`;
  const icoImg = s => `<img src="./imagenes/${esc(s.icon || 'consulta')}.svg" alt="" loading="lazy">`;
  const petIco = p => `<span class="ico">${ART.forSpecies(p.species)}</span>`;
  const skeleton = (n = 3) => `<div class="view">${'<div class="skeleton" style="margin-bottom:.7rem"></div>'.repeat(n)}</div>`;
  const empty = (t, btn) => `<div class="empty">${ART.empty()}<p>${t}</p>${btn || ''}</div>`;

  /* ---------- Datos (con caché local para modo sin conexión) ---------- */
  async function q(key, run) {
    try { const r = await run(); if (r.error) throw r.error; P.cache.set(uid + key, r.data); return r.data; }
    catch (e) { const c = P.cache.get(uid + key); if (c) return c; throw e; }
  }
  const loadProfile = async () => { S.profile = await q('profile', () => sb.from('profiles').select('*').eq('id', uid).single()); S.staff = ['staff', 'admin'].includes(S.profile.role); S.admin = S.profile.role === 'admin'; };
  const loadPets = async () => { S.pets = await q('pets', () => sb.from('pets').select('*').eq('owner_id', uid).order('created_at')); };
  const loadAppts = async () => { S.appts = await q('appts', () => sb.from('appointment_requests').select('*, pet:pets(name,species), service:services_catalog(name,duration_min,price_label,price_value,icon)').eq('owner_id', uid).order('starts_at', { ascending: false })); };
  const loadServices = async () => { S.services = await q('services', () => sb.from('services_catalog').select('*').order('sort_order')); };
  const active = a => ['pendiente', 'confirmada'].includes(a.status) && new Date(a.ends_at) > new Date();

  /* ---------- Navegación ---------- */
  const IC = {
    inicio: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    reservar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18M12 13v5M9.5 15.5h5"/>',
    turnos: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    mascotas: '<circle cx="6" cy="10.5" r="1.8"/><circle cx="10" cy="6" r="1.8"/><circle cx="15" cy="6" r="1.8"/><circle cx="19" cy="10.5" r="1.8"/><path d="M12.5 11.5c-3.200 0-6.200 3.600-6.200 6.200 0 2 1.600 3.100 3.200 3.100 1.400 0 2-.7 3-.7s1.600.7 3 .7c1.600 0 3.200-1.100 3.200-3.100 0-2.600-3-6.200-6.200-6.200z"/>',
    historial: '<path d="M3 12a9 9 0 1 0 3-6.700L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    servicios: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    personal: '<path d="M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    admin: '<path d="M12 2l3 6 6 .9-4.500 4.300 1 6.300L12 16.500 6.500 19.500l1-6.300L3 8.900 9 8z"/>',
    perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    mas: '<path d="M4 6h16M4 12h16M4 18h16"/>'
  };
  const ico = id => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[id]}</svg>`;
  /* Menú subdividido por secciones (g): laptop = grupos plegables; celular = hoja con secciones */
  const NAV = [
    { id: 'inicio', t: 'Inicio', g: 'Principal' }, { id: 'reservar', t: 'Reservar', g: 'Principal' }, { id: 'turnos', t: 'Mis citas', g: 'Principal' },
    { id: 'mascotas', t: 'Mascotas', g: 'Mis mascotas' }, { id: 'historial', t: 'Historial', g: 'Mis mascotas' },
    { id: 'servicios', t: 'Servicios', g: 'Clínica' }, { id: 'personal', t: 'Personal', g: 'Clínica', staff: true }, { id: 'admin', t: 'Administración', g: 'Clínica', admin: true },
    { id: 'perfil', t: 'Perfil', g: 'Cuenta' }
  ];
  const DOCK = ['inicio', 'reservar', 'turnos', 'mascotas'];
  let current = '', arg = null;
  const visibleNav = () => NAV.filter(n => (!n.staff || S.staff) && (!n.admin || S.admin));
  const navBtn = n => `<button class="nav-btn" data-nav="${n.id}"><span class="e">${ico(n.id)}</span><span>${n.t}</span></button>`;
  function buildNav() {
    const items = visibleNav(), groups = [...new Set(items.map(n => n.g))];
    $('#side').innerHTML = groups.map(g => `<details class="navgrp" open><summary>${g}</summary>${items.filter(n => n.g === g).map(navBtn).join('')}</details>`).join('') + `<div class="who">${esc(S.profile.full_name)}${S.staff ? ' · Personal' : ''}</div>`;
    $('#dock').innerHTML = items.filter(n => DOCK.includes(n.id)).map(navBtn).join('') + `<button class="nav-btn" data-nav="__more"><span class="e">${ico('mas')}</span><span>Menú</span></button>`;
  }
  document.addEventListener('click', e => {
    const n = e.target.closest('[data-nav]'); if (!n) return; const id = n.dataset.nav;
    $('.sheet') && $('.sheet').remove();
    if (id === '__more') return moreSheet();
    go(id);
  });
  function moreSheet() {
    const items = visibleNav(), groups = [...new Set(items.map(n => n.g))];
    const sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'Menú');
    sh.innerHTML = groups.map(g => `<p class="sheet__t">${g}</p><div class="sheet__g">${items.filter(n => n.g === g).map(n => `<button class="btn block${n.id === current ? ' primary' : ''}" data-nav="${n.id}"><span class="e">${ico(n.id)}</span>${n.t}</button>`).join('')}</div>`).join('') + `<button class="btn ghost block" data-logout>Cerrar sesión</button>`;
    document.body.appendChild(sh); setTimeout(() => document.addEventListener('click', function f(ev) { if (!sh.contains(ev.target)) { sh.remove(); document.removeEventListener('click', f); } }), 0);
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-logout]') || e.target.closest('#logoutTop')) logout(); });
  async function logout() { if (!await P.confirm('¿Cerrar sesión?', 'Tendrás que ingresar otra vez para ver tus mascotas.', 'Cerrar sesión')) return; const name = (S.profile && S.profile.full_name || '').split(' ')[0]; window.__leaving = true; await P.logEvent('cierre_sesion'); P.cache.clear(); await sb.auth.signOut(); P.goodbye(name, () => location.replace('./index.html')); }
  async function go(id, a) {
    if (!NAV.some(n => n.id === id && (!n.staff || S.staff) && (!n.admin || S.admin))) id = 'inicio';
    current = id; arg = a || null; if (location.hash !== '#' + id) history.pushState(null, '', '#' + id);
    $$('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === id));
    const host = $('#main'); host.scrollTo(0, 0); const m = document.createElement('div'); host.replaceChildren(m); m.innerHTML = skeleton();   /* cada vista escribe en su propio contenedor: una carga lenta no pisa a la siguiente */
    try { await VIEWS[id](m); } catch (e) { if (host.firstChild !== m) return; console.error(e); m.innerHTML = `<div class="view">${empty('No se pudo cargar esta sección. ' + esc(errMsg(e)), '<button class="btn primary" data-nav="' + id + '">Reintentar</button>')}</div>`; }
    P.onNet(navigator.onLine);
  }
  addEventListener('popstate', () => go(location.hash.slice(1) || 'inicio'));
  const refresh = () => $$('[data-nav]').length && go(current);

  /* ======================= INICIO ======================= */
  const TIPS = [
    ['💉', 'Vacunas al día', 'Lleva el carnet a cada visita. El esquema lo define el veterinario según edad, especie e historial.'],
    ['🥣', 'Alimentación', 'Cambia el alimento de forma gradual durante 7 a 10 días y deja siempre agua fresca disponible.'],
    ['🦷', 'Salud dental', 'El mal aliento o el sarro pueden indicar problemas. Pide una revisión dental una vez al año.'],
    ['🚨', 'Señales de alerta', 'Vómitos repetidos, apatía, dificultad para respirar o no comer por más de un día: consulta pronto.']
  ];
  const hourLP = () => +new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', hour12: false }).format(new Date());
  const ROLE = {
    tutor: ['Tu panel de tutor', 'Aquí controlas todo lo de tus mascotas: reservas citas con horarios libres, ves su historial médico y su carnet de vacunas, pagas con QR y descargas tu recibo.', ['Reservar y cancelar citas', 'Historial médico y vacunas', 'Pagos con QR y recibo']],
    staff: ['Panel del personal veterinario', 'Aquí atiendes la clínica: confirmas o rechazas solicitudes, atiendes pacientes, registras diagnósticos y vacunas, validas pagos (también leyendo la notificación de Yape o del banco) y cobras en efectivo.', ['Confirmar / rechazar citas', 'Atender y registrar historial', 'Validar pagos y emitir recibos']],
    admin: ['Panel de administración', 'Tienes el control total: dashboard con ingresos y estadísticas, servicios y precios, equipo y roles, ajustes de contacto y QR de pago, y la bitácora con cada evento del sistema.', ['Dashboard e ingresos', 'Servicios, equipo y roles', 'Bitácora de eventos y ajustes']]
  };
  async function vInicio(m) {
    await Promise.all([loadPets(), loadAppts(), loadServices(), loadMedia(), P.settings().then(s => S.settings = s)]);
    const h = hourLP(), hi = h < 12 ? '¡Buenos días' : h < 19 ? '¡Buenas tardes' : '¡Buenas noches';
    const upcoming = S.appts.filter(active).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    const nxt = upcoming[0], done = S.appts.filter(a => a.status === 'completada').length;
    const trio = S.pets.length ? S.pets.slice(0, 3).map(p => p.species) : ['gato', 'perro', 'ave'];
    const rk = S.admin ? 'admin' : S.staff ? 'staff' : 'tutor', R = ROLE[rk];
    const tiles = [['reservar', 'Reservar'], ['turnos', 'Mis citas'], ['mascotas', 'Mascotas'], ['historial', 'Historial'], ['servicios', 'Servicios'], ...(S.staff ? [['personal', 'Personal']] : []), ...(S.admin ? [['admin', 'Admin']] : []), ['perfil', 'Perfil']];
    m.innerHTML = `<div class="view">
      <div class="greeting"><div><h2>${hi}, ${esc(S.profile.full_name.split(' ')[0])}!</h2><p>${S.pets.length ? 'Cuidamos a ' + S.pets.slice(0, 4).map(p => esc(p.name)).join(', ') + ' con cariño.' : 'Registra a tu primera mascota para empezar.'}</p></div><div class="petrow">${trio.map(s => `<div class="pw">${ART.forSpecies(s)}</div>`).join('')}</div></div>
      <div class="cols3" style="margin-bottom:.8rem">
        <div class="card stat lift"><b class="count" data-to="${S.pets.length}">0</b><span>Mascotas</span></div>
        <div class="card stat lift"><b class="count" data-to="${upcoming.length}">0</b><span>Citas activas</span></div>
        <div class="card stat lift"><b class="count" data-to="${done}">0</b><span>Atenciones</span></div></div>
      <div class="acc open"><button class="acc-head" aria-expanded="true"><span class="ico">${ico(S.admin ? 'admin' : S.staff ? 'personal' : 'inicio')}</span><span class="grow"><b>${R[0]}</b><span class="sub">Qué puedes hacer aquí</span></span></button><div class="acc-body"><div class="acc-in"><div class="acc-pad"><p>${R[1]}</p><ul style="margin:.4rem 0 .2rem 1.1rem">${R[2].map(x => `<li>${x}</li>`).join('')}</ul></div></div></div></div>
      <div class="tiles" style="margin:.8rem 0">${tiles.map(([id, t]) => `<button class="tile" data-nav="${id}">${ico(id)}<span>${t}</span></button>`).join('')}</div>
      <div class="cols"><div class="card"><h3>Próxima cita</h3><br>${nxt ? `<dl class="kv"><dt>Servicio</dt><dd>${esc(nxt.service.name)}</dd><dt>Mascota</dt><dd>${esc(nxt.pet.name)}</dd><dt>Cuándo</dt><dd>${fmtDate(nxt.starts_at)} · ${fmtTime(nxt.starts_at)}</dd><dt>Estado</dt><dd>${badge(nxt.status)}</dd></dl><div class="actions"><button class="btn sm" data-nav="turnos">Ver mis citas</button></div>` : empty('No tienes citas próximas.', '<button class="btn accent" data-nav="reservar">Reservar ahora</button>')}</div>
        <div class="card"><h3>Urgencias y contacto</h3><p class="hint" style="margin:.3rem 0 .6rem">${esc(S.settings.address)}</p>${P.socialBar(S.settings.whatsapp, 'Hola Pata Andina Vet, tengo una urgencia con mi mascota.')}</div></div>
      <h3 style="margin:1rem 0 .4rem">Los 10 servicios más buscados</h3>
      <div class="rail" id="rail">${Catalog.top(S.services).map((s, i) => Catalog.card(s, S.media[s.id], i + 1)).join('')}</div>
      <h3 style="margin:.8rem 0 .4rem">Cómo funciona cada rol</h3>
      <div data-group="1">${Object.values(ROLE).map(r => `<div class="acc"><button class="acc-head" aria-expanded="false"><span class="grow"><b>${r[0]}</b></span></button><div class="acc-body"><div class="acc-in"><div class="acc-pad"><p>${r[1]}</p></div></div></div></div>`).join('')}</div>
      <h3 style="margin:.8rem 0 .4rem">Consejos de cuidado</h3>
      <div data-group="1">${TIPS.map(t => `<div class="acc"><button class="acc-head" aria-expanded="false"><span class="ico">${t[0]}</span><span class="grow"><b>${t[1]}</b></span></button><div class="acc-body"><div class="acc-in"><div class="acc-pad">${t[2]}</div></div></div></div>`).join('')}</div></div>`;
    $$('.count', m).forEach(c => P.countUp(c, +c.dataset.to)); P.lazyScan(m);
    Catalog.bind(m.querySelector('#rail'), { state: {}, redraw() { }, list: () => S.services, media: () => S.media, onBook: s => go('reservar', { service: s.id }) });
  }

  /* ======================= MASCOTAS ======================= */
  async function vMascotas(m) {
    await loadPets();
    m.innerHTML = `<div class="view"><h2>Mis mascotas</h2><p class="lead">Toca una mascota para ver sus datos y opciones.</p>
      <button class="btn primary" id="addPet" style="margin-bottom:1rem">＋ Agregar mascota</button>
      <div data-group="1">${S.pets.map(p => `<div class="acc" data-pet="${p.id}"><button class="acc-head" aria-expanded="false">${petIco(p)}<span class="grow"><b>${esc(p.name)}</b><span class="sub">${esc(SPECIES[p.species])}${p.breed ? ' · ' + esc(p.breed) : ''}${p.birth_date ? ' · ' + P.age(p.birth_date) : ''}</span></span></button>
        <div class="acc-body"><div class="acc-in"><div class="acc-pad"><dl class="kv"><dt>Sexo</dt><dd>${esc(p.sex || '—')}</dd><dt>Nacimiento</dt><dd>${p.birth_date ? fmtDay(p.birth_date) : '—'}</dd><dt>Peso</dt><dd>${p.weight_kg ? p.weight_kg + ' kg' : '—'}</dd><dt>Notas</dt><dd>${esc(p.notes || '—')}</dd></dl>
        <div class="actions"><button class="btn sm primary" data-book="${p.id}">Reservar</button><button class="btn sm" data-hist="${p.id}">Historial</button><button class="btn sm" data-edit="${p.id}">Editar</button><button class="btn sm danger" data-del="${p.id}">Eliminar</button></div></div></div></div></div>`).join('')}</div>
      ${S.pets.length ? '' : empty('Aún no registraste mascotas.')}</div>`;
    $('#addPet').onclick = () => petForm();
    m.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return; const id = b.dataset.book || b.dataset.hist || b.dataset.edit || b.dataset.del; const p = S.pets.find(x => x.id === id);
      if (b.dataset.book) go('reservar', { pet: id }); else if (b.dataset.hist) go('historial', { pet: id }); else if (b.dataset.edit) petForm(p);
      else if (b.dataset.del && await P.confirm(`¿Eliminar a ${p.name}?`, 'Se borrarán también sus citas e historial médico. Esta acción no se puede deshacer.', 'Sí, eliminar', true)) {
        const { error } = await sb.from('pets').delete().eq('id', id); if (error) return toast(errMsg(error), 'err'); toast(p.name + ' fue eliminado/a.'); refresh();
      }
    };
  }
  function petForm(p) {
    const edit = !!p; p = p || {};
    P.modal(`<h2>${edit ? 'Editar' : 'Nueva'} mascota</h2><form id="pf" novalidate>
      <div class="row2"><div class="field"><label for="pName">Nombre *</label><input id="pName" maxlength="40" value="${esc(p.name || '')}"></div>
      <div class="field"><label for="pSpecies">Especie *</label><select id="pSpecies"><option value="">Selecciona…</option>${Object.entries(SPECIES).map(([k, t]) => `<option value="${k}" ${p.species === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
      <div class="row2"><div class="field"><label for="pBreed">Raza</label><input id="pBreed" maxlength="60" value="${esc(p.breed || '')}" placeholder="Mestizo, Siamés…"></div>
      <div class="field"><label for="pSex">Sexo</label><select id="pSex"><option value="">—</option><option value="macho" ${p.sex === 'macho' ? 'selected' : ''}>Macho</option><option value="hembra" ${p.sex === 'hembra' ? 'selected' : ''}>Hembra</option></select></div></div>
      <div class="row2"><div class="field"><label for="pBirth">Nacimiento</label><input id="pBirth" type="date" max="${todayLP()}" value="${p.birth_date || ''}"></div>
      <div class="field"><label for="pWeight">Peso (kg)</label><input id="pWeight" type="number" step="0.1" min="0.1" max="119" inputmode="decimal" value="${p.weight_kg || ''}"></div></div>
      <div class="field"><label for="pNotes">Notas (alergias, comportamiento)</label><textarea id="pNotes" rows="2" maxlength="300">${esc(p.notes || '')}</textarea></div>
      <div class="actions"><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="pSave">${edit ? 'Guardar cambios' : 'Guardar mascota'}</button></div></form>`, (mod, close) => {
      const val = liveValidate(mod, {
        pName: x => x.trim().length >= 1 && x.trim().length <= 40 ? '' : 'Escribe el nombre (máx. 40).',
        pSpecies: x => x ? '' : 'Selecciona la especie.',
        pBirth: x => !x || x <= todayLP() ? '' : 'La fecha no puede ser futura.',
        pWeight: x => !x || (+x > 0 && +x < 120) ? '' : 'Peso entre 0.1 y 119 kg.'
      });
      mod.querySelector('#pf').onsubmit = async e => {
        e.preventDefault(); if (!val()) return; const b = $('#pSave', mod); btnBusy(b, true);
        const row = { name: $('#pName', mod).value.trim(), species: $('#pSpecies', mod).value, breed: $('#pBreed', mod).value.trim() || null, sex: $('#pSex', mod).value || null, birth_date: $('#pBirth', mod).value || null, weight_kg: $('#pWeight', mod).value || null, notes: $('#pNotes', mod).value.trim() || null };
        const { error } = edit ? await sb.from('pets').update(row).eq('id', p.id) : await sb.from('pets').insert({ ...row, owner_id: uid });
        btnBusy(b, false); if (error) return toast(errMsg(error), 'err');
        close(); toast(edit ? 'Datos actualizados.' : `¡${row.name} fue registrado/a!`); if (!edit) P.confetti(18); refresh();
      };
    });
  }

  /* ======================= RESERVAR (asistente de 4 pasos) ======================= */
  const W = { step: 1, pet: null, service: null, date: '', time: '', note: '' };
  const TITLES = ['Mascota', 'Servicio', 'Fecha y hora', 'Confirmar'];
  async function vReservar(m) {
    await Promise.all([loadPets(), loadServices(), loadMedia()]);
    if (arg && arg.pet) { W.pet = arg.pet; W.step = Math.max(W.step, 2); }
    if (arg && arg.service) { W.service = arg.service; W.step = W.pet ? 3 : 1; }
    if (!S.pets.some(p => p.id === W.pet)) W.pet = null;
    if (!S.services.some(s => s.id === W.service)) { W.service = null; W.step = Math.min(W.step, 2); }
    if (!W.pet) W.step = 1;
    paintWizard(m);
  }
  function paintWizard(m) {
    m = m || $('#main');
    const stepHtml = [stepPet, stepService, stepDate, stepConfirm][W.step - 1]();
    m.innerHTML = `<div class="view"><h2>Reservar cita</h2><p class="lead">Paso ${W.step} de 4 · ${TITLES[W.step - 1]}</p>
      <div class="steps">${[1, 2, 3, 4].map(i => `<i class="${i <= W.step ? 'on' : ''}"></i>`).join('')}</div><div class="pane" id="wz">${stepHtml}</div></div>`;
    bindStep(m);
  }
  const stepPet = () => !S.pets.length ? empty('Primero registra a tu mascota.', '<button class="btn primary" data-nav="mascotas">Agregar mascota</button>') :
    S.pets.map(p => `<button class="pick ${W.pet === p.id ? 'sel' : ''}" data-pet="${p.id}">${petIco(p)}<span><b>${esc(p.name)}</b><br><small>${esc(SPECIES[p.species])}${p.breed ? ' · ' + esc(p.breed) : ''}</small></span></button>`).join('');
  const svcRow = s => `<button class="pick ${W.service === s.id ? 'sel' : ''}" data-svc="${s.id}"><span class="ico">${icoImg(s)}</span><span style="flex:1"><b>${esc(s.name)}</b> ${s.tag ? `<span class="tag">${esc(s.tag)}</span>` : ''}<br><small>${esc(s.description)}</small><br><small><b>${esc(s.price_label)}</b> · ${s.duration_min} min</small></span></button>`;
  function stepService() {
    const groups = {}; S.services.filter(s => s.active !== false).forEach(s => (groups[Catalog.grp(s)] = groups[Catalog.grp(s)] || []).push(s));
    const selCat = Catalog.grp(S.services.find(s => s.id === W.service) || {});
    return `<div class="field"><label for="svcSearch">Buscar servicio</label><input id="svcSearch" type="search" placeholder="Vacuna, dental, baño…"></div>
      <div id="svcGroups" data-group="1">${Object.entries(groups).map(([c, list]) => `<div class="acc ${c === selCat ? 'open' : ''}" data-cat="${c}"><button class="acc-head" aria-expanded="${c === selCat}"><span class="grow"><b>${esc((Catalog.GROUPS.find(g => g.k === c) || { t: c }).t)}</b><span class="sub">${list.length} servicios</span></span></button><div class="acc-body"><div class="acc-in"><div class="acc-pad">${list.map(svcRow).join('')}</div></div></div></div>`).join('')}</div>${nav(!!W.service)}`;
  }
  function stepDate() {
    const svc = S.services.find(s => s.id === W.service);
    const quick = []; for (let i = 0; quick.length < 6 && i < 14; i++) { const d = addDays(todayLP(), i); if (P.dow(d) !== 0) quick.push(d); }
    return `<div class="card" style="margin-bottom:.8rem"><small>${esc(svc.name)} · ${svc.duration_min} min · Lun–Sáb 09:00–13:00 y 14:00–18:00</small> <button class="btn sm" data-media="${svc.id}" style="margin-left:.4rem">Ver fotos y video</button></div>
      <div class="chips">${quick.map(d => `<button class="chip ${W.date === d ? 'active' : ''}" data-day="${d}">${fmtDay(d).replace(/ \d{4}$/, '')}</button>`).join('')}</div>
      <div class="field"><label for="wDate">…o elige otra fecha</label><input id="wDate" type="date" min="${todayLP()}" max="${addDays(todayLP(), 90)}" value="${W.date}"></div>
      <div id="slots" data-group="">${W.date ? '<div class="skeleton"></div>' : '<p class="hint">Elige una fecha para ver los horarios.</p>'}</div>${nav(!!W.time)}`;
  }
  function stepConfirm() {
    const p = S.pets.find(x => x.id === W.pet), s = S.services.find(x => x.id === W.service), at = toISO(W.date, W.time);
    return `<div class="card"><dl class="kv"><dt>Mascota</dt><dd>${esc(p.name)}</dd><dt>Servicio</dt><dd>${esc(s.name)}</dd><dt>Fecha</dt><dd>${fmtDate(at)}</dd><dt>Hora</dt><dd>${fmtTime(at)} (${s.duration_min} min)</dd><dt>Precio</dt><dd>${esc(s.price_label)}</dd></dl></div><br>
      <div class="field"><label for="wNote">Comentarios para el veterinario (opcional)</label><textarea id="wNote" rows="2" maxlength="300">${esc(W.note)}</textarea></div>
      <label class="check"><input type="checkbox" id="wOk"><span>Entiendo que la cita queda <b>pendiente</b> hasta que la clínica la confirme.</span></label>
      <div class="wiz-nav"><button class="btn ghost" data-back>← Atrás</button><button class="btn accent" id="wGo">Solicitar cita</button></div>`;
  }
  const nav = ok => `<div class="wiz-nav">${W.step > 1 ? '<button class="btn ghost" data-back>← Atrás</button>' : '<span></span>'}<button class="btn primary" data-next ${ok ? '' : 'disabled'}>Siguiente →</button></div>`;

  async function drawSlots() {
    const box = $('#slots'); if (!box) return; const svc = S.services.find(s => s.id === W.service);
    if (!W.date) return;
    if (P.dow(W.date) === 0) { box.innerHTML = '<div class="notice warn">Los domingos la clínica no atiende. Elige otro día.</div>'; return; }
    if (W.date < todayLP() || W.date > addDays(todayLP(), 90)) { box.innerHTML = '<div class="notice warn">Fecha fuera del rango permitido (hoy a 90 días).</div>'; return; }
    const day = W.date; let busy;
    try { const r = await sb.rpc('get_busy_slots', { p_day: day }); if (r.error) throw r.error; busy = r.data || []; } catch (e) { box.innerHTML = `<div class="notice bad">${esc(errMsg(e))}</div>`; return; }
    if (day !== W.date) return;
    const blocks = [['09:00', '13:00', 'Mañana'], ['14:00', '18:00', 'Tarde']], tm = t => +t.slice(0, 2) * 60 + +t.slice(3);
    box.innerHTML = blocks.map(([a, b, label]) => {
      let out = ''; for (let mm = tm(a); mm + svc.duration_min <= tm(b); mm += 30) {
        const hh = String(Math.floor(mm / 60)).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0'), s = Date.parse(toISO(day, hh)), e = s + svc.duration_min * 60000;
        const bad = s <= Date.now() + 30 * 60000 || busy.some(x => s < Date.parse(x.ends_at) && e > Date.parse(x.starts_at));
        out += `<button class="slot ${W.time === hh ? 'sel' : ''}" data-time="${hh}" ${bad ? 'disabled' : ''}>${hh}</button>`;
      }
      return `<div class="acc open"><button class="acc-head" aria-expanded="true"><b class="grow">${label}</b></button><div class="acc-body"><div class="acc-in"><div class="acc-pad"><div class="slots">${out || '<small>Sin horarios</small>'}</div></div></div></div></div>`;
    }).join('');
    if (!$('.slot:not([disabled])', box)) box.insertAdjacentHTML('afterbegin', '<div class="notice warn">No quedan horarios libres este día.</div>');
  }
  function bindStep(m) {
    const wz = $('#wz', m);
    wz.onclick = async e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.media) { const sv = S.services.find(x => x.id === t.dataset.media); return P.modal(Catalog.sheet(sv, S.media[sv.id], 'Elegir este servicio'), (mod, close) => { P.lazyScan(mod); mod.querySelector('[data-book]').onclick = close; }); }
      if (t.dataset.pet) { W.pet = t.dataset.pet; W.step = 2; return paintWizard(); }
      if (t.dataset.svc) { W.service = t.dataset.svc; W.time = ''; $$('.pick', wz).forEach(x => x.classList.toggle('sel', x.dataset.svc === W.service)); $('[data-next]', wz).disabled = false; return; }
      if (t.dataset.day) { W.date = t.dataset.day; W.time = ''; $('#wDate').value = W.date; $$('.chip', wz).forEach(x => x.classList.toggle('active', x.dataset.day === W.date)); $('[data-next]').disabled = true; return drawSlots(); }
      if (t.dataset.time) { W.time = t.dataset.time; $$('.slot', wz).forEach(x => x.classList.toggle('sel', x === t)); $('[data-next]').disabled = false; return; }
      if (t.hasAttribute('data-back')) { W.step--; return paintWizard(); }
      if (t.hasAttribute('data-next')) { W.step++; return paintWizard(); }
      if (t.id === 'wGo') await submitBooking(t);
    };
    if (W.step === 2) $('#svcSearch').oninput = ev => {
      const k = ev.target.value.trim().toLowerCase();
      $$('#svcGroups .acc', wz).forEach(a => { let n = 0; $$('.pick', a).forEach(p => { const s = S.services.find(x => x.id === p.dataset.svc), hit = !k || (s.name + ' ' + s.description + ' ' + (s.tag || '')).toLowerCase().includes(k); p.hidden = !hit; if (hit) n++; }); a.hidden = !n; if (k && n) a.classList.add('open'); });
    };
    if (W.step === 3) { $('#wDate').onchange = ev => { W.date = ev.target.value; W.time = ''; $('[data-next]').disabled = true; $$('.chip', wz).forEach(x => x.classList.toggle('active', x.dataset.day === W.date)); drawSlots(); }; if (W.date) drawSlots(); }
  }
  async function submitBooking(btn) {
    W.note = $('#wNote').value.trim();
    if (!$('#wOk').checked) return toast('Marca la casilla para continuar.', 'err');
    const svc = S.services.find(s => s.id === W.service), start = toISO(W.date, W.time), s = Date.parse(start);
    if (s <= Date.now() + 30 * 60000) { toast('Ese horario ya pasó. Elige otro.', 'err'); W.step = 3; W.time = ''; return paintWizard(); }
    btnBusy(btn, true);
    const { error } = await sb.from('appointment_requests').insert({ owner_id: uid, pet_id: W.pet, service_id: W.service, starts_at: start, ends_at: new Date(s + svc.duration_min * 60000).toISOString(), note: W.note || null });
    btnBusy(btn, false);
    if (error) { toast(errMsg(error), 'err'); if (error.code === '23P01') { W.step = 3; W.time = ''; paintWizard(); } return; }
    P.confetti(34); toast('¡Solicitud enviada! La clínica la confirmará pronto.');
    Object.assign(W, { step: 1, pet: null, service: null, date: '', time: '', note: '' }); go('turnos');
  }

  /* ======================= MIS CITAS ======================= */
  const AF = { activas: a => active(a), todas: () => true, pendiente: a => a.status === 'pendiente', confirmada: a => a.status === 'confirmada', completada: a => a.status === 'completada', cerradas: a => ['cancelada', 'rechazada'].includes(a.status) };
  let tf = 'activas';
  P.parseNotif = txt => { const t = String(txt || ''); const am = (t.match(/(?:Bs\.?|BOB)\s*([\d]+(?:[.,]\d{1,2})?)/i) || t.match(/([\d]+(?:[.,]\d{1,2})?)\s*(?:Bs|bolivianos)/i) || [])[1]; const amount = am ? parseFloat(am.replace(',', '.')) : null; const named = (t.match(/(?:c[oó]digo|operaci[oó]n|nro\.?|n[°º]|ref\w*)\s*[:#]?\s*([A-Za-z0-9-]{5,24})/i) || [])[1]; const codes = [...t.matchAll(/\b[A-Za-z]{0,3}\d{5,14}\b/g)].map(x => x[0].toUpperCase()); return { amount, codes: named ? [named.toUpperCase(), ...codes] : codes }; };
  const PAYB = { pendiente: ['b-pendiente', 'Pago por validar'], validado: ['b-confirmada', 'Pagado'], rechazado: ['b-rechazada', 'Pago rechazado'] };
  const loadPayments = async () => { S.payments = await q('pays', () => sb.from('payments').select('*').eq('owner_id', uid).order('created_at', { ascending: false })); };
  const payOf = a => (S.payments || []).find(x => x.appointment_id === a.id && x.status !== 'rechazado');
  async function payModal(a, done) {
    const st = await P.settings(), price = Number(a.service.price_value) || '';
    P.modal(`<h2>Pagar con QR</h2><p class="hint">${esc(a.service.name)} · ${esc(a.pet.name)}</p>
      <div class="qrbox">${st.pay_qr ? `<img src="${esc(st.pay_qr)}" alt="Código QR de pago de ${esc(st.pay_holder)}">` : '<p class="hint">La clínica aún no cargó su QR. Escribe por WhatsApp o paga en caja.</p>'}</div>
      <p class="hint" style="margin:.4rem 0">Titular: <b>${esc(st.pay_holder)}</b>. ${esc(st.pay_note)}</p>
      <form id="payf" novalidate><div class="row2"><div class="field"><label for="payAmt">Monto (Bs)</label><input id="payAmt" type="number" step="0.01" min="1" inputmode="decimal" value="${price}"></div>
      <div class="field"><label for="payM">Método</label><select id="payM"><option value="qr">QR / Yape / Tigo Money</option><option value="transferencia">Transferencia bancaria</option></select></div></div>
      <div class="field"><label for="payRef">Código de operación</label><input id="payRef" maxlength="24" autocapitalize="characters" placeholder="Ej: 12345678"></div>
      <div class="field"><label for="payFile">Foto del comprobante (opcional)</label><input id="payFile" type="file" accept="image/*"><img id="payPrev" class="proof" alt="Vista previa del comprobante" hidden></div>
      <div class="actions"><a class="btn sm" href="${esc(P.waLink(st.whatsapp, 'Hola, envío mi comprobante de pago para la cita del ' + fmtDate(a.starts_at)))}" target="_blank" rel="noopener noreferrer">Enviar por WhatsApp</a><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="payGo">Enviar pago</button></div></form>`, (mod, close) => {
      let proof = null;
      const val = liveValidate(mod, { payAmt: x => +x >= 1 && +x <= 10000 ? '' : 'Monto entre 1 y 10000 Bs.', payRef: x => /^[A-Za-z0-9-]{5,24}$/.test(x.trim()) ? '' : 'Código de 5 a 24 letras o números.' });
      $('#payFile', mod).onchange = async e => { const f = e.target.files[0]; if (!f) { proof = null; $('#payPrev', mod).hidden = true; return; } try { proof = await P.imageToData(f, 720); const im = $('#payPrev', mod); im.src = proof; im.hidden = false; } catch (er) { proof = null; e.target.value = ''; toast(er.message, 'err'); } };
      mod.querySelector('#payf').onsubmit = async e => { e.preventDefault(); if (!val()) return; const b = $('#payGo', mod); btnBusy(b, true);
        const { error } = await sb.rpc('submit_payment', { p_appointment: a.id, p_amount: +$('#payAmt', mod).value, p_method: $('#payM', mod).value, p_reference: $('#payRef', mod).value.trim(), p_proof: proof });
        btnBusy(b, false); if (error) return toast(errMsg(error), 'err'); close(); toast('Pago enviado. El personal lo validará y recibirás tu recibo.'); P.confetti(14); done && done(); };
    });
  }
  async function receiptModal(pay, a) {
    const st = await P.settings();
    P.modal(`<div class="receipt"><h2>${esc(st.clinic_name)}</h2><p class="hint">${esc(st.address)}</p><p style="margin:.5rem 0"><span class="paid">PAGADO</span></p>
      <dl class="kv"><dt>Recibo N°</dt><dd>${esc(pay.receipt_no)}</dd><dt>Fecha</dt><dd>${fmtDate(pay.validated_at || pay.created_at)}</dd><dt>Tutor</dt><dd>${esc(S.profile.full_name)}</dd><dt>Mascota</dt><dd>${esc(a.pet.name)}</dd><dt>Servicio</dt><dd>${esc(a.service.name)}</dd><dt>Cita</dt><dd>${fmtDate(a.starts_at)} · ${fmtTime(a.starts_at)}</dd><dt>Método</dt><dd>${esc(pay.method)}${pay.reference ? ' · ref ' + esc(pay.reference) : ''}</dd><dt>Total</dt><dd><b>Bs ${Number(pay.amount).toFixed(2)}</b></dd></dl>
      <p class="hint" style="margin-top:.6rem">Presenta este recibo el día de tu cita. ¡Gracias por confiar en nosotros!</p></div>
      <div class="actions"><button class="btn primary" onclick="window.print()">Imprimir / guardar PDF</button><button class="btn ghost" data-close>Cerrar</button></div>`);
  }
  async function vTurnos(m) {
    await Promise.all([loadAppts(), loadPayments().catch(() => { S.payments = []; })]); draw();
    function draw() {
      const list = S.appts.filter(AF[tf]).sort((a, b) => tf === 'activas' ? new Date(a.starts_at) - new Date(b.starts_at) : new Date(b.starts_at) - new Date(a.starts_at));
      m.innerHTML = `<div class="view"><h2>Mis citas</h2><p class="lead">Toca una cita para ver el detalle, pagar o ver tu recibo.</p>
        <div class="chips">${[['activas', 'Próximas'], ['pendiente', 'Pendientes'], ['confirmada', 'Confirmadas'], ['completada', 'Atendidas'], ['cerradas', 'Canceladas'], ['todas', 'Todas']].map(([k, l]) => `<button class="chip ${tf === k ? 'active' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
        <div data-group="1">${list.slice(0, 40).map(a => { const pay = payOf(a), pb = pay && PAYB[pay.status]; return `<div class="acc"><button class="acc-head" aria-expanded="false"><span class="ico">${icoImg(a.service)}</span><span class="grow"><b>${esc(a.service.name)}</b> · ${esc(a.pet.name)}<span class="sub">${fmtDate(a.starts_at)} · ${fmtTime(a.starts_at)}</span></span>${badge(a.status)}</button>
          <div class="acc-body"><div class="acc-in"><div class="acc-pad"><dl class="kv"><dt>Duración</dt><dd>${a.service.duration_min} min</dd><dt>Precio</dt><dd>${esc(a.service.price_label)}</dd><dt>Pago</dt><dd>${pb ? `<span class="badge ${pb[0]}">${pb[1]}</span>` : '<span class="badge b-cancelada">Sin pago</span>'}</dd><dt>Tu nota</dt><dd>${esc(a.note || '—')}</dd><dt>Respuesta</dt><dd>${esc(a.staff_note || '—')}</dd></dl>
          <div class="actions">${!pay && ['pendiente', 'confirmada', 'completada'].includes(a.status) ? `<button class="btn sm accent" data-pay="${a.id}">Pagar con QR</button>` : ''}${pay && pay.status === 'validado' ? `<button class="btn sm primary" data-receipt="${a.id}">Ver recibo</button>` : ''}${active(a) ? `<button class="btn sm danger" data-cancel="${a.id}">Cancelar cita</button>` : ''}</div></div></div></div></div>`; }).join('')}</div>
        ${list.length ? (list.length > 40 ? `<p class="hint">Mostrando 40 de ${list.length}. Usa los filtros.</p>` : '') : empty('No hay citas en esta vista.', '<button class="btn accent" data-nav="reservar">Reservar cita</button>')}</div>`;
    }
    m.onclick = async e => {
      const f = e.target.closest('[data-f]'); if (f) { tf = f.dataset.f; return draw(); }
      const pb = e.target.closest('[data-pay]'); if (pb) return payModal(S.appts.find(x => x.id === pb.dataset.pay), async () => { await loadPayments(); draw(); });
      const rb = e.target.closest('[data-receipt]'); if (rb) { const a = S.appts.find(x => x.id === rb.dataset.receipt); return receiptModal(payOf(a), a); }
      const c = e.target.closest('[data-cancel]'); if (!c) return;
      if (!await P.confirm('¿Cancelar esta cita?', 'El horario quedará libre para otras familias.', 'Sí, cancelar', true)) return;
      btnBusy(c, true); const { error } = await sb.rpc('cancel_my_appointment', { p_id: c.dataset.cancel }); btnBusy(c, false);
      if (error) return toast(errMsg(error), 'err'); toast('Cita cancelada.'); await loadAppts(); draw();
    };
  }

  const vaxState = d => !d ? ['b-confirmada', 'Registrada'] : d < todayLP() ? ['b-rechazada', 'Vencida'] : d < addDays(todayLP(), 30) ? ['b-pendiente', 'Próxima'] : ['b-confirmada', 'Al día'];
  function vaccineForm(petId, done) {
    P.modal(`<h2>Registrar vacuna</h2><form id="vf" novalidate><div class="field"><label for="vName">Vacuna *</label><input id="vName" maxlength="80" placeholder="Rabia, Triple felina…"></div>
      <div class="row2"><div class="field"><label for="vApp">Aplicada el</label><input id="vApp" type="date" max="${todayLP()}" value="${todayLP()}"></div><div class="field"><label for="vNext">Próxima dosis</label><input id="vNext" type="date" min="${todayLP()}"></div></div>
      <div class="field"><label for="vLot">Lote</label><input id="vLot" maxlength="30"></div><div class="actions"><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="vGo">Guardar</button></div></form>`, (mod, close) => {
      const val = liveValidate(mod, { vName: x => x.trim().length >= 2 ? '' : 'Escribe el nombre de la vacuna.', vApp: x => x && x <= todayLP() ? '' : 'Fecha válida (hoy o antes).', vNext: (x, el) => !x || x >= $('#vApp', mod).value ? '' : 'Debe ser posterior a la aplicación.' });
      mod.querySelector('#vf').onsubmit = async e => { e.preventDefault(); if (!val()) return; const b = $('#vGo', mod); btnBusy(b, true); const { error } = await sb.rpc('staff_add_vaccine', { p_pet: petId, p_vaccine: $('#vName', mod).value.trim(), p_applied: $('#vApp', mod).value, p_next: $('#vNext', mod).value || null, p_lot: $('#vLot', mod).value.trim() || null }); btnBusy(b, false); if (error) return toast(errMsg(error), 'err'); close(); toast('Vacuna registrada en el carnet.'); done && done(); };
    });
  }
  async function vHistorial(m) {
    await loadPets();
    if (!S.pets.length) { m.innerHTML = `<div class="view"><h2>Historial médico</h2>${empty('Registra una mascota para ver su historial.', '<button class="btn primary" data-nav="mascotas">Agregar mascota</button>')}</div>`; return; }
    let pid = (arg && arg.pet) || S.pets[0].id, sub = 'hist';
    async function draw() {
      m.innerHTML = `<div class="view"><h2>Historial médico</h2><div class="chips">${S.pets.map(p => `<button class="chip ${p.id === pid ? 'active' : ''}" data-p="${p.id}">${esc(p.name)}</button>`).join('')}</div>
        <div class="tabs"><button class="tab ${sub === 'hist' ? 'active' : ''}" data-sub="hist">Atenciones</button><button class="tab ${sub === 'vac' ? 'active' : ''}" data-sub="vac">Carnet de vacunas</button></div><div id="recs">${skeleton(2)}</div></div>`;
      try {
        if (sub === 'vac') {
          const vs = await q('vac' + pid, () => sb.from('pet_vaccines').select('*').eq('pet_id', pid).order('applied_on', { ascending: false })); if (!$('#recs')) return;
          $('#recs').innerHTML = `${vs.map(x => { const b = vaxState(x.next_due); return `<div class="vax"><span class="ico">${icoImg({ icon: 'vacuna' })}</span><div style="flex:1;min-width:0"><b>${esc(x.vaccine)}</b><br><small>Aplicada ${fmtDay(x.applied_on)}${x.next_due ? ' · próxima ' + fmtDay(x.next_due) : ''}${x.lot ? ' · lote ' + esc(x.lot) : ''}</small></div><span class="badge ${b[0]}">${b[1]}</span></div>`; }).join('')}${vs.length ? '' : empty('Aún no hay vacunas registradas.')}${S.staff ? `<div class="actions"><button class="btn sm primary" data-addvac="${pid}">Registrar vacuna</button></div>` : ''}`;
          return;
        }
        const recs = await q('rec' + pid, () => sb.from('pet_medical_records').select('*').eq('pet_id', pid).order('visit_date', { ascending: false }).limit(60)); if (!$('#recs')) return;
        const next = recs.filter(r => r.next_visit && r.next_visit >= todayLP()).map(r => r.next_visit).sort()[0];
        $('#recs').innerHTML = (next ? `<div class="notice" style="background:var(--accent-soft)"><b>Próxima visita sugerida:</b> ${fmtDay(next)} <button class="btn sm accent" data-book="${pid}" style="margin-left:.5rem">Reservar</button></div>` : '') +
          `<div data-group="1">${recs.map((r, i) => `<div class="acc ${i === 0 ? 'open' : ''}"><button class="acc-head" aria-expanded="${i === 0}"><span class="ico">🩺</span><span class="grow"><b>${esc(r.diagnosis.slice(0, 60))}${r.diagnosis.length > 60 ? '…' : ''}</b><span class="sub">${fmtDay(r.visit_date)}</span></span></button>
          <div class="acc-body"><div class="acc-in"><div class="acc-pad"><dl class="kv"><dt>Diagnóstico</dt><dd>${esc(r.diagnosis)}</dd><dt>Tratamiento</dt><dd>${esc(r.treatment || '—')}</dd><dt>Receta</dt><dd>${esc(r.prescription || '—')}</dd><dt>Peso</dt><dd>${r.weight_kg ? r.weight_kg + ' kg' : '—'}</dd><dt>Próxima visita</dt><dd>${r.next_visit ? fmtDay(r.next_visit) : '—'}</dd></dl></div></div></div></div>`).join('')}</div>` +
          (recs.length ? '' : empty('Aún no hay atenciones registradas para esta mascota.'));
      } catch (e) { if ($('#recs')) $('#recs').innerHTML = `<div class="notice bad">${esc(errMsg(e))}</div>`; }
    }
    m.onclick = e => { const c = e.target.closest('[data-p]'); if (c) { pid = c.dataset.p; draw(); } const s = e.target.closest('[data-sub]'); if (s) { sub = s.dataset.sub; draw(); } const b = e.target.closest('[data-book]'); if (b) go('reservar', { pet: b.dataset.book }); const v = e.target.closest('[data-addvac]'); if (v) vaccineForm(v.dataset.addvac, draw); };
    draw();
  }

  /* ======================= SERVICIOS ======================= */
  const loadMedia = async () => { if (!S.media) { try { S.media = await (await fetch('./data/media.json')).json(); } catch (_) { S.media = {}; } } return S.media; };
  async function vServicios(m) {
    await Promise.all([loadServices(), loadMedia()]); const state = { tab: 'top' }; let foods = null;
    m.innerHTML = `<div class="view"><h2>Servicios</h2><p class="lead">Top 10 y tres categorías. Toca una tarjeta: fotos, video y reserva.</p><div id="cat"></div><div class="actions"><button class="btn" id="foodBtn">Comida para gatos</button></div><div id="food"></div></div>`;
    const cat = m.querySelector('#cat'), draw = () => { cat.innerHTML = Catalog.view(S.services, S.media, state); P.lazyScan(cat); }; draw();
    Catalog.bind(cat, { state, redraw: draw, list: () => S.services, media: () => S.media, onBook: s => go('reservar', { service: s.id }) });
    m.querySelector('#foodBtn').onclick = async () => { const box = m.querySelector('#food'); if (box.innerHTML) { box.innerHTML = ''; return; } if (!foods) { try { foods = await (await fetch('./data/productos-gatos.json')).json(); } catch (_) { foods = []; } } box.innerHTML = `<div class="grid" data-group="1" style="margin-top:.6rem">${foods.map(f => `<div class="acc"><button class="acc-head" aria-expanded="false"><span class="ico">🐱</span><span class="grow"><b>${esc(f.name)}</b><span class="sub">${esc(f.kind)}</span></span></button><div class="acc-body"><div class="acc-in"><div class="acc-pad"><p>${esc(f.description)}</p><p class="hint" style="margin-top:.4rem">${esc(f.guidance)}</p></div></div></div></div>`).join('') || empty('Catálogo no disponible sin conexión.')}</div>`; };
  }

  /* ======================= PERSONAL ======================= */
  const staffAppt = '*, pet:pets(name,species), service:services_catalog(name,duration_min,icon), owner:profiles(full_name,phone)';
  async function vPersonal(m) {
    let tab = 'pend', af = 'hoy';
    async function draw() {
      m.innerHTML = `<div class="view"><h2>Panel del personal</h2><div class="tabs"><button class="tab ${tab === 'pend' ? 'active' : ''}" data-tab="pend">Pendientes</button><button class="tab ${tab === 'agenda' ? 'active' : ''}" data-tab="agenda">Agenda</button><button class="tab ${tab === 'pay' ? 'active' : ''}" data-tab="pay">Pagos</button><button class="tab ${tab === 'att' ? 'active' : ''}" data-tab="att">Atención y vacunas</button></div><div class="pane" id="sp">${skeleton(2)}</div></div>`;
      try { await ({ pend: tPend, agenda: tAgenda, pay: tPay, att: tAtt })[tab](); } catch (e) { const sp = $('#sp'); if (sp) sp.innerHTML = `<div class="notice bad">${esc(errMsg(e))}</div>`; }
    }
    const apptCard = (a, actions) => { a.pet = a.pet || { name: '—', species: 'otro' }; a.owner = a.owner || { full_name: '—' }; return `<div class="acc"><button class="acc-head" aria-expanded="false"><span class="ico">${icoImg(a.service)}</span><span class="grow"><b>${esc(a.service.name)}</b> · ${esc(a.pet.name)}<span class="sub">${fmtDate(a.starts_at)} · ${fmtTime(a.starts_at)}</span></span>${badge(a.status)}</button><div class="acc-body"><div class="acc-in"><div class="acc-pad"><dl class="kv"><dt>Tutor</dt><dd>${esc(a.owner.full_name)}</dd><dt>Celular</dt><dd>${a.owner.phone ? `<a href="tel:+591${esc(a.owner.phone)}">${esc(a.owner.phone)}</a> · <a href="https://wa.me/591${esc(a.owner.phone)}" target="_blank" rel="noopener">WhatsApp</a>` : '—'}</dd><dt>Nota</dt><dd>${esc(a.note || '—')}</dd></dl><div class="actions">${actions}</div></div></div></div></div>`; };
    async function tPend() {
      const r = await sb.from('appointment_requests').select(staffAppt).eq('status', 'pendiente').gte('ends_at', new Date().toISOString()).order('starts_at'); if (r.error) throw r.error;
      const sp = $('#sp'); if (!sp) return; sp.innerHTML = `<div data-group="1">${r.data.map(a => apptCard(a, `<button class="btn sm primary" data-ok="${a.id}">Confirmar</button><button class="btn sm danger" data-no="${a.id}">Rechazar</button>`)).join('')}</div>${r.data.length ? '' : empty('No hay solicitudes pendientes. ¡Todo al día!')}`;
    }
    async function tAgenda() {
      const t0 = new Date(toISO(todayLP(), '00:00')).toISOString(), t1 = new Date(toISO(af === 'hoy' ? addDays(todayLP(), 1) : af === 'semana' ? addDays(todayLP(), 7) : addDays(todayLP(), 120), '00:00')).toISOString();
      const r = await sb.from('appointment_requests').select(staffAppt).in('status', ['confirmada', 'completada']).gte('starts_at', t0).lt('starts_at', t1).order('starts_at').limit(80); if (r.error) throw r.error;
      const sp = $('#sp'); if (!sp) return; sp.innerHTML = `<div class="chips">${[['hoy', 'Hoy'], ['semana', '7 días'], ['todas', 'Todas']].map(([k, l]) => `<button class="chip ${af === k ? 'active' : ''}" data-af="${k}">${l}</button>`).join('')}</div><div data-group="1">${r.data.map(a => apptCard(a, a.status === 'confirmada' ? `<button class="btn sm primary" data-att="${a.id}" data-pet="${a.pet_id}">Atender y registrar</button>` : '<small>Atención registrada</small>')).join('')}</div>${r.data.length ? '' : empty('No hay citas confirmadas en este rango.')}`;
      S._agenda = r.data;
    }
    async function tPay() {
      const pr = await sb.from('payments').select('*, owner:profiles!payments_owner_id_fkey(full_name,phone), appt:appointment_requests(starts_at, pet:pets(name), service:services_catalog(name))').eq('status', 'pendiente').order('created_at'); if (pr.error) throw pr.error;
      const ar = await sb.from('appointment_requests').select(staffAppt).in('status', ['confirmada', 'completada']).order('starts_at', { ascending: false }).limit(40); if (ar.error) throw ar.error;
      const pd = await sb.from('payments').select('appointment_id').in('status', ['pendiente', 'validado']).in('appointment_id', ar.data.map(a => a.id)); const paid = new Set((pd.data || []).map(x => x.appointment_id));
      S._pend = pr.data; const nopay = ar.data.filter(a => !paid.has(a.id)).slice(0, 12); S._nopay = nopay;
      const sp = $('#sp'); if (!sp) return;
      sp.innerHTML = `<div class="card" style="margin-bottom:.8rem"><h3>Leer notificación de pago</h3><p class="hint" style="margin:.3rem 0 .5rem">Pega el texto que te llegó de Yape, Tigo Money o tu banco. El sistema extrae el monto y el código de operación y lo compara con los pagos pendientes.</p>
        <div class="field"><label for="notif">Texto de la notificación</label><textarea id="notif" rows="2" placeholder="Ej: Yape! Ana Pérez te envió Bs 60.00. Código de operación 12345678"></textarea></div><button class="btn accent" data-notif>Leer y validar</button><div id="notifOut" class="notice" hidden role="status" style="margin-top:.6rem"></div></div>
        <h3 style="margin:.4rem 0">Pagos por validar (${pr.data.length})</h3><div data-group="1">${pr.data.map(p => `<div class="acc"><button class="acc-head" aria-expanded="false"><span class="grow"><b>${esc(p.owner.full_name)} · Bs ${Number(p.amount).toFixed(2)}</b><span class="sub">${esc(p.method)} · ref ${esc(p.reference || '—')}</span></span><span class="badge b-pendiente">Por validar</span></button><div class="acc-body"><div class="acc-in"><div class="acc-pad"><dl class="kv"><dt>Cita</dt><dd>${p.appt ? esc(p.appt.service.name) + ' · ' + esc(p.appt.pet.name) + ' · ' + fmtDate(p.appt.starts_at) : '—'}</dd><dt>Celular</dt><dd>${esc(p.owner.phone || '—')}</dd></dl>${p.proof ? `<img class="proof" data-zoom="${esc(p.proof)}" data-cap="Comprobante de ${esc(p.owner.full_name)}" src="${esc(p.proof)}" alt="Comprobante de pago">` : '<p class="hint">Sin foto de comprobante.</p>'}<div class="actions"><button class="btn sm primary" data-vok="${p.id}">Validar y emitir recibo</button><button class="btn sm danger" data-vno="${p.id}">Rechazar</button></div></div></div></div></div>`).join('')}</div>${pr.data.length ? '' : empty('No hay pagos por validar.')}
        <h3 style="margin:.8rem 0 .4rem">Cobrar en efectivo</h3><div data-group="1">${nopay.map(a => `<div class="acc"><button class="acc-head" aria-expanded="false"><span class="grow"><b>${esc(a.service.name)} · ${esc(a.pet.name)}</b><span class="sub">${esc(a.owner.full_name)} · ${fmtDate(a.starts_at)}</span></span></button><div class="acc-body"><div class="acc-in"><div class="acc-pad"><button class="btn sm accent" data-cash="${a.id}">Registrar cobro en efectivo</button></div></div></div></div>`).join('')}</div>${nopay.length ? '' : empty('Todas las citas recientes tienen pago.')}`;
    }
    async function validatePay(id, ok, note) { const { data, error } = await sb.rpc('staff_validate_payment', { p_id: id, p_ok: ok, p_note: note || null }); if (error) { toast(errMsg(error), 'err'); return false; } toast(ok ? 'Pago validado. Recibo ' + data : 'Pago rechazado.'); if (ok) P.confetti(14); return true; }
    async function tAtt() {
      const r = await sb.from('pets').select('id,name,species,breed,owner:profiles(full_name)').order('name'); if (r.error) throw r.error; S._allPets = r.data;
      const sp = $('#sp'); if (!sp) return; sp.innerHTML = `<div class="field"><label for="petQ">Buscar mascota o tutor</label><input id="petQ" type="search" placeholder="Luna, Pérez…"></div><div id="petList" data-group="1"></div>`;
      const paint = k => { const l = S._allPets.filter(p => !k || (p.name + ' ' + p.owner.full_name).toLowerCase().includes(k)); $('#petList').innerHTML = l.slice(0, 30).map(p => `<div class="pickrow"><button class="pick" data-att="" data-pet="${p.id}">${petIco(p)}<span><b>${esc(p.name)}</b><br><small>${esc(p.owner.full_name)} · ${esc(SPECIES[p.species] || p.species)}</small></span></button><button class="btn sm" data-vac="${p.id}">Vacuna</button></div>`).join('') + (l.length > 30 ? `<p class="hint">Mostrando 30 de ${l.length}. Usa el buscador.</p>` : '') || empty('Sin resultados.'); };
      paint(''); $('#petQ').oninput = e => paint(e.target.value.trim().toLowerCase());
    }
    m.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { tab = b.dataset.tab; return draw(); }
      if (b.dataset.af) { af = b.dataset.af; return draw(); }
      if (b.dataset.ok) { btnBusy(b, true); const { error } = await sb.rpc('staff_set_status', { p_id: b.dataset.ok, p_status: 'confirmada', p_note: null }); btnBusy(b, false); if (error) return toast(errMsg(error), 'err'); toast('Cita confirmada.'); return draw(); }
      if (b.dataset.no) { const id = b.dataset.no; return P.modal(`<h2>Rechazar solicitud</h2><form id="rf" novalidate><div class="field"><label for="rWhy">Motivo (se lo mostraremos al tutor)</label><textarea id="rWhy" rows="3" maxlength="300" placeholder="Ej: Ese día no hay veterinario disponible."></textarea></div><div class="actions"><button type="button" class="btn ghost" data-close>Volver</button><button class="btn danger" id="rGo">Rechazar</button></div></form>`, (mod, close) => {
        const val = liveValidate(mod, { rWhy: x => x.trim().length >= 3 ? '' : 'Escribe el motivo (mínimo 3 caracteres).' });
        mod.querySelector('#rf').onsubmit = async ev => { ev.preventDefault(); if (!val()) return; const g = $('#rGo', mod); btnBusy(g, true); const { error } = await sb.rpc('staff_set_status', { p_id: id, p_status: 'rechazada', p_note: $('#rWhy', mod).value.trim() }); btnBusy(g, false); if (error) return toast(errMsg(error), 'err'); close(); toast('Solicitud rechazada.'); draw(); };
      }); }
      if (b.dataset.vac) return vaccineForm(b.dataset.vac, () => toast('Carnet actualizado.'));
      if (b.hasAttribute('data-notif')) { const out = $('#notifOut'), pn = P.parseNotif($('#notif').value); out.hidden = false; const hit = (S._pend || []).find(p => pn.codes.includes(String(p.reference || '').toUpperCase()) && (pn.amount == null || Math.abs(pn.amount - Number(p.amount)) < 0.01));
        if (!pn.codes.length && pn.amount == null) { out.textContent = 'No encontré monto ni código en el texto.'; return; }
        if (!hit) { out.textContent = `Leí monto ${pn.amount == null ? '—' : 'Bs ' + pn.amount} y código ${pn.codes[0] || '—'}, pero no hay un pago pendiente que coincida.`; return; }
        out.textContent = `Coincide: ${hit.owner.full_name} · Bs ${Number(hit.amount).toFixed(2)} · ref ${hit.reference}.`; if (await P.confirm('Pago encontrado', `${hit.owner.full_name} pagó Bs ${Number(hit.amount).toFixed(2)} (ref ${hit.reference}). ¿Validar y emitir recibo?`, 'Validar')) { if (await validatePay(hit.id, true)) draw(); } return; }
      if (b.dataset.vok) { btnBusy(b, true); const okp = await validatePay(b.dataset.vok, true); btnBusy(b, false); if (okp) draw(); return; }
      if (b.dataset.vno) { const id = b.dataset.vno; return P.modal(`<h2>Rechazar pago</h2><form id="pf2" novalidate><div class="field"><label for="pWhy">Motivo</label><textarea id="pWhy" rows="2" maxlength="200" placeholder="Ej: El monto no coincide."></textarea></div><div class="actions"><button type="button" class="btn ghost" data-close>Volver</button><button class="btn danger" id="pGo">Rechazar</button></div></form>`, (mod, close) => { const val = liveValidate(mod, { pWhy: x => x.trim().length >= 3 ? '' : 'Escribe el motivo.' }); mod.querySelector('#pf2').onsubmit = async ev => { ev.preventDefault(); if (!val()) return; const g = $('#pGo', mod); btnBusy(g, true); const okp = await validatePay(id, false, $('#pWhy', mod).value.trim()); btnBusy(g, false); if (okp) { close(); draw(); } }; }); }
      if (b.dataset.cash) { const ap = (S._nopay || []).find(x => x.id === b.dataset.cash); return P.modal(`<h2>Cobro en efectivo</h2><p class="hint">${esc(ap.service.name)} · ${esc(ap.pet.name)}</p><form id="cf" novalidate><div class="field"><label for="cAmt">Monto cobrado (Bs)</label><input id="cAmt" type="number" step="0.01" min="1" inputmode="decimal" value="${Number(ap.service.price_value) || ''}"></div><div class="actions"><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="cGo">Registrar</button></div></form>`, (mod, close) => { const val = liveValidate(mod, { cAmt: x => +x >= 1 && +x <= 10000 ? '' : 'Monto entre 1 y 10000 Bs.' }); mod.querySelector('#cf').onsubmit = async ev => { ev.preventDefault(); if (!val()) return; const g = $('#cGo', mod); btnBusy(g, true); const { data, error } = await sb.rpc('staff_register_cash', { p_appointment: ap.id, p_amount: +$('#cAmt', mod).value }); btnBusy(g, false); if (error) return toast(errMsg(error), 'err'); close(); toast('Cobro registrado. Recibo ' + data); P.confetti(10); draw(); }; }); }
      if (b.dataset.att !== undefined && b.dataset.pet) attentionForm({ pet: b.dataset.pet, appointment: b.dataset.att || null }, draw);
    };
    draw();
  }
  function attentionForm({ pet, appointment }, done) {
    P.modal(`<h2>Registrar atención</h2><form id="af" novalidate>
      <div class="field"><label for="aDx">Diagnóstico *</label><textarea id="aDx" rows="2" maxlength="500"></textarea></div>
      <div class="field"><label for="aTx">Tratamiento</label><textarea id="aTx" rows="2" maxlength="500"></textarea></div>
      <div class="field"><label for="aRx">Receta / indicaciones</label><textarea id="aRx" rows="2" maxlength="500"></textarea></div>
      <div class="row2"><div class="field"><label for="aW">Peso (kg)</label><input id="aW" type="number" step="0.1" min="0.1" max="119" inputmode="decimal"></div><div class="field"><label for="aNext">Próxima visita</label><input id="aNext" type="date" min="${todayLP()}"></div></div>
      <div class="actions"><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="aGo">Guardar atención</button></div></form>`, (mod, close) => {
      const val = liveValidate(mod, { aDx: x => x.trim().length >= 3 ? '' : 'Escribe el diagnóstico (mínimo 3 caracteres).', aW: x => !x || (+x > 0 && +x < 120) ? '' : 'Peso entre 0.1 y 119 kg.', aNext: x => !x || x >= todayLP() ? '' : 'La fecha no puede ser pasada.' });
      mod.querySelector('#af').onsubmit = async e => {
        e.preventDefault(); if (!val()) return; const g = $('#aGo', mod); btnBusy(g, true);
        const { error } = await sb.rpc('staff_register_attention', { p_pet: pet, p_appointment: appointment, p_diagnosis: $('#aDx', mod).value.trim(), p_treatment: $('#aTx', mod).value.trim() || null, p_prescription: $('#aRx', mod).value.trim() || null, p_weight: $('#aW', mod).value || null, p_next: $('#aNext', mod).value || null });
        btnBusy(g, false); if (error) return toast(errMsg(error), 'err'); close(); toast('Atención registrada en el historial.'); P.confetti(14); done && done();
      };
    });
  }

  /* ======================= PERFIL ======================= */
  async function vPerfil(m) {
    await loadProfile(); const p = S.profile;
    const initials = p.full_name.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase(), roleTxt = S.admin ? 'Administrador' : S.staff ? 'Personal veterinario' : 'Tutor';
    m.innerHTML = `<div class="view"><div class="profile-head"><div class="avatar" aria-hidden="true">${esc(initials)}</div><div style="min-width:0"><h2 style="color:#fff;font-size:1.5rem">${esc(p.full_name)}</h2><div style="opacity:.85;word-break:break-all">${esc(session.user.email)}</div><span class="role-pill ${S.admin ? 'admin' : ''}">${roleTxt}</span></div></div>
      ${S.admin ? '<div class="actions" style="margin:0 0 1rem"><button class="btn accent" data-nav="admin">Abrir Administración</button><button class="btn" data-nav="personal">Panel del personal</button></div>' : S.staff ? '<div class="actions" style="margin:0 0 1rem"><button class="btn accent" data-nav="personal">Abrir panel del personal</button></div>' : ''}
      <div data-group="1">
      <div class="acc open"><button class="acc-head" aria-expanded="true"><span class="ico">👤</span><b class="grow">Datos personales</b></button><div class="acc-body"><div class="acc-in"><div class="acc-pad"><form id="prf" novalidate>
        <div class="field"><label for="fName">Nombre completo</label><input id="fName" maxlength="80" value="${esc(p.full_name)}"></div>
        <div class="row2"><div class="field"><label for="fPhone">Celular</label><input id="fPhone" inputmode="numeric" maxlength="8" value="${esc(p.phone || '')}"></div><div class="field"><label for="fAddr">Dirección</label><input id="fAddr" maxlength="160" value="${esc(p.address || '')}"></div></div>
        <button class="btn primary" id="fGo">Guardar</button></form></div></div></div></div>
      <div class="acc"><button class="acc-head" aria-expanded="false"><span class="ico">🔒</span><b class="grow">Cambiar contraseña</b></button><div class="acc-body"><div class="acc-in"><div class="acc-pad"><form id="pwf" novalidate>
        <div class="field"><label for="cp1">Nueva contraseña</label><input id="cp1" type="password" autocomplete="new-password"><div class="meter"><i id="cpm"></i></div></div>
        <div class="field"><label for="cp2">Repítela</label><input id="cp2" type="password" autocomplete="new-password"></div><button class="btn primary" id="cpGo">Actualizar</button></form></div></div></div></div>
      ${S.staff ? '' : `<div class="acc"><button class="acc-head" aria-expanded="false"><span class="ico">🩺</span><b class="grow">Soy personal de la clínica</b></button><div class="acc-body"><div class="acc-in"><div class="acc-pad"><form id="stf" novalidate><div class="field"><label for="sCode">Código de activación</label><input id="sCode" autocapitalize="characters" maxlength="40" placeholder="PATA-STAFF-…"></div><button class="btn accent" id="sGo">Activar</button></form></div></div></div></div>`}
      <div class="acc"><button class="acc-head" aria-expanded="false"><span class="ico">📲</span><b class="grow">App y sesión</b></button><div class="acc-body"><div class="acc-in"><div class="acc-pad"><p class="hint">Instálala desde el menú del navegador (“Agregar a pantalla de inicio”) para usarla como app.</p><div class="actions"><button class="btn danger" data-logout>⎋ Cerrar sesión</button></div></div></div></div></div></div></div>`;
    $('#fPhone').oninput = e => e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
    const vp = liveValidate($('#prf'), { fName: x => v.name(x) ? '' : 'Nombre válido (solo letras, mínimo 2).', fPhone: x => !x || v.phone(x) ? '' : 'Celular de 8 dígitos que empieza con 6 o 7.' });
    $('#prf').onsubmit = async e => { e.preventDefault(); if (!vp()) return; const b = $('#fGo'); btnBusy(b, true); const { error } = await sb.from('profiles').update({ full_name: $('#fName').value.trim().replace(/\s+/g, ' '), phone: $('#fPhone').value || null, address: $('#fAddr').value.trim() || null }).eq('id', uid); btnBusy(b, false); if (error) return toast(errMsg(error), 'err'); toast('Perfil actualizado.'); await loadProfile(); buildNav(); $$('[data-nav]').forEach(x => x.classList.toggle('active', x.dataset.nav === 'perfil')); };
    $('#cp1').oninput = e => { const s = v.strength(e.target.value); $('#cpm').style.width = s * 25 + '%'; $('#cpm').style.background = s < 3 ? '#b4483a' : '#2f7d57'; };
    const vw = liveValidate($('#pwf'), { cp1: x => v.pass(x) ? '' : 'Mínimo 8 caracteres, con letras y números.', cp2: x => x === $('#cp1').value && x ? '' : 'Las contraseñas no coinciden.' });
    $('#pwf').onsubmit = async e => { e.preventDefault(); if (!vw()) return; const b = $('#cpGo'); btnBusy(b, true); const { error } = await sb.auth.updateUser({ password: $('#cp1').value }); btnBusy(b, false); if (error) return toast(errMsg(error), 'err'); $('#pwf').reset(); $('#cpm').style.width = 0; toast('Contraseña actualizada.'); };
    if ($('#stf')) $('#stf').onsubmit = async e => { e.preventDefault(); const c = $('#sCode').value.trim(); if (!setField($('#sCode'), c.length >= 6 ? '' : 'Escribe el código completo.')) return; const b = $('#sGo'); btnBusy(b, true); const { error } = await sb.rpc('activate_staff', { p_code: c }); btnBusy(b, false); if (error) return setField($('#sCode'), errMsg(error)); P.confetti(); toast('¡Acceso de personal activado!'); await loadProfile(); buildNav(); go('personal'); };
  }


  /* ======================= ADMINISTRACIÓN (solo rol admin) ======================= */
  const LOGC = { sesion: ['inicio_sesion', 'cierre_sesion', 'invitado_visita'], citas: x => x.startsWith('cita_'), pagos: x => x.startsWith('pago_'), usuarios: x => ['rol_cambiado', 'mascota_creada', 'mascota_eliminada'].includes(x), historial: x => ['atencion_registrada', 'vacuna_registrada'].includes(x) };
  const LOGN = { inicio_sesion: 'Inicio de sesión', cierre_sesion: 'Cierre de sesión', invitado_visita: 'Visita de invitado', cita_creada: 'Cita creada', cita_confirmada: 'Cita confirmada', cita_rechazada: 'Cita rechazada', cita_cancelada: 'Cita cancelada', cita_completada: 'Cita atendida', pago_enviado: 'Pago enviado', pago_validado: 'Pago validado', pago_rechazado: 'Pago rechazado', pago_efectivo: 'Cobro en efectivo', mascota_creada: 'Mascota registrada', mascota_eliminada: 'Mascota eliminada', atencion_registrada: 'Atención registrada', vacuna_registrada: 'Vacuna registrada', rol_cambiado: 'Rol cambiado', servicio_editado: 'Servicio editado' };
  async function vAdmin(m) {
    let tab = 'res', lf = 'todos', lq = '', lmax = 25;
    async function draw() {
      m.innerHTML = `<div class="view"><h2>Administración</h2><p class="lead">Dashboard, servicios, equipo, bitácora y ajustes de la clínica.</p><div class="chips" role="tablist">${[['res', 'Resumen'], ['svc', 'Servicios'], ['team', 'Equipo'], ['log', 'Bitácora'], ['set', 'Ajustes']].map(([k, l]) => `<button class="chip ${tab === k ? 'active' : ''}" role="tab" data-tab="${k}">${l}</button>`).join('')}</div><div class="pane" id="ap">${skeleton(2)}</div></div>`;
      try { await ({ res: aRes, svc: aSvc, team: aTeam, log: aLog, set: aSet })[tab](); } catch (e) { const ap = $('#ap'); if (ap) ap.innerHTML = `<div class="notice bad">${esc(errMsg(e))}</div>`; }
    }
    async function aRes() {
      const r = await sb.rpc('admin_stats'); if (r.error) throw r.error; const s = r.data, ap = $('#ap'); if (!ap || tab !== 'res') return;
      const total = Object.values(s.by_status).reduce((a, b) => a + b, 0) || 1, col = { pendiente: '#b7791f', confirmada: '#2f7d57', completada: '#2a5185', cancelada: '#888', rechazada: '#b4483a' }, mx = Math.max(1, ...(s.by_month || []).map(x => x.n));
      ap.innerHTML = `<div class="cols3" style="margin-bottom:.8rem"><div class="card stat"><b class="count" data-to="${s.users}">0</b><span>Usuarios</span></div><div class="card stat"><b class="count" data-to="${s.pets}">0</b><span>Mascotas</span></div><div class="card stat"><b class="count" data-to="${s.upcoming}">0</b><span>Citas próximas</span></div></div>
        <div class="cols3" style="margin-bottom:.8rem"><div class="card stat"><b>Bs <span class="count" data-to="${Math.round(s.revenue || 0)}">0</span></b><span>Ingresos validados</span></div><div class="card stat"><b>Bs <span class="count" data-to="${Math.round(s.revenue_30d || 0)}">0</span></b><span>Últimos 30 días</span></div><div class="card stat"><b class="count" data-to="${s.pay_pending || 0}">0</b><span>Pagos por validar</span></div></div>
        <div class="cols"><div class="card"><h3>Citas por mes</h3><div style="display:flex;align-items:flex-end;gap:.4rem;height:120px;margin-top:.6rem">${(s.by_month || []).map(x => `<div style="flex:1;text-align:center"><div class="bar" style="height:${Math.max(8, Math.round(x.n / mx * 100))}px;width:100%;border-radius:8px 8px 0 0;background:linear-gradient(var(--accent),var(--forest))" title="${x.n}"></div><small>${esc(x.m.slice(5))}</small></div>`).join('') || '<p class="hint">Sin datos.</p>'}</div></div>
        <div class="card"><h3>Citas por estado</h3><br>${Object.entries(s.by_status).map(([k, n]) => `<div class="mini-stat"><span>${badge(k)}</span><b>${n}</b></div><div class="bar"><i data-w="${Math.round(n / total * 100)}" style="background:${col[k] || '#888'}"></i></div>`).join('') || '<p class="hint">Sin citas.</p>'}</div></div>
        <div class="card" style="margin-top:1rem"><h3>Servicios más pedidos</h3><br>${s.top_services.map(x => `<div class="mini-stat"><span>${esc(x.name)}</span><b>${x.n}</b></div>`).join('') || '<p class="hint">Sin datos.</p>'}<div class="mini-stat"><span>Atenciones registradas</span><b>${s.records}</b></div><div class="mini-stat"><span>Equipo (personal + admin)</span><b>${s.staff + s.admins}</b></div>${Object.entries(s.by_species).map(([k, n]) => `<div class="mini-stat"><span>Mascotas: ${esc(SPECIES[k] || k)}</span><b>${n}</b></div>`).join('')}</div>`;
      $$('.count', ap).forEach(c => P.countUp(c, +c.dataset.to)); setTimeout(() => $$('.bar i[data-w]', ap).forEach(i => i.style.width = i.dataset.w + '%'), 60);
    }
    async function aSvc() {
      const r = await sb.from('services_catalog').select('*').order('sort_order'); if (r.error) throw r.error; const ap = $('#ap'); if (!ap || tab !== 'svc') return;
      ap.innerHTML = `<div data-group="1">${r.data.map(s => `<div class="acc"><button class="acc-head" aria-expanded="false"><span class="ico">${icoImg(s)}</span><span class="grow"><b>${esc(s.name)}</b><span class="sub">${esc(s.price_label)} · ${s.duration_min} min</span></span><span class="badge ${s.active ? 'b-confirmada' : 'b-cancelada'}">${s.active ? 'Activo' : 'Oculto'}</span></button><div class="acc-body"><div class="acc-in"><div class="acc-pad"><div class="field"><label for="pr-${s.id}">Precio / etiqueta</label><input id="pr-${s.id}" maxlength="60" value="${esc(s.price_label)}"></div><div class="field"><label for="vd-${s.id}">Video (enlace https de YouTube o .mp4, opcional)</label><input id="vd-${s.id}" maxlength="300" value="${esc(s.video_url || '')}" placeholder="https://www.youtube.com/watch?v=…"></div><label class="check"><input type="checkbox" id="ac-${s.id}" ${s.active ? 'checked' : ''}><span>Visible para los tutores</span></label><button class="btn sm primary" data-save="${s.id}">Guardar</button></div></div></div></div>`).join('')}</div>`;
    }
    async function aTeam() {
      const r = await sb.rpc('admin_list_users'); if (r.error) throw r.error; const ap = $('#ap'); if (!ap || tab !== 'team') return;
      ap.innerHTML = `<div class="card" style="margin-bottom:1rem"><h3>Código para activar personal</h3><p class="hint" style="margin:.3rem 0 .6rem">Entrégalo a un veterinario: se canjea una vez en Perfil.</p><button class="btn accent" id="mkCode">Generar código</button> <span id="codeOut" style="font-weight:800;letter-spacing:.08em;margin-left:.5rem"></span></div>
        <div class="field"><label for="uq">Buscar usuario</label><input id="uq" type="search" placeholder="Nombre o correo"></div><div id="ul" data-group="1"></div>`;
      const paint = k => { const l = r.data.filter(u => !k || (u.full_name + ' ' + (u.email || '')).toLowerCase().includes(k)).slice(0, 30); $('#ul').innerHTML = l.map(u => `<div class="acc"><button class="acc-head" aria-expanded="false"><span class="ico">${esc(u.full_name.slice(0, 1).toUpperCase())}</span><span class="grow"><b>${esc(u.full_name)}</b><span class="sub">${esc(u.email || '')} · ${u.pets} mascota(s)</span></span><span class="badge ${u.role === 'admin' ? 'b-completada' : u.role === 'staff' ? 'b-confirmada' : 'b-cancelada'}">${u.role === 'admin' ? 'Admin' : u.role === 'staff' ? 'Personal' : 'Tutor'}</span></button><div class="acc-body"><div class="acc-in"><div class="acc-pad"><dl class="kv"><dt>Celular</dt><dd>${esc(u.phone || '—')}</dd><dt>Desde</dt><dd>${fmtDate(u.created_at)}</dd></dl>${u.id === uid ? '<p class="hint" style="margin-top:.5rem">Esta eres tú: no puedes cambiar tu propio rol.</p>' : `<div class="field" style="margin-top:.6rem"><label for="rl-${u.id}">Rol</label><select id="rl-${u.id}"><option value="tutor" ${u.role === 'tutor' ? 'selected' : ''}>Tutor</option><option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Personal veterinario</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador</option></select></div><button class="btn sm primary" data-role="${u.id}">Guardar rol</button>`}</div></div></div></div>`).join('') + (r.data.length > 30 && !k ? `<p class="hint">Mostrando 30 de ${r.data.length}. Usa el buscador.</p>` : ''); };
      paint(''); $('#uq').oninput = e => paint(e.target.value.trim().toLowerCase());
    }
    async function aLog() {
      const r = await sb.from('audit_log').select('*').order('at', { ascending: false }).limit(400); if (r.error) throw r.error; const ap = $('#ap'); if (!ap || tab !== 'log') return;
      const rows = r.data.filter(x => { const c = LOGC[lf]; const okc = lf === 'todos' || (Array.isArray(c) ? c.includes(x.action) : c(x.action)); return okc && (!lq || (x.action + ' ' + (x.actor_name || '') + ' ' + (x.detail || '')).toLowerCase().includes(lq)); });
      ap.innerHTML = `<div class="chips">${['todos', 'sesion', 'citas', 'pagos', 'usuarios', 'historial'].map(k => `<button class="chip ${lf === k ? 'active' : ''}" data-lf="${k}">${k === 'sesion' ? 'sesiones' : k}</button>`).join('')}</div><div class="field"><label for="lsearch">Buscar en la bitácora</label><input id="lsearch" type="search" value="${esc(lq)}" placeholder="Nombre, acción o detalle"></div>
        <p class="hint">${rows.length} evento(s) de los últimos ${r.data.length}</p><div class="card" style="padding:.4rem 1rem">${rows.slice(0, lmax).map(x => `<div class="logrow"><time datetime="${esc(x.at)}">${fmtDate(x.at)} ${fmtTime(x.at)}</time><div><b>${esc(LOGN[x.action] || x.action)}</b><span>${esc(x.actor_name || 'Sistema')}${x.detail ? ' · ' + esc(x.detail) : ''}</span></div></div>`).join('') || '<p class="hint" style="padding:1rem">Sin eventos.</p>'}</div>${rows.length > lmax ? '<div class="actions"><button class="btn" data-more>Ver más</button></div>' : ''}`;
      const si = $('#lsearch'); si.oninput = e => { lq = e.target.value.trim().toLowerCase(); lmax = 25; clearTimeout(aLog.t); aLog.t = setTimeout(draw, 250); };
    }
    async function aSet() {
      const st = await P.settings(true), ap = $('#ap'); if (!ap || tab !== 'set') return; let qr = null;
      ap.innerHTML = `<form id="setf" class="card" novalidate><div class="row2"><div class="field"><label for="sName">Nombre de la clínica</label><input id="sName" maxlength="60" value="${esc(st.clinic_name)}"></div><div class="field"><label for="sWa">WhatsApp (con código de país)</label><input id="sWa" inputmode="numeric" maxlength="15" value="${esc(st.whatsapp)}"></div></div>
        <div class="field"><label for="sAddr">Dirección</label><input id="sAddr" maxlength="120" value="${esc(st.address)}"></div><div class="row2"><div class="field"><label for="sHold">Titular del pago</label><input id="sHold" maxlength="60" value="${esc(st.pay_holder)}"></div><div class="field"><label for="sNote">Indicación de pago</label><input id="sNote" maxlength="200" value="${esc(st.pay_note)}"></div></div>
        <div class="field"><label for="sQr">QR de pago (foto o captura)</label><input id="sQr" type="file" accept="image/*"><div class="qrbox" style="margin-top:.4rem"><img id="qrPrev" ${st.pay_qr ? `src="${esc(st.pay_qr)}"` : 'hidden'} alt="QR de pago actual"></div></div><button class="btn primary" id="sGo">Guardar ajustes</button></form>`;
      const val = liveValidate($('#setf'), { sName: x => x.trim().length >= 2 ? '' : 'Escribe el nombre.', sWa: x => /^\d{8,15}$/.test(x) ? '' : 'Solo dígitos con código de país (59171234567).', sAddr: x => x.trim().length >= 4 ? '' : 'Escribe la dirección.', sHold: x => x.trim().length >= 2 ? '' : 'Escribe el titular.' });
      $('#sQr').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { qr = await P.imageToData(f, 480, 'image/png'); const im = $('#qrPrev'); im.src = qr; im.hidden = false; } catch (er) { qr = null; e.target.value = ''; toast(er.message, 'err'); } };
      $('#setf').onsubmit = async e => { e.preventDefault(); if (!val()) return; const b = $('#sGo'); btnBusy(b, true); const { error } = await sb.rpc('admin_save_settings', { p_name: $('#sName').value.trim(), p_whatsapp: $('#sWa').value, p_address: $('#sAddr').value.trim(), p_holder: $('#sHold').value.trim(), p_note: $('#sNote').value.trim(), p_qr: qr }); btnBusy(b, false); if (error) return toast(errMsg(error), 'err'); P._set = null; toast('Ajustes guardados.'); };
    }
    m.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { tab = b.dataset.tab; return draw(); }
      if (b.dataset.lf) { lf = b.dataset.lf; lmax = 25; return draw(); }
      if (b.hasAttribute('data-more')) { lmax += 25; return draw(); }
      if (b.dataset.save) { const id = b.dataset.save, price = $('#pr-' + id), act = $('#ac-' + id), vid = $('#vd-' + id); if (!setField(price, price.value.trim().length >= 2 ? '' : 'Escribe el precio.')) return; if (!setField(vid, !vid.value || /^https:\/\//.test(vid.value.trim()) ? '' : 'El enlace debe empezar con https://')) return; btnBusy(b, true); let { error } = await sb.rpc('admin_set_service', { p_id: id, p_active: act.checked, p_price_label: price.value.trim() }); if (!error) ({ error } = await sb.rpc('admin_set_video', { p_id: id, p_url: vid.value.trim() })); btnBusy(b, false); if (error) return toast(errMsg(error), 'err'); S.services = []; toast('Servicio actualizado.'); return draw(); }
      if (b.dataset.role) { const id = b.dataset.role; btnBusy(b, true); const { error } = await sb.rpc('admin_set_role', { p_user: id, p_role: $('#rl-' + id).value }); btnBusy(b, false); if (error) return toast(errMsg(error), 'err'); toast('Rol actualizado.'); return draw(); }
      if (b.id === 'mkCode') { btnBusy(b, true); const { data, error } = await sb.rpc('admin_create_code', { p_code: null }); btnBusy(b, false); if (error) return toast(errMsg(error), 'err'); $('#codeOut').textContent = data; P.confetti(10); try { await navigator.clipboard.writeText(data); toast('Código copiado: ' + data); } catch (_) { toast('Código: ' + data); } }
    };
    draw();
  }

  const VIEWS = { inicio: vInicio, mascotas: vMascotas, reservar: vReservar, turnos: vTurnos, historial: vHistorial, servicios: vServicios, personal: vPersonal, admin: vAdmin, perfil: vPerfil };
  try { await loadProfile(); } catch (e) { $('#main').innerHTML = `<div class="view">${empty('No se pudo cargar tu perfil. ' + esc(errMsg(e)), '<button class="btn primary" onclick="location.reload()">Reintentar</button>')}</div>`; return; }
  buildNav(); go(location.hash.slice(1) || 'inicio');
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ['turnos', 'personal', 'inicio'].includes(current) && navigator.onLine && !$('.modal-bg')) refresh(); });
})();
