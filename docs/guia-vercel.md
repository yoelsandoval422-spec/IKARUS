# Guía para publicar IKARU en Vercel (sin programar)

> **Estado honesto:** el proyecto está **preparado** para publicarse. **No fue desplegado** (no tengo acceso a tu cuenta de Vercel) y **no fue probado con un Supabase real**. Esta guía la escribimos sin haber podido recorrerla en tu cuenta: los nombres de los menús de Vercel, GitHub y Supabase pueden cambiar levemente. Si algo no coincide, buscá el botón con nombre parecido.

**Qué vas a lograr:** una dirección web (por ejemplo `https://ikaru-tuapellido.vercel.app`, y luego tu dominio propio) desde la que vos y tus deportistas entran con el navegador del celular, tablet o computadora. **Nadie instala nada.**

**Qué necesitás:** una cuenta de correo, el archivo ZIP del proyecto, y haber hecho antes la [guía de Supabase](guia-supabase.md) (necesitás dos datos de ahí: la *Project URL* y la *clave pública*).

---

## Paso 1 · Crear una cuenta en GitHub (el "depósito" del proyecto)

Vercel toma el proyecto desde un depósito (repositorio) online. El más usado es GitHub.

1. Entrá a <https://github.com> → **Sign up** y creá la cuenta.
2. Arriba a la derecha: **+** → **New repository**.
3. Nombre: `ikaru`. Marcá **Private** (privado). **No** agregues README ni otros archivos. → **Create repository**.

> **Importante:** el repositorio debe ser **privado**. Nunca subas contraseñas ni claves reales (el proyecto no las incluye; solo guarda claves en Vercel).

## Paso 2 · Subir el proyecto

1. Descomprimí el ZIP en tu computadora. Vas a ver una carpeta `handball-app` (el nombre interno no afecta a la marca visible: la app se muestra como IKARU).
2. En la página vacía de tu repositorio tocá **uploading an existing file**.
3. Arrastrá el **contenido** de la carpeta (no la carpeta en sí). GitHub acepta unos **100 archivos por carga** en el navegador, y el proyecto tiene más: subilo en **2 o 3 tandas** (por ejemplo, primero `app`, `components`, `lib`, `public`, `types`, `data`; luego `supabase`, `tests`, `tests-integration`, `scripts`, `docs`; y por último los archivos sueltos como `package.json`, `package-lock.json`, `next.config.ts`, `proxy.ts`, etc.). Después de cada tanda: **Commit changes**.
4. Comprobá que en la raíz del repositorio veas `package.json`, `next.config.ts` y la carpeta `app`.
5. **Verificá que NO exista ningún archivo `.env.local`** en el repositorio (solo `.env.example`, que está vacío de claves).

*Alternativa más cómoda:* instalar **GitHub Desktop** (programa gratuito con botones, no requiere escribir comandos): *File → Add local repository → Publish repository* (marcando "Keep this code private"). Es opcional, pero evita tener que subir por tandas.

## Paso 3 · Crear la cuenta de Vercel

1. Entrá a <https://vercel.com/signup> y elegí **Continue with GitHub** (así quedan conectados).
2. Revisá el plan. Vercel indica que el plan gratuito (*Hobby*) es para uso **personal y no comercial**. Como IKARU puede usarse con tu actividad profesional, **leé los términos vigentes de Vercel** y elegí el plan que corresponda antes de usarlo con deportistas reales.

## Paso 4 · Importar el proyecto

1. En Vercel: **Add New… → Project**.
2. Si no ves tu repositorio, tocá **Adjust GitHub App Permissions** y dale acceso al repositorio `ikaru`.
3. Junto a `ikaru` tocá **Import**.
4. Vercel detecta solo que es **Next.js**. Dejá todo como está (Build Command, Output Directory, Install Command: **valores por defecto**). No hace falta configurar nada más.

## Paso 5 · Cargar las variables de entorno (antes del primer despliegue)

En la misma pantalla, desplegá **Environment Variables** y agregá (una por una; *Name* y *Value*):

| Name | Value | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | La *Project URL* de tu Supabase | Termina en `.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | La clave **pública** (*anon* o *publishable*) | **Nunca** la `service_role` ni una que diga *secret* |

**No agregues** `APP_ALLOW_DEMO`: en producción, si no existe, el modo demostración queda **apagado** y quien no inicie sesión va al login (es lo que querés).

Más detalle en [variables-de-entorno.md](variables-de-entorno.md).

> Estas variables se "incorporan" a la aplicación al **compilar**. Si más adelante las cambiás, hay que **volver a desplegar** (Paso 8) para que tomen efecto.

## Paso 6 · Primer despliegue

1. Tocá **Deploy**. Tarda unos minutos.
2. Si termina bien, Vercel muestra la dirección (`algo.vercel.app`). Ábrila.
3. Qué deberías ver: la pantalla de **IKARU** con el botón *Ingresar*. Si entrás a `/profesional` sin sesión, te lleva al login.
4. Si falla el despliegue: abrí el detalle (*Deployments → el que falló → Build Logs*) y copiá el mensaje de error; no lo compartas si contiene datos personales (no debería).

## Paso 7 · Verificar que todo funciona (con tu cuenta profesional)

1. Entrá a `https://TU-DIRECCIÓN/login` con tu cuenta profesional (creada en la guía de Supabase).
2. Abrí `/configuracion` y tocá **Verificar ahora**: deben aparecer en ✓ la autenticación y la lectura de la base. **Este es el único punto que confirma la conexión real.**
3. Seguí la lista de [seguridad-produccion.md](seguridad-produccion.md).

## Paso 8 · Publicar cambios en el futuro

Cada vez que cambies archivos en GitHub (por ejemplo, subiendo una versión nueva del proyecto), Vercel **vuelve a desplegar solo**. Para forzar un nuevo despliegue sin cambiar archivos (por ejemplo, tras editar variables): *Deployments → ⋯ en el último → Redeploy*.
Si un despliegue sale mal, en *Deployments* podés volver a uno anterior que funcionaba (*⋯ → Promote to Production*).

## Paso 9 · Dominio personalizado (opcional)

1. Comprá un dominio (por ejemplo, en un registrador como NIC Argentina para `.com.ar`, o en cualquier otro).
2. En Vercel: tu proyecto → **Settings → Domains → Add** → escribí el dominio.
3. Vercel te muestra uno o más **registros DNS** (tipo y valor). Cargalos en el panel de tu registrador (sección DNS). Puede tardar desde minutos hasta unas horas.
4. Cuando Vercel marque el dominio como válido, genera solo el **certificado HTTPS**.
5. **Después de tener dominio:** en Supabase → *Authentication → URL Configuration* poné ese dominio como **Site URL**.

## Paso 10 · Verificar HTTPS

- La dirección debe empezar con `https://` y el navegador mostrar el candado.
- Si abrís `http://` debe redirigir a `https://` (Vercel lo hace solo).
- Es imprescindible: las cookies de sesión de IKARU son *Secure* y **no funcionan sin HTTPS**.

## Pantallas pendientes en la versión publicada

La app publicada permite iniciar sesión y ver el panel profesional y la lista de deportistas reales asignados. **Los formularios diarios del deportista todavía no guardan datos** (están marcados como demostrativos) y las secciones de evaluaciones e informes son reservas. Ver [pendientes.md](pendientes.md).

## Opcional: región de la aplicación

Si tu Supabase está en São Paulo, en Vercel → *Settings → Functions* podés elegir una región cercana (por ejemplo São Paulo) para que sea más rápida. No es obligatorio.
