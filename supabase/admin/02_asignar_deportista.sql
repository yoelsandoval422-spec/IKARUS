-- ADMINISTRACIÓN · se ejecuta SOLO a mano en Supabase → SQL Editor (rol postgres).
-- Asigna un deportista existente a un profesional (el profesional ya debe tener rol).

do $$
declare
  v_prof_email text := 'REEMPLAZAR_CORREO_PROFESIONAL';
  v_athlete    uuid := '00000000-0000-0000-0000-000000000000'; -- athletes.id
  v_prof       uuid;
begin
  select id into v_prof from auth.users where lower(email) = lower(v_prof_email);
  if v_prof is null then
    raise exception 'No existe un usuario con el correo %', v_prof_email;
  end if;
  insert into public.professional_athletes (professional_id, athlete_id)
  values (v_prof, v_athlete)
  on conflict do nothing;
end $$;
