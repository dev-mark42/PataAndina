/* Utilidades compartidas: cliente Supabase, validaciones, toasts, efectos, PWA. */
(function () {
  'use strict';
  const cfg = window.PATA_CONFIG || {};
  /* Aunque peguen la URL con /rest/v1/ o con barra final, se usa solo el origen (evita "invalid request"). */
  const origin = u => { try { const x = new URL(String(u || '').trim()); return x.protocol === 'https:' ? x.origin : ''; } catch (_) { return ''; } };
  const SB_URL = origin(cfg.SUPABASE_URL), SB_KEY = String(cfg.SUPABASE_ANON_KEY || '').trim();
  const configured = !!SB_URL && SB_KEY.length > 40;
  const P = window.Pata = { configured, sb: null };
  /* Las claves nuevas (sb_publishable_...) no son JWT: no deben viajar en Authorization. */
  const safeFetch = (u, o = {}) => { const h = new Headers(o.headers || {}); if (/^Bearer sb_/.test(h.get('Authorization') || '')) h.delete('Authorization'); return fetch(u, { ...o, headers: h }); };
  if (configured && window.supabase) {
    P.sb = window.supabase.createClient(SB_URL, SB_KEY,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }, global: { fetch: safeFetch } });
  }

  /* ---- DOM ---- */
  P.$ = (s, r = document) => r.querySelector(s);
  P.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  P.esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---- Fechas (clínica en La Paz, UTC-4 fijo) ---- */
  const LP = 'America/La_Paz';
  P.todayLP = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
  P.addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  P.dow = iso => new Date(iso + 'T12:00:00Z').getUTCDay();
  P.toISO = (date, hhmm) => `${date}T${hhmm}:00-04:00`;
  P.fmtDate = d => new Intl.DateTimeFormat('es-BO', { timeZone: LP, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));
  P.fmtTime = d => new Intl.DateTimeFormat('es-BO', { timeZone: LP, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d));
  P.fmtDay = iso => new Intl.DateTimeFormat('es-BO', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso + 'T12:00:00Z'));
  P.age = iso => { if (!iso) return ''; const m = Math.floor((Date.now() - new Date(iso)) / 2629800000); return m < 12 ? `${Math.max(m, 0)} meses` : `${Math.floor(m / 12)} año${m >= 24 ? 's' : ''}`; };

  /* ---- Validaciones ---- */
  P.v = {
    email: s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 120,
    name: s => /^[\p{L}][\p{L}\s'.-]{1,78}$/u.test(s.trim()),
    phone: s => /^[67]\d{7}$/.test(s),
    pass: s => s.length >= 8 && /[A-Za-z]/.test(s) && /\d/.test(s) && s.length <= 72,
    strength: s => { let n = 0; if (s.length >= 8) n++; if (/[A-Z]/.test(s) && /[a-z]/.test(s)) n++; if (/\d/.test(s)) n++; if (/[^A-Za-z0-9]/.test(s) || s.length >= 12) n++; return n; }
  };
  /* Marca un campo como válido/inválido con mensaje */
  P.setField = (input, msg) => {
    const f = input.closest('.field'); if (!f) return !msg;
    f.classList.toggle('invalid', !!msg); f.classList.toggle('valid', !msg && !!input.value);
    let e = f.querySelector('.err'); if (!e) { e = document.createElement('div'); e.className = 'err'; e.setAttribute('role', 'alert'); f.appendChild(e); }
    e.textContent = msg || ''; input.setAttribute('aria-invalid', msg ? 'true' : 'false'); return !msg;
  };
  /* Validación en vivo: rules = { idDelInput: valor => 'mensaje' | '' } */
  P.liveValidate = (form, rules) => {
    const run = (el) => P.setField(el, rules[el.id](el.value, el));
    Object.keys(rules).forEach(id => { const el = form.querySelector('#' + id); if (!el) return; el.addEventListener('blur', () => run(el)); el.addEventListener('input', () => { if (el.closest('.field').classList.contains('invalid')) run(el); }); });
    return () => { let ok = true, first = null; Object.keys(rules).forEach(id => { const el = form.querySelector('#' + id); if (el && !run(el)) { ok = false; first = first || el; } }); if (first) first.focus(); return ok; };
  };

  /* ---- Errores legibles ---- */
  P.errMsg = e => {
    const m = (e && (e.message || e.error_description)) || String(e || '');
    const c = e && e.code;
    if (!navigator.onLine || /Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sin conexión. Revisa tu internet e inténtalo otra vez.';
    if (/invalid path|requested path is invalid|invalid request|Invalid API key/i.test(m)) return 'La conexión con Supabase está mal configurada: revisa js/config.js (URL sin /rest/v1/ y clave correcta).';
    if (c === '23P01') return 'Ese horario acaba de ser tomado por otra reserva. Elige otro.';
    if (c === '42501' || /row-level security|permission denied/i.test(m)) return 'No tienes permiso para realizar esta acción.';
    if (c === '23505') return 'Ese registro ya existe.';
    if (c === '23514') return 'Hay un dato fuera de rango. Revisa el formulario.';
    if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
    if (/Email not confirmed/i.test(m)) return 'Debes confirmar tu correo antes de ingresar. Revisa tu bandeja.';
    if (/already registered|already been registered/i.test(m)) return 'Ese correo ya tiene una cuenta. Prueba ingresar o recuperar tu contraseña.';
    if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera unos minutos.';
    if (/same password|different from the old/i.test(m)) return 'La nueva contraseña debe ser distinta a la anterior.';
    if (/weak|at least/i.test(m)) return 'La contraseña es muy débil (mínimo 8 caracteres, letras y números).';
    return m || 'Ocurrió un error inesperado.';
  };

  /* ---- Toasts ---- */
  P.toast = (msg, type = 'ok') => {
    let box = document.getElementById('toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast' + (type === 'err' ? ' err' : ''); t.textContent = msg; box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, type === 'err' ? 5200 : 3200);
  };

  /* ---- Efectos ---- */
  P.confetti = (n = 16) => {
    const paw = ART.paw(); n = Math.min(n, 20);
    for (let i = 0; i < n; i++) { const s = document.createElement('span'); s.className = 'fall'; s.innerHTML = paw; const z = 14 + Math.random() * 14; s.style.cssText = `left:${Math.random() * 100}vw;width:${z}px;height:${z}px;color:var(${i % 3 ? '--forest' : '--accent'});animation-duration:${2.2 + Math.random() * 2}s;animation-delay:${Math.random() * .6}s`; document.body.appendChild(s); setTimeout(() => s.remove(), 5200); }
  };
  P.countUp = (el, to) => { const t0 = performance.now(); const step = t => { const k = Math.min((t - t0) / 700, 1); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); };
  /* Rastro de huellas que avanza en diagonal: sobrio, sin caricaturas. */
  P.paws = box => {
    if (!box) return; box.classList.add('paw-trail'); const paw = ART.paw();
    [[6, 88, 1], [54, 96, -1]].forEach(([x0, y0, dir], t) => { for (let i = 0; i < 10; i++) { const side = i % 2 ? 1 : -1, e = document.createElement('span'); e.className = 'print'; e.style.left = (x0 + i * 4.6 * dir + side * 1.4) + '%'; e.style.top = (y0 - i * 8.2 + side * 1.2) + '%'; e.style.setProperty('--r', dir * 28 + 'deg'); e.style.animationDelay = (i * .55 + t * 2.4) + 's'; e.innerHTML = paw; box.appendChild(e); } });
  };
  /* Ripple en botones + mascotas que hablan al tocarlas */
  document.addEventListener('click', e => {
    const b = e.target.closest('.btn'); if (b) { const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height), s = document.createElement('span'); s.className = 'ripple'; s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`; b.appendChild(s); setTimeout(() => s.remove(), 600); }

  });
  P.btnBusy = (b, on) => { b.classList.toggle('loading', on); b.disabled = on; };

  /* ---- Tema ---- */
  P.initTheme = btn => {
    const set = d => { document.body.classList.toggle('dark-theme', d); if (btn) btn.textContent = d ? '☀️' : '🌙'; };
    let d = false; try { d = localStorage.getItem('pata-theme') === 'dark'; } catch (_) { }
    set(d); if (btn) btn.addEventListener('click', () => { d = !d; set(d); try { localStorage.setItem('pata-theme', d ? 'dark' : 'light'); } catch (_) { } });
  };
  /* ---- Red ---- */
  P.initNet = el => {
    const up = () => { const on = navigator.onLine; if (el) { el.dataset.s = on ? 'on' : 'off'; el.querySelector('b').textContent = on ? 'En línea' : 'Sin conexión'; } document.body.classList.toggle('is-offline', !on); P.onNet && P.onNet(on); };
    addEventListener('online', up); addEventListener('offline', up); up();
  };
  /* ---- PWA: service worker + botón instalar ---- */
  P.initPWA = installBtn => {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW:', e)));
    }
    let ev = null;
    addEventListener('beforeinstallprompt', e => { e.preventDefault(); ev = e; if (installBtn) installBtn.hidden = false; });
    if (installBtn) installBtn.addEventListener('click', async () => { if (!ev) return; ev.prompt(); await ev.userChoice; ev = null; installBtn.hidden = true; });
    addEventListener('appinstalled', () => { if (installBtn) installBtn.hidden = true; P.toast('¡Pata Andina instalada!'); });
  };
  /* Caché local de lecturas para ver datos sin conexión */
  P.cache = { get(k) { try { return JSON.parse(localStorage.getItem('pata:' + k)); } catch (_) { return null; } }, set(k, v) { try { localStorage.setItem('pata:' + k, JSON.stringify(v)); } catch (_) { } }, clear() { try { Object.keys(localStorage).filter(k => k.startsWith('pata:')).forEach(k => localStorage.removeItem(k)); } catch (_) { } } };
  /* Acordeones (delegado): .acc > .acc-head. data-group en el padre => solo uno abierto */
  document.addEventListener('click', e => {
    const h = e.target.closest('.acc-head'); if (!h) return; const a = h.parentElement, g = a.parentElement;
    const open = !a.classList.contains('open');
    if (g && g.dataset.group) [...g.children].forEach(x => { if (x !== a && x.classList.contains('acc')) { x.classList.remove('open'); x.querySelector(':scope>.acc-head').setAttribute('aria-expanded', 'false'); } });
    a.classList.toggle('open', open); h.setAttribute('aria-expanded', String(open));
  });
  /* Modal genérico */
  P.modal = (html, onMount) => {
    const bg = document.createElement('div'); bg.className = 'modal-bg'; bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    const close = () => { bg.remove(); document.removeEventListener('keydown', k); }; const k = e => e.key === 'Escape' && close();
    bg.addEventListener('mousedown', e => { if (e.target === bg) close(); }); document.addEventListener('keydown', k); document.body.appendChild(bg);
    bg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close)); const f = bg.querySelector('input,select,textarea,button'); f && f.focus();
    onMount && onMount(bg.firstElementChild, close); return close;
  };
  P.confirm = (title, text, okLabel = 'Confirmar', danger = false) => new Promise(res => {
    let done = false; const fin = v => { if (!done) { done = true; res(v); } };
    const close = P.modal(`<h2>${P.esc(title)}</h2><p>${P.esc(text)}</p><div class="actions"><button class="btn ghost" data-close>Volver</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${P.esc(okLabel)}</button></div>`, (m, c) => { m.querySelector('[data-ok]').onclick = () => { fin(true); c(); }; });
    const bgs = document.querySelectorAll('.modal-bg'); const bg = bgs[bgs.length - 1]; const ob = new MutationObserver(() => { if (!document.body.contains(bg)) { ob.disconnect(); fin(false); } }); ob.observe(document.body, { childList: true });
  });
})();
