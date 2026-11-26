'use strict';
/* Service Worker de Pata Andina Vet.
   - App shell precacheado: abre sin conexión (login y app).
   - Archivos propios: "stale-while-revalidate" (rápido y se actualiza solo).
   - Llamadas a Supabase (API/Auth): NUNCA se cachean (datos siempre reales y seguros). */
const CACHE = 'pata-andina-v23-total-20261126';
const SHELL = [
  './media/photos/consulta-general-poster.webp', './media/photos/consulta-felina-poster.webp', './media/photos/control-cachorro-poster.webp', './media/photos/vacuna-canina-poster.webp', './media/photos/vacuna-felina-poster.webp', './media/photos/desparasitacion-poster.webp', './media/photos/profilaxis-dental-poster.webp', './media/photos/esterilizacion-poster.webp', './media/photos/cirugia-poster.webp', './media/photos/curaciones-poster.webp', './media/photos/laboratorio-poster.webp', './media/photos/imagenologia-poster.webp', './media/photos/consulta-domicilio-poster.webp', './media/photos/peluqueria-poster.webp', './media/photos/nutricion-poster.webp', './media/photos/microchip-poster.webp',
  './', './index.html', './app.html', './guest.html', './404.html', './manifest.json', './css/style.css', './guest.html', './audit.html', './js/a11y.js', './js/site.js', './js/catalog.js', './js/guest.js', './js/audit.js', './data/curso.json',  './css/fx.css', './js/fx.js', './data/media.json',
  './js/config.js', './js/vendor/supabase.js', './js/art.js', './js/common.js', './js/login.js', './js/app.js', './js/guest.js', './data/curso.json',
  './icons/icon-192.png', './icons/icon-512.png', './data/productos-gatos.json',
  ...['consulta', 'control', 'curaciones', 'odontologia', 'domicilio', 'gato', 'imagenologia', 'laboratorio', 'nutricion', 'peluqueria', 'prevencion', 'vacuna', 'cirugia'].map(n => `./imagenes/${n}.svg`)];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('pata-andina-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;   // Supabase y externos: directo a la red
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; })
      .catch(async () => (await caches.match(req, { ignoreSearch: true, ignoreVary: true })) || (await caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
