'use strict';
/* Service Worker de Pata Andina Vet.
   - App shell precacheado: abre sin conexión (login y app).
   - Archivos propios: "stale-while-revalidate" (rápido y se actualiza solo).
   - Llamadas a Supabase (API/Auth): NUNCA se cachean (datos siempre reales y seguros). */
const CACHE = 'pata-andina-v21-invitado-20261124';
const SHELL = ['./', './index.html', './app.html', './guest.html', './404.html', './manifest.json', './css/style.css',
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
