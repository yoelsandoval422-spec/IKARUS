-- =============================================================================
-- VERIFICACIÓN · Estado de la seguridad en la base (SQL Editor; solo lee, no modifica nada)
-- -----------------------------------------------------------------------------
-- Cada fila es una comprobación. Todas deben tener ok = true.
-- Esto revisa la CONFIGURACIÓN (RLS activado, privilegios, funciones). El comportamiento
-- real con cuentas distintas se comprueba con `npm run test:integration`.
-- =============================================================================

with checks as (
  select 'Todas las tablas de public tienen RLS activado' as comprobacion,
         not exists (
           select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) as ok,
         (select coalesce(string_agg(c.relname, ', '), 'ninguna') from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) as detalle
  union all
  select 'anon no tiene privilegios sobre tablas de public',
         not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'),
         (select coalesce(string_agg(distinct table_name, ', '), 'ninguno') from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon')
  union all
  select 'authenticated no puede borrar ni truncar en public',
         not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and privilege_type in ('DELETE', 'TRUNCATE')),
         (select coalesce(string_agg(distinct table_name, ', '), 'ninguno') from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and privilege_type in ('DELETE', 'TRUNCATE'))
  union all
  select 'authenticated NO puede cambiar profiles.role',
         not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'), 'columna role'
  union all
  select 'authenticated NO puede cambiar profiles.is_active',
         not has_column_privilege('authenticated', 'public.profiles', 'is_active', 'UPDATE'), 'columna is_active'
  union all
  select 'authenticated NO puede escribir professional_athletes',
         not (has_table_privilege('authenticated', 'public.professional_athletes', 'INSERT')
              or has_table_privilege('authenticated', 'public.professional_athletes', 'UPDATE')), 'tabla de asignaciones'
  union all
  select 'authenticated NO puede cambiar athletes.user_id',
         not has_column_privilege('authenticated', 'public.athletes', 'user_id', 'UPDATE'), 'vínculo cuenta ↔ ficha'
  union all
  select 'authenticated NO puede cambiar athlete_id en registros',
         not (has_column_privilege('authenticated', 'public.wellbeing_records', 'athlete_id', 'UPDATE')
              or has_column_privilege('authenticated', 'public.nutrition_records', 'athlete_id', 'UPDATE')
              or has_column_privilege('authenticated', 'public.hydration_records', 'athlete_id', 'UPDATE')
              or has_column_privilege('authenticated', 'public.training_records', 'athlete_id', 'UPDATE')), 'tablas de registros diarios'
  union all
  select 'El schema private no es utilizable por anon',
         not has_schema_privilege('anon', 'private', 'usage'), 'schema private'
  union all
  select 'anon no puede ejecutar funciones (no trigger) de private',
         not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'private' and p.prorettype <> 'trigger'::regtype
                        and has_function_privilege('anon', p.oid, 'execute')),
         'funciones de autorización'
  union all
  select 'in_edit_window es STABLE (no IMMUTABLE)',
         coalesce((select p.provolatile = 's' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'private' and p.proname = 'in_edit_window'), false), 'migración 04'
  union all
  select 'Cada tabla de public tiene al menos una política RLS',
         not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                      where n.nspname = 'public' and c.relkind = 'r'
                        and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)),
         (select coalesce(string_agg(c.relname, ', '), 'ninguna sin política') from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r'
              and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname))
  union all
  select 'Ninguna política aplica a anon ni a public',
         not exists (select 1 from pg_policies where schemaname = 'public' and (roles && array['anon', 'public']::name[])),
         (select coalesce(string_agg(tablename || '.' || policyname, ', '), 'ninguna') from pg_policies where schemaname = 'public' and (roles && array['anon', 'public']::name[]))
  union all
  select 'Trigger de alta de perfiles presente en auth.users',
         exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'auth' and c.relname = 'users' and t.tgname = 'on_auth_user_created' and not t.tgisinternal),
         'on_auth_user_created'
  union all
  select 'Ningún usuario sin perfil',
         not exists (select 1 from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)),
         (select count(*)::text || ' usuarios sin perfil' from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id))
)
select comprobacion, ok, detalle from checks order by ok, comprobacion;
