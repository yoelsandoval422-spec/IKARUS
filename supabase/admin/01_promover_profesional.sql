-- ADMINISTRACIÓN · se ejecuta SOLO a mano en Supabase → SQL Editor (rol postgres).
-- Nunca desde la aplicación. Otorga el rol profesional a un usuario existente.
-- 1) Reemplaza el correo; 2) ejecuta.

do $$
declare
  v_email text := 'REEMPLAZAR_CORREO_PROFESIONAL';
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(v_email);
  if v_id is null then
    raise exception 'No existe un usuario con el correo %', v_email;
  end if;
  update public.profiles set role = 'professional' where id = v_id;
  if not found then
    raise exception 'El usuario % no tiene perfil', v_email;
  end if;
end $$;
