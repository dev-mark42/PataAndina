/* Catálogo reutilizable (invitado y app): 3 grupos + Top 10, tarjetas grandes con foto y ficha con fotos/video (hidratación bajo demanda). */
(function () {
  'use strict';
  const P = window.Pata, esc = P.esc;
  const GROUPS = [
    { k: 'salud', t: 'Consultas y prevención', d: 'Chequeos, vacunas y cuidado diario' },
    { k: 'cirugia', t: 'Cirugía y procedimientos', d: 'Castración, dental, curaciones y cirugías' },
    { k: 'diagnostico', t: 'Diagnóstico y bienestar', d: 'Laboratorio, imágenes, nutrición y baño' }];
  const FB = { esterilizacion: ['cirugia', 100], 'vacuna-canina': ['salud', 98], 'vacuna-felina': ['salud', 96], 'consulta-general': ['salud', 94], desparasitacion: ['salud', 90], 'profilaxis-dental': ['cirugia', 86], 'consulta-felina': ['salud', 84], 'control-cachorro': ['salud', 80], laboratorio: ['diagnostico', 76], peluqueria: ['diagnostico', 72], imagenologia: ['diagnostico', 66], microchip: ['salud', 62], nutricion: ['diagnostico', 58], curaciones: ['cirugia', 54], cirugia: ['cirugia', 50], 'consulta-domicilio': ['salud', 46] };
  const grp = s => s.grp || (FB[s.id] || ['salud'])[0], pop = s => s.popularity || (FB[s.id] || [0, 0])[1];
  const top = (list, n = 10) => list.filter(s => s.active !== false).sort((a, b) => pop(b) - pop(a)).slice(0, n);
  const inGroup = (list, k) => list.filter(s => s.active !== false && grp(s) === k).sort((a, b) => pop(b) - pop(a));
  const yt = u => { const m = String(u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/); return m && m[1]; };
  const video = (s, md) => { const v = s.video_url, id = yt(v);
    if (id) return `<div class="vwrap"><span class="vtag">Video</span><iframe loading="lazy" title="Video: ${esc(s.name)}" src="https://www.youtube-nocookie.com/embed/${id}" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
    const src = v && /^https:\/\/.+\.(mp4|webm)(\?.*)?$/i.test(v) ? v : (md && md.video); if (!src) return '';
    return `<div class="vwrap"><span class="vtag">Video del proceso</span><video controls preload="none" playsinline poster="${esc((md && md.poster) || '')}" src="${esc(src)}" aria-label="Video: ${esc(s.name)}"></video></div>`; };
  const gallery = (md) => !md ? '' : `<div class="gallery">${md.photos.map((f, i) => `<figure data-zoom="${esc(f.src)}" data-cap="${esc(f.cap)}" tabindex="0" role="button" aria-label="Ampliar foto ${i + 1}: ${esc(f.cap)}"><img data-src="${esc(f.src)}" alt="${esc(f.alt)}" width="640" height="420"><figcaption>${i + 1}. ${esc(f.cap)}</figcaption></figure>`).join('')}</div>`;
  const card = (s, md, rank) => `<button class="svc" data-svc="${esc(s.id)}" type="button" aria-label="${esc(s.name)}: ver fotos, video y detalles">
    <img ${rank && rank > 4 ? 'loading="lazy"' : 'loading="lazy"'} src="${esc((md && md.poster) || './imagenes/' + (s.icon || 'consulta') + '.svg')}" alt="" width="640" height="360">
    ${rank ? `<span class="rank">${rank}</span>` : ''}<span class="svc-body"><b>${esc(s.name)}</b><small>${esc(s.price_label)} · ${s.duration_min} min</small></span></button>`;
  /* Ficha completa: se arma SOLO cuando el usuario la abre (hidratación diferida) */
  function sheet(s, md, bookLabel) {
    return `<h2>${esc(s.name)}</h2>${s.tag ? `<span class="tag">${esc(s.tag)}</span>` : ''}<p style="margin:.5rem 0">${esc(s.description)}</p><p class="hint">${esc(s.details || '')}</p>
      <dl class="kv" style="margin:.6rem 0"><dt>Precio</dt><dd>${esc(s.price_label)}</dd><dt>Duración</dt><dd>${s.duration_min} min</dd><dt>Para</dt><dd>${esc(s.species || 'Todas')}</dd></dl>
      <b>El proceso, paso a paso</b><div class="svc-media">${gallery(md)}${video(s, md)}</div>
      <div class="actions"><button class="btn primary" data-book="${esc(s.id)}">${esc(bookLabel || 'Reservar este servicio')}</button><button class="btn ghost" data-close>Cerrar</button></div>`;
  }
  /* Vista con pestañas: Top 10 + 3 grupos */
  function view(list, media, state) {
    const tabs = [{ k: 'top', t: 'Top 10' }, ...GROUPS.map(g => ({ k: g.k, t: g.t }))];
    const cur = state.tab || 'top', items = cur === 'top' ? top(list) : inGroup(list, cur), g = GROUPS.find(x => x.k === cur);
    return `<div class="chips" role="tablist" aria-label="Categorías">${tabs.map(t => `<button class="chip ${cur === t.k ? 'active' : ''}" role="tab" aria-selected="${cur === t.k}" data-ctab="${t.k}">${esc(t.t)}</button>`).join('')}</div>
      <p class="hint" style="margin-bottom:.6rem">${cur === 'top' ? 'Los 10 servicios más buscados y necesitados. Toca uno para ver fotos y video.' : esc(g.d)}</p>
      <div class="svc-grid" data-reveal>${items.map((s, i) => card(s, media[s.id], cur === 'top' ? i + 1 : 0)).join('') || '<p class="empty">Sin servicios.</p>'}</div>`;
  }
  /* Enlaza clics (delegación): pestañas y tarjetas */
  function bind(root, ctx) {
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-ctab]'); if (t) { ctx.state.tab = t.dataset.ctab; ctx.redraw(); return; }
      const c = e.target.closest('.svc'); if (!c) return; const s = ctx.list().find(x => x.id === c.dataset.svc); if (!s) return;
      P.modal(sheet(s, ctx.media()[s.id], ctx.bookLabel), (m, close) => { P.lazyScan(m); m.querySelector('[data-book]').onclick = () => { close(); ctx.onBook(s); }; });
    });
  }
  window.Catalog = { GROUPS, grp, pop, top, inGroup, card, sheet, view, bind, video, gallery };
  document.addEventListener('click', e => { const f = e.target.closest('[data-zoom]'); if (f) P.modal(`<div class="lightbox"><img src="${esc(f.dataset.zoom)}" alt="${esc(f.dataset.cap)}"><p style="margin:.6rem 0"><b>${esc(f.dataset.cap)}</b></p><div class="actions"><button class="btn primary" data-close>Cerrar</button></div></div>`); });
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-zoom]')) { e.preventDefault(); e.target.click(); } });
})();
