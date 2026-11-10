-- =============================================================================
-- 03 · Registros diarios (auto-registro del deportista) y registros profesionales
-- -----------------------------------------------------------------------------
-- Auto-registro (bienestar, alimentación, hidratación, entrenamiento):
--   * el deportista lee, crea y edita SOLO los suyos, y solo dentro de una
--     ventana de 14 días (private.in_edit_window); no puede borrar;
--   * el profesional asignado solo los lee;
--   * unicidad por deportista + fecha (+ comida / sesión) evita duplicados;
--   * `athlete_id` y `created_by` no se pueden cambiar tras la creación.
-- Registros profesionales (rendimiento, observaciones, antropometría):
--   * los escribe el profesional asignado; el deportista solo lee lo suyo
--     (observaciones solo si están marcadas como compartidas).
-- =============================================================================

create type public.meal_type as enum ('breakfast', 'lunch', 'snack', 'dinner', 'supplement');
create type public.session_type as enum ('training', 'match', 'gym', 'recovery', 'other');

-- ---- Utilidad: claves inmutables ------------------------------------------------------

create function private.protect_record_keys() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.athlete_id is distinct from old.athlete_id then
    raise exception 'No se puede reasignar un registro a otro deportista.' using errcode = '23514';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'No se puede cambiar el autor de un registro.' using errcode = '23514';
  end if;
  return new;
end $$;

-- ---- Bienestar y recuperación ------------------------------------------------------------

create table public.wellbeing_records (
  id              uuid primary key default gen_random_uuid(),
  athlete_id      uuid not null references public.athletes (id) on delete cascade,
  record_date     date not null,
  sleep_hours     numeric(4,2) check (sleep_hours between 0 and 24),
  sleep_quality   smallint check (sleep_quality between 1 and 5),
  fatigue         smallint check (fatigue between 1 and 5),
  muscle_soreness smallint check (muscle_soreness between 1 and 5),
  stress          smallint check (stress between 1 and 5),
  mood            smallint check (mood between 1 and 5),
  notes           text check (notes is null or char_length(notes) <= 500),
  created_by      uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (athlete_id, record_date)
);

-- ---- Alimentación (varias comidas por día, una por tipo) ---------------------------------------

create table public.nutrition_records (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.athletes (id) on delete cascade,
  record_date date not null,
  meal        public.meal_type not null,
  description text not null check (char_length(btrim(description)) between 1 and 500),
  created_by  uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (athlete_id, record_date, meal)
);

-- ---- Hidratación --------------------------------------------------------------------------------

create table public.hydration_records (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.athletes (id) on delete cascade,
  record_date date not null,
  total_ml    integer not null check (total_ml between 0 and 10000),
  urine_color smallint check (urine_color between 1 and 8),
  created_by  uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (athlete_id, record_date)
);

-- ---- Entrenamiento (hasta 5 sesiones por día) ------------------------------------------------------

create table public.training_records (
  id             uuid primary key default gen_random_uuid(),
  athlete_id     uuid not null references public.athletes (id) on delete cascade,
  record_date    date not null,
  session_number smallint not null default 1 check (session_number between 1 and 5),
  session        public.session_type not null default 'training',
  duration_min   integer not null check (duration_min between 1 and 600),
  rpe            smallint check (rpe between 1 and 10),
  notes          text check (notes is null or char_length(notes) <= 500),
  created_by     uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (athlete_id, record_date, session_number)
);

-- ---- Rendimiento (lo carga el profesional) ------------------------------------------------------------

create table public.performance_records (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.athletes (id) on delete cascade,
  record_date date not null,
  metric_code text not null check (metric_code ~ '^[a-z0-9_]{2,60}$'),
  value       numeric not null,
  unit        text not null check (char_length(btrim(unit)) between 1 and 20),
  notes       text check (notes is null or char_length(notes) <= 500),
  created_by  uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (athlete_id, record_date, metric_code)
);

-- ---- Observaciones profesionales -------------------------------------------------------------------------

create table public.professional_notes (
  id                  uuid primary key default gen_random_uuid(),
  athlete_id          uuid not null references public.athletes (id) on delete cascade,
  note_date           date not null default current_date,
  body                text not null check (char_length(btrim(body)) between 1 and 2000),
  shared_with_athlete boolean not null default false,
  created_by          uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index professional_notes_athlete_date_idx on public.professional_notes (athlete_id, note_date desc);

-- ---- Evaluaciones antropométricas (estructura; sin fórmulas todavía) ---------------------------------------

create table public.anthropometric_evaluations (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references public.athletes (id) on delete cascade,
  evaluated_on date not null,
  isak_level   smallint not null default 1 check (isak_level in (1, 2)),
  notes        text check (notes is null or char_length(notes) <= 1000),
  created_by   uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (athlete_id, evaluated_on, isak_level)
);

create table public.anthropometric_measurements (
  id            uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.anthropometric_evaluations (id) on delete cascade,
  variable_code text not null check (variable_code ~ '^[a-z0-9_]{2,60}$'),
  value         numeric not null check (value >= 0),
  unit          text not null check (char_length(btrim(unit)) between 1 and 20),
  created_at    timestamptz not null default now(),
  unique (evaluation_id, variable_code)
);

create function private.protect_measurement_keys() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.evaluation_id is distinct from old.evaluation_id then
    raise exception 'No se puede mover una medición a otra evaluación.' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger anthropometric_measurements_keep_eval before update on public.anthropometric_measurements
  for each row execute function private.protect_measurement_keys();

-- Autorización de mediciones a través de su evaluación.
create function private.evaluation_athlete(target_evaluation uuid) returns uuid
language sql security definer set search_path = '' as $$
  select e.athlete_id from public.anthropometric_evaluations e where e.id = target_evaluation;
$$;
revoke all on function private.evaluation_athlete(uuid) from public;
grant execute on function private.evaluation_athlete(uuid) to authenticated;

-- ---- Triggers comunes (updated_at, claves inmutables) --------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'wellbeing_records', 'nutrition_records', 'hydration_records', 'training_records',
    'performance_records', 'professional_notes', 'anthropometric_evaluations'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
                   t || '_set_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function private.protect_record_keys()',
                   t || '_keep_keys', t);
    execute format('create index %I on public.%I (athlete_id)', t || '_athlete_idx', t);
  end loop;
end $$;

-- ---- Privilegios ---------------------------------------------------------------------------------------------------

revoke all on public.wellbeing_records, public.nutrition_records, public.hydration_records,
              public.training_records, public.performance_records, public.professional_notes,
              public.anthropometric_evaluations, public.anthropometric_measurements
  from anon, authenticated;

grant select on public.wellbeing_records, public.nutrition_records, public.hydration_records,
                public.training_records, public.performance_records, public.professional_notes,
                public.anthropometric_evaluations, public.anthropometric_measurements
  to authenticated;

grant insert (athlete_id, record_date, sleep_hours, sleep_quality, fatigue, muscle_soreness, stress, mood, notes, created_by)
  on public.wellbeing_records to authenticated;
grant update (record_date, sleep_hours, sleep_quality, fatigue, muscle_soreness, stress, mood, notes)
  on public.wellbeing_records to authenticated;

grant insert (athlete_id, record_date, meal, description, created_by) on public.nutrition_records to authenticated;
grant update (record_date, meal, description) on public.nutrition_records to authenticated;

grant insert (athlete_id, record_date, total_ml, urine_color, created_by) on public.hydration_records to authenticated;
grant update (record_date, total_ml, urine_color) on public.hydration_records to authenticated;

grant insert (athlete_id, record_date, session_number, session, duration_min, rpe, notes, created_by)
  on public.training_records to authenticated;
grant update (record_date, session_number, session, duration_min, rpe, notes) on public.training_records to authenticated;

grant insert (athlete_id, record_date, metric_code, value, unit, notes, created_by)
  on public.performance_records to authenticated;
grant update (record_date, metric_code, value, unit, notes) on public.performance_records to authenticated;

grant insert (athlete_id, note_date, body, shared_with_athlete, created_by) on public.professional_notes to authenticated;
grant update (note_date, body, shared_with_athlete) on public.professional_notes to authenticated;

grant insert (athlete_id, evaluated_on, isak_level, notes, created_by) on public.anthropometric_evaluations to authenticated;
grant update (evaluated_on, isak_level, notes) on public.anthropometric_evaluations to authenticated;

grant insert (evaluation_id, variable_code, value, unit) on public.anthropometric_measurements to authenticated;
grant update (variable_code, value, unit) on public.anthropometric_measurements to authenticated;

-- ---- RLS --------------------------------------------------------------------------------------------------------------

alter table public.wellbeing_records enable row level security;
alter table public.nutrition_records enable row level security;
alter table public.hydration_records enable row level security;
alter table public.training_records enable row level security;
alter table public.performance_records enable row level security;
alter table public.professional_notes enable row level security;
alter table public.anthropometric_evaluations enable row level security;
alter table public.anthropometric_measurements enable row level security;

-- Auto-registro: el deportista (dueño) lee/crea/edita; el profesional asignado solo lee.
do $$
declare t text;
begin
  foreach t in array array['wellbeing_records', 'nutrition_records', 'hydration_records', 'training_records']
  loop
    execute format($f$create policy %I on public.%I for select to authenticated
                      using (private.can_read_athlete(athlete_id))$f$, t || '_select', t);
    execute format($f$create policy %I on public.%I for insert to authenticated
                      with check (private.is_self(athlete_id)
                                  and created_by = auth.uid()
                                  and private.in_edit_window(record_date))$f$, t || '_insert_self', t);
    execute format($f$create policy %I on public.%I for update to authenticated
                      using (private.is_self(athlete_id) and private.in_edit_window(record_date))
                      with check (private.is_self(athlete_id) and private.in_edit_window(record_date))$f$,
                   t || '_update_self', t);
  end loop;
end $$;

-- Rendimiento y evaluaciones: escribe el profesional asignado; el deportista lee lo suyo.
do $$
declare t text;
begin
  foreach t in array array['performance_records', 'anthropometric_evaluations']
  loop
    execute format($f$create policy %I on public.%I for select to authenticated
                      using (private.can_read_athlete(athlete_id))$f$, t || '_select', t);
    execute format($f$create policy %I on public.%I for insert to authenticated
                      with check (private.is_assigned(athlete_id) and created_by = auth.uid())$f$,
                   t || '_insert_prof', t);
    execute format($f$create policy %I on public.%I for update to authenticated
                      using (private.is_assigned(athlete_id)) with check (private.is_assigned(athlete_id))$f$,
                   t || '_update_prof', t);
  end loop;
end $$;

-- Observaciones: profesionales asignados leen; solo el autor edita; el deportista ve las compartidas.
create policy professional_notes_select on public.professional_notes for select to authenticated
  using (private.is_assigned(athlete_id) or (private.is_self(athlete_id) and shared_with_athlete));

create policy professional_notes_insert on public.professional_notes for insert to authenticated
  with check (private.is_assigned(athlete_id) and created_by = auth.uid());

create policy professional_notes_update_author on public.professional_notes for update to authenticated
  using (private.is_assigned(athlete_id) and created_by = auth.uid())
  with check (private.is_assigned(athlete_id) and created_by = auth.uid());

-- Mediciones: se autorizan por el deportista dueño de la evaluación.
create policy measurements_select on public.anthropometric_measurements for select to authenticated
  using (private.can_read_athlete(private.evaluation_athlete(evaluation_id)));

create policy measurements_insert on public.anthropometric_measurements for insert to authenticated
  with check (private.is_assigned(private.evaluation_athlete(evaluation_id)));

create policy measurements_update on public.anthropometric_measurements for update to authenticated
  using (private.is_assigned(private.evaluation_athlete(evaluation_id)))
  with check (private.is_assigned(private.evaluation_athlete(evaluation_id)));
