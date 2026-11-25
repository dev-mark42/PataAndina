# Pata Andina V28 · correcciones para presentación

## Cambios
- Menú lateral agrupado por secciones (desktop) y drawer con botón hamburguesa (móvil).
- Barra inferior móvil visible: Inicio, Servicios, Mascotas, Citas y Más.
- Cerrar sesión accesible en menú lateral, Más y cabecera; Supabase `signOut({scope:"local"})` y retorno al login.
- Avances desbloqueados al octavo toque del logotipo, organizados por Semana 1, 2 y 3.
- Inicio subdividido en Resumen, Top 10, Mi espacio y Consejos para reducir scroll.
- Catálogo con tres fotos por servicio, miniaturas y ampliación. Usa imágenes locales incluidas; algunas fotografías externas intentan cargar primero y tienen fallback local.
- Caché PWA versionada para no conservar CSS/JS antiguos.
- Restaurada la configuración Supabase ya facilitada por el usuario.

## Datos de prueba extra
`supabase/demo-datos-extra.sql` agrega hasta 10 mascotas y 2 registros médicos por mascota para `cliente.demo@pataandina.test`. Es idempotente y no elimina información. Ejecutar solo después de crear esa cuenta en Authentication.

## Publicar
Reemplaza todos los archivos del repositorio con el contenido del ZIP y ejecuta:
```bash
git add .
git commit -m "Pata Andina V28 menu movil avances y galeria"
git push origin main
```
Luego abre la PWA y usa Ctrl+Shift+R. Si está instalada, cierra y vuelve a abrir o limpia los datos del sitio para descartar la caché antigua.
