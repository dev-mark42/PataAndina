# Pata Andina Vet · PWA con Supabase (v3)

Veterinaria instalable (PWA) en HTML + CSS + JavaScript puro con base de datos PostgreSQL en Supabase.
Tres paneles (tutor, personal veterinario, administrador), modo invitado, pagos con QR y recibo, carnet de vacunas,
bitácora de eventos, accesibilidad (alto contraste) y una **auditoría oculta** de los avances del curso.

## 1. Puesta en marcha

### SQL (Supabase > SQL Editor > New query > Run), **en este orden**
| Orden | Archivo | Qué hace |
|---|---|---|
| 1 | `supabase/schema.sql` | Tablas base, RLS, 16 servicios, reservas sin superposición. |
| 2 | `supabase/02-admin-pagos-bitacora.sql` | Rol administrador, aves, Top 10 y 3 grupos de servicios, pagos QR/efectivo con recibo, carnet de vacunas, bitácora, ajustes (WhatsApp, QR). |
| 3 | `supabase/03-datos-masivos.sql` | **Inserción masiva**: 45 usuarios, ~84 mascotas, ~630 citas, ~450 atenciones, ~175 vacunas, ~455 pagos y ~2.500 eventos de bitácora. |
| 4 (opcional) | `supabase/04-hazme-admin.sql` | Convierte TU correo en administrador. |

Los 3 primeros son idempotentes (puedes repetirlos). Los probé en un PostgreSQL 16 real (con `auth` simulado): crean todo sin errores.

### Conexión
`js/config.js` ya trae tu URL y clave pública. Si cambias de proyecto, reemplázalas (nunca uses `service_role` aquí).

### Ejecutar
```bash
npx serve . -l 5500      # o: python3 -m http.server 5500
```
Abre http://localhost:5500 (no con doble clic: el service worker exige http/https).
Publicar: Netlify / Vercel / GitHub Pages (arrastrar la carpeta). En Supabase > Authentication > URL Configuration agrega tu URL.

## 2. Credenciales de la inserción masiva
| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@pataandina.com` | `Admin2026!` |
| Personal | `vet@pataandina.com`, `vet2@pataandina.com` | `Vet2026!` |
| Tutor (con historial) | `ana@pataandina.com`, `carlos@pataandina.com` | `Demo2026!` |
| Tutores | `tutor01@pataandina.com` … `tutor40@pataandina.com` | `Demo2026!` |

Cambia esas contraseñas antes de publicar. Para volver admin a tu propio correo usa `04-hazme-admin.sql`.
El código de activación de personal de ejemplo es `PATA-STAFF-2026` (el admin genera más en Administración > Equipo).

## 3. Los tres paneles (se explican dentro de la app, en Inicio)
- **Tutor**: reservar y cancelar citas, mascotas, historial médico, carnet de vacunas, pagar con QR y ver/imprimir el recibo.
- **Personal**: confirmar/rechazar solicitudes, agenda, atender y registrar diagnóstico, registrar vacunas, validar pagos (incluye lector de notificaciones) y cobrar en efectivo.
- **Administrador**: dashboard (ingresos, citas por mes/estado, top servicios), servicios (precio, visibilidad, video), equipo y roles, **bitácora de eventos** con filtros y buscador, y ajustes (WhatsApp, dirección, titular y **QR de pago**).
- **Invitado** (botón en el login): solo ve el catálogo, fotos y videos; si intenta reservar lo envía a iniciar sesión.
- Al cerrar sesión aparece la pantalla «¡Hasta luego!» con las mascotas.

## 4. Auditoría oculta del curso
En el login, **toca el logo 7 veces** (aparece la advertencia) y **8 veces** (entra). Abre `audit.html`: 4 semanas, cada concepto con *dónde está aplicado* y una **prueba en vivo** (modo oscuro, filtros, delegación de eventos, lazy loading, PWA, XSS, contraste real calculado, smoke test del DOM, alto contraste, etc.). No aparece en ningún menú del sistema entregado.

## 5. Accesibilidad (semana 4)
Botón ♿ en todas las pantallas: contraste **blanco/negro** (texto negro) y **negro/amarillo** (texto amarillo), tamaño de texto A−/A+, sin animaciones, letra fácil de leer y subrayado de enlaces. Se guarda en el dispositivo. Foco visible, navegación por teclado, `aria-*`, `prefers-reduced-motion`.

## 6. Diseño y rendimiento
Misma paleta (verde bosque, terracota, crema). Login con aurora, rayos de luz, guirnalda de luces, luciérnagas en canvas, escritura animada, tarjeta de cristal con borde giratorio y gato, perro y pájaro cuyos ojos siguen el puntero (saltan y sueltan corazones al tocarlos). Botones con brillo y ripple, tarjetas con foco de luz, contadores animados.
Servicios: **Top 10** + solo **3 categorías** (Consultas y prevención · Cirugía y procedimientos · Diagnóstico y bienestar), tarjetas grandes con foto, ficha con 3 fotos del proceso, video y botón de reservar. Poco scroll: tiles, pestañas, acordeones y modales.
Carga rápida: scripts con `defer`, imágenes con `loading="lazy"` y `data-src` (IntersectionObserver), fichas que se «hidratan» al abrirse, videos con `preload="none"`, service worker con precaché y caché de datos para ver lo último sin conexión.

## 7. Pagos con QR y recibo
1. Admin sube la foto de su QR en Administración > Ajustes (viene un QR de ejemplo).
2. El tutor, en *Mis citas > Pagar con QR*, escanea, paga y registra el **código de operación** (5–24 caracteres, no se puede reutilizar) y opcionalmente la foto del comprobante.
3. El personal lo ve en *Personal > Pagos* y valida (o rechaza con motivo) → se emite el **recibo** `PA-AAAA-000123` con sello PAGADO, imprimible/PDF.
4. **Lector de notificaciones**: el personal pega el texto de la notificación de Yape/Tigo/banco; el sistema extrae monto y código, lo compara con los pagos pendientes y, si coincide, valida y emite el recibo.

### Sobre «escuchar» notificaciones de Android
**Una PWA no puede leer las notificaciones de otras apps** (el navegador no lo permite; eso requiere `NotificationListenerService`, que solo existe en apps Android nativas). Por eso implementé la alternativa que sí funciona en PWA: pegar la notificación (paso 4) y validación manual con comprobante. Para automatizarlo de verdad hay que hacer una app Android pequeña en el teléfono de la clínica que lea la notificación y la envíe a una *Edge Function* de Supabase que marque el pago como validado; las funciones SQL de este proyecto ya sirven de base.

## 8. Correos de Supabase (límite de envíos)
El servicio de correo gratuito de Supabase tiene un **límite muy bajo por hora**; por eso aparecían errores al registrarse/recuperar contraseña. El código **ya no tiene bloqueos propios** (se quitaron los límites de intentos). Para que nada se corte con muchos usuarios:
- Authentication > Providers > Email: **desactiva «Confirm email»** (registro inmediato, sin correo de verificación), o
- configura un SMTP propio (Gmail/Brevo/Resend) en Authentication > SMTP Settings para correos ilimitados.
Tras registrarte, la app te lleva siempre a **Iniciar sesión** con tu correo ya escrito.

## 9. Fotos y videos de los servicios
`media/photos/` (3 fotos del proceso + póster por servicio) y `media/videos/` (16 videos). Son **material generado a partir de las fotos del proyecto** (no encontré videos reales: este entorno no tiene acceso a internet). Para poner uno real: en Administración > Servicios pega un enlace `https://` de YouTube o `.mp4`, o reemplaza `media/videos/<id>.mp4`.

## 10. Contacto y redes
WhatsApp (`wa.me/59170000000`, número de ejemplo editable en Ajustes), Facebook (`https://www.facebook.com/`) y TikTok (`https://www.tiktok.com/`). El test revisa que ningún enlace local esté roto.

## 11. Pruebas
```bash
npm i && npm test      # enlaces + más de 100 comprobaciones de interfaz (Supabase simulado)
```
`tests/db-test3.sql` y `tests/db-test3b.sql` prueban el SQL en PostgreSQL. **No pude probar contra tu Supabase real ni ver las pantallas en un navegador real**: haz la prueba manual de abajo.

### Prueba manual (10 minutos)
1. Registrarte → te lleva a Iniciar sesión → entrar. 2. Reservar y ver el horario ocupado desde otra cuenta.
3. Pagar con QR → entrar como `vet@` → Pagos → validar → ver el recibo en la cuenta del tutor.
4. Entrar como `admin@`: dashboard, Bitácora, Ajustes. 5. ♿ alto contraste en celular y laptop.
6. Instalar la PWA y abrirla en modo avión. 7. Logo ×8 → auditoría.

## Estructura
```
index.html (acceso)  app.html (sistema)  guest.html (invitado)  audit.html (oculta)  sw.js  manifest.json
css/{style,fx}.css  js/{config,common,site,fx,a11y,art,catalog,login,app,guest,audit}.js  js/vendor/supabase.js
supabase/*.sql  data/{media,curso,productos-gatos}.json  media/{photos,videos}  imagenes/  icons/  tests/
```
