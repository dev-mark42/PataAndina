# PATA ANDINA VET · V26

## 1. Crear las cuentas de demostración
En Supabase → Authentication → Users → Add user, crea y confirma:

- Cliente: `cliente.demo@pataandina.test` / `PataDemo2026!`
- Administrador: `admin.demo@pataandina.test` / `AdminPata2026!`

Supabase Auth administra las contraseñas; no se crean con INSERT SQL. Cambia las claves tras la prueba.

## 2. Cargar TODA la base de datos con un solo SQL
Abre `supabase/INSTALACION_LIMPIA_COMPLETA.sql`, copia el archivo entero en Supabase → SQL Editor → New query y pulsa Run.

**Advertencia:** el script borra y reconstruye los datos operativos de `public`, pero conserva `auth.users` y sus contraseñas. No lo ejecutes sobre datos reales sin respaldo.

Carga 50 servicios, 200 eventos DEMO, 15 mascotas, 15 historiales, vacunas, desparasitaciones y tres citas futuras. Si el usuario demo no existe, asigna las mascotas a la primera cuenta tutor existente. Si no hay tutor, muestra un aviso. La salida final muestra los conteos.

## 3. Funciones de la aplicación
- Login, registro, confirmación de correo y recuperación/cambio de contraseña.
- Perfil de tutor, mascotas (crear/editar/eliminar), historial clínico.
- Vacunas y desparasitación visibles dentro del historial por mascota.
- Catálogo de servicios con filtros y fotografías ampliables.
- Reserva de citas en pasos: mascota → servicio → fecha/horario → confirmación; validación de horarios y prevención de cruces en la BD.
- Mis citas y cancelación; panel de personal para agenda y registrar atenciones; bitácora.
- Invitado: catálogo de servicios únicamente, sin autenticación ni acceso a tablas privadas. Las acciones restringidas redirigen al login.
- Avances ocultos: ocho toques seguidos sobre el logotipo superior; el séptimo avisa y el octavo abre la sección con scroll interno.

## 4. Publicar
Copia esta carpeta a la raíz del repositorio `PataAndina` y ejecuta:

```bash
git add .
git commit -m "Pata Andina V26: mascotas, vacunas y avances ocultos"
git push origin main
```

Después abre `https://dev-mark42.github.io/PataAndina/index.html` y fuerza recarga con `Ctrl + Shift + R`.

## 5. Pruebas locales
Con Node instalado:

```bash
npm test
```

Las pruebas revisan referencias locales, modo invitado de solo lectura, el acceso oculto por ocho toques, el historial de vacunas/desparasitación y la presencia de 15 mascotas/200 eventos en el SQL. No equivalen a ejecutar el SQL en tu proyecto Supabase real; esa verificación final se hace al pulsar Run y revisar los conteos devueltos.
