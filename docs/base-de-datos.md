# Base de datos (Bloque 2)

PostgreSQL de Supabase. Migraciones versionadas en `supabase/migrations/` (orden por nombre; la 04 corrige hallazgos de la revisión del Bloque 3). Scripts de administración manual en `supabase/admin/` (no son migraciones; se ejecutan en el SQL Editor).

## Tablas

| Tabla | Contenido | Restricciones clave |
|---|---|---|
| `profiles` | Perfil y rol (`athlete`/`professional`) por usuario de `auth.users` | rol por defecto `athlete`; solo el servidor lo cambia |
| `categories`, `positions`, `teams` | Catálogos y equipos | nombres/códigos únicos; `RESTRICT` al borrar si están en uso |
| `athletes` | Ficha del deportista (UUID propio) | `user_id` único y solo vinculable por el servidor |
| `professional_athletes` | Asignación profesional ↔ deportista | PK compuesta; solo perfiles con rol profesional; sin escritura desde la API |
| `team_memberships` | Deportista ↔ equipo con fechas y camiseta | una membresía vigente por deportista+equipo; camiseta única por equipo vigente |
| `wellbeing_records` | Bienestar y recuperación | único por deportista+fecha |
| `nutrition_records` | Alimentación | único por deportista+fecha+comida |
| `hydration_records` | Hidratación | único por deportista+fecha |
| `training_records` | Entrenamiento (hasta 5 sesiones/día) | único por deportista+fecha+n.º de sesión |
| `performance_records` | Rendimiento (lo carga el profesional) | único por deportista+fecha+métrica |
| `professional_notes` | Observaciones profesionales | `shared_with_athlete` = false por defecto |
| `anthropometric_evaluations` / `_measurements` | Estructura para ISAK 1/2 (sin fórmulas) | única por deportista+fecha+nivel; mediciones únicas por variable |

Todo el historial de un deportista cuelga de `athletes.id` con `ON DELETE CASCADE`: cada historial es independiente.

## Permisos (RLS)

| Quién | Auto-registros diarios | Rendimiento / evaluaciones | Observaciones | Ficha, equipos |
|---|---|---|---|---|
| Deportista (propio) | leer, crear, editar (ventana de 14 días); no borrar | solo leer | solo las compartidas | solo leer su ficha |
| Profesional asignado | solo leer | leer y escribir | leer y escribir (edita solo el autor) | leer y editar datos; crear fichas |
| Profesional no asignado | nada | nada | nada | nada |
| `anon` (sin sesión) | nada | nada | nada | nada |

## Decisiones de seguridad

1. **Rol**: el alta crea siempre `athlete`; sin `UPDATE` sobre `role`/`is_active` para `authenticated`; trigger de respaldo. Se promueve solo con `supabase/admin/01_promover_profesional.sql`.
2. **Privilegios mínimos**: se revocan los privilegios amplios que Supabase concede por defecto y se conceden por columna. Nadie borra desde la API.
3. **Funciones de autorización** en el schema `private` (no expuesto por la API), `SECURITY DEFINER` con `search_path` vacío.
4. **Claves inmutables**: `athlete_id`, `created_by` y `user_id` no cambian tras la creación (triggers + privilegios por columna).
5. **Servidor y base**: `getSessionContext()` valida el usuario con `auth.getUser()` y lee el rol de `profiles`; la base vuelve a aplicar RLS en cada consulta.
6. **Alta por el profesional**: un trigger `BEFORE INSERT` lo asigna al deportista que crea (FK diferida), de modo que `insert ... returning` funciona sin ampliar la visibilidad.

## Limitaciones conocidas

- Verificado con PGlite (PostgreSQL real en memoria), no con un proyecto Supabase.
- Los catálogos (`teams`, `categories`, `positions`) los puede editar cualquier profesional activo.
- Un profesional asignado puede leer las observaciones de otros profesionales asignados al mismo deportista.
- La ventana de 14 días usa la fecha UTC del servidor de base de datos.

## Revisión del Bloque 3 (hallazgos)

| Hallazgo | Acción |
|---|---|
| `in_edit_window` era `IMMUTABLE` pero usa `current_date` (el planificador podía fijar la ventana) | Migración 04: ahora `STABLE`; prueba que lo verifica |
| Usuarios anteriores a la migración 01 sin perfil | Migración 04: perfil `athlete` por relleno (idempotente); prueba que lo verifica |
| Auto-registro público de Supabase crea usuarios sin acceso a datos pero innecesarios | Desactivarlo en el panel (README) |
| `created_by ... ON DELETE RESTRICT` impide borrar un usuario con registros | Limitación asumida: se preserva la autoría; para borrar una cuenta hay que reasignar o eliminar antes sus registros desde el servidor |

Las pruebas `tests/db/auth-hardening.test.ts` comprueban además, para 9 tablas, que un deportista, su profesional, un profesional sin asignaciones y un usuario sin ficha ven 0 filas de otro deportista, y que `anon` no accede a nada.

## Scripts de prueba (Bloque 4)

`supabase/test/` (solo para un proyecto de Supabase independiente de pruebas; se ejecutan a mano en el SQL Editor):

| Script | Función |
|---|---|
| `01_sembrar_datos_de_prueba.sql` | 3 deportistas ficticios (ids `7e57…`), roles y asignaciones de 5 cuentas de prueba. Se niega a correr si hay deportistas ajenos a la prueba. |
| `02_reiniciar_datos_de_prueba.sql` | Borra solo las filas `7e57…` y sus dependientes. No toca cuentas ni perfiles. |
| `03_verificar_rls.sql` | Solo lectura: RLS activo, privilegios de `anon`/`authenticated`, funciones privadas, columnas protegidas. |

Su sintaxis y lógica se verificaron en PGlite (`tests/db/test-scripts.test.ts`); **no se ejecutaron en Supabase real**.
