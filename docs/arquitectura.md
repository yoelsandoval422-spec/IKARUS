# Arquitectura (Bloque 1)

## Stack
Next.js 16 (App Router) · React 19 · TypeScript estricto (`strict` + `noUncheckedIndexedAccess`) · Tailwind CSS 4 · Zod 4 · Supabase JS 2 · Vitest 5 + Testing Library.

## Estructura

| Carpeta | Rol |
|---|---|
| `app/` | Rutas (App Router), layouts, `loading`, `error`, `not-found` |
| `components/` | Componentes reutilizables (navegación única `Nav`, tarjetas, badges, estados) |
| `lib/` | Lógica pura: filtros, estados, navegación, validación Zod |
| `lib/supabase/` | Lectura de variables (`env.ts`) y cliente opcional (`client.ts`) |
| `types/` | `AthleteSummary`, `DailyRecordStatus`, `AppRole`, etc. |
| `data/demo/` | Datos ficticios, aislados de futuras consultas reales |
| `tests/` | Pruebas Vitest |
| `docs/` | Documentación |

## Decisiones

1. **`data/demo/` separado de `lib/`**: evita que datos ficticios se importen por error desde código de datos reales.
2. **Navegación en `lib/navigation.ts`** y un solo componente `Nav` (horizontal/vertical) para no duplicar código.
3. **Supabase opcional**: `readSupabaseEnv()` valida con Zod; `getSupabaseClient()` devuelve `null` si falta configuración. Solo variables `NEXT_PUBLIC_*`; ninguna clave privilegiada.
4. **Sin `@supabase/ssr` todavía**: se añadirá junto con la autenticación (cookies/sesión) en un bloque posterior.
5. **`/configuracion` es dinámica** para leer el entorno en cada petición; no imprime URL ni claves.
6. **Accesibilidad**: foco visible global, enlace "Saltar al contenido", etiquetas en formularios, estados con texto + símbolo (no solo color), `prefers-reduced-motion`.
7. **Roles**: existe el tipo `AppRole`, pero no hay mecanismo alguno para que un deportista elija su rol; la asignación será del servidor.
8. **Estado de los formularios demo**: solo en memoria del navegador; nada se persiste.
9. **TypeScript 5.9** y **ESLint 9** (no las últimas mayores) por compatibilidad con `eslint-config-next`.

## Actualización Bloque 2

- `supabase/migrations/` y `supabase/admin/`: esquema, RLS y scripts de administración (ver `docs/base-de-datos.md`).
- `lib/auth/session.ts`: sesión validada en el servidor; sin sesión → modo demostración.
- `lib/data/`: acceso a datos con resultado tipado (`DataResult`) y respaldo demo; las páginas `/profesional` y `/profesional/deportistas` ya lo usan.
- `lib/schemas/records.ts`: esquemas Zod de los registros, alineados con las restricciones CHECK (probado).
- `lib/supabase/server.ts`: cliente de servidor con cookies (`@supabase/ssr`), solo clave pública.
- `types/database.ts`: tipos de filas (manuales por ahora).
- `tests/db/`: pruebas de RLS contra PGlite.

## Actualización Bloque 3 (autenticación)

- `proxy.ts` / `lib/supabase/proxy.ts`: renueva la sesión; solo hace una redirección optimista a `/login` si `APP_ALLOW_DEMO=false`. No consulta la base ni el rol (Next recomienda no hacer trabajo lento en el proxy ni depender solo de él).
- `lib/auth/session.ts`: `getSessionContext()` memoizado con `cache` de React (una verificación por petición); el rol sale de `profiles`.
- `lib/auth/guards.ts`: `authorizeRoute()` (pura, probada) y `requireArea()`, usado en cada página protegida y en el layout profesional.
- `lib/auth/redirect.ts`: saneo de `next` (sin redirecciones abiertas) y destino por rol.
- `app/login`, `components/LoginForm.tsx`: Server Action + `useActionState`.
- `lib/supabase/health.ts`: verificación real de conexión, solo accionable por profesionales autenticados.
- `app/layout.tsx` es dinámico: el encabezado muestra la sesión, así que ninguna página se prerrenderiza con un estado de sesión fijo.
- `next.config.ts`: cabeceras de seguridad básicas (sin CSP).

## Actualización Bloque 4 (validación)

- **Estados de sesión** (`lib/auth/session.ts` + `lib/auth/errors.ts`): `demo` (motivos `not-configured | no-session | expired | no-access`), `unavailable` (red/5xx: nunca se confunde con "sin sesión") y `authenticated`. `authorizeRoute()` los traduce a `/login?motivo=sesion-vencida`, `/acceso-denegado` o `/sin-conexion`.
- **Cookies** (`lib/supabase/cookies.ts`): `httpOnly`, `sameSite=lax`, `secure` en producción → requiere HTTPS fuera de localhost.
- **Claves**: `lib/supabase/env.ts` rechaza claves privilegiadas (`service_role`, `sb_secret_…`); un build con una clave falsa en el entorno no la incluye en ningún bundle (verificado).
- **Pruebas por capas** (cada una dice qué NO prueba):
  1. Unitarias/UI con mocks (`tests/auth`, `tests/security`).
  2. RLS en PGlite (`tests/db`), incluidos los scripts `supabase/test/*.sql`.
  3. E2E en Chromium contra Auth/REST simulado (`scripts/sim-e2e`).
  4. Integración contra un Supabase de pruebas (`tests-integration`, opcional, solo clave pública).
- `next.config.ts`: `NEXT_DIST_DIR` permite compilar a otra carpeta (usado por el E2E simulado).
- Nota de la simulación: el servidor simulado imita la tolerancia de Supabase a reutilizar un refresh token ~10 s; el cliente puede refrescar desde el proxy y desde el Server Component en la misma petición.
