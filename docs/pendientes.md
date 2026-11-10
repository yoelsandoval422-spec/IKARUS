# Pendientes

| Área | Estado |
|---|---|
| Esquema, RLS, migraciones 01–04, capa de datos, Zod | Hecho (verificado con PGlite) |
| Login, logout, proxy de sesión, guards por rol, `/configuracion` | Hecho en el Bloque 3 (probado con simulaciones; no con Supabase real) |
| Verificación en un proyecto Supabase real (login, sesión, RLS) | **Pendiente**: crear proyecto de prueba, `03_verificar_rls.sql`, `npm run test:integration` y lista manual del README |
| Bloque 4: auditoría, scripts de prueba SQL, pruebas de integración, E2E simulado, estados de UX | Hecho (E2E simulado y PGlite; integración preparada, no ejecutada) |
| Recuperación/cambio de contraseña, invitaciones | Pendiente |
| Pantallas de alta de deportistas, equipos y asignaciones | Pendiente (hoy por SQL en `supabase/admin/`) |
| Pantallas de carga diaria reales (escritura) | Pendiente |
| Informes y consultas de registros | Pendiente |
| Módulo antropométrico ISAK (fórmulas e interfaz) | Pendiente (solo estructura de tablas) |
| Importación desde Excel | Pendiente |
| Tipos generados con `supabase gen types` | Pendiente (`types/database.ts` es manual) |
| CSP, límite propio de intentos, auditoría de seguridad, E2E, accesibilidad con lector de pantalla | Pendiente |
| Despliegue | No se desplegó nada |
| Formularios diarios reales (bienestar, nutrición, hidratación), entrenamiento/rendimiento | Pendiente (no se implementó en el Bloque 4) |
| Despliegue público en producción (HTTPS, `APP_ALLOW_DEMO=false`) | Pendiente |
| Playwright como dependencia fija del proyecto (hoy se instala a mano para `sim:e2e`) | Pendiente |
| Logotipo e íconos definitivos (principal, isotipo, monocromático, claro/oscuro, favicon) | Pendiente (hay provisionales; ver `public/brand/LEEME.md`) |
| Despliegue real en Vercel y conexión a un Supabase real | **No realizado**: lo hace el propietario con sus cuentas (`docs/tareas-del-propietario.md`) |
| Pruebas con usuarios reales; revisión en iPhone/Android/tablet reales | Pendiente |
| Service worker / uso sin conexión | Descartado por ahora por privacidad (`docs/pwa-y-cache.md`) |
| Texto de consentimiento y política de privacidad | Pendiente (requiere asesoramiento legal) |
