# Seguridad y privacidad de IKARU en producción

> **No afirmamos que IKARU esté "listo para producción con datos reales".** Está **preparado para publicar**; varias comprobaciones solo pueden hacerse en tu Vercel y tu Supabase. La columna *Estado* distingue lo verificado en el desarrollo (con simulaciones) de lo que te toca confirmar.

## 1. Lista de controles

| # | Control | Cómo se cumple | Estado |
|---|---|---|---|
| 1 | HTTPS en producción | Vercel lo da automático; la app envía `Strict-Transport-Security` en producción | Configurado. **Verificar en tu dirección real** (candado) |
| 2 | Cookies de sesión seguras | `httpOnly`, `Secure` (producción), `SameSite=Lax` | Probado por pruebas automáticas y en navegador real con Auth simulado. Confirmar en tu sitio publicado |
| 3 | Protección de rutas privadas | `proxy.ts` + `requireArea()` por rol en cada página | Probado (unitarias + E2E simulado). Confirmar con tus cuentas |
| 4 | RLS activo en todas las tablas | Migraciones 01–04 | Probado en PostgreSQL local (PGlite). **NO verificado en Supabase real** hasta ejecutar `03_verificar_rls.sql` y `npm run test:integration` en tu proyecto |
| 5 | Sin claves secretas en el frontend | Solo variables `NEXT_PUBLIC_*` públicas; se rechazan claves `service_role`/`sb_secret_` | Verificado: compilación con clave falsa → 0 apariciones en el código del navegador |
| 6 | Sin `.env.local` en el repositorio | `.gitignore` excluye `.env*` (salvo los `.example`); el ZIP no incluye ninguno | Verificado en el ZIP. **Revisá tu repositorio de GitHub** |
| 7 | Sin credenciales en archivos de configuración | Búsqueda de patrones de claves en el código | Verificado (0 hallazgos) |
| 8 | Sin datos sensibles en logs | Los errores mostrados son genéricos en español; no se imprimen claves ni datos de deportistas | Cubierto por pruebas; revisá los *Logs* de Vercel tras usar la app |
| 9 | Variables documentadas | [variables-de-entorno.md](variables-de-entorno.md) | Hecho |
| 10 | Manejo seguro de errores | Mensajes genéricos; páginas de error, sin conexión y acceso denegado | Probado |
| 11 | Demostración desactivada en producción | Por defecto apagada si `NODE_ENV=production` (Vercel) salvo `APP_ALLOW_DEMO=true` | Probado (unitarias + E2E con compilación de producción) |
| 12 | Producción distinta de desarrollo | `isDemoAllowed()` y cookies `Secure` dependen del entorno; Preview recomendado con Supabase de prueba | Hecho |
| 13 | Comportamiento si faltan variables | Login deshabilitado con aviso; sin datos | Probado |
| 14 | Buscadores | `robots.txt` bloquea todo y `noindex` | Hecho |
| 15 | Cabeceras de seguridad | `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` | Hecho. **Falta CSP** (pendiente) |
| 16 | Registro de nuevos usuarios | Debe estar desactivado en Supabase | **Te toca** (guía Supabase, paso 3) |
| 17 | Caché de datos privados | Sin service worker; páginas dinámicas | Hecho (ver [pwa-y-cache.md](pwa-y-cache.md)) |

## 2. Qué verificar vos tras publicar (15 minutos)

- [ ] La dirección carga con `https://` y candado.
- [ ] Sin iniciar sesión, abrir `/profesional` y `/deportista` te manda al login y **no se ven datos**.
- [ ] Login de profesional → panel con **solo** tus deportistas asignados; cerrar sesión funciona.
- [ ] Login de un deportista → no puede abrir `/profesional` (te lleva a *acceso denegado*).
- [ ] `/configuracion` → *Verificar ahora* en ✓.
- [ ] En Supabase: *Allow new users to sign up* **apagado**; `03_verificar_rls.sql` todo `ok = true`.
- [ ] En Vercel → Environment Variables: **no** hay `service_role`, ni `APP_ALLOW_DEMO=true`.
- [ ] Tu repositorio de GitHub es **privado** y no contiene `.env.local`.

## 3. Privacidad y protección de datos

IKARU maneja datos personales y de salud/deporte de personas, que suelen considerarse **datos sensibles**.

- **Separación**: cada deportista accede solo a lo suyo y cada profesional solo a sus asignados; la regla se aplica en la base (RLS), no solo en la pantalla.
- **Mínimos datos**: cargá solo lo necesario.
- **Nada privado en servicios públicos**: no subas datos de deportistas a GitHub, a chats ni a capturas.
- **Consentimiento**: obtené el **consentimiento informado y por escrito** de cada persona (de su tutor, si es menor) explicando qué datos se guardan, para qué, quién los ve y cómo pedir su eliminación. En Argentina rige la Ley 25.326 de Protección de Datos Personales; **consultá a un profesional del derecho** para el texto de consentimiento y las obligaciones (por ejemplo, registro de la base ante la autoridad). Esto no es asesoramiento legal.
- **Cuentas**: contraseñas únicas y fuertes; dar de baja las cuentas que ya no se usen (`profiles.is_active = false`).
- **Copias y recuperación**: ver guía de Supabase, paso 9.
- **Incidentes**: si sospechás que una clave o cuenta se filtró, cambiá contraseñas, regenerá claves en Supabase y revisá accesos.

## 4. Limitaciones conocidas

No hay límite propio de intentos de login (se usa el de Supabase), ni recuperación de contraseña, ni CSP, ni auditoría de seguridad externa, ni registro de accesos. Ver [pendientes.md](pendientes.md).
