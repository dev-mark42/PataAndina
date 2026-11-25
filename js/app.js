/* Pata Andina Vet · aplicación principal (SPA con Supabase). */
(async function () {
  'use strict';
  const P = Pata, { $, $$, esc, v, toast, errMsg, btnBusy, fmtDate, fmtTime, fmtDay, todayLP, addDays, toISO, liveValidate, setField } = P;
  if (!P.configured) return location.replace('./index.html');
  const sb = P.sb;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return location.replace('./index.html');
  const uid = session.user.id;
  sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') location.replace('./index.html'); });
  P.initTheme($('#themeBtn')); P.initPWA($('#installBtn')); P.initNet($('#net'));
  // Avances de presentación: se desbloquean con ocho toques al logotipo.
  let logoTaps = 0, logoReset = null;
  const logo = $('#brandLogo');
  if (logo) logo.addEventListener('click', () => {
    logoTaps++; clearTimeout(logoReset);
    logoReset = setTimeout(() => { logoTaps = 0; }, 2600);
    if (logoTaps === 7) P.toast('Un toque más para abrir los avances de las 3 semanas.');
    if (logoTaps === 8) {
      logoTaps = 0;
      P.modal(`<div class="advances-modal"><div class="advances-head"><span class="eyebrow">PRESENTACIÓN DEL PROYECTO</span><h2>🐾 Avances de Pata Andina</h2><p>Resumen organizado por las tres semanas de desarrollo.</p></div><div class="adv-tabs" role="tablist"><button class="chip active" data-adv-tab="1">Semana 1</button><button class="chip" data-adv-tab="2">Semana 2</button><button class="chip" data-adv-tab="3">Semana 3</button></div><div class="adv-scroll" id="advContent"><section class="adv-week"><span class="badge">SEMANA 1</span><h3>Base y experiencia visual</h3><ul><li>Identidad visual Pata Andina, paleta verde, crema y terracota.</li><li>Login, registro, recuperación y validaciones de formularios.</li><li>Diseño adaptable, tema claro/oscuro y animaciones.</li><li>Configuración PWA, iconos y caché inicial.</li></ul></section></div><div class="actions"><button class="btn primary" data-close>Continuar</button></div></div>`, modal => {
        const data = {
          1: ['Base y experiencia visual', ['Identidad visual Pata Andina, paleta verde, crema y terracota.','Login, registro, recuperación y validaciones de formularios.','Diseño adaptable, tema claro/oscuro y animaciones.','Configuración PWA, iconos y caché inicial.']],
          2: ['Funciones veterinarias', ['Perfiles de tutores y gestión de mascotas.','Catálogo de servicios, especialidades y fichas informativas.','Reserva de citas por mascota, servicio, fecha y horario.','Mis citas, estados, cancelaciones e historial médico.']],
          3: ['Integración y presentación', ['Panel del personal y registro de atenciones.','Seguridad por roles y políticas RLS de Supabase.','Navegación por subdivisiones, menú móvil y cierre de sesión.','Pruebas de interfaz, galería de servicios y ajustes PWA.']]
        };
        modal.addEventListener('click', ev => { const b=ev.target.closest('[data-adv-tab]'); if(!b)return; modal.querySelectorAll('[data-adv-tab]').forEach(x=>x.classList.toggle('active',x===b)); const [title,items]=data[b.dataset.advTab]; modal.querySelector('#advContent').innerHTML=`<section class="adv-week"><span class="badge">SEMANA ${b.dataset.advTab}</span><h3>${title}</h3><ul>${items.map(x=>`<li>${x}</li>`).join('')}</ul></section>`; });
      });
    }
  });
  P.onNet = on => { let b = $('#offBar'); if (!on && !b) { b = document.createElement('div'); b.id = 'offBar'; b.className = 'offline-bar'; b.textContent = 'Sin conexión: puedes ver datos guardados, pero no reservar ni editar.'; $('#main').prepend(b); } if (on && b) b.remove(); };

  const CATS = { consulta: 'Consultas', prevencion: 'Prevención', procedimientos: 'Procedimientos', diagnostico: 'Diagnóstico', bienestar: 'Bienestar' };
  const ST = { pendiente: 'Pendiente', confirmada: 'Confirmada', completada: 'Completada', cancelada: 'Cancelada', rechazada: 'Rechazada' };
  const SPECIES = { perro: '🐶 Perro', gato: '🐱 Gato', otro: '🐾 Otro' };
  const S = { profile: null, pets: [], appts: [], services: [], staff: false };
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
  const loadProfile = async () => { S.profile = await q('profile', () => sb.from('profiles').select('*').eq('id', uid).single()); S.staff = S.profile.role === 'staff'; };
  const loadPets = async () => { S.pets = await q('pets', () => sb.from('pets').select('*').eq('owner_id', uid).order('created_at')); };
  const loadAppts = async () => { S.appts = await q('appts', () => sb.from('appointment_requests').select('*, pet:pets(name,species), service:services_catalog(name,duration_min,price_label,icon)').eq('owner_id', uid).order('starts_at', { ascending: false })); };
  const loadServices = async () => { S.services = await q('services', () => sb.from('services_catalog').select('*').order('sort_order')); };
  const active = a => ['pendiente', 'confirmada'].includes(a.status) && new Date(a.ends_at) > new Date();

  /* ---------- Navegación ---------- */
  const NAV = [
    { id: 'inicio', t: 'Inicio', e: '🏠', group: 'Principal' },
    { id: 'servicios', t: 'Catálogo y especialidades', e: '🩺', group: 'Principal' },
    { id: 'mascotas', t: 'Mis mascotas', e: '🐾', group: 'Mis mascotas' },
    { id: 'historial', t: 'Historial médico', e: '📋', group: 'Mis mascotas' },
    { id: 'reservar', t: 'Solicitar cita', e: '📅', group: 'Citas' },
    { id: 'turnos', t: 'Mis citas', e: '🗓️', group: 'Citas' },
    { id: 'personal', t: 'Panel veterinario', e: '🩺', group: 'Clínica', staff: true },
    { id: 'perfil', t: 'Mi perfil', e: '👤', group: 'Cuenta' }
  ];
  const DOCK = ['inicio', 'servicios', 'mascotas', 'reservar'];
  let current = '', arg = null;
  const closeSide = () => { document.body.classList.remove('menu-open'); $('#side')?.classList.remove('is-open'); $('#menuBtn')?.setAttribute('aria-expanded','false'); };
  const openSide = () => { document.body.classList.add('menu-open'); $('#side')?.classList.add('is-open'); $('#menuBtn')?.setAttribute('aria-expanded','true'); };
  $('#menuBtn')?.addEventListener('click', () => document.body.classList.contains('menu-open') ? closeSide() : openSide());
  $('#sideClose')?.addEventListener('click', closeSide);
  $('#sideBackdrop')?.addEventListener('click', closeSide);
  document.addEventListener('keydown', e => { if(e.key==='Escape') closeSide(); });
  function buildNav() {
    const items = NAV.filter(n => !n.staff || S.staff);
    const btn = n => `<button class="nav-btn" data-nav="${n.id}"><span class="e">${n.e}</span><span>${n.t}</span></button>`;
    const groups = [...new Set(items.map(n=>n.group))];
    const sideGroups = groups.map((g,i)=>`<details class="navgrp" ${i<2?'open':''}><summary>${g}</summary>${items.filter(n=>n.group===g).map(btn).join('')}</details>`).join('');
    $('#side').innerHTML = `<div class="side-head"><div><b>PATA ANDINA</b><small>Menú de tu cuenta</small></div><button class="side-close" id="sideClose" type="button" aria-label="Cerrar menú">×</button></div>${sideGroups}<div class="who"><span class="who-avatar">${esc((S.profile.full_name||'U').slice(0,1).toUpperCase())}</span><span><b>${esc(S.profile.full_name)}</b><small>${S.staff?'Personal veterinario':'Cuenta de cliente'}</small></span></div><button class="nav-btn side-logout" data-logout><span class="e">⎋</span><span>Cerrar sesión</span></button>`;
    $('#sideClose')?.addEventListener('click', closeSide);
    $('#dock').innerHTML = items.filter(n => DOCK.includes(n.id)).map(btn).join('') + `<button class="nav-btn" data-nav="__more"><span class="e">⋯</span><span>Más</span></button>`;
  }
  document.addEventListener('click', e => {
    const n = e.target.closest('[data-nav]'); if (!n) return; const id = n.dataset.nav;
    $('.sheet') && $('.sheet').remove();
    if (id === '__more') return moreSheet();
    closeSide(); go(id);
  });
  function moreSheet() {
    const items = NAV.filter(n => (!n.staff || S.staff) && !DOCK.includes(n.id));
    const s = document.createElement('div'); s.className = 'sheet';
    s.innerHTML = `<div class="sheet__t">OTRAS SECCIONES</div><div class="sheet__g">${items.map(n => `<button class="btn block" data-nav="${n.id}">${n.e} ${n.t}</button>`).join('')}</div><button class="btn ghost block" data-logout>⎋ Cerrar sesión</button>`;
    document.body.appendChild(s); setTimeout(() => document.addEventListener('click', function f(ev) { if (!s.contains(ev.target)) { s.remove(); document.removeEventListener('click', f); } }), 0);
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-logout]') || e.target.closest('#logoutTop')) logout(); });
  async function logout() { if (!await P.confirm('¿Cerrar sesión?', 'Se cerrará esta sesión en este dispositivo.', 'Cerrar sesión')) return; P.cache.clear(); try { const { error } = await sb.auth.signOut({ scope: 'local' }); if (error) console.warn('Supabase signOut:', error.message); } catch (e) { console.warn('Logout:', e); } finally { try { Object.keys(localStorage).filter(k=>k.startsWith('sb-') || k.startsWith('pata:')).forEach(k=>localStorage.removeItem(k)); } catch (_) {} location.replace('./index.html'); } }
  async function go(id, a) {
    if (!NAV.some(n => n.id === id && (!n.staff || S.staff))) id = 'inicio';
    current = id; arg = a || null; if (location.hash !== '#' + id) history.pushState(null, '', '#' + id);
    $$('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === id));
    const m = $('#main'); m.innerHTML = skeleton(); m.scrollTo(0, 0);
    try { await VIEWS[id](m); } catch (e) { console.error(e); m.innerHTML = `<div class="view">${empty('No se pudo cargar esta sección. ' + esc(errMsg(e)), '<button class="btn primary" data-nav="' + id + '">Reintentar</button>')}</div>`; }
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
  async function vInicio(m) {
    await Promise.all([loadPets(), loadAppts(), loadServices()]);
    const h = hourLP(), hi = h < 12 ? '¡Buenos días' : h < 19 ? '¡Buenas tardes' : '¡Buenas noches';
    const upcoming = S.appts.filter(active).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
    const nxt = upcoming[0], done = S.appts.filter(a=>a.status==='completada').length;
    const top = S.services.filter(x=>x.active!==false).slice().sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).slice(0,10);
    const cats = [['todas','Todo'],...Object.entries(CATS)];
    const topCards = list => list.map(s=>`<article class="home-service"><span class="home-service-ico"><img src="./imagenes/${esc(s.icon||'consulta')}.svg" alt="" loading="lazy"></span><div class="home-service-copy"><span class="tag">${esc(CATS[s.category]||s.category)}</span><b>${esc(s.name)}</b><small>${esc(s.price_label)} · ${s.duration_min} min</small></div><button class="icon-btn home-book" data-home-book="${esc(s.id)}" aria-label="Reservar ${esc(s.name)}">＋</button></article>`).join('');
    m.innerHTML = `<div class="view client-home">
      <div class="home-subnav" role="tablist" aria-label="Secciones de inicio"><button class="chip active" data-home-panel="resumen">Resumen</button><button class="chip" data-home-panel="top">Top 10 servicios</button><button class="chip" data-home-panel="espacio">Mi espacio</button><button class="chip" data-home-panel="consejos">Consejos</button></div>
      <section class="home-panel active" data-panel="resumen"><div class="greeting"><div><span class="eyebrow">PATA ANDINA VET</span><h2>${hi}, ${esc((S.profile.full_name||'').split(' ')[0])}!</h2><p>${S.pets.length?'Un cuidado especial para '+S.pets.map(p=>esc(p.name)).join(', ')+'.':'Registra a tu primera mascota y empieza su cuidado.'}</p><div class="actions"><button class="btn accent" data-nav="reservar">＋ Solicitar cita</button><button class="btn ghost hero-ghost" data-nav="mascotas">Mis mascotas</button></div></div><div class="pw bob">${S.pets[0]?ART.forSpecies(S.pets[0].species):ART.cat()}</div></div>
      <div class="cols3 home-stats"><div class="card stat"><b>${S.pets.length}</b><span>Mascotas</span></div><div class="card stat"><b>${upcoming.length}</b><span>Citas activas</span></div><div class="card stat"><b>${done}</b><span>Atenciones</span></div></div>
      <div class="home-two"><article class="card home-next"><span class="eyebrow">AGENDA</span><h3>📅 Próxima cita</h3>${nxt?`<dl class="kv"><dt>Servicio</dt><dd>${esc(nxt.service?.name||'—')}</dd><dt>Mascota</dt><dd>${esc(nxt.pet?.name||'—')}</dd><dt>Cuándo</dt><dd>${fmtDate(nxt.starts_at)} · ${fmtTime(nxt.starts_at)}</dd><dt>Estado</dt><dd>${badge(nxt.status)}</dd></dl><button class="btn sm" data-nav="turnos">Ver mis citas</button>`:`<p class="hint">Todavía no tienes citas próximas.</p><button class="btn sm accent" data-nav="reservar">Elegir horario</button>`}</article><article class="card"><span class="eyebrow">ACCESOS RÁPIDOS</span><h3>Tu espacio</h3><div class="quick-links"><button class="quick-link" data-nav="mascotas"><span>🐾</span><b>Mascotas</b><small>Perfiles</small></button><button class="quick-link" data-nav="historial"><span>🩺</span><b>Historial</b><small>Controles</small></button><button class="quick-link" data-nav="turnos"><span>🗓️</span><b>Citas</b><small>Seguimiento</small></button></div></article></div></section>
      <section class="home-panel" data-panel="top" hidden><div class="section-head compact"><div><span class="eyebrow">RECOMENDADOS</span><h2>Top 10 servicios</h2><p>Elige una especialidad o explora los más solicitados.</p></div><button class="btn ghost sm" data-nav="servicios">Catálogo completo →</button></div><div class="chips home-cats" id="homeCats">${cats.map(([k,l],i)=>`<button class="chip ${i===0?'active':''}" data-home-cat="${k}">${l}</button>`).join('')}</div><div class="home-service-grid" id="homeTop">${topCards(top)}</div></section>
      <section class="home-panel" data-panel="espacio" hidden><div class="section-head compact"><div><span class="eyebrow">TUS MASCOTAS</span><h2>Mi espacio</h2><p>Accede a la información importante sin recorrer una página larga.</p></div><button class="btn primary sm" data-nav="mascotas">Gestionar mascotas</button></div><div class="pet-mini-grid">${S.pets.slice(0,6).map(p=>`<button class="pet-mini card" data-open-pet="${p.id}"><span>${p.species==='gato'?'🐱':p.species==='perro'?'🐶':'🐾'}</span><b>${esc(p.name)}</b><small>${esc(p.breed||p.species)}</small></button>`).join('')||'<p class="hint">Todavía no tienes mascotas registradas.</p>'}</div><div class="quick-links"><button class="quick-link" data-nav="historial"><span>🩺</span><b>Historial médico</b><small>Diagnósticos y controles</small></button><button class="quick-link" data-nav="turnos"><span>🗓️</span><b>Mis citas</b><small>Estados y horarios</small></button><button class="quick-link" data-nav="perfil"><span>👤</span><b>Mi perfil</b><small>Datos de cuenta</small></button></div></section>
      <section class="home-panel" data-panel="consejos" hidden><div class="section-head compact"><div><span class="eyebrow">BIENESTAR</span><h2>Consejos veterinarios</h2><p>Pequeños cuidados, grandes cambios.</p></div></div><div class="tip-row">${TIPS.map(t=>`<article class="tip-card"><span>${t[0]}</span><b>${t[1]}</b><small>${t[2]}</small></article>`).join('')}</div></section>
    </div>`;
    const showPanel = id => { $$('.home-panel',m).forEach(x=>{x.hidden=x.dataset.panel!==id;x.classList.toggle('active',!x.hidden);}); $$('[data-home-panel]',m).forEach(x=>x.classList.toggle('active',x.dataset.homePanel===id)); };
    m.addEventListener('click',e=>{const t=e.target.closest('[data-home-panel]');if(t)showPanel(t.dataset.homePanel);const b=e.target.closest('[data-home-cat]');if(b){$$('[data-home-cat]',m).forEach(x=>x.classList.toggle('active',x===b));const filtered=b.dataset.homeCat==='todas'?top:top.filter(x=>x.category===b.dataset.homeCat);$('#homeTop',m).innerHTML=topCards(filtered)||'<p class="hint">No hay servicios en esta especialidad.</p>';}});
    $('#homeTop',m)?.addEventListener('click',e=>{const b=e.target.closest('[data-home-book]');if(b)go('reservar',{service:b.dataset.homeBook});});
    m.addEventListener('click',e=>{const p=e.target.closest('[data-open-pet]');if(p)go('mascotas');});
  }

  /* ======================= MASCOTAS ======================= */
  async function vMascotas(m) {
    await loadPets();
    m.innerHTML = `<div class="view"><h2>Mis mascotas</h2><p class="lead">Toca una mascota para ver sus datos y opciones.</p>
      <button class="btn primary" id="addPet" style="margin-bottom:1rem">＋ Agregar mascota</button>
      <div data-group="1">${S.pets.map(p => `<div class="acc" data-pet="${p.id}"><button class="acc-head" aria-expanded="false">${petIco(p)}<span class="grow"><b>${esc(p.name)}</b><span class="sub">${esc(SPECIES[p.species])}${p.breed ? ' · ' + esc(p.breed) : ''}${p.birth_date ? ' · ' + P.age(p.birth_date) : ''}</span></span></button>
        <div class="acc-body"><div class="acc-in"><div class="acc-pad"><dl class="kv"><dt>Sexo</dt><dd>${esc(p.sex || '—')}</dd><dt>Nacimiento</dt><dd>${p.birth_date ? fmtDay(p.birth_date) : '—'}</dd><dt>Peso</dt><dd>${p.weight_kg ? p.weight_kg + ' kg' : '—'}</dd><dt>Notas</dt><dd>${esc(p.notes || '—')}</dd></dl>
        <div class="actions"><button class="btn sm primary" data-book="${p.id}">📅 Reservar</button><button class="btn sm" data-hist="${p.id}">📋 Historial</button><button class="btn sm" data-edit="${p.id}">✏️ Editar</button><button class="btn sm danger" data-del="${p.id}">🗑️ Eliminar</button></div></div></div></div></div>`).join('')}</div>
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
    await Promise.all([loadPets(), loadServices()]);
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
    const groups = {}; S.services.forEach(s => (groups[s.category] = groups[s.category] || []).push(s));
    const selCat = (S.services.find(s => s.id === W.service) || {}).category;
    return `<div class="field"><label for="svcSearch">Buscar servicio</label><input id="svcSearch" type="search" placeholder="Vacuna, dental, baño…"></div>
      <div id="svcGroups" data-group="1">${Object.entries(groups).map(([c, list]) => `<div class="acc ${c === selCat ? 'open' : ''}" data-cat="${c}"><button class="acc-head" aria-expanded="${c === selCat}"><span class="grow"><b>${CATS[c] || c}</b><span class="sub">${list.length} servicios</span></span></button><div class="acc-body"><div class="acc-in"><div class="acc-pad">${list.map(svcRow).join('')}</div></div></div></div>`).join('')}</div>${nav(!!W.service)}`;
  }
  function stepDate() {
    const svc = S.services.find(s => s.id === W.service);
    const quick = []; for (let i = 0; quick.length < 6 && i < 14; i++) { const d = addDays(todayLP(), i); if (P.dow(d) !== 0) quick.push(d); }
    return `<div class="card" style="margin-bottom:.8rem"><small>${esc(svc.name)} · ${svc.duration_min} min · Lun–Sáb 09:00–13:00 y 14:00–18:00</small></div>
      <div class="chips">${quick.map(d => `<button class="chip ${W.date === d ? 'active' : ''}" data-day="${d}">${fmtDay(d).replace(/ \d{4}$/, '')}</button>`).join('')}</div>
      <div class="field"><label for="wDate">…o elige otra fecha</label><input id="wDate" type="date" min="${todayLP()}" max="${addDays(todayLP(), 90)}" value="${W.date}"></div>
      <div id="slots" data-group="">${W.date ? '<div class="skeleton"></div>' : '<p class="hint">Elige una fecha para ver los horarios.</p>'}</div>${nav(!!W.time)}`;
  }
  function stepConfirm() {
    const p = S.pets.find(x => x.id === W.pet), s = S.services.find(x => x.id === W.service), at = toISO(W.date, W.time);
    return `<div class="card"><dl class="kv"><dt>Mascota</dt><dd>${esc(p.name)}</dd><dt>Servicio</dt><dd>${esc(s.name)}</dd><dt>Fecha</dt><dd>${fmtDate(at)}</dd><dt>Hora</dt><dd>${fmtTime(at)} (${s.duration_min} min)</dd><dt>Precio</dt><dd>${esc(s.price_label)}</dd></dl></div><br>
      <div class="field"><label for="wNote">Comentarios para el veterinario (opcional)</label><textarea id="wNote" rows="2" maxlength="300">${esc(W.note)}</textarea></div>
      <label class="check"><input type="checkbox" id="wOk"><span>Entiendo que la cita queda <b>pendiente</b> hasta que la clínica la confirme.</span></label>
      <div class="wiz-nav"><button class="btn ghost" data-back>← Atrás</button><button class="btn accent" id="wGo">Solicitar cita 🐾</button></div>`;
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
    const blocks = [['09:00', '13:00', '☀️ Mañana'], ['14:00', '18:00', '🌤️ Tarde']], tm = t => +t.slice(0, 2) * 60 + +t.slice(3);
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
  async function vTurnos(m) {
    await loadAppts(); draw();
    function draw() {
      const list = S.appts.filter(AF[tf]).sort((a, b) => tf === 'activas' ? new Date(a.starts_at) - new Date(b.starts_at) : new Date(b.starts_at) - new Date(a.starts_at));
      m.innerHTML = `<div class="view"><h2>Mis citas</h2><p class="lead">Toca una cita para ver el detalle.</p>
        <div class="chips">${[['activas', 'Próximas'], ['pendiente', 'Pendientes'], ['confirmada', 'Confirmadas'], ['completada', 'Atendidas'], ['cerradas', 'Canceladas'], ['todas', 'Todas']].map(([k, l]) => `<button class="chip ${tf === k ? 'active' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
        <div data-group="1">${list.map(a => `<div class="acc"><button class="acc-head" aria-expanded="false"><span class="ico">${icoImg(a.service)}</span><span class="grow"><b>${esc(a.service.name)}</b> · ${esc(a.pet.name)}<span class="sub">${fmtDate(a.starts_at)} · ${fmtTime(a.starts_at)}</span></span>${badge(a.status)}</button>
          <div class="acc-body"><div class="acc-in"><div class="acc-pad"><dl class="kv"><dt>Duración</dt><dd>${a.service.duration_min} min</dd><dt>Precio</dt><dd>${esc(a.service.price_label)}</dd><dt>Tu nota</dt><dd>${esc(a.note || '—')}</dd><dt>Respuesta</dt><dd>${esc(a.staff_note || '—')}</dd></dl>
          ${active(a) ? `<div class="actions"><button class="btn sm danger" data-cancel="${a.id}">Cancelar cita</button></div>` : ''}</div></div></div></div>`).join('')}</div>
        ${list.length ? '' : empty('No hay citas en esta vista.', '<button class="btn accent" data-nav="reservar">Reservar cita</button>')}</div>`;
    }
    m.onclick = async e => {
      const f = e.target.closest('[data-f]'); if (f) { tf = f.dataset.f; return draw(); }
      const c = e.target.closest('[data-cancel]'); if (!c) return;
      if (!await P.confirm('¿Cancelar esta cita?', 'El horario quedará libre para otras familias.', 'Sí, cancelar', true)) return;
      btnBusy(c, true); const { error } = await sb.rpc('cancel_my_appointment', { p_id: c.dataset.cancel }); btnBusy(c, false);
      if (error) return toast(errMsg(error), 'err'); toast('Cita cancelada.'); await loadAppts(); draw();
    };
  }

  /* ======================= HISTORIAL ======================= */
  async function vHistorial(m) {
    await loadPets();
    if (!S.pets.length) { m.innerHTML = `<div class="view"><h2>Historial médico</h2>${empty('Registra una mascota para ver su historial.', '<button class="btn primary" data-nav="mascotas">Agregar mascota</button>')}</div>`; return; }
    let pid = (arg && arg.pet) || S.pets[0].id;
    async function draw() {
      m.innerHTML = `<div class="view"><h2>Historial médico</h2><div class="chips">${S.pets.map(p => `<button class="chip ${p.id === pid ? 'active' : ''}" data-p="${p.id}">${p.species === 'gato' ? '🐱' : p.species === 'perro' ? '🐶' : '🐾'} ${esc(p.name)}</button>`).join('')}</div><div id="recs">${skeleton(2)}</div></div>`;
      let recs; try { recs = await q('rec' + pid, () => sb.from('pet_medical_records').select('*').eq('pet_id', pid).order('visit_date', { ascending: false })); } catch (e) { if ($('#recs')) $('#recs').innerHTML = `<div class="notice bad">${esc(errMsg(e))}</div>`; return; }
      if (!$('#recs')) return;
      const next = recs.filter(r => r.next_visit && r.next_visit >= todayLP()).map(r => r.next_visit).sort()[0];
      $('#recs').innerHTML = (next ? `<div class="notice" style="background:var(--accent-soft)">🔔 <b>Próxima visita sugerida:</b> ${fmtDay(next)} <button class="btn sm accent" data-book="${pid}" style="margin-left:.5rem">Reservar</button></div>` : '') +
        `<div data-group="1">${recs.map((r, i) => `<div class="acc ${i === 0 ? 'open' : ''}"><button class="acc-head" aria-expanded="${i === 0}"><span class="ico">🩺</span><span class="grow"><b>${esc(r.diagnosis.slice(0, 60))}${r.diagnosis.length > 60 ? '…' : ''}</b><span class="sub">${fmtDay(r.visit_date)}</span></span></button>
        <div class="acc-body"><div class="acc-in"><div class="acc-pad"><dl class="kv"><dt>Diagnóstico</dt><dd>${esc(r.diagnosis)}</dd><dt>Tratamiento</dt><dd>${esc(r.treatment || '—')}</dd><dt>Receta</dt><dd>${esc(r.prescription || '—')}</dd><dt>Peso</dt><dd>${r.weight_kg ? r.weight_kg + ' kg' : '—'}</dd><dt>Próxima visita</dt><dd>${r.next_visit ? fmtDay(r.next_visit) : '—'}</dd></dl></div></div></div></div>`).join('')}</div>` +
        (recs.length ? '' : empty('Aún no hay atenciones registradas para esta mascota.'));
    }
    m.onclick = e => { const c = e.target.closest('[data-p]'); if (c) { pid = c.dataset.p; draw(); } const b = e.target.closest('[data-book]'); if (b) go('reservar', { pet: b.dataset.book }); };
    draw();
  }

  /* ======================= SERVICIOS ======================= */
  async function vServicios(m) {
    await loadServices(); let cat='todas', tab='svc', foods=null;
    const remotePhotos = [
      'https://rgs.veterian.com/uploads/blog/kopek_muayene_oluyor_kediyle_beraber_6a2053a7621c4.jpg',
      'https://img.bemypet.kr/content/sites/14/2025/09/25095949/image-28-1024x683.png',
      'https://dranimal.com/images/blog/o-que-e-avaliado-em-consulta-veterinaria-rotina-caes-gatos.jpg'
    ];
    const localPhotos = ['./imagenes/vet-consulta.webp','./imagenes/vet-evaluacion.webp','./imagenes/vet-diagnostico.webp','./imagenes/vet-cuidados.webp','./imagenes/vet-atencion-felina.webp','./imagenes/vet-portada.webp'];
    const photoSet = s => { const base=s.category==='diagnostico'?2:s.category==='bienestar'?3:s.category==='prevencion'?1:0; return [localPhotos[base],localPhotos[(base+1)%localPhotos.length],localPhotos[(base+2)%localPhotos.length]]; };
    function zoomPhoto(src,title){P.modal(`<div class="photo-viewer"><div class="section-head compact"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Cerrar">×</button></div><img src="${esc(src)}" alt="${esc(title)}" onerror="this.src='./imagenes/vet-consulta.webp'"><p class="hint">Vista ampliada · Pata Andina Vet</p></div>`);}
    function serviceCard(s){const photos=photoSet(s);return `<article class="service-card"><button class="service-photo" type="button" data-zoom="${esc(photos[0])}" data-title="${esc(s.name)}"><img src="${esc(photos[0])}" alt="${esc(s.name)}" loading="lazy" onerror="this.src='./imagenes/vet-consulta.webp'"><span>⌕ Ampliar</span></button><div class="service-gallery">${photos.map((src,i)=>`<button type="button" class="service-thumb" data-zoom="${esc(src)}" data-title="${esc(s.name)} · Foto ${i+1}" aria-label="Ampliar foto ${i+1} de ${esc(s.name)}"><img src="${esc(src)}" alt="Foto ${i+1}" loading="lazy" onerror="this.src='./imagenes/vet-consulta.webp'"></button>`).join('')}</div><div class="service-copy"><div class="service-meta"><span>${esc(CATS[s.category]||s.category)}</span><b>${esc(s.price_label)}</b></div><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><details><summary>Ver detalles y recomendaciones</summary><p>${esc(s.details||'La atención se define tras la evaluación veterinaria.')}</p><small>Dirigido a: ${esc(s.species||'Perros y gatos')} · ${s.duration_min} min</small></details><div class="actions"><button class="btn primary sm" data-book="${esc(s.id)}">Solicitar cita</button><button class="btn ghost sm" data-zoom="${esc(photos[0])}" data-title="${esc(s.name)}">Ver fotos</button></div></div></article>`;}
    async function draw(){if(tab==='food'&&!foods){try{foods=await(await fetch('./data/productos-gatos.json')).json();}catch(_){foods=[];}}const list=S.services.filter(s=>cat==='todas'||s.category===cat);m.innerHTML=`<div class="view"><div class="section-head compact"><div><span class="eyebrow">CATÁLOGO VETERINARIO</span><h2>Servicios y especialidades</h2><p>Explora cada servicio, revisa sus fotografías y consulta sus detalles.</p></div></div><div class="tabs"><button class="tab ${tab==='svc'?'active':''}" data-tab="svc">Servicios (${S.services.length})</button><button class="tab ${tab==='food'?'active':''}" data-tab="food">Nutrición y alimentos</button></div><div class="pane">${tab==='svc'?`<div class="chips service-filters">${['todas',...Object.keys(CATS)].map(c=>`<button class="chip ${cat===c?'active':''}" data-cat="${c}">${c==='todas'?'Todas las especialidades':CATS[c]}</button>`).join('')}</div><div class="service-grid">${list.map(serviceCard).join('')||empty('No hay servicios en esta especialidad.')}</div>`:`<div class="grid">${(foods||[]).map(f=>`<div class="acc"><button class="acc-head" aria-expanded="false"><span class="ico">🐱</span><span class="grow"><b>${esc(f.name)}</b><span class="sub">${esc(f.kind)}</span></span></button><div class="acc-body"><div class="acc-in"><div class="acc-pad"><p>${esc(f.description)}</p><p class="hint">💡 ${esc(f.guidance)}</p></div></div></div></div>`).join('')||empty('Catálogo no disponible sin conexión.')}</div>`}</div></div>`;}
    m.onclick=e=>{const t=e.target.closest('[data-tab]');if(t){tab=t.dataset.tab;return draw();}const c=e.target.closest('[data-cat]');if(c){cat=c.dataset.cat;return draw();}const z=e.target.closest('[data-zoom]');if(z){zoomPhoto(z.dataset.zoom,z.dataset.title||'Servicio veterinario');return;}const b=e.target.closest('[data-book]');if(b)go('reservar',{service:b.dataset.book});};draw();
  }

  /* ======================= PERSONAL ======================= */
  const staffAppt = '*, pet:pets(name,species), service:services_catalog(name,duration_min,icon), owner:profiles(full_name,phone)';
  async function vPersonal(m) {
    let tab = 'pend', af = 'hoy';
    async function draw() {
      m.innerHTML = `<div class="view"><h2>Panel del personal 🩺</h2><div class="tabs"><button class="tab ${tab === 'pend' ? 'active' : ''}" data-tab="pend">Pendientes</button><button class="tab ${tab === 'agenda' ? 'active' : ''}" data-tab="agenda">Agenda</button><button class="tab ${tab === 'att' ? 'active' : ''}" data-tab="att">Registrar atención</button></div><div class="pane" id="sp">${skeleton(2)}</div></div>`;
      try { await ({ pend: tPend, agenda: tAgenda, att: tAtt })[tab](); } catch (e) { const sp = $('#sp'); if (sp) sp.innerHTML = `<div class="notice bad">${esc(errMsg(e))}</div>`; }
    }
    const apptCard = (a, actions) => { a.pet = a.pet || { name: '—', species: 'otro' }; a.owner = a.owner || { full_name: '—' }; return `<div class="acc"><button class="acc-head" aria-expanded="false"><span class="ico">${icoImg(a.service)}</span><span class="grow"><b>${esc(a.service.name)}</b> · ${esc(a.pet.name)}<span class="sub">${fmtDate(a.starts_at)} · ${fmtTime(a.starts_at)}</span></span>${badge(a.status)}</button><div class="acc-body"><div class="acc-in"><div class="acc-pad"><dl class="kv"><dt>Tutor</dt><dd>${esc(a.owner.full_name)}</dd><dt>Celular</dt><dd>${a.owner.phone ? `<a href="tel:+591${esc(a.owner.phone)}">${esc(a.owner.phone)}</a> · <a href="https://wa.me/591${esc(a.owner.phone)}" target="_blank" rel="noopener">WhatsApp</a>` : '—'}</dd><dt>Nota</dt><dd>${esc(a.note || '—')}</dd></dl><div class="actions">${actions}</div></div></div></div></div>`; };
    async function tPend() {
      const r = await sb.from('appointment_requests').select(staffAppt).eq('status', 'pendiente').gte('ends_at', new Date().toISOString()).order('starts_at'); if (r.error) throw r.error;
      const sp = $('#sp'); if (!sp) return; sp.innerHTML = `<div data-group="1">${r.data.map(a => apptCard(a, `<button class="btn sm primary" data-ok="${a.id}">✔ Confirmar</button><button class="btn sm danger" data-no="${a.id}">✖ Rechazar</button>`)).join('')}</div>${r.data.length ? '' : empty('No hay solicitudes pendientes. ¡Todo al día! 🎉')}`;
    }
    async function tAgenda() {
      const t0 = new Date(toISO(todayLP(), '00:00')).toISOString(), t1 = new Date(toISO(af === 'hoy' ? addDays(todayLP(), 1) : af === 'semana' ? addDays(todayLP(), 7) : addDays(todayLP(), 120), '00:00')).toISOString();
      const r = await sb.from('appointment_requests').select(staffAppt).in('status', ['confirmada', 'completada']).gte('starts_at', t0).lt('starts_at', t1).order('starts_at'); if (r.error) throw r.error;
      const sp = $('#sp'); if (!sp) return; sp.innerHTML = `<div class="chips">${[['hoy', 'Hoy'], ['semana', '7 días'], ['todas', 'Todas']].map(([k, l]) => `<button class="chip ${af === k ? 'active' : ''}" data-af="${k}">${l}</button>`).join('')}</div><div data-group="1">${r.data.map(a => apptCard(a, a.status === 'confirmada' ? `<button class="btn sm primary" data-att="${a.id}" data-pet="${a.pet_id}">🩺 Atender y registrar</button>` : '<small>Atención registrada ✔</small>')).join('')}</div>${r.data.length ? '' : empty('No hay citas confirmadas en este rango.')}`;
      S._agenda = r.data;
    }
    async function tAtt() {
      const r = await sb.from('pets').select('id,name,species,breed,owner:profiles(full_name)').order('name'); if (r.error) throw r.error; S._allPets = r.data;
      const sp = $('#sp'); if (!sp) return; sp.innerHTML = `<div class="field"><label for="petQ">Buscar mascota o tutor</label><input id="petQ" type="search" placeholder="Luna, Pérez…"></div><div id="petList" data-group="1"></div>`;
      const paint = k => { const l = S._allPets.filter(p => !k || (p.name + ' ' + p.owner.full_name).toLowerCase().includes(k)); $('#petList').innerHTML = l.map(p => `<button class="pick" data-att="" data-pet="${p.id}">${petIco(p)}<span><b>${esc(p.name)}</b><br><small>${esc(p.owner.full_name)} · ${esc(SPECIES[p.species])}</small></span></button>`).join('') || empty('Sin resultados.'); };
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
      if (b.dataset.att !== undefined && b.dataset.pet) attentionForm({ pet: b.dataset.pet, appointment: b.dataset.att || null }, draw);
    };
    draw();
  }
  function attentionForm({ pet, appointment }, done) {
    P.modal(`<h2>Registrar atención 🩺</h2><form id="af" novalidate>
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
    m.innerHTML = `<div class="view"><h2>Mi perfil</h2><p class="lead">${esc(session.user.email)} · ${S.staff ? '🩺 Personal' : '🐾 Tutor'}</p><div data-group="1">
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

  const VIEWS = { inicio: vInicio, mascotas: vMascotas, reservar: vReservar, turnos: vTurnos, historial: vHistorial, servicios: vServicios, personal: vPersonal, perfil: vPerfil };
  try { await loadProfile(); } catch (e) { $('#main').innerHTML = `<div class="view">${empty('No se pudo cargar tu perfil. ' + esc(errMsg(e)), '<button class="btn primary" onclick="location.reload()">Reintentar</button>')}</div>`; return; }
  buildNav(); go(location.hash.slice(1) || 'inicio');
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ['turnos', 'personal', 'inicio'].includes(current) && navigator.onLine && !$('.modal-bg')) refresh(); });
})();
