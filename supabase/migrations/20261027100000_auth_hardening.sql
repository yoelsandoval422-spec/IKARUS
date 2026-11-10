-- =============================================================================
-- 04 · Correcciones de la revisión previa a Auth
-- -----------------------------------------------------------------------------
-- 1) private.in_edit_window estaba declarada IMMUTABLE pero depende de
--    current_date: el planificador podía cachear/plegar el resultado y fijar la
--    ventana de edición. Debe ser STABLE (constante dentro de una sentencia).
-- 2) Usuarios creados ANTES de la migración 01 no tienen perfil, así que la
--    aplicación los trataría como "sin sesión". Se les crea el perfil con rol
--    `athlete` (nunca profesional).
-- Se agrega como migración nueva (y no se editan las anteriores) para que sea
-- segura tanto si 01–03 ya se ejecutaron como si no.
-- =============================================================================

create or replace function private.in_edit_window(d date) returns boolean
language sql stable set search_path = '' as $$
  select d between (current_date - 14) and (current_date + 1);
$$;

revoke all on function private.in_edit_window(date) from public;
grant execute on function private.in_edit_window(date) to authenticated;

insert into public.profiles (id, role, display_name)
select u.id,
       'athlete',
       left(nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''), 120)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
