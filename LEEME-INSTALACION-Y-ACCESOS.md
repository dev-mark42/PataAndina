# PATA ANDINA VET · V25

## 1) Instalar el SQL limpio
1. Abre Supabase → SQL Editor → New query.
2. Abre `supabase/INSTALACION_LIMPIA_COMPLETA.sql`.
3. Copia todo, pégalo y pulsa Run una sola vez.

El script borra los datos operativos de `public` (perfiles, mascotas, citas,
historiales, servicios, códigos y bitácora) y los vuelve a cargar. NO borra
`auth.users` ni contraseñas. Inserta 50 servicios únicos y 200 eventos
marcados como demostración. Si ya existe el usuario cliente demo, crea tres
mascotas, tres historiales y dos citas futuras de prueba.

## 2) Crear usuarios para iniciar sesión
Supabase no permite crear cuentas Auth/passwords de forma soportada desde
un SQL del editor. Crea las cuentas en Authentication → Users → Add user,
activa Auto Confirm User y establece la contraseña:

- Cliente: `cliente.demo@pataandina.test` / `ClienteDemo2026!`
- Administrador: `admin.demo@pataandina.test` / `AdminDemo2026!`

Después de crear las cuentas, vuelve a ejecutar el SQL si lo habías corrido
antes de crear los usuarios. El script genera sus perfiles y asigna `tutor`
al cliente y `staff` al correo admin indicado. No compartas el acceso admin.

Si el alta desde la pantalla web muestra rate limit, no repitas el registro:
crea el usuario desde Authentication → Users. El login con contraseña sigue
funcionando una vez que la cuenta está creada y confirmada.

## 3) Invitado
Abre `invitado.html`. El invitado solo ve el catálogo de servicios públicos.
No ve avances, galería, mascotas, citas, pedidos, perfiles ni historiales.
No se invoca Supabase Auth. Los botones para solicitar una cita llevan al
login. La app privada `app.html` exige una sesión antes de mostrar contenido.

El SQL permite a `anon` únicamente `SELECT` sobre `services_catalog` con
`active=true`; no concede acceso anónimo a las demás tablas.

## 4) Publicar
Copia el contenido de esta carpeta a la raíz del repositorio `PataAndina` y
ejecuta:

```bash
git add .
git commit -m "Pata Andina V25: invitado solo servicios y SQL limpio"
git push origin main
```

Luego abre `https://dev-mark42.github.io/PataAndina/invitado.html` y fuerza
recarga con Ctrl+Shift+R. La versión del Service Worker se incrementó para
renovar la caché.

## 5) Verificación local
Con Node instalado, ejecuta `npm test`. El test de invitado comprueba que
solo consulta `services_catalog`, no usa Auth, dirige las acciones al login,
y que el SQL contiene 50 servicios únicos y 200 eventos demo.
