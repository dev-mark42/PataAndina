# Acceso de cliente y datos de demostración

## Entrar como cliente
1. Abre el sitio publicado por HTTPS.
2. Pulsa **Crear cuenta** y registra tu correo real.
3. Usa una contraseña de al menos 8 caracteres con letras y números.
4. Confirma el correo si Supabase lo solicita.
5. Vuelve al login e inicia sesión. El perfil se crea automáticamente con rol `tutor` (cliente).

No existe una contraseña universal: las credenciales pertenecen a Supabase Auth. No es seguro ni compatible insertar usuarios directamente en `auth.users` mediante un INSERT SQL.

## Cargar datos de ejemplo
1. Registra tu cuenta cliente desde la app.
2. Abre `supabase/datos_demo_cliente.sql`.
3. Cambia `cliente.demo@pataandina.test` por el correo exacto de tu cuenta.
4. Ejecuta el archivo en Supabase SQL Editor.
5. Inicia sesión: aparecerán tres mascotas demo y seis servicios adicionales.

Puedes ejecutar el script más de una vez sin duplicar mascotas.

## Menú y PWA
- Escritorio: menú fijo a la izquierda.
- Celular: ☰ abre un panel lateral izquierdo, con cierre al elegir sección, tocar fuera o pulsar Escape.
- Se elimina el menú inferior para dar más espacio a la pantalla.
- Instala la PWA desde HTTPS. Se incrementó la caché del Service Worker para forzar la actualización.
- Si ya estaba instalada, ciérrala por completo y vuelve a abrirla tras desplegar los archivos.
