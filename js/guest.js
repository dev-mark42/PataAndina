/* Modo invitado (acceso oculto): avances del curso, catálogo en vivo y accesos bloqueados.
   Sin sesión: la base de datos solo deja leer services_catalog (RLS); todo lo demás está bloqueado. */
(function () {
  'use strict';
  const P = Pata, { $, $$, esc, toast, errMsg } = P;
  let allowed = false; try { allowed = sessionStorage.getItem('pata-guest') === '1'; } catch (_) { }
  if (!allowed) return location.replace('./index.html');
  P.initTheme($('#themeBtn')); P.initPWA(null); P.initNet($('#net'));
  $('#exitBtn').onclick = () => { try { sessionStorage.removeItem('pata-guest'); } catch (_) { } location.replace('./index.html'); };

  const CATS = { consulta: 'Consultas', prevencion: 'Prevención', procedimientos: 'Procedimientos', diagnostico: 'Diagnóstico', bienestar: 'Bienestar' };
  const LOCKED = [
    ['Reservar citas', 'Necesita una cuenta para guardar la reserva a tu nombre.', 'appointment_requests'],
    ['Mascotas', 'Los datos de cada mascota son privados de su tutor.', 'pets'],
    ['Historial médico', 'Solo lo ven el tutor y el personal de la clínica.', 'pet_medical_records'],
    ['Perfil y contraseña', 'Pertenecen a una cuenta real.', 'profiles'],
    ['Panel del personal', 'Requiere una cuenta con rol de personal.', null]
  ];
  const S = { tab: 'curso', course: null, services: null, cat: 'todas', q: '', probe: null };
  const TABS = [['curso', 'Avances del curso'], ['servicios', 'Servicios'], ['bloqueado', 'Bloqueado']];

  async function curso() {
    if (!S.course) { const r = await fetch('./data/curso.json'); if (!r.ok) throw new Error('No se pudo cargar el curso.'); S.course = await r.json(); }
    const total = S.course.reduce((n, w) => n + w.temas.length, 0);
    const tema = t => `<div class="acc"><button class="acc-head" aria-expanded="false"><span class="grow"><b>${esc(t.t)}</b><span class="sub">${esc(t.id)}</span></span><span class="badge b-confirmada">Entregado</span></button><div class="acc-body"><div class="acc-in"><div class="acc-pad"><p>${esc(t.d)}</p>${t.demo ? `<div class="actions"><button class="btn sm primary" data-demo="${esc(t.demo)}">${esc(t.demoLabel)}</button></div><p class="hint" data-out="${esc(t.demo)}" style="margin-top:.5rem"></p>` : ''}</div></div></div></div>`;
    return `<div class="card" style="margin-bottom:1rem"><b>${total} de ${total} temas entregados</b><div class="bar"><i data-w="100"></i></div></div><div data-group="1">${S.course.map((w, i) => `<div class="acc ${i === 0 ? 'open' : ''}"><button class="acc-head" aria-expanded="${i === 0}"><span class="grow"><b>Semana ${w.semana} · ${esc(w.titulo)}</b><span class="sub">${w.temas.length} temas · 100 %</span></span></button><div class="acc-body"><div class="acc-in"><div class="acc-pad">${w.temas.map(tema).join('')}</div></div></div></div>`).join('')}</div>`;
  }

  async function servicios() {
    if (!S.services) {
      if (!P.sb) throw new Error('Falta configurar Supabase en js/config.js');
      const r = await P.sb.from('services_catalog').select('id,name,category,description,details,price_label,duration_min,tag,species,icon').order('sort_order');
      if (r.error) throw r.error; S.services = r.data;
    }
    const k = S.q.trim().toLowerCase(), list = S.services.filter(s => (S.cat === 'todas' || s.category === S.cat) && (!k || (s.name + ' ' + s.description).toLowerCase().includes(k)));
    return `<div class="field"><label for="gq">Buscar servicio</label><input id="gq" type="search" value="${esc(S.q)}" placeholder="Vacuna, dental, baño…"></div>
      <div class="chips">${['todas', ...Object.keys(CATS)].map(c => `<button class="chip ${S.cat === c ? 'active' : ''}" data-cat="${c}">${c === 'todas' ? 'Todos' : CATS[c]}</button>`).join('')}</div>
      <p class="hint" style="margin-bottom:.6rem">${list.length} de ${S.services.length} servicios · datos en vivo de la base de datos</p>
      <div class="grid">${list.map(s => `<div class="acc"><button class="acc-head" aria-expanded="false"><span class="ico"><img src="./imagenes/${esc(s.icon || 'consulta')}.svg" alt="" loading="lazy"></span><span class="grow"><b>${esc(s.name)}</b><span class="sub">${esc(s.price_label)} · ${s.duration_min} min</span></span></button><div class="acc-body"><div class="acc-in"><div class="acc-pad"><p>${esc(s.description)}</p><p class="hint" style="margin:.4rem 0">${esc(s.details || '')}</p><div class="actions"><button class="btn sm" data-locked="Reservar">Reservar (bloqueado)</button></div></div></div></div></div>`).join('')}</div>${list.length ? '' : '<p class="empty">Ningún servicio coincide con tu búsqueda.</p>'}`;
  }

  async function bloqueado() {
    if (!S.probe) S.probe = await Promise.all(LOCKED.map(async ([, , table]) => {
      if (!table) return 'Solo con rol de personal'; if (!P.sb) return 'Sin conexión a la base';
      try { const r = await P.sb.from(table).select('*').limit(1); return r.error ? 'Bloqueado por la base de datos' : (r.data && r.data.length ? 'ABIERTO: revisa las políticas RLS' : 'Bloqueado: 0 filas visibles'); } catch (_) { return 'Sin conexión'; }
    }));
    return `<p class="lead">Cada acceso se comprobó ahora mismo contra la base de datos con la clave pública, sin sesión.</p>${LOCKED.map(([t, why], i) => `<div class="card lockrow"><div><b>${esc(t)}</b><br><small>${esc(why)}</small></div><span class="badge b-cancelada">${esc(S.probe[i])}</span></div>`).join('')}<div class="actions"><a class="btn primary" href="./index.html">Crear cuenta o ingresar</a></div>`;
  }

  async function draw() {
    $('#gTabs').innerHTML = TABS.map(([k, l]) => `<button class="tab ${S.tab === k ? 'active' : ''}" role="tab" aria-selected="${S.tab === k}" data-tab="${k}">${l}</button>`).join('');
    const pane = $('#gPane'); if (!(S.tab === 'servicios' && S.services)) pane.innerHTML = '<div class="skeleton"></div>';
    try { pane.innerHTML = `<div class="pane">${await ({ curso, servicios, bloqueado })[S.tab]()}</div>`; }
    catch (e) { pane.innerHTML = `<div class="notice bad">${esc(errMsg(e))}</div>`; }
    $$('.bar i', pane).forEach(i => requestAnimationFrame(() => requestAnimationFrame(() => { i.style.width = i.dataset.w + '%'; })));
  }

  async function demo(k) {
    const out = $(`[data-out="${k}"]`);
    if (k === 'tema') { $('#themeBtn').click(); out.textContent = 'Tema actual: ' + (document.body.classList.contains('dark-theme') ? 'oscuro' : 'claro') + '. Se recuerda en este equipo.'; }
    else if (k === 'toast') { toast('Operación completada.'); setTimeout(() => toast('Ejemplo de error controlado.', 'err'), 600); }
    else if (k === 'filtro') { S.tab = 'servicios'; draw(); }
    else if (k === 'pwa') {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null, keys = window.caches ? await caches.keys() : [];
      out.textContent = `Service worker: ${reg ? 'registrado' : 'no registrado (requiere https o localhost)'} · Caché: ${keys.join(', ') || 'vacía'} · Conexión: ${navigator.onLine ? 'en línea' : 'sin conexión'}.`;
    }
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('#gTabs [data-tab]'); if (t) { S.tab = t.dataset.tab; return draw(); }
    const c = e.target.closest('[data-cat]'); if (c) { S.cat = c.dataset.cat; return draw(); }
    const l = e.target.closest('[data-locked]'); if (l) return toast(l.dataset.locked + ' está bloqueado en modo invitado. Crea una cuenta para usarlo.', 'err');
    const d = e.target.closest('[data-demo]'); if (d) demo(d.dataset.demo);
  });
  document.addEventListener('input', async e => {
    if (e.target.id !== 'gq') return; S.q = e.target.value; await draw();
    const i = $('#gq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  });
  draw();
})();
