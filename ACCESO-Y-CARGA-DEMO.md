# PATA ANDINA VET — acceso y datos demo V26

## Antes de ejecutar el SQL
El SQL completo limpia los datos operativos de `public` (perfiles, mascotas, citas, historiales, vacunas, desparasitaciones, catálogo y bitácora) y los vuelve a cargar. No elimina `auth.users` ni contraseñas. Haz una copia de seguridad si ya tienes datos reales.

Supabase no permite crear usuarios Auth/passwords desde el SQL Editor. En **Authentication → Users → Add user**, crea y confirma (Auto Confirm User) estas cuentas de prueba:

| Rol | Correo | Contraseña inicial |
|---|---|---|
| Cliente | `cliente.demo@pataandina.test` | `PataDemo2026!` |
| Administrador | `admin.demo@pataandina.test` | `AdminPata2026!` |

Cambia las contraseñas después de la demostración. Nunca publiques credenciales reales ni `service_role`.

## Ejecutar la base completa
1. Abre `supabase/INSTALACION_LIMPIA_COMPLETA.sql`.
2. Copia TODO en Supabase → SQL Editor → New query.
3. Pulsa Run una sola vez y revisa la tabla de resultados al final.

El script conserva las cuentas de Auth, reconstruye sus perfiles y carga 50 servicios, 200 eventos demo, 15 mascotas, 15 historiales, registros de vacunas y desparasitación, y tres citas futuras. Si no existe `cliente.demo@pataandina.test`, asigna las mascotas a la primera cuenta con rol `tutor` ya creada. Si no existe ningún tutor, muestra un aviso y no inventa una cuenta.

## Acceso
- Cliente: entra con correo y contraseña en `index.html`.
- Admin: entra con el correo admin demo; el SQL asigna el rol `staff`.
- Invitado: `invitado.html`; solo consulta `services_catalog`. No usa Auth y no tiene acceso a mascotas, perfiles, citas, historiales, vacunas, desparasitación ni bitácora. Cualquier acción que requiera cuenta abre el login.
- Avances: dentro de la app, toca el logotipo superior ocho veces seguidas. El séptimo toque avisa; el octavo desbloquea la sección. Su lista tiene desplazamiento interno.

## Límite de correos de Supabase
Si el registro muestra “Demasiados intentos”, no lo repitas: espera a que se libere el límite o crea la cuenta desde Authentication → Users con Auto Confirm User. El login normal funciona cuando la cuenta existe y está confirmada.
