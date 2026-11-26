-- Convierte TU cuenta en ADMINISTRADOR. Primero regístrate en la app con tu correo,
-- luego cambia el correo de abajo y ejecuta esto en Supabase > SQL Editor.
update public.profiles set role = 'admin'
 where id = (select id from auth.users where email = 'TU-CORREO@ejemplo.com');
-- Para volver a tutor: set role = 'tutor'
