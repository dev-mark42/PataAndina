# Pata Andina Vet · PWA V26

Aplicación veterinaria académica con HTML/CSS/JavaScript, Supabase Auth y PostgreSQL RLS.

## Instalación rápida
1. Configura `js/config.js` con la URL y clave publicable de Supabase.
2. Crea/confirmar los usuarios demo desde Supabase Authentication → Users (las contraseñas Auth no se insertan con SQL).
3. Ejecuta completo `supabase/INSTALACION_LIMPIA_COMPLETA.sql` desde SQL Editor. **Es destructivo para los datos operativos de `public`; respalda antes.** Conserva `auth.users`.
4. Publica la carpeta en GitHub Pages/HTTPS.

El SQL carga 50 servicios, 200 eventos DEMO, 15 mascotas, historiales, vacunas, desparasitación y tres citas futuras. Si no encuentra el correo demo, usa la primera cuenta tutor ya existente.

## Accesos
- Login/registro/recuperación: `index.html`.
- Invitado solo catálogo de servicios: `invitado.html`; no usa Auth ni consulta datos privados.
- Cliente: administra sus mascotas, consulta su historial y reserva citas.
- Personal: agenda, atención clínica y bitácora.
- Avances ocultos: ocho toques consecutivos al logotipo superior; el séptimo avisa y el octavo abre el panel desplazable.

## Pruebas
```bash
npm test
```
