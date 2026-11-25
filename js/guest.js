/* MODO INVITADO PÚBLICO · SOLO CATÁLOGO DE SERVICIOS.
   No usa Supabase Auth. No consulta perfiles, mascotas, citas ni historiales.
   Toda acción que implique una cuenta conduce al login. */
(function () {
  'use strict';
  const P = Pata, { $, esc } = P;
  P.initTheme($('#themeBtn'));
  P.initPWA($('#installBtn'));
  P.initNet($('#net'));
  $('#exitBtn').addEventListener('click', () => { location.href = './index.html'; });

  const CATS = {
    consulta: 'Consultas',
    prevencion: 'Prevención',
    procedimientos: 'Procedimientos',
    diagnostico: 'Diagnóstico',
    bienestar: 'Bienestar'
  };
  const DEMO = [
    ['consulta-general','Consulta veterinaria general','consulta','Revisión clínica inicial para perros y gatos, con orientación para el siguiente paso.','Incluye entrevista al tutor y evaluación clínica presencial. El diagnóstico lo define el profesional.','Bs 60',30,'consulta'],
    ['consulta-felina','Consulta felina','consulta','Atención pensada para reducir el estrés durante la visita de tu gato.','Se recomienda transportar al gato en un kennel seguro.','Bs 70',35,'gato'],
    ['control-cachorro','Control de cachorro o gatito','prevencion','Seguimiento de crecimiento, hábitos y plan preventivo según edad.','El profesional revisa antecedentes, peso y condición general.','Bs 50',25,'control'],
    ['vacuna-canina','Vacunación canina','prevencion','Revisión previa y aplicación de vacunas indicadas para cada paciente.','La vacuna y dosis dependen del historial y criterio veterinario.','Desde Bs 80',20,'vacuna'],
    ['vacuna-felina','Vacunación felina','prevencion','Evaluación y vacunación felina según antecedentes.','Trae el carnet de vacunación si está disponible.','Desde Bs 85',20,'vacuna'],
    ['desparasitacion','Desparasitación','prevencion','Orientación y control antiparasitario individual según especie y peso.','El producto y pauta los indica un profesional.','Desde Bs 40',15,'prevencion'],
    ['profilaxis-dental','Evaluación y limpieza dental','consulta','Valoración de salud oral y propuesta de higiene o profilaxis.','El alcance se define tras la evaluación presencial.','Desde Bs 180',45,'odontologia'],
    ['esterilizacion','Evaluación para esterilización','procedimientos','Consulta prequirúrgica para revisar condiciones y requisitos.','La cirugía no se confirma desde esta página.','Cotización tras evaluación',30,'cirugia'],
    ['cirugia','Valoración quirúrgica','procedimientos','Primera valoración para procedimientos programados.','La indicación y presupuesto se explican después del examen clínico.','Cotización según caso',40,'cirugia'],
    ['curaciones','Curaciones y control ambulatorio','procedimientos','Revisión y cuidado de heridas o controles indicados.','El tipo de curación se define según evaluación.','Desde Bs 70',25,'curaciones'],
    ['laboratorio','Toma de muestra y laboratorio','diagnostico','Coordinación de muestras y pruebas complementarias.','El veterinario define qué prueba se necesita.','Según prueba',20,'laboratorio'],
    ['imagenologia','Ecografía o radiografía','diagnostico','Coordinación de apoyo por imagen según indicación.','Disponibilidad, preparación y costo se confirman antes de acudir.','Consultar disponibilidad',30,'imagenologia'],
    ['consulta-domicilio','Consulta a domicilio','consulta','Atención programada en domicilio, sujeta a zona y disponibilidad.','Cobertura y costo de traslado se confirman antes de reservar.','Desde Bs 100',45,'domicilio'],
    ['peluqueria','Baño y peluquería higiénica','bienestar','Baño, cepillado y cuidado estético según pelaje y tolerancia.','Informa sobre alergias, lesiones o sensibilidad.','Desde Bs 90',60,'peluqueria'],
    ['nutricion','Orientación nutricional','bienestar','Consejos de alimentación según edad, condición y estilo de vida.','El plan se personaliza tras conocer antecedentes.','Bs 50',25,'nutricion'],
    ['microchip','Microchip de identificación','prevencion','Implantación de microchip para identificar a tu mascota.','El procedimiento se realiza en consulta.','Bs 120',20,'control']
  ].map((x, i) => ({
    id:x[0], name:x[1], category:x[2], description:x[3], details:x[4],
    price_label:x[5], duration_min:x[6], icon:x[7], sort_order:i
  }));

  const S = { services:null, category:'todas', query:'' };
  const loginUrl = './index.html';
  const goLogin = () => { location.href = loginUrl; };

  async function loadServices() {
    if (S.services) return;
    S.services = DEMO;
    // La clave pública solo lee el catálogo activo. No se llama a auth ni a tablas privadas.
    if (P.configured && P.sb) {
      try {
        const { data, error } = await P.sb
          .from('services_catalog')
          .select('id,name,category,description,details,price_label,duration_min,tag,species,icon,sort_order')
          .eq('active', true)
          .order('sort_order');
        if (!error && Array.isArray(data) && data.length) S.services = data;
        else console.warn('Se usa el catálogo local de demostración:', error?.message || 'catálogo vacío');
      } catch (error) {
        console.warn('Se usa el catálogo local de demostración:', error);
      }
    }
  }

  function render() {
    const q = S.query.trim().toLocaleLowerCase('es');
    const items = S.services.filter(s =>
      (S.category === 'todas' || s.category === S.category) &&
      (!q || `${s.name} ${s.description} ${s.species || ''}`.toLocaleLowerCase('es').includes(q))
    );
    $('#gPane').innerHTML = `
      <section class="guest-catalog">
        <div class="guest-catalog-head">
          <span class="eyebrow">PATA ANDINA VET · CATÁLOGO</span>
          <h1>Servicios veterinarios</h1>
          <p>Explora los servicios disponibles para perros y gatos. Este acceso es de consulta: para solicitar atención debes iniciar sesión.</p>
        </div>
        <div class="field guest-search">
          <label for="serviceSearch">Buscar un servicio</label>
          <input id="serviceSearch" type="search" autocomplete="off" placeholder="Ej. vacunación, consulta, baño…" value="${esc(S.query)}">
        </div>
        <div class="chips" role="group" aria-label="Filtrar servicios">
          ${[['todas','Todos'],...Object.entries(CATS)].map(([k,v]) =>
            `<button type="button" class="chip ${S.category===k?'active':''}" data-category="${esc(k)}" aria-pressed="${S.category===k}">${esc(v)}</button>`
          ).join('')}
        </div>
        <p class="hint guest-count">${items.length} servicios encontrados</p>
        <div class="guest-service-grid">
          ${items.map((s,i)=>`
            <article class="card guest-service">
              <div class="guest-service-top">
                <span class="guest-service-icon"><img src="./imagenes/${esc(s.icon||'consulta')}.svg" alt="" loading="lazy"></span>
                <span class="badge b-confirmada">${esc(CATS[s.category]||'Servicio')}</span>
              </div>
              <h2>${esc(s.name)}</h2>
              <p>${esc(s.description)}</p>
              <div class="guest-service-meta">
                <strong>${esc(s.price_label||'Consultar')}</strong>
                <span>${Number(s.duration_min)||30} min aprox.</span>
              </div>
              <details class="guest-service-details">
                <summary>Ver detalles del servicio</summary>
                <p>${esc(s.details||'Los detalles se confirman durante la evaluación veterinaria.')}</p>
                ${s.species?`<small>Atención: ${esc(s.species)}</small>`:''}
                <a class="btn primary block" href="${loginUrl}" data-login-action>Iniciar sesión para solicitar</a>
              </details>
            </article>`).join('')}
        </div>
        ${items.length?'':'<div class="empty">No encontramos servicios con esa búsqueda.</div>'}
        <div class="guest-login-callout">
          <div><b>¿Necesitas una cita?</b><span>Ingresa o crea tu cuenta para solicitar atención y gestionar tus mascotas.</span></div>
          <a class="btn primary" href="${loginUrl}" data-login-action>Ir al login</a>
        </div>
        <p class="hint guest-readonly-note">Modo invitado · Solo lectura · No se crean citas, pedidos ni registros.</p>
      </section>`;
    const input = $('#serviceSearch');
    if (input) {
      input.addEventListener('input', () => {
        S.query = input.value;
        const pos = input.selectionStart;
        render();
        const next = $('#serviceSearch');
        next?.focus();
        try { next?.setSelectionRange(pos,pos); } catch (_) {}
      });
    }
  }

  document.addEventListener('click', e => {
    const c = e.target.closest('[data-category]');
    if (c) { S.category = c.dataset.category; render(); return; }
    const a = e.target.closest('[data-login-action]');
    if (a) { e.preventDefault(); goLogin(); }
  });

  (async function start() {
    try {
      await loadServices();
      render();
    } catch (error) {
      console.error(error);
      $('#gPane').innerHTML = `<div class="notice bad">No se pudo cargar el catálogo. <a href="${loginUrl}">Volver al login</a></div>`;
    }
  })();
})();
