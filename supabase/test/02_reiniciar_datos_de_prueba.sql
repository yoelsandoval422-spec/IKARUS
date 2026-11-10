-- =============================================================================
-- PRUEBAS · Reiniciar los datos de prueba (SQL Editor, rol postgres)
-- -----------------------------------------------------------------------------
-- Borra ÚNICAMENTE las filas creadas por 01_sembrar_datos_de_prueba.sql (identificadores
-- fijos 7e57…) y todo lo que cuelga de ellas (registros, asignaciones, membresías) por cascada.
-- NO borra cuentas de usuario, perfiles, categorías ni puestos, y no puede afectar a
-- deportistas reales porque filtra por esos identificadores exactos.
-- Para volver a empezar: ejecuta este script y luego el 01.
-- =============================================================================

do $$
begin
  delete from public.athletes
   where id in ('7e570000-0000-4000-8000-0000000000a1',
                '7e570000-0000-4000-8000-0000000000a2',
                '7e570000-0000-4000-8000-0000000000a3');
  delete from public.teams where id = '7e570000-0000-4000-8000-0000000000e1';
end $$;

-- Debe mostrar 0 en todo
select
  (select count(*) from public.athletes where id::text like '7e570000-%') as deportistas_de_prueba,
  (select count(*) from public.teams where id::text like '7e570000-%') as equipos_de_prueba,
  (select count(*) from public.wellbeing_records where athlete_id::text like '7e570000-%') as registros_restantes;
