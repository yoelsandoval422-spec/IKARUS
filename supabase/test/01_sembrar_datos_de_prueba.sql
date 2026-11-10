-- =============================================================================
-- PRUEBAS · Sembrar datos de prueba (se ejecuta a mano en el SQL Editor, rol postgres)
-- -----------------------------------------------------------------------------
-- SOLO para un proyecto de Supabase INDEPENDIENTE creado para pruebas.
--  * Usa identificadores fijos (prefijo 7e57…): el script y su reinicio SOLO tocan esas filas.
--  * Se niega a correr si el proyecto contiene deportistas que NO son de prueba
--    (protección contra ejecutarlo por error en el proyecto real).
--  * Se puede ejecutar varias veces: primero borra sus propios datos de prueba.
--  * Antes de ejecutar: crea las 5 cuentas en Authentication → Users y reemplaza los
--    5 correos de abajo (las líneas que dicen REEMPLAZAR_…).
--
-- Resultado:
--   pro1 (profesional) → asignado a Deportista TEST 1 y 2
--   pro2 (profesional) → asignado a Deportista TEST 3
--   ath1 ↔ TEST 1,  ath2 ↔ TEST 2,  ath3 ↔ TEST 3
-- =============================================================================

do $$
declare
  v_pro1 text := 'REEMPLAZAR_PRO1';
  v_pro2 text := 'REEMPLAZAR_PRO2';
  v_ath1 text := 'REEMPLAZAR_ATH1';
  v_ath2 text := 'REEMPLAZAR_ATH2';
  v_ath3 text := 'REEMPLAZAR_ATH3';
  -- Solo ponlo en true si SABES que los otros deportistas del proyecto también son de prueba.
  v_allow_other_data boolean := false;

  a1 constant uuid := '7e570000-0000-4000-8000-0000000000a1';
  a2 constant uuid := '7e570000-0000-4000-8000-0000000000a2';
  a3 constant uuid := '7e570000-0000-4000-8000-0000000000a3';
  t1 constant uuid := '7e570000-0000-4000-8000-0000000000e1';

  u_pro1 uuid; u_pro2 uuid; u_ath1 uuid; u_ath2 uuid; u_ath3 uuid;
begin
  -- 1) Protección: ¿hay datos que no son de prueba?
  if not v_allow_other_data and exists (select 1 from public.athletes where id not in (a1, a2, a3)) then
    raise exception 'Este proyecto contiene deportistas que NO son de prueba. Abortado para proteger datos reales. ¿Estás en el proyecto correcto?';
  end if;

  -- 2) Las 5 cuentas deben existir
  select id into u_pro1 from auth.users where lower(email) = lower(v_pro1);
  select id into u_pro2 from auth.users where lower(email) = lower(v_pro2);
  select id into u_ath1 from auth.users where lower(email) = lower(v_ath1);
  select id into u_ath2 from auth.users where lower(email) = lower(v_ath2);
  select id into u_ath3 from auth.users where lower(email) = lower(v_ath3);
  if u_pro1 is null or u_pro2 is null or u_ath1 is null or u_ath2 is null or u_ath3 is null then
    raise exception 'Falta alguna cuenta de prueba. Revisa los 5 correos al inicio del script (deben existir en Authentication → Users).';
  end if;
  if (select count(distinct x) from unnest(array[u_pro1, u_pro2, u_ath1, u_ath2, u_ath3]) as x) <> 5 then
    raise exception 'Los 5 correos deben ser distintos.';
  end if;

  -- 3) Reinicio previo de SUS datos de prueba (identificadores fijos; cascada a registros y asignaciones)
  delete from public.athletes where id in (a1, a2, a3);
  delete from public.teams where id = t1;

  -- 4) Roles: solo el servidor puede promover (aquí corre como postgres)
  update public.profiles set role = 'professional', is_active = true where id in (u_pro1, u_pro2);
  update public.profiles set role = 'athlete', is_active = true where id in (u_ath1, u_ath2, u_ath3);

  -- 5) Estructura
  insert into public.teams (id, name, category_id, season)
    values (t1, 'TEST Equipo', (select id from public.categories where name = 'Juvenil'), 'TEST');

  insert into public.athletes (id, user_id, display_name, category_id, position_id) values
    (a1, u_ath1, 'Deportista TEST 1', (select id from public.categories where name = 'Juvenil'), (select id from public.positions where code = 'CE')),
    (a2, u_ath2, 'Deportista TEST 2', (select id from public.categories where name = 'Juvenil'), (select id from public.positions where code = 'PI')),
    (a3, u_ath3, 'Deportista TEST 3', (select id from public.categories where name = 'Adulto'),  (select id from public.positions where code = 'AR'));

  insert into public.professional_athletes (professional_id, athlete_id) values
    (u_pro1, a1), (u_pro1, a2), (u_pro2, a3);

  insert into public.team_memberships (athlete_id, team_id, jersey_number) values
    (a1, t1, 1), (a2, t1, 2), (a3, t1, 3);

  -- 6) Registros de prueba (los inserta el servidor; así hay datos "privados" que proteger)
  insert into public.wellbeing_records (athlete_id, record_date, sleep_hours, sleep_quality, created_by) values
    (a1, current_date, 7.5, 4, u_ath1), (a2, current_date, 6.0, 3, u_ath2), (a3, current_date, 8.0, 5, u_ath3);
  insert into public.hydration_records (athlete_id, record_date, total_ml, created_by) values
    (a1, current_date, 2000, u_ath1), (a2, current_date, 1500, u_ath2), (a3, current_date, 2500, u_ath3);
  insert into public.professional_notes (athlete_id, body, shared_with_athlete, created_by) values
    (a1, 'TEST nota PRIVADA de TEST 1', false, u_pro1),
    (a1, 'TEST nota COMPARTIDA de TEST 1', true, u_pro1),
    (a3, 'TEST nota PRIVADA de TEST 3', false, u_pro2);
  insert into public.performance_records (athlete_id, record_date, metric_code, value, unit, created_by) values
    (a1, current_date, 'test_salto', 30, 'cm', u_pro1), (a3, current_date, 'test_salto', 35, 'cm', u_pro2);
end $$;

-- Resumen (debe mostrar 3 deportistas de prueba, 3 asignaciones)
select
  (select count(*) from public.athletes where id::text like '7e570000-%') as deportistas_de_prueba,
  (select count(*) from public.professional_athletes where athlete_id::text like '7e570000-%') as asignaciones,
  (select count(*) from public.profiles where role = 'professional') as profesionales_en_el_proyecto;
