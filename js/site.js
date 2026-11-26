/* Utilidades de sitio: ajustes de la clínica, redes/WhatsApp, despedida, bitácora, lazy-loading. */
(function () {
  'use strict';
  const P = window.Pata, esc = P.esc;
  const DEF = { clinic_name: 'Pata Andina Vet', whatsapp: '59170000000', address: 'La Paz, Bolivia', pay_holder: 'Pata Andina Vet', pay_note: 'Escanea el QR, paga el monto exacto y escribe el código de operación.', pay_qr: null };
  P.settings = async (force) => {
    if (P._set && !force) return P._set; let s = { ...DEF, ...(P.cache.get('settings') || {}) };
    if (P.sb && navigator.onLine) { try { const r = await P.sb.from('clinic_settings').select('*').eq('id', 1).single(); if (!r.error && r.data) { s = { ...DEF, ...r.data }; P.cache.set('settings', s); } } catch (_) { } }
    return (P._set = s);
  };
  P.waLink = (num, txt) => `https://wa.me/${String(num || DEF.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(txt || 'Hola Pata Andina Vet, quisiera hacer una consulta.')}`;
  const IC = {
    wa: '<path d="M3 21l1.6-4.8A8.5 8.5 0 1 1 8 19.6z"/><path d="M9 9c.5 3 3 5.500 6 6l1.200-1.500-2.200-1-1 .8c-.8-.4-1.600-1.200-2-2l.8-1-1-2.200z"/>',
    fb: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.500c0-.3.200-.5.500-.5z"/>',
    tt: '<path d="M14 3v11.500a3.500 3.500 0 1 1-3.500-3.500"/><path d="M14 3c.5 2.500 2 4 5 4.200"/>'
  };
  P.socialBar = (wa, txt) => `<nav class="social" aria-label="Contacto y redes sociales">
    <a class="soc wa" href="${esc(P.waLink(wa, txt))}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true">${IC.wa}</svg><span>WhatsApp</span></a>
    <a class="soc fb" href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true">${IC.fb}</svg><span>Facebook</span></a>
    <a class="soc tt" href="https://www.tiktok.com/" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true">${IC.tt}</svg><span>TikTok</span></a></nav>`;
  P.logEvent = async a => { try { if (P.sb && navigator.onLine) await Promise.race([P.sb.rpc('log_event', { p_action: a }), new Promise(r => setTimeout(r, 1500))]); } catch (_) { } };
  /* Pantalla de despedida con mascotas */
  P.goodbye = (name, done) => {
    const o = document.createElement('div'); o.className = 'bye'; o.setAttribute('role', 'alert');
    o.innerHTML = `<div class="bye-in"><div class="petrow"><div class="pw">${ART.cat()}</div><div class="pw">${ART.dog()}</div><div class="pw">${ART.bird()}</div></div><h2>¡Hasta luego${name ? ', ' + esc(name) : ''}!</h2><p>Gracias por confiar en <b>Pata Andina Vet</b>, tu veterinaria de confianza. Cuida mucho a tus peluditos: aquí los esperamos.</p><div class="bar"><i id="byeBar"></i></div></div>`;
    document.body.appendChild(o); P.confetti(24); setTimeout(() => { const b = document.getElementById('byeBar'); if (b) b.style.width = '100%'; }, 40);
    setTimeout(() => done && done(), 2600);
  };
  /* Carga diferida: [data-src] en img/video/iframe se activa al entrar en pantalla */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { const el = e.target; if (el.dataset.src) { el.src = el.dataset.src; el.removeAttribute('data-src'); } el.classList.add('in'); io.unobserve(el); } }), { rootMargin: '200px' }) : null;
  P.lazyScan = (root = document) => root.querySelectorAll('[data-src],[data-reveal]').forEach(el => io ? io.observe(el) : (el.dataset.src && (el.src = el.dataset.src), el.classList.add('in')));
  /* Reducir imagen a data-URL (comprobantes y QR) */
  P.imageToData = (file, max = 720, type = 'image/jpeg', q = .62) => new Promise((res, rej) => {
    if (!file || !/^image\//.test(file.type)) return rej(new Error('Elige una imagen (JPG o PNG).'));
    if (file.size > 8e6) return rej(new Error('La imagen pesa más de 8 MB.'));
    const fr = new FileReader(); fr.onerror = () => rej(new Error('No se pudo leer la imagen.'));
    fr.onload = () => { const im = new Image(); im.onerror = () => rej(new Error('Imagen inválida.')); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); const x = c.getContext('2d'); if (type === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); } x.drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL(type, q)); }; im.src = fr.result; };
    fr.readAsDataURL(file);
  });
})();
