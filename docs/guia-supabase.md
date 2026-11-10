# Guía para conectar IKARU con Supabase (sin programar)

> **Estado honesto:** el código de IKARU está preparado para Supabase, pero **nunca se probó contra un proyecto real** (no hay acceso a tu cuenta). Las políticas de seguridad (RLS) se probaron en una base PostgreSQL local de prueba, no en Supabase. Esta guía te lleva a comprobarlo vos. Los nombres de los menús de Supabase pueden variar.

**Recomendación fuerte:** hacé primero todo esto en un proyecto de **PRUEBA** (con deportistas ficticios). Cuando todo funcione, repetí en un proyecto **REAL** distinto. Nunca mezcles datos reales en el proyecto de prueba. Los pasos de pruebas están en la sección "Supabase de prueba" del [README](../README.md).

---

## Paso 1 · Crear el proyecto

1. <https://supabase.com> → **Start your project** → creá la cuenta.
2. **New project**. Nombre (ej. `ikaru`), una contraseña de base **fuerte** (guardala en un gestor de contraseñas; la aplicación no la usa) y la región más cercana (para Argentina suele convenir *South America (São Paulo)*).
3. Esperá a que termine de crearse.

## Paso 2 · Crear las tablas y reglas de seguridad (migraciones)

Vas a pegar **4 archivos** de la carpeta `supabase/migrations/` del proyecto, **en este orden**, en **SQL Editor → New query → Run**. Cada uno debe terminar sin errores y **se ejecuta una sola vez**:

1. `20261021100000_identity.sql`
2. `20261021100100_structure_and_athletes.sql`
3. `20261021100200_daily_records.sql`
4. `20261027100000_auth_hardening.sql`

Estos archivos **solo crean** estructura y reglas; no borran datos. Si alguno da error, **detenete** y no sigas con el siguiente.

## Paso 3 · Ajustes de Authentication

1. **Authentication → Sign In / Providers → Email**: dejalo activo y **apagá "Allow new users to sign up"** (así nadie puede registrarse solo; solo existen las cuentas que vos crees).
2. **Authentication → URL Configuration**: en *Site URL* poné la dirección de tu aplicación en Vercel (o tu dominio) una vez que la tengas.
3. Revisá en *Authentication → Policies/Settings* las opciones de contraseña mínima y, si está disponible en tu plan, protecciones adicionales.

## Paso 4 · Obtener las dos claves que usa la app

*Project Settings → API Keys* (o *API*):

| Dato | Para qué | ¿Es secreto? |
|---|---|---|
| **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` | No |
| Clave **anon** o **publishable** (`sb_publishable_…`) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No: está pensada para el navegador; la protección real son las políticas RLS |
| Clave **service_role** o **secret** (`sb_secret_…`) | **No se usa en IKARU** | **SÍ. NUNCA la pegues en Vercel, en GitHub, en chats ni en ningún lado.** |

La aplicación se niega a iniciar sesión si detecta una clave privilegiada en esas variables.

## Paso 5 · Crear las cuentas

*Authentication → Users → Add user → Create new user.* Tildá *Auto Confirm User*. Creá una cuenta para vos (profesional) y una por cada deportista. Pasales su contraseña por un medio seguro y pedíles que la cambien cuando exista esa función (todavía no existe: ver pendientes). Todas nacen con rol **deportista**.

## Paso 6 · Darte el rol de profesional (forma segura)

El rol profesional **no se puede obtener desde la aplicación** (ni por error ni a propósito): solo se da desde el SQL Editor.
1. Abrí `supabase/admin/01_promover_profesional.sql`, reemplazá `REEMPLAZAR_CORREO_PROFESIONAL` por tu correo y ejecutalo.

## Paso 7 · Cargar deportistas y asignarlos

Todavía no hay pantalla para esto. Se hace desde el SQL Editor:
1. Crear la ficha: `insert into public.athletes (display_name) values ('Nombre Apellido') returning id;` (copiá el `id`).
2. Vincular la cuenta del deportista con su ficha: `supabase/admin/03_vincular_cuenta_deportista.sql`.
3. Asignarlo a un profesional: `supabase/admin/02_asignar_deportista.sql`.

Un profesional solo ve a los deportistas que tiene **asignados**.

## Paso 8 · Comprobar la seguridad (RLS)

1. Ejecutá `supabase/test/03_verificar_rls.sql` (solo lee): todas las filas deben decir `ok = true`.
2. Para un chequeo completo con cuentas distintas, usá el proyecto de **prueba** y `npm run test:integration` (requiere a alguien con conocimientos técnicos; ver README). **Hasta que eso se ejecute en tu proyecto, RLS en Supabase real figura como NO VERIFICADO.**

## Paso 9 · Copias de seguridad y recuperación

- Los datos de deportistas son **sensibles**. Revisá en *Database → Backups* qué copias tiene **tu plan** (los planes gratuitos pueden no incluir copias automáticas descargables; verificalo en tu panel).
- Si tu plan no las incluye, programá una **exportación manual periódica** (*Table Editor → tabla → Export CSV*) y guardala **cifrada y fuera de GitHub**, o contratá un plan con copias.
- Probá **una vez** que sabés restaurar (en el proyecto de prueba) antes de depender de ello.
- Los proyectos gratuitos pueden **pausarse por inactividad**: verificá la política vigente en Supabase.

## Paso 10 · Qué NO hacer

- No ejecutes migraciones ni scripts de `supabase/test/` en el proyecto real (los de prueba se niegan a correr si hay deportistas ajenos, pero no dependas de eso).
- No cambies a mano las políticas RLS desde el panel.
- No compartas capturas del panel que muestren claves.
- Si una clave secreta se filtró: en Supabase, rotala/regenerala de inmediato.
