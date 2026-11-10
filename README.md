# IKARU — Evolucionamos juntos. (Bloque 5: identidad y preparación para publicar online)

Prototipo web responsive en español. Los deportistas cargarán registros diarios desde el celular y el profesional los revisará desde una computadora. Más adelante se agregará el módulo antropométrico ISAK Nivel 1 (ampliable a Nivel 2).

> **Cada persona tiene su propio camino, pero nadie tiene que recorrerlo en soledad.**

## ¿Qué es IKARU y cómo se usa?

IKARU es una plataforma web de seguimiento para deportistas y personas físicamente activas. **Se usa desde el navegador** (computadora, tablet o celular) entrando a una dirección web: **no hay que instalar Node.js, npm, Visual Studio Code ni ningún programa.** La instalación y compilación ocurren en el servicio de alojamiento (Vercel), no en tu dispositivo.

### Estado real (leelo antes de publicar)

| Etapa | Estado |
|---|---|
| Proyecto **preparado** para publicar (marca, Vercel, Supabase, controles de producción) | **Sí** |
| Proyecto **desplegado** en Vercel | **No**: no hay acceso a tu cuenta. Lo hacés vos con la [guía de Vercel](docs/guia-vercel.md) |
| Proyecto **conectado** a un Supabase real | **No**: nunca se probó contra un Supabase real. Guía: [Supabase](docs/guia-supabase.md) |
| Probado con **usuarios reales** | **No** |
| Formularios diarios del deportista | **No guardan datos** (están marcados como demostrativos) |

### Guías para personas sin conocimientos de programación

| Necesito… | Documento |
|---|---|
| Publicar IKARU en internet | [docs/guia-vercel.md](docs/guia-vercel.md) |
| Conectar la base de datos y las cuentas | [docs/guia-supabase.md](docs/guia-supabase.md) |
| Saber qué es cada variable de entorno | [docs/variables-de-entorno.md](docs/variables-de-entorno.md) |
| Revisar seguridad y privacidad antes de usar datos reales | [docs/seguridad-produccion.md](docs/seguridad-produccion.md) |
| Ver qué tareas solo puedo hacer yo | [docs/tareas-del-propietario.md](docs/tareas-del-propietario.md) |
| Entender la app instalable (PWA) y la caché | [docs/pwa-y-cache.md](docs/pwa-y-cache.md) |
| Ver qué falta | [docs/pendientes.md](docs/pendientes.md) |
| Ver qué cambió | [docs/registro-de-cambios.md](docs/registro-de-cambios.md) |

### Identidad de marca

Todo el texto de marca (nombre IKARU, frase, concepto, colores, rutas de íconos) está en **un solo archivo**: `lib/brand.ts`. El logotipo actual es **provisional** (solo texto); para el definitivo, ver `public/brand/LEEME.md`. La marca es independiente de la parte técnica: no se renombraron tablas, rutas ni variables.

---

## Para quien desarrolla o prueba (opcional; el resto del documento es técnico)

> **Verificación técnica:** instalación limpia, lint, TypeScript, pruebas y compilación **se ejecutaron y pasan** (tabla en *Verificación*). Autenticación, proxy de sesión y rutas por rol se probaron en navegador real contra un Auth **simulado**, y las políticas RLS contra PostgreSQL local (PGlite). **Nada se probó contra Supabase ni Vercel reales.** Sin sesión, en desarrollo, la app funciona en **modo demostración** (nada se guarda); **en producción la demostración viene apagada**.

## Requisitos

- Node.js 22.22 o superior (probado con 22.22.2; ver `.nvmrc`) y npm 10+.
- Opcional: un proyecto de Supabase (la app arranca sin él).

## Instalación

```bash
npm install
```

## Configuración (opcional)

```bash
cp .env.example .env.local
# completa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Usa solo la clave pública (anon/publishable). **Nunca** pongas una clave `service_role` en el cliente ni en variables `NEXT_PUBLIC_*`. Sin estas variables la app muestra un aviso en `/configuracion` y sigue en modo demostración.

## Desarrollo

```bash
npm run dev          # http://localhost:3000
npm run build        # compilación de producción
npm run start        # sirve la compilación
```

## Pruebas y calidad

```bash
npm test             # Vitest (una pasada)
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run verify       # lint + typecheck + test + build
npm run test:integration  # contra un Supabase DE PRUEBAS (se omite si no lo configuras)
npm run sim:e2e      # navegador real + Auth simulado (requiere Playwright, ver abajo)
```

## Rutas

| Ruta | Contenido |
|---|---|
| `/` | Bienvenida y accesos |
| `/deportista` | Registro del día (formularios demostrativos) |
| `/profesional` | Panel con tarjetas y tabla demo |
| `/profesional/deportistas` | Listado con búsqueda y filtros |
| `/profesional/evaluaciones` | Reserva del módulo antropométrico |
| `/profesional/informes` | Reserva de informes |
| `/login` | Inicio de sesión (correo y contraseña) |
| `/acceso-denegado` | Se muestra si tu rol no corresponde a la sección |
| `/configuracion` | Estado de variables y sesión (sin mostrar secretos) y verificación real de la conexión |


## Configurar Supabase paso a paso

1. Crea un proyecto en <https://supabase.com> (Dashboard → New project) y guarda la contraseña de la base en un gestor de contraseñas (la app **no** la usa).
2. **Migraciones.** Ejecuta, en este orden, cada archivo de `supabase/migrations/` en *SQL Editor → New query → Run*:
   1. `20261021100000_identity.sql`
   2. `20261021100100_structure_and_athletes.sql`
   3. `20261021100200_daily_records.sql`
   4. `20261027100000_auth_hardening.sql` (correcciones: ventana de edición `STABLE` y perfiles de usuarios previos; ejecútala siempre, aunque ya hayas corrido 1–3)

   Alternativa con la CLI de Supabase: `supabase link --project-ref <ref>` y luego `supabase db push`.
   Cada archivo debe correr sin errores; no los ejecutes dos veces (no son idempotentes).
3. **Variables.** En *Project Settings → API* copia la *Project URL* y la clave *anon/publishable* a `.env.local` (ver `.env.example`). Nunca uses la clave `service_role` en la app.
4. **Crea usuarios** en *Authentication → Users* (uno para el profesional y uno por deportista). El perfil se crea solo, siempre con rol `athlete`.
5. **Promueve al profesional** (único camino para obtener ese rol): abre `supabase/admin/01_promover_profesional.sql`, reemplaza el correo y ejecútalo en el SQL Editor.
6. **Crea deportistas y asígnalos.** Un profesional puede crear fichas (`athletes`) y queda asignado automáticamente. Para vincular la cuenta de un deportista con su ficha usa `supabase/admin/03_vincular_cuenta_deportista.sql`; para asignar un deportista a otro profesional, `supabase/admin/02_asignar_deportista.sql`.
7. Reinicia `npm run dev` y abre `/configuracion` para ver si las variables fueron detectadas.



## Autenticación: configurar y probar

### Cómo funciona
| Pieza | Qué hace |
|---|---|
| `app/login` | Formulario (Server Action) con `signInWithPassword`; errores en español sin revelar si el correo existe; tras entrar comprueba que exista un perfil **activo** y redirige según el rol |
| Cierre de sesión | Botón en el encabezado (Server Action): invalida la sesión y limpia cookies |
| `proxy.ts` + `lib/supabase/proxy.ts` | Renueva la sesión en cada navegación (`getClaims`) siguiendo el patrón de Supabase SSR para Next 16, y copia las cookies a la petición y a la respuesta |
| `lib/auth/session.ts` | Valida al usuario con `auth.getUser()` en el servidor y lee el **rol de la tabla `profiles`**, nunca de `user_metadata` |
| `lib/auth/guards.ts` | `requireArea()` en cada página protegida: deportista → solo `/deportista`; profesional → solo `/profesional/*`; otro rol → `/acceso-denegado` |
| Base de datos | Aunque alguien saltara la interfaz, RLS vuelve a limitar cada consulta (ver `docs/base-de-datos.md`) |

Sin variables de Supabase, o sin sesión, la app sigue en **modo demostración**: aviso visible en el encabezado y en cada pantalla, y nada se guarda. En **producción** (Vercel) el modo demostración está **apagado por defecto**: los visitantes sin sesión van a `/login` (solo se activa con `APP_ALLOW_DEMO=true`).

### Preparar Supabase para el login
1. Ejecuta las 4 migraciones (sección anterior).
2. **Desactiva el auto-registro público**: en el panel, *Authentication → Sign In / Providers → Email* → apaga *Allow new users to sign up* (los nombres de los menús pueden variar según la versión del panel). Así solo existen las cuentas que tú crees.
3. Crea los usuarios en *Authentication → Users → Add user → Create new user* (marca *Auto Confirm User*): un profesional y al menos dos deportistas de prueba.
4. Promueve al profesional con `supabase/admin/01_promover_profesional.sql` (cambia el correo y ejecuta en el SQL Editor).
5. Crea las fichas de los deportistas y asígnalas (SQL Editor; aún no existe pantalla para esto):
   ```sql
   insert into public.athletes (display_name) values ('Deportista Prueba 1'), ('Deportista Prueba 2') returning id, display_name;
   ```
   Copia cada `id` y úsalo en `supabase/admin/03_vincular_cuenta_deportista.sql` (cuenta ↔ ficha) y en `supabase/admin/02_asignar_deportista.sql` (profesional ↔ deportista).
6. Completa `.env.local` (ver `.env.example`) y reinicia `npm run dev`. Para ver el efecto de exigir sesión añade `APP_ALLOW_DEMO=false`.

### Probar la autenticación (lista de comprobación manual)
| # | Acción | Resultado esperado |
|---|---|---|
| 1 | Sin iniciar sesión, abre `/profesional` (con `APP_ALLOW_DEMO` sin definir) | Datos ficticios con aviso "Modo demostración" |
| 2 | Con `APP_ALLOW_DEMO=false`, abre `/profesional` sin sesión | Redirige a `/login?next=%2Fprofesional` |
| 3 | En `/login`, escribe una contraseña incorrecta | "Correo o contraseña incorrectos." (el correo queda escrito, la contraseña no) |
| 4 | Entra como profesional | Va a `/profesional`; encabezado "Sesión · profesional"; aviso "Datos reales"; solo ves a tus deportistas asignados |
| 5 | Como profesional abre `/deportista` | `/acceso-denegado` |
| 6 | Pulsa "Cerrar sesión" | Vuelves al inicio en modo demostración |
| 7 | Entra como deportista | Va a `/deportista`; el aviso aclara que los formularios no guardan nada |
| 8 | Como deportista abre `/profesional` | `/acceso-denegado` |
| 9 | Abre `/login?next=https://ejemplo.com` e inicia sesión | Ignora `next` y va al inicio de tu rol |
| 10 | Como profesional abre `/configuracion` y pulsa "Verificar ahora" | Dos pasos en ✓ (autenticación alcanzable y tabla `categories` legible). **Este es el único punto donde se comprueba la conexión real.** |
| 11 | Mantén la sesión más de una hora y navega | Sigue activa (renovación por `proxy.ts`) |

Si el paso 10 falla, `/configuracion` indica qué falló (URL, clave o migraciones) sin mostrar secretos.

### Qué no hace todavía
No hay registro público, recuperación de contraseña, cambio de contraseña ni correo de invitación: las cuentas las crea el administrador en el panel. No hay protección contra fuerza bruta propia (se usan los límites de Supabase Auth) ni cabecera CSP.

## Base de datos

Resumen en `docs/base-de-datos.md` (tablas, relaciones, matriz de permisos, decisiones de seguridad).

## Pruebas

`npm test` ejecuta, además de las pruebas de interfaz, **pruebas de RLS contra PostgreSQL real (PGlite)**: aplican las migraciones tal cual y simulan a cada usuario (`set role authenticated` + `auth.uid()`). Imitan de Supabase solo los roles, `auth.users` y `auth.uid()`. No sustituyen una verificación en tu proyecto real.

## Implementado y pendiente

| Implementado | Pendiente |
|---|---|
| 4 migraciones; RLS en todas las tablas; rol profesional solo asignable por el servidor | Ejecutarlas y verificar todo en **tu** proyecto Supabase (nunca se hizo) |
| Login/logout, errores claros, `next` saneado, perfil activo obligatorio | Recuperar/cambiar contraseña, invitaciones por correo |
| `proxy.ts` con renovación de sesión por cookies | Verificar la renovación con un proyecto real |
| Guards por rol (`requireArea`) + RLS como segunda barrera | Pantallas de alta de deportistas y asignaciones (hoy por SQL) |
| Modo demostración identificado; `APP_ALLOW_DEMO` | Pantallas de carga diaria reales (hoy demostrativas) |
| Capa de datos conectada a Supabase para la lista de deportistas | Resto de consultas (registros, informes) |
| `/configuracion` con verificación real de conexión (solo profesionales) | Fórmulas ISAK y su interfaz |
| 362 pruebas + E2E simulado en navegador + pruebas de integración listas | Ejecutar integración y E2E reales en Supabase de prueba, CSP, auditoría externa, `supabase gen types` |

## Supabase de prueba (independiente del real)

Objetivo: comprobar login, sesión y RLS con cuentas reales **sin tocar datos de deportistas**. Todo esto lo haces tú; el código no ejecuta nada contra ningún proyecto remoto por su cuenta.

1. **Crea un proyecto nuevo**, solo para pruebas (Supabase → New project; por ejemplo `handball-test`). Nunca uses el proyecto con datos reales.
2. **Migraciones, en este orden**, pegándolas en SQL Editor (todas son aditivas, ninguna borra datos):
   `supabase/migrations/20261021100000_identity.sql` → `…100100_structure_and_athletes.sql` → `…100200_daily_records.sql` → `20261027100000_auth_hardening.sql`.
3. **Auth**: Authentication → Providers → Email activo; desactiva *Allow new users to sign up*; para pruebas puedes desactivar *Confirm email* o confirmar a mano cada usuario.
4. **Cuentas**: Authentication → Users → *Add user* → 5 cuentas con contraseñas de prueba (gestor de contraseñas): `pro1`, `pro2`, `ath1`, `ath2`, `ath3`. Quedan con rol *athlete* (el trigger de perfiles lo asigna).
5. **Datos de prueba y rol profesional (seguro)**: abre `supabase/test/01_sembrar_datos_de_prueba.sql`, reemplaza los 5 correos y ejecútalo. Crea 3 deportistas ficticios (ids `7e57…`), promueve a `pro1` y `pro2` a profesional, asigna `pro1`→TEST 1 y 2, `pro2`→TEST 3, y vincula `ath1..3`. **Se niega a correr** si el proyecto ya tiene deportistas que no son de prueba. El rol profesional **solo** se otorga así (SQL Editor, rol `postgres`) o con `supabase/admin/01_promover_profesional.sql`: ningún usuario puede ascenderse desde la app.
6. **Verificar la configuración de RLS**: ejecuta `supabase/test/03_verificar_rls.sql` (solo lee). Todas las filas deben tener `ok = true`.
7. **Pruebas de integración** (comportamiento real con cuentas distintas):
   ```bash
   cp .env.test.example .env.test.local   # completa URL, clave pública anon/publishable, 5 cuentas y TEST_CONFIRM_TEST_PROJECT=si
   npm run test:integration
   ```
   Usa solo la clave pública (rechaza `service_role`/`sb_secret_…`). Sin variables TEST_* las pruebas se **omiten**; con configuración incompleta **fallan** a propósito. Cubren: anon sin acceso, el deportista solo ve/escribe lo suyo y no puede ascenderse, cada profesional solo ve a sus asignados, y los cruces entre cuentas.
8. **Probar la app contra ese proyecto**: en `.env.local` pon la URL y clave pública **del proyecto de prueba**, `npm run dev`, y recorre la lista manual de abajo.
9. **Reiniciar el entorno de prueba**: `supabase/test/02_reiniciar_datos_de_prueba.sql` borra **solo** las filas `7e57…` y lo que cuelga de ellas (no toca cuentas, perfiles ni otros deportistas); luego vuelve a ejecutar el 01. Para empezar de cero del todo, borra el proyecto de prueba en el panel.

### Simulación E2E en navegador (no es Supabase real)

```bash
npm i -D playwright && npx playwright install chromium   # una vez
npm run sim:e2e
```
Compila la app con una URL falsa, levanta un servidor de Auth/REST simulado y recorre 16 escenarios en Chromium (73 comprobaciones): modo demostración, credenciales incorrectas, login/logout profesional, rol tomado de la base y no de `user_metadata`, profesional fuera de `/deportista`, sesión vencida, servicio caído, cuentas sin perfil activo, redirecciones abiertas, renovación de token y `APP_ALLOW_DEMO=false`. Valida cookies, `proxy.ts`, Server Actions y redirecciones; **no valida RLS ni el comportamiento de tu Supabase**.

### Estados de la interfaz (en español, sin datos técnicos)

| Situación | Qué ve la persona |
|---|---|
| Cargando | Indicador de carga en el login y la verificación de conexión |
| Credenciales incorrectas | "Correo o contraseña incorrectos." (mismo mensaje exista o no el correo) |
| Sesión vencida | `/login` con "Tu sesión venció. Ingresa de nuevo para continuar." |
| Sin permisos | `/acceso-denegado` (también para cuentas sin perfil activo) |
| Error de conexión | `/sin-conexion` o aviso en el login; nunca se muestran datos |
| Supabase sin configurar | Aviso en `/configuracion` y modo demostración |
| Modo demostración | Insignia visible; no se guarda nada |

### Comprobaciones manuales que te tocan

- [ ] Login de `pro1` → llega a `/profesional`; recargar y cerrar/abrir el navegador mantiene la sesión; *Salir* cierra la sesión y `/profesional` vuelve a pedir login.
- [ ] Login de `ath1` → `/deportista`; `/profesional` lleva a *acceso denegado*.
- [ ] `pro1` ve solo TEST 1 y 2 en `/profesional/deportistas`; `pro2` solo TEST 3.
- [ ] Cuenta sin perfil activo (desactívala en `profiles.is_active`) → bloqueada.
- [ ] `/configuracion` → *Verificar ahora* con `pro1`: todo en verde.
- [ ] `npm run test:integration` y `03_verificar_rls.sql` sin fallos **en tu proyecto de prueba**.
- [ ] Con `APP_ALLOW_DEMO=false`, sin sesión te lleva a `/login`.
- [ ] En producción usa **HTTPS** (las cookies de sesión son `Secure`; en HTTP no localhost no se guardan).
- [ ] Revisa en el panel de Supabase que *sign ups* estén desactivados y que no haya claves `service_role` en variables del hosting del front.

## Verificación (resultados reales del Bloque 5)

| Comprobación | Resultado |
|---|---|
| Instalación limpia (`npm ci`, Node 22.22.2) | APROBADO |
| Lint | APROBADO (0 errores, 0 avisos) |
| TypeScript estricto | APROBADO |
| Pruebas (`npm test`) | APROBADO: 23 archivos, 362 pruebas (incluye autenticación, rutas, roles, marca, manifest, entorno y RLS en PGlite) |
| Compilación de producción (`next build`) | APROBADO (sin Supabase configurado y con variables de prueba) |
| Arranque de la compilación sin Supabase | APROBADO: `/profesional` y `/deportista` redirigen a `/login` con aviso "Supabase no está configurado"; no se ven datos ficticios; cabeceras HSTS/X-Frame/nosniff presentes; `/manifest.webmanifest` y `/robots.txt` responden |
| Escaneo de secretos (build con `service_role` falsa en el entorno) | APROBADO: 0 apariciones en `.next`; 0 claves en el código fuente |
| Simulación E2E en Chromium (Auth **simulado**) | APROBADO: 16 escenarios, 73/73 |
| RLS en PGlite (PostgreSQL local, **no** Supabase) | APROBADO |
| Diseño responsive en pantallas reales (Android, iPhone, tablet) | **NO EJECUTADO** (no hay dispositivos; solo revisión de código/clases) |
| Despliegue en Vercel | **NO EJECUTADO** (sin acceso a tu cuenta) |
| Conexión con un Supabase real / login real | **NO EJECUTADO** |
| RLS en Supabase real (`03_verificar_rls.sql`, `npm run test:integration`) | **NO EJECUTADO** |

## Solución de problemas

| Síntoma | Causa / solución |
|---|---|
| Aviso "Supabase no está configurado" | Faltan variables; copia `.env.example` a `.env.local`. Es normal en el prototipo. |
| Cambié `.env.local` y no se nota | Reinicia `npm run dev`. |
| Advertencia `EBADENGINE` al instalar | Actualiza Node a 22.22.2+ (o 24.15+). |
| Puerto 3000 ocupado | `npm run dev -- -p 3001`. |

Más detalle en `docs/arquitectura.md` y `docs/pendientes.md`.
| "Tu cuenta todavía no está habilitada" al ingresar | El usuario no tiene perfil activo: ejecuta la migración 04 (crea perfiles faltantes) o revisa `profiles.is_active` |
| Ingreso correcto pero vuelves a `/login` o ves demostración | Perfil inexistente/inactivo, o la sesión no llegó: revisa que `proxy.ts` esté en la raíz y que las variables correspondan al mismo proyecto |
| Profesional con la lista vacía | No tiene deportistas asignados: usa `supabase/admin/02_asignar_deportista.sql` |
| "Demasiados intentos" | Límite de Supabase Auth; espera unos minutos |
| "Verificar ahora" marca falla en migraciones | Aún no ejecutaste las migraciones, o el usuario no es profesional activo |
| Cualquiera puede registrarse | Desactiva *Allow new users to sign up* en el panel (ver arriba) |

