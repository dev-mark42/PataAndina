from pathlib import Path
p=Path('/mnt/data/pata-fix/pata-andina')
# login: more useful rate limit messaging, prevent repeat-click registration, easy switch to login
f=p/'js/login.js'; s=f.read_text()
s=s.replace("if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera unos minutos.';", "if (/rate limit|too many/i.test(m)) return 'Supabase limitó temporalmente los correos de acceso. No vuelvas a registrar la cuenta ni pulses varias veces. Espera a que se restablezca el límite; si ya tienes cuenta, usa Ingresar.';")
s=s.replace("if (error) return msg($('#regMsg'), errMsg(error), 'bad');", "if (error) { const human = errMsg(error); msg($('#regMsg'), human, 'bad'); if (/rate limit|too many/i.test(error.message || '')) { $('#regBtn').disabled = true; $('#regBtn').textContent = 'Registro temporalmente limitado'; $('#regMsg').insertAdjacentHTML('afterend', '<p class=\"hint\" style=\"margin:.5rem 0\">No repitas el registro. Si tu cuenta ya existe, vuelve a <button type=\"button\" class=\"link\" data-go=\"login\">Ingresar</button>. Si no, espera a que Supabase libere el envío de correos.</p>'); } return; }")
f.write_text(s)
# Make register form always offer return to login
f=p/'index.html'; s=f.read_text()
s=s.replace('<button class="btn primary block" id="regBtn" type="submit">Crear cuenta</button>','<button class="btn primary block" id="regBtn" type="submit">Crear cuenta</button>\n        <p class="hint" style="text-align:center;margin-top:.8rem">¿Ya tienes cuenta? <button type="button" class="link" data-go="login">Ingresar</button></p>')
f.write_text(s)
# service details with photos and zoom modal
f=p/'js/app.js'; s=f.read_text()
s=s.replace("{ id: 'servicios', t: 'Servicios', g: 'Clínica' }, { id: 'personal', t: 'Personal', g: 'Clínica', staff: true },", "{ id: 'servicios', t: 'Servicios', g: 'Clínica' }, { id: 'personal', t: 'Personal', g: 'Clínica', staff: true }, { id: 'bitacora', t: 'Bitácora', g: 'Administración', staff: true },")
old='''        <div class="grid">${list.map(s => `<div class="acc"><button class="acc-head" aria-expanded="false"><span class="ico">${icoImg(s)}</span><span class="grow"><b>${esc(s.name)}</b><span class="sub">${esc(s.price_label)} · ${s.duration_min} min</span></span></button><div class="acc-body"><div class="acc-in"><div class="acc-pad"><p>${esc(s.description)}</p><p class="hint" style="margin:.4rem 0">${esc(s.details || '')}</p><dl class="kv"><dt>Para</dt><dd>${esc(s.species || '')}</dd></dl><div class="actions"><button class="btn sm primary" data-book="${s.id}">Reservar este servicio</button></div></div></div></div></div>`).join('')}</div>'''
new='''        <div class="service-grid">${list.map((s,i) => { const photos = ['./imagenes/vet-consulta.webp','./imagenes/vet-evaluacion.webp','./imagenes/vet-cuidados.webp','./imagenes/vet-diagnostico.webp','./imagenes/vet-atencion-felina.webp']; const photo=photos[i%photos.length]; return `<article class="service-card"><button class="service-photo" type="button" data-zoom="${photo}" aria-label="Ampliar fotografía de ${esc(s.name)}"><img src="${photo}" alt="Atención veterinaria: ${esc(s.name)}" loading="lazy"><span>⌕ Ampliar</span></button><div class="service-copy"><div class="service-meta"><span>${esc(CATS[s.category] || s.category)}</span><b>${esc(s.price_label)}</b></div><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><details><summary>Ver detalles del servicio</summary><p>${esc(s.details || '')}</p><p class="hint">Atención para: ${esc(s.species || 'Perros y gatos')} · ${s.duration_min} minutos aproximados</p></details><button class="btn sm primary block" data-book="${s.id}">Reservar este servicio</button></div></article>`; }).join('')}</div>'''
if old not in s: print('service block pattern not found')
else: s=s.replace(old,new)
s=s.replace("const b = e.target.closest('[data-book]'); if (b) go('reservar', { service: b.dataset.book });", "const z = e.target.closest('[data-zoom]'); if (z) { P.modal(`<div class=\"photo-viewer\"><button class=\"btn ghost\" data-close>Cerrar ✕</button><img src=\"${z.dataset.zoom}\" alt=\"Fotografía ampliada del servicio\"><p class=\"hint\">Fotografía ilustrativa de atención veterinaria</p></div>`); return; }\n      const b = e.target.closest('[data-book]'); if (b) go('reservar', { service: b.dataset.book });")
# Add staff audit view before VIEWS object
needle="  const VIEWS = { inicio: vInicio, mascotas: vMascotas, reservar: vReservar, turnos: vTurnos, historial: vHistorial, servicios: vServicios, personal: vPersonal, perfil: vPerfil };"
insert='''  async function vBitacora(m) {
    if (!S.staff) { m.innerHTML = `<div class="view"><h2>Acceso restringido</h2><p>Solo el personal autorizado puede consultar la bitácora.</p></div>`; return; }
    const { data, error } = await sb.from('audit_events').select('id,event_type,entity_type,description,metadata,created_at,is_demo').order('created_at',{ascending:false}).limit(300);
    if (error) throw error;
    m.innerHTML = `<div class="view"><div class="audit-heading"><div><span class="eyebrow">CONTROL INTERNO</span><h2>Bitácora de eventos</h2><p class="lead">Registro cronológico de actividad. Los eventos de demostración están identificados.</p></div><button class="btn sm" id="auditRefresh">↻ Actualizar</button></div><div class="audit-stats"><div class="card"><b>${data.length}</b><span>Eventos visibles</span></div><div class="card"><b>${data.filter(x=>!x.is_demo).length}</b><span>Eventos reales registrados</span></div><div class="card"><b>${data.filter(x=>x.is_demo).length}</b><span>Datos de demostración</span></div></div><div class="audit-list">${data.map(x=>`<article class="audit-row"><span class="audit-dot"></span><div class="audit-content"><div><b>${esc(x.event_type.replaceAll('_',' '))}</b>${x.is_demo?'<span class="tag">DEMO</span>':''}<time>${new Date(x.created_at).toLocaleString('es-BO',{dateStyle:'medium',timeStyle:'short',timeZone:'America/La_Paz'})}</time></div><p>${esc(x.description)}</p><small>${esc(x.entity_type || 'sistema')} · #${x.id}</small></div></article>`).join('') || empty('Todavía no hay eventos.')}</div></div>`;
    $('#auditRefresh').onclick=()=>go('bitacora');
  }
  const VIEWS = { inicio: vInicio, mascotas: vMascotas, reservar: vReservar, turnos: vTurnos, historial: vHistorial, servicios: vServicios, personal: vPersonal, bitacora: vBitacora, perfil: vPerfil };'''
assert needle in s
s=s.replace(needle,insert)
f.write_text(s)
# CSS additions
f=p/'css/style.css'; f.write_text(f.read_text()+r'''

/* Catálogo visual de servicios + visor */
.service-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(245px,1fr));gap:1rem;margin-top:.8rem}
.service-card{overflow:hidden;border:1px solid var(--line);border-radius:20px;background:var(--card);box-shadow:var(--shadow);min-width:0;transition:transform .22s,box-shadow .22s}
.service-card:hover{transform:translateY(-3px);box-shadow:0 16px 32px rgba(25,55,40,.15)}
.service-photo{position:relative;display:block;width:100%;height:178px;padding:0;border:0;background:var(--mint);overflow:hidden;cursor:zoom-in}
.service-photo img{width:100%;height:100%;object-fit:cover;transition:transform .35s}
.service-photo:hover img{transform:scale(1.07)}
.service-photo span{position:absolute;right:.65rem;bottom:.65rem;padding:.35rem .65rem;border-radius:99px;background:rgba(20,35,27,.78);color:white;font-size:.75rem;font-weight:700}
.service-copy{padding:1rem}.service-copy h3{font-size:1.2rem;margin:.3rem 0}.service-copy>p{color:var(--muted);font-size:.88rem;min-height:3.8em}.service-meta{display:flex;justify-content:space-between;gap:.5rem;color:var(--accent);font-size:.72rem;font-weight:800}.service-meta b{color:var(--forest)}body.dark-theme .service-meta b{color:#f0b49a}
.service-copy details{margin:.65rem 0;color:var(--muted);font-size:.84rem}.service-copy summary{cursor:pointer;color:var(--forest);font-weight:700}body.dark-theme .service-copy summary{color:#efb398}
.photo-viewer{display:grid;gap:.8rem}.photo-viewer img{display:block;max-width:min(84vw,900px);max-height:75dvh;width:auto;height:auto;object-fit:contain;border-radius:14px;margin:auto;background:var(--bg)}
.audit-heading{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}.audit-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.7rem;margin:1rem 0}.audit-stats .card{display:grid;gap:.2rem}.audit-stats b{font-size:1.8rem;color:var(--forest)}.audit-stats span{font-size:.78rem;color:var(--muted)}.audit-list{border-left:2px solid var(--line);margin:1rem 0 1rem .55rem}.audit-row{position:relative;padding:0 0 1.1rem 1.2rem}.audit-dot{position:absolute;left:-.48rem;top:.3rem;width:.8rem;height:.8rem;border-radius:50%;background:var(--accent);border:3px solid var(--bg)}.audit-content{padding:.85rem;border:1px solid var(--line);border-radius:14px;background:var(--card)}.audit-content>div{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}.audit-content time{margin-left:auto;color:var(--muted);font-size:.72rem}.audit-content p{margin:.3rem 0;font-size:.9rem}.audit-content small{color:var(--muted)}
@media(max-width:600px){.service-grid{grid-template-columns:1fr}.service-photo{height:205px}.audit-stats{grid-template-columns:1fr 1fr}.audit-stats .card:first-child{grid-column:1/-1}.audit-content time{width:100%;margin-left:0}.audit-heading{align-items:flex-start}}
''')
# PWA cache version and photo cache assets
f=p/'sw.js'; t=f.read_text().replace('pata-andina-v22-mobile-leftnav-20261125','pata-andina-v23-auth-audit-catalog-20261125')
t=t.replace("'./icons/icon-192.png', './icons/icon-512.png', './data/productos-gatos.json',", "'./icons/icon-192.png', './icons/icon-512.png', './data/productos-gatos.json', './imagenes/vet-consulta.webp', './imagenes/vet-evaluacion.webp', './imagenes/vet-cuidados.webp', './imagenes/vet-diagnostico.webp', './imagenes/vet-atencion-felina.webp',")
f.write_text(t)
