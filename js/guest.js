/* Modo invitado: solo lectura. Reservar/pagar/mascotas redirigen al inicio de sesión. */
(function () {
  'use strict';
  const P = Pata, { $, esc, toast } = P;
  P.initTheme($('#themeBtn')); P.initNet($('#net'));
  $('#gPets').innerHTML = ['cat', 'dog', 'bird'].map(k => `<div class="pw">${ART[k]()}</div>`).join('');
  const S = { list: [], media: {}, state: { tab: 'top' } };
  const toLogin = (why) => { toast(why || 'Inicia sesión para continuar.', 'err'); try { sessionStorage.setItem('pata-from-guest', '1'); } catch (_) { } setTimeout(() => location.assign('./index.html'), 1100); };
  const draw = () => { $('#gCatalog').innerHTML = Catalog.view(S.list, S.media, S.state); P.lazyScan($('#gCatalog')); };
  Catalog.bind($('#gCatalog'), { state: S.state, redraw: draw, list: () => S.list, media: () => S.media, bookLabel: 'Reservar (requiere iniciar sesión)', onBook: () => toLogin('Para reservar necesitas iniciar sesión.') });
  (async () => {
    try { S.media = await (await fetch('./data/media.json')).json(); } catch (_) { }
    try {
      if (!P.sb) throw new Error('Falta configurar Supabase');
      const r = await P.sb.from('services_catalog').select('*').order('sort_order'); if (r.error) throw r.error; S.list = r.data; P.cache.set('guest-services', r.data);
    } catch (e) { S.list = P.cache.get('guest-services') || []; if (!S.list.length) { $('#gCatalog').innerHTML = `<div class="notice bad">${esc(P.errMsg(e))}</div>`; return; } }
    draw();
  })();
  P.settings().then(s => { $('#gSocial').innerHTML = P.socialBar(s.whatsapp) + `<p class="hint" style="text-align:center;margin-top:.5rem">${esc(s.address)}</p>`; });
})();
