-- ADMINISTRACIÓN · se ejecuta SOLO a mano en Supabase → SQL Editor (rol postgres).
-- Vincula la cuenta (auth.users) de un deportista con su ficha `athletes`.
-- Un usuario solo puede estar vinculado a un deportista (restricción UNIQUE).

do $$
declare
  v_email   text := 'REEMPLAZAR_CORREO_DEPORTISTA';
  v_athlete uuid := '00000000-0000-0000-0000-000000000000'; -- athletes.id
  v_user    uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'No existe un usuario con el correo %', v_email;
  end if;
  update public.athletes set user_id = v_user where id = v_athlete and user_id is null;
  if not found then
    raise exception 'El deportista no existe o ya tiene una cuenta vinculada';
  end if;
end $$;
