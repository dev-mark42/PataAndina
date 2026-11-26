/* Panel de accesibilidad (semana 4): contraste claro/oscuro, tamaño de texto, sin movimiento, fuente legible, enlaces subrayados. */
(function () {
  'use strict';
  const KEY = 'pata-a11y', D = { c: 0, fs: 0, mo: 0, dys: 0, ul: 0 };
  let s = { ...D }; try { s = { ...D, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch (_) { }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) { } };
  function apply() {
    const b = document.body; if (!b) return;
    b.classList.toggle('hc-light', s.c === 1); b.classList.toggle('hc-dark', s.c === 2);
    b.classList.toggle('nomo', !!s.mo); b.classList.toggle('dys', !!s.dys); b.classList.toggle('ulinks', !!s.ul);
    document.documentElement.style.fontSize = (16 + s.fs * 2) + 'px';
    const p = document.getElementById('a11yPanel'); if (p) render(p);
  }
  const NAMES = ['Normal', 'Blanco y negro', 'Negro y amarillo'];
  function render(p) {
    p.innerHTML = `<h2>Accesibilidad</h2>
      <div class="a11y-row"><span>Contraste: <b>${NAMES[s.c]}</b></span><button class="btn sm" data-a="c" type="button">Cambiar</button></div>
      <div class="a11y-row"><span>Tamaño del texto</span><span><button class="btn sm" data-a="fs-" type="button" aria-label="Reducir texto">A−</button> <button class="btn sm" data-a="fs+" type="button" aria-label="Aumentar texto">A+</button></span></div>
      <div class="a11y-row"><span>Sin animaciones</span><button class="btn sm" data-a="mo" aria-pressed="${!!s.mo}" type="button">${s.mo ? 'Activado' : 'Desactivado'}</button></div>
      <div class="a11y-row"><span>Letra fácil de leer</span><button class="btn sm" data-a="dys" aria-pressed="${!!s.dys}" type="button">${s.dys ? 'Activada' : 'Desactivada'}</button></div>
      <div class="a11y-row"><span>Subrayar enlaces</span><button class="btn sm" data-a="ul" aria-pressed="${!!s.ul}" type="button">${s.ul ? 'Activado' : 'Desactivado'}</button></div>
      <div class="actions"><button class="btn sm ghost" data-a="reset" type="button">Restablecer</button><button class="btn sm primary" data-a="close" type="button">Cerrar</button></div>`;
  }
  function build() {
    if (document.getElementById('a11yBtn')) return;
    const b = document.createElement('button'); b.id = 'a11yBtn'; b.className = 'a11y-btn'; b.type = 'button'; b.setAttribute('aria-label', 'Opciones de accesibilidad'); b.setAttribute('aria-expanded', 'false');
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4.5" r="1.8"/><path d="M5 8.5l7 1.5 7-1.5M12 10v5M9 21l3-6 3 6"/></svg>';
    document.body.appendChild(b);
    b.onclick = () => { let p = document.getElementById('a11yPanel'); if (p) { p.remove(); b.setAttribute('aria-expanded', 'false'); return; } p = document.createElement('div'); p.id = 'a11yPanel'; p.className = 'a11y-panel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Accesibilidad'); render(p); document.body.appendChild(p); b.setAttribute('aria-expanded', 'true'); const f = p.querySelector('button'); f && f.focus(); };
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-a]'); if (!a || !a.closest('#a11yPanel')) return; const k = a.dataset.a;
      if (k === 'c') s.c = (s.c + 1) % 3; else if (k === 'fs+') s.fs = Math.min(s.fs + 1, 4); else if (k === 'fs-') s.fs = Math.max(s.fs - 1, -2);
      else if (k === 'reset') s = { ...D }; else if (k === 'close') { document.getElementById('a11yPanel').remove(); b.setAttribute('aria-expanded', 'false'); return; } else s[k] = s[k] ? 0 : 1;
      save(); apply();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { const p = document.getElementById('a11yPanel'); if (p) { p.remove(); b.setAttribute('aria-expanded', 'false'); b.focus(); } } });
  }
  window.A11y = { get: () => ({ ...s }), set(k, v) { s[k] = v; save(); apply(); }, apply };
  const init = () => { build(); apply(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
