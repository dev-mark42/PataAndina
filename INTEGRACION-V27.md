# Pata Andina V27 · Integración de sistema central + diseño

## Qué se conservó del sistema central
- Autenticación Supabase: login, registro, recuperación y cambio de contraseña.
- Registro/edición/eliminación de mascotas.
- Reserva en cuatro pasos con disponibilidad y validación horaria.
- Mis citas, cancelación, historial médico y panel del personal.
- Esquema PostgreSQL y RLS originales del sistema central.

## Qué se integró del diseño anterior
- Paleta verde bosque, crema y terracota, animaciones y contraste del tema oscuro.
- Acceso de invitado independiente, solo lectura del catálogo `services_catalog`.
- Inicio de cliente con recomendaciones Top 10, filtros por categoría y accesos rápidos.
- Diseño responsive con menú lateral en escritorio y dock móvil.
- Panel informativo de avances al tocar el logotipo ocho veces.

## Configuración
1. Mantén tus credenciales de Supabase en `js/config.js` (URL + anon public key).
2. El esquema central está en `supabase/schema.sql`. Si ya lo ejecutaste, no necesitas reinstalarlo para estos cambios de interfaz.
3. La política original permite `SELECT` anónimo solo de servicios activos. El invitado no consulta mascotas, perfiles, citas ni historiales.
4. Publica todos los archivos conservando la estructura de carpetas.

## Publicar
```bash
git add .
git commit -m "Pata Andina V27 integracion visual y cliente"
git push origin main
```

## Pruebas
Se ejecutó comprobación sintáctica de JavaScript con `node --check`. La suite automatizada requiere instalar la dependencia `jsdom` (`npm install`) antes de ejecutar `npm test`. No se afirma que el backend remoto haya sido probado; la conexión real depende de la configuración de Supabase y sus políticas desplegadas.
