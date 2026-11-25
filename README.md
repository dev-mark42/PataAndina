# 🐾 Pata Andina Vet · PWA con Supabase

Aplicación web instalable (PWA) para una clínica veterinaria: login único, registro de tutores y mascotas,
reservas con validación de horarios, historial médico y panel del personal. Frontend en **HTML + CSS + JavaScript puro**
(sin frameworks) y base de datos **PostgreSQL en Supabase** con seguridad por filas (RLS).

## 1. Puesta en marcha (≈10 minutos)

### Paso 1 · Crear el proyecto en Supabase
1. Entra a https://supabase.com → **New project** (anota la contraseña de la base de datos).
2. **SQL Editor → New query**, pega TODO el contenido de `supabase/schema.sql` y pulsa **Run**.
   Crea tablas, validaciones, políticas RLS, funciones seguras y los **16 servicios**. Se puede ejecutar varias veces.
3. **Project Settings → API**: copia **Project URL** y la clave **anon public**.
   *(Nunca uses la clave `service_role` en el frontend.)*

### Paso 2 · Conectar la app
Edita `js/config.js` y pega tus dos valores:
```js
window.PATA_CONFIG = {
  SUPABASE_URL: "https://xxxxxxxx.supabase.co",   // SOLO esto: sin /rest/v1/ (con él, el login falla con "invalid request")
  SUPABASE_ANON_KEY: "eyJhbGciOi..."
};
```

### Paso 3 · Configurar el correo (autenticación)
En Supabase → **Authentication**:
- **Providers → Email**: para probar rápido en clase desactiva *Confirm email* (si lo dejas activo, el registro pedirá confirmar por correo; la app lo maneja).
- **URL Configuration**: en **Site URL** y **Redirect URLs** agrega la URL donde publicarás la app
  (ej. `http://localhost:5500/index.html` y la de producción). Sin esto el enlace de "Olvidé mi clave" no vuelve a la app.

### Paso 4 · Ejecutar
Los service workers y PWA requieren `http://localhost` o `https`. No abras el HTML con doble clic.
```bash
npx serve . -l 5500        # o: python3 -m http.server 5500
```
Abre http://localhost:5500 . Para publicar: Netlify, Vercel, GitHub Pages o Cloudflare Pages (arrastrar la carpeta). En el celular, "Agregar a pantalla de inicio".

## 2. Cuentas y credenciales
| Rol | Cómo se obtiene |
|---|---|
| **Tutor** | Se crea desde la pantalla *Crear cuenta*. |
| **Personal** | Regístrate como tutor → *Perfil → Soy personal de la clínica* → ingresa el código **`PATA-STAFF-2026`** (un solo uso). |

Para generar más códigos (SQL Editor): `insert into staff_activation_codes(code) values ('TU-CODIGO-NUEVO');`
**Cambia el código de ejemplo antes de entregar** (`update staff_activation_codes set code='OTRO' where code='PATA-STAFF-2026';`).
Los correos y contraseñas de prueba los defines tú al registrarte; el repositorio no incluye contraseñas.

## 2b. Modo invitado (acceso oculto)
En la pantalla de acceso, toca el **logo 7 veces seguidas** (cada toque a menos de 1,5 s del anterior): aparece una advertencia.
Un toque más en el logo (antes de 6 s) abre `guest.html`. Sin esa secuencia, `guest.html` redirige al login.
Muestra los **avances del curso** (`data/curso.json`: semanas 1 a 3, 16 temas), el **catálogo de servicios leído en vivo de la base**
y una pestaña **Bloqueado** que comprueba contra la BD que citas, mascotas, historial y perfiles no son accesibles sin cuenta.
El bloqueo real lo hace la base (RLS: `anon` solo puede leer `services_catalog`); la interfaz solo lo refleja.

## 3. Qué hace cada pantalla
- **Acceso (única)**: ingresar / crear cuenta / recuperar contraseña / **nueva contraseña** (flujo final del enlace del correo). Mascotas animadas (gato y perro), patitas flotantes, bloqueo tras 5 intentos.
- **Inicio**: saludo, contadores animados, próxima cita, accesos rápidos y consejos desplegables.
- **Mascotas**: alta/edición/eliminación con validaciones; cada mascota se despliega.
- **Reservar** (4 pasos): mascota → servicio (categorías desplegables + buscador) → fecha y horarios libres → confirmar. Sin superposición (restricción `no_overlap` en la BD), sin domingos, horario 09–13 y 14–18, anticipación mínima 30 min, máx. 90 días y 5 citas activas por tutor.
- **Mis citas**: filtros, detalle desplegable y cancelación.
- **Historial**: por mascota, con próxima visita sugerida.
- **Servicios**: 16 servicios con filtros + comida para gatos.
- **Personal**: confirmar/rechazar (el rechazo exige motivo), agenda (hoy / 7 días / todas), registrar atención (completa la cita y actualiza el peso).
- **Perfil**: datos, cambio de contraseña, activación de personal, cerrar sesión.

## 4. PWA
Instalable (botón 📲 y menú del navegador), funciona en celular (barra inferior) y laptop (menú lateral).
`sw.js` precachea la app y los iconos para abrir sin conexión; las llamadas a Supabase **nunca** se cachean.
Sin conexión se muestran los últimos datos guardados y se bloquea escribir. Tema claro/oscuro, `prefers-reduced-motion` respetado.

## 5. Seguridad (RLS)
- Cada tutor solo ve/edita **sus** mascotas, citas e historial; el personal ve todo.
- El cliente **no puede** cambiar su rol, cambiar estados de citas ni escribir historial: eso solo ocurre por funciones `security definer` (`staff_set_status`, `staff_register_attention`, `activate_staff`, `cancel_my_appointment`).
- `staff_activation_codes` tiene RLS sin políticas: inaccesible desde el navegador.
- Todo el texto del usuario se escapa antes de mostrarse (anti-XSS).

## 6. Pruebas incluidas
```bash
npm i && npm test        # comprobaciones de interfaz con un Supabase simulado
node tests/links.test.js # verifica que no haya enlaces ni recursos rotos
```
`tests/db-test.sql` prueba el esquema en un PostgreSQL real (solapamientos, domingo, almuerzo, escalada de rol, RLS, flujo del personal).
**Importante:** no pude conectarme a tu proyecto Supabase real; antes de la exposición haz la prueba manual de la sección 7.

## 7. Lista de prueba manual (con tu Supabase real)
1. Crear cuenta A → entrar → agregar mascota → reservar mañana 10:00 → ver "Pendiente" en *Mis citas*.
2. Crear cuenta B (otro navegador) → intentar reservar el mismo horario → debe verlo ocupado.
3. Cuenta B → Perfil → activar personal → *Personal → Pendientes* → confirmar → *Agenda → Atender* → guardar diagnóstico.
4. Cuenta A → *Historial* → ver la atención y la próxima visita.
5. "Olvidé mi clave" → abrir el enlace del correo → crear nueva contraseña → ingresar.
6. Celular: instalar la PWA, activar modo avión y abrir: debe cargar con datos guardados.

## Estructura
```
index.html (acceso)  app.html (aplicación)  sw.js  manifest.json
css/style.css  js/{config,common,art,login,app}.js  js/vendor/supabase.js (supabase-js 2.45.4, sin CDN)
supabase/schema.sql  tests/  data/productos-gatos.json  imagenes/  icons/
```
