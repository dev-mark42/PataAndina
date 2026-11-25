# PATA ANDINA VET — acceso y datos de demostración

## Por qué aparece «Demasiados intentos»
Ese aviso viene del límite de autenticación/envío de correos de Supabase. No es un error visual del formulario y no se puede saltar desde JavaScript sin poner en riesgo las cuentas. No pulses Crear cuenta repetidamente. Espera a que se libere el límite.

Para una prueba académica rápida, en Supabase abre **Authentication → Users → Add user** y crea manualmente estas dos cuentas. Marca **Auto Confirm User / Email confirmed**:

| Rol | Correo | Contraseña inicial |
|---|---|---|
| Cliente | `cliente.demo@pataandina.test` | `PataDemo2026!` |
| Administrador / personal | `admin.demo@pataandina.test` | `AdminPata2026!` |

Estas cuentas NO se crean desde este ZIP porque no tengo acceso administrativo a tu proyecto Supabase. Debes crearlas una sola vez en el panel. Cambia ambas contraseñas después de la prueba y no uses estas credenciales en producción.

El admin inicia sesión y entra a **Perfil → Soy personal de la clínica**. Usa el código inicial `PATA-STAFF-2026` (de un solo uso). Cámbialo en `schema.sql` antes de publicar a usuarios reales.

## Orden para cargar la base de datos
1. En Supabase → SQL Editor, ejecuta `supabase/schema.sql` si todavía no lo hiciste.
2. Ejecuta `supabase/seed_completo_y_bitacora.sql`.
3. Crea las dos cuentas de la tabla anterior en Authentication → Users.
4. Ejecuta `supabase/crear_usuarios_demo.sql`.
5. Ingresa como cliente para ver Luna, Michi, Toby y sus fichas médicas.
6. Ingresa como admin, activa el perfil de personal y abre **Administración → Bitácora**.

El catálogo queda con 50 servicios activos (16 originales + 34 nuevos). La bitácora contiene 200 eventos históricos ficticios marcados `DEMO`; los cambios reales de mascotas, citas e historiales quedan registrados automáticamente desde que se ejecuta el SQL. La interfaz distingue los eventos DEMO de los reales.

## Imágenes de servicios
Se utilizan fotografías locales incluidas en `imagenes/` para que también se vean en la PWA sin depender de servicios externos. Pulsa la fotografía para ampliarla. Las imágenes son ilustrativas, no fotografías clínicas de pacientes de la veterinaria.

## Error de correo / rate limit
Si Supabase todavía bloquea el registro o el correo de confirmación, no intentes crear más cuentas. Crea los usuarios desde Authentication → Users como se indicó. Revisa también Authentication → Rate Limits y la configuración SMTP/Email Provider del proyecto. No publiques ni compartas la `service_role` key; el navegador debe usar únicamente la clave publicable/anon.
