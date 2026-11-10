# PWA y caché en IKARU

## Qué hay hoy

| Pieza | Estado |
|---|---|
| Web App Manifest (`app/manifest.ts` → `/manifest.webmanifest`) | Hecho: nombre IKARU, nombre corto IKARU, colores, `display: standalone`, íconos 192, 512 y *maskable* |
| Íconos (`public/icons/`) y favicon (`app/icon.svg`) | **Provisionales** (letra I): reemplazar por los definitivos conservando los nombres (ver `public/brand/LEEME.md`) |
| Metadatos para iPhone (`apple-touch-icon`, título) | Hecho |
| Diseño responsive | Hecho en las pantallas actuales |
| **Service worker / modo sin conexión** | **No implementado, a propósito** |

Con esto, desde el navegador del celular se puede **"Agregar a la pantalla de inicio"** y IKARU se abre como una app, **pero siempre en línea**.

## Por qué no hay service worker

La seguridad tiene prioridad sobre el uso sin conexión. Un service worker puede guardar copias de páginas y respuestas en el dispositivo. En IKARU eso implicaría riesgo de dejar guardados:

- datos personales y deportivos,
- contenido de páginas protegidas,
- respuestas autenticadas de Supabase y sesiones,

que podrían verse desde un dispositivo compartido o tras cerrar sesión. Una PWA con caché mal configurada comprometería la privacidad, y no queremos entregar una PWA incompleta o insegura.

Una prueba automática (`tests/brand.test.ts`) verifica que no exista `sw.js` ni ningún registro de service worker.

## Cómo se evita la caché de datos privados hoy

- Las páginas privadas son dinámicas (`force-dynamic`): se generan en cada visita según la sesión.
- Las cookies de sesión son `httpOnly`, no accesibles desde scripts.
- `robots.txt` y `noindex` evitan que buscadores copien contenido.

## Cuándo reconsiderarlo (pendiente)

Si algún día se quiere un modo sin conexión (por ejemplo, que un deportista anote datos sin señal), debe diseñarse aparte con: cola de envíos cifrada, nada de páginas autenticadas en caché, borrado al cerrar sesión y revisión de seguridad. Hasta entonces: **no implementar**.
