# Variables de entorno de IKARU

Son los "ajustes secretos o de configuración" que la aplicación lee. **No van en el repositorio.** En Vercel se cargan en *Settings → Environment Variables*; en una computadora de desarrollo, en `.env.local`.

## Aplicación

| Variable | ¿Obligatoria? | Valor | Se ve en el navegador | Notas |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí (para uso real) | `https://xxxx.supabase.co` | Sí | Sin ella la app no puede iniciar sesión y muestra un aviso |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí (para uso real) | Clave *anon* / *publishable* | Sí | **Solo clave pública.** Se rechaza `service_role` / `sb_secret_…` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No | Igual que la anterior | Sí | Alternativa si el panel la llama *publishable*; se usa solo si la anterior está vacía |
| `APP_ALLOW_DEMO` | No | `true` / `false` | No | **En producción, si no existe, la demostración está APAGADA.** En desarrollo, encendida. No la definas en Vercel |
| `APP_TIME_ZONE` | No | Ej. `America/Argentina/Buenos_Aires` | No | Define cuándo empieza "hoy". Es el valor por defecto |
| `NEXT_DIST_DIR` | No | — | No | Solo para pruebas internas; **no usar en Vercel** |

> Todo lo que empieza con `NEXT_PUBLIC_` queda incrustado en el código que recibe cualquier visitante. Por eso ahí **solo** va información pública.

## Solo para pruebas de integración (`.env.test.local`, nunca en Vercel)

`TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_CONFIRM_TEST_PROJECT=si` y las cuentas `TEST_PRO1/PRO2/ATH1/ATH2/ATH3_EMAIL/_PASSWORD`. Ver `.env.test.example`. Usar **únicamente** con un proyecto de prueba.

## Que nunca debe existir en Vercel ni en GitHub

`SUPABASE_SERVICE_ROLE_KEY`, cualquier `sb_secret_…`, la contraseña de la base de datos, ni contraseñas de cuentas reales.

## Entornos de Vercel

Vercel distingue **Production**, **Preview** y **Development**. Recomendación: para *Preview* cargá las claves de tu proyecto Supabase de **prueba** (o no cargues nada), de modo que las versiones de ensayo nunca toquen datos reales.

## Comportamiento si faltan variables

| Situación | Resultado |
|---|---|
| Falta la URL o la clave | `/login` muestra un aviso en español y el formulario queda deshabilitado; no se muestran datos reales ni ficticios en producción |
| Se detecta una clave privilegiada | Se trata como no configurada; no se usa |
| En desarrollo sin variables | Modo demostración con aviso visible (datos ficticios, nada se guarda) |
