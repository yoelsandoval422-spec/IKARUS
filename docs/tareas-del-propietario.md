# Tareas que solo podés hacer vos, desde tus cuentas

Nadie más (ni yo, ni quien programa) puede hacerlas por vos: requieren tus cuentas, tus pagos o tus decisiones. En orden:

| # | Tarea | Dónde | Guía |
|---|---|---|---|
| 1 | Crear un proyecto **de prueba** en Supabase y ensayar todo con datos ficticios | supabase.com | [guia-supabase.md](guia-supabase.md) y README |
| 2 | Ejecutar las 4 migraciones, en orden | Supabase → SQL Editor | guía Supabase, paso 2 |
| 3 | Apagar *Allow new users to sign up* | Supabase → Authentication | guía Supabase, paso 3 |
| 4 | Crear tus cuentas y darte el rol profesional | Supabase | pasos 5 y 6 |
| 5 | Verificar RLS (`03_verificar_rls.sql`) y, con ayuda técnica, `npm run test:integration` | Supabase de prueba | paso 8 |
| 6 | Crear cuenta de GitHub y un repositorio **privado**; subir el proyecto | github.com | [guia-vercel.md](guia-vercel.md), pasos 1–2 |
| 7 | Crear cuenta de Vercel; revisar si tu uso requiere plan de pago | vercel.com | pasos 3–4 |
| 8 | Cargar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en Vercel (solo claves públicas) | Vercel → Environment Variables | paso 5 |
| 9 | Primer despliegue y recorrido de la lista de verificación | Vercel / tu sitio | pasos 6–7 y [seguridad-produccion.md](seguridad-produccion.md) |
| 10 | Probar con cuentas reales de ensayo: profesional y deportista, en celular Android, iPhone, tablet y computadora | Tus dispositivos | lista de seguridad §2 |
| 11 | Comprar/configurar un dominio propio (opcional) y fijarlo como *Site URL* en Supabase | Registrador / Vercel / Supabase | pasos 9–10 |
| 12 | Crear el proyecto Supabase **real** (separado del de prueba) y repetir 2–5 | supabase.com | guía Supabase |
| 13 | Definir copias de seguridad y probar una restauración | Supabase | paso 9 |
| 14 | Redactar con asesoramiento legal el **consentimiento informado** y la política de privacidad | Fuera de la app | [seguridad-produccion.md](seguridad-produccion.md) §3 |
| 15 | Aportar el **logotipo definitivo** (versiones clara, oscura, monocromática, isotipo, favicon, íconos) | Archivos | `public/brand/LEEME.md` |
| 16 | Cargar deportistas y asignarlos (por ahora desde SQL) | Supabase | guía Supabase, paso 7 |

**Regla de oro:** si algo te pide pegar una clave que dice *secret*, *service_role* o la contraseña de la base de datos en Vercel o GitHub, **detenete**: esa no se usa.
