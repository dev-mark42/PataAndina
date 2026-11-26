/* Efectos visuales: luces, luciérnagas, aurora, ojos que siguen, corazones, tilt, spotlight, máquina de escribir. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  let px = innerWidth * .7, py = innerHeight * .3, raf = 0;

  /* ---- Puntero: spotlight global, spotlight por tarjeta, ojos de las mascotas, tilt ---- */
  function onMove(x, y, target) {
    px = x; py = y;
    if (raf) return; raf = requestAnimationFrame(() => {
      raf = 0; const r = document.documentElement.style; r.setProperty('--mx', px + 'px'); r.setProperty('--my', py + 'px');
      $$('.pet-svg').forEach(svg => {
        const b = svg.getBoundingClientRect(); if (b.bottom < 0 || b.top > innerHeight) return;
        const dx = px - (b.left + b.width / 2), dy = py - (b.top + b.height * .45), d = Math.hypot(dx, dy) || 1, k = Math.min(d / 160, 1) * 4.5;
        svg.querySelectorAll('.pupil').forEach(p => p.style.transform = `translate(${dx / d * k}px,${dy / d * k}px)`);
      });
      const c = target && target.closest && target.closest('.card,.acc');
      if (c) { const b = c.getBoundingClientRect(); c.style.setProperty('--cx', px - b.left + 'px'); c.style.setProperty('--cy', py - b.top + 'px'); }
      const t = $('.auth-card'); if (t && !touch && !reduce) { const b = t.getBoundingClientRect(), rx = (py - (b.top + b.height / 2)) / innerHeight, ry = (px - (b.left + b.width / 2)) / innerWidth; t.style.transform = `perspective(1000px) rotateX(${(-rx * 5).toFixed(2)}deg) rotateY(${(ry * 6).toFixed(2)}deg)`; }
    });
  }
  addEventListener('pointermove', e => onMove(e.clientX, e.clientY, e.target), { passive: true });
  addEventListener('touchmove', e => { const t = e.touches[0]; if (t) onMove(t.clientX, t.clientY, e.target); }, { passive: true });

  /* ---- Mascotas: saltan y sueltan corazones al tocarlas ---- */
  document.addEventListener('click', e => {
    const w = e.target.closest('.pw'); if (!w) return;
    w.classList.remove('jump'); void w.offsetWidth; w.classList.add('jump');
    const svg = w.querySelector('.pet-svg'), say = svg && svg.dataset.say, b = w.getBoundingClientRect();
    ['💚', '🧡', '✨', '💛'].forEach((h, i) => { const s = document.createElement('span'); s.className = 'heartfx'; s.textContent = h; s.style.left = b.left + b.width * (.25 + Math.random() * .5) + 'px'; s.style.top = b.top + 10 + 'px'; s.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px'); s.style.setProperty('--rot', (Math.random() * 60 - 30) + 'deg'); s.style.animationDelay = i * .08 + 's'; document.body.appendChild(s); setTimeout(() => s.remove(), 1700); });
    if (say) { const s = document.createElement('span'); s.className = 'heartfx'; s.style.cssText = `left:${b.left + b.width / 2 - 30}px;top:${b.top - 14}px;font-weight:800;font-size:1rem;background:#fff;color:#204437;border-radius:14px;padding:.15rem .6rem;box-shadow:0 6px 16px rgba(0,0,0,.2)`; s.textContent = say; document.body.appendChild(s); setTimeout(() => s.remove(), 1500); }
    setTimeout(() => w.classList.remove('jump'), 800);
  });

  /* ---- Guirnalda de luces ---- */
  function lights() {
    const box = $('#lights'); if (!box) return; box.innerHTML = '';
    const W = innerWidth, n = Math.max(9, Math.round(W / 74)), cols = ['#ffd45e', '#ff8fa3', '#7be0b5', '#8fc5ff', '#ffb27a'];
    const sag = 34, ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} 78`); svg.setAttribute('preserveAspectRatio', 'none');
    const path = document.createElementNS(ns, 'path'); path.setAttribute('d', `M-10 6 Q ${W / 2} ${6 + sag * 2} ${W + 10} 6`); path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#486155'); path.setAttribute('stroke-width', '2'); svg.appendChild(path); box.appendChild(svg);
    for (let i = 0; i < n; i++) { const t = (i + .5) / n, x = W * t, y = 6 + sag * 2 * 2 * t * (1 - t) ; const b = document.createElement('i'); b.className = 'bulb'; b.style.cssText = `left:${x}px;top:${y + 2}px;--c:${cols[i % cols.length]};--d:${(i * .37).toFixed(2)}s`; box.appendChild(b); }
  }
  /* ---- Canvas: luciérnagas (día: polen dorado · noche: luciérnagas y estrellas) ---- */
  function particles() {
    const cv = $('#fx'); if (!cv || reduce) return; const ctx = cv.getContext && cv.getContext('2d'); if (!ctx) return; let W, H, items = [], run = true, dpr = Math.min(devicePixelRatio || 1, 2);
    const size = () => { W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr; cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px'; };
    const mk = () => ({ x: Math.random() * W, y: Math.random() * H, r: (Math.random() * 2.4 + 1) * dpr, vx: (Math.random() - .5) * .35 * dpr, vy: (-Math.random() * .4 - .08) * dpr, ph: Math.random() * 6.28, hue: [48, 150, 22, 200][Math.floor(Math.random() * 4)] });
    size(); const N = (touch || innerWidth < 700) ? 28 : 70; for (let i = 0; i < N; i++) items.push(mk());
    addEventListener('resize', () => { size(); lights(); });
    document.addEventListener('visibilitychange', () => { run = !document.hidden; if (run) loop(); });
    let t = 0; function loop() {
      if (!run) return; t += .016; ctx.clearRect(0, 0, W, H); if (/nomo|hc-/.test(document.body.className)) return requestAnimationFrame(loop); const dark = document.body.classList.contains('dark-theme');
      items.forEach(p => {
        p.x += p.vx + Math.sin(t + p.ph) * .25 * dpr; p.y += p.vy; if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        const a = (.35 + .65 * Math.abs(Math.sin(t * 1.2 + p.ph))) * (dark ? 1 : .8), g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 7);
        const col = dark ? `hsla(${p.hue},95%,72%,` : `hsla(${p.hue === 150 ? 35 : p.hue},90%,62%,`;
        g.addColorStop(0, col + a + ')'); g.addColorStop(1, col + '0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 7, 0, 6.283); ctx.fill();
      }); requestAnimationFrame(loop);
    } loop();
  }
  /* ---- Máquina de escribir ---- */
  function typer() {
    const el = $('#typer'); if (!el) return; const lines = ['Cuidar también es acompañar.', 'Reserva tu cita en 4 pasos.', 'Todo el historial de tu mascota, a la mano.', 'Gatos, perros, aves y más.'];
    if (reduce) { el.textContent = lines[0]; return; }
    let i = 0, j = 0, del = false; (function tick() { const s = lines[i]; el.textContent = s.slice(0, j); if (!del && j === s.length) { del = true; return setTimeout(tick, 1700); } if (del && j === 0) { del = false; i = (i + 1) % lines.length; } j += del ? -1 : 1; setTimeout(tick, del ? 28 : 55); })();
  }
  /* ---- Mascotas parpadeantes: el pájaro mueve la cabeza solo a ratos ---- */
  function idle() { setInterval(() => { const ws = $$('.petrow .pw'); if (!ws.length || document.hidden) return; const w = ws[Math.floor(Math.random() * ws.length)]; w.classList.remove('jump'); void w.offsetWidth; w.classList.add('jump'); setTimeout(() => w.classList.remove('jump'), 800); }, 6500); }

  window.Fx = { lights, particles, typer, idle };
  document.addEventListener('DOMContentLoaded', () => { lights(); particles(); typer(); if (!reduce) idle(); });
  if (document.readyState !== 'loading') { lights(); particles(); typer(); if (!reduce) idle(); }
})();
