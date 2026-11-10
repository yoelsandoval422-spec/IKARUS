# Registro de cambios

## Bloque 5 — Identidad IKARU y preparación para publicar online

| Área | Cambio |
|---|---|
| Marca | `lib/brand.ts` es la única fuente de verdad (nombre IKARU, nombre corto, frase "Evolucionamos juntos.", concepto, descripción, colores, rutas de íconos). Nombres técnicos (tablas, rutas, variables) **no** se tocaron |
| Logotipo | `components/BrandLogo.tsx`: logotipo **provisional** de texto (tipografía fuerte, espaciada, barra de acento). Sin símbolo inventado. Estructura para el definitivo en `public/brand/LEEME.md` |
| Interfaz | Encabezado, bienvenida, inicio de sesión (con la frase, solo allí y en la bienvenida), pantalla de carga y metadatos usan IKARU; título del navegador `Pantalla · IKARU` |
| Íconos | `app/icon.svg` y `public/icons/` (192, 512, *maskable*, Apple touch): provisionales |
| PWA | `app/manifest.ts` (nombre IKARU, `standalone`, íconos); **sin service worker** a propósito (ver `docs/pwa-y-cache.md`) |
| Producción | La demostración queda **apagada por defecto** en producción (`lib/config.ts`); sin Supabase configurado en producción se va a `/login` con aviso (`lib/auth/guards.ts`) |
| Buscadores | `app/robots.ts` y `noindex`: plataforma privada |
| Pruebas | `tests/brand.test.ts` (marca, manifest, íconos, ausencia de service worker, navegación por rol) y ampliaciones en guards/redirect/pages. E2E simulado: app "A" con `APP_ALLOW_DEMO=true`, app "B" sin la variable (valor por defecto de producción) |
| Documentación | README, guías de Vercel y Supabase, variables de entorno, seguridad y privacidad, tareas del propietario, PWA/caché, pendientes |

## Bloque 4 — Validación y puesta en marcha controlada
Auditoría, scripts SQL de prueba (`supabase/test/`), pruebas de integración opcionales, E2E simulado en Chromium, estados de interfaz en español, corrección de un tipo (`AuthErrorLike`).

## Bloques 1–3
Base técnica y prototipo; esquema, RLS y capa de datos (migraciones 01–04); autenticación, proxy de sesión y guards por rol.
