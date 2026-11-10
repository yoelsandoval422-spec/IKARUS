-- =============================================================================
-- 02 · Estructura deportiva: categorías, puestos, equipos, deportistas,
--      membresías y asignaciones profesional ↔ deportista
-- -----------------------------------------------------------------------------
-- * Cada deportista tiene un UUID propio (`athletes.id`); todo su historial cuelga
--   de ese id (ON DELETE CASCADE), de modo que los historiales son independientes.
-- * `athletes.user_id` vincula al deportista con su cuenta; solo lo cambia el servidor.
-- * Un profesional solo accede a deportistas con fila en `professional_athletes`;
--   esa tabla solo se escribe desde el servidor (o por el alta automática del
--   deportista creado por el propio profesional).
-- =============================================================================

-- ---- Catálogos --------------------------------------------------------------

create table public.categories (
  id         smallint generated always as identity primary key,
  name       text not null unique check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

create table public.positions (
  id         smallint generated always as identity primary key,
  code       text not null unique check (code ~ '^[A-Z]{2,4}$'),
  name       text not null unique check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  category_id smallint references public.categories (id) on delete restrict,
  season     text check (season is null or char_length(btrim(season)) between 1 and 20),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, season)
);

create trigger teams_set_updated_at before update on public.teams
  for each row execute function private.set_updated_at();

insert into public.categories (name) values ('Cadete'), ('Juvenil'), ('Adulto')
  on conflict (name) do nothing;

insert into public.positions (code, name) values
  ('AR', 'Arquero'),
  ('EI', 'Extremo izquierdo'),
  ('ED', 'Extremo derecho'),
  ('LI', 'Lateral izquierdo'),
  ('LD', 'Lateral derecho'),
  ('CE', 'Central'),
  ('PI', 'Pivote')
  on conflict (code) do nothing;

-- ---- Deportistas -------------------------------------------------------------

create table public.athletes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid unique references auth.users (id) on delete set null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  birth_date   date check (birth_date is null or birth_date > date '1900-01-01'),
  category_id  smallint references public.categories (id) on delete restrict,
  position_id  smallint references public.positions (id) on delete restrict,
  is_active    boolean not null default true,
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on column public.athletes.user_id is
  'Cuenta de acceso del deportista (única). Solo la vincula el servidor.';

create trigger athletes_set_updated_at before update on public.athletes
  for each row execute function private.set_updated_at();

-- Solo el servidor (postgres / service_role) puede vincular o cambiar user_id.
create function private.guard_athlete_link() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and new.user_id is not null then
      raise exception 'No está permitido vincular una cuenta al crear un deportista.' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (new.user_id is distinct from old.user_id
                             or new.created_by is distinct from old.created_by) then
      raise exception 'No está permitido modificar el vínculo de cuenta ni el creador.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger athletes_guard_link before insert or update on public.athletes
  for each row execute function private.guard_athlete_link();

-- ---- Asignaciones profesional ↔ deportista --------------------------------------

create table public.professional_athletes (
  professional_id uuid not null references public.profiles (id) on delete cascade,
  athlete_id      uuid not null references public.athletes (id) on delete cascade
                    deferrable initially deferred,
  assigned_at     timestamptz not null default now(),
  primary key (professional_id, athlete_id)
);
create index professional_athletes_athlete_idx on public.professional_athletes (athlete_id);

-- Solo perfiles con rol profesional pueden ser asignados.
create function private.assert_assignee_is_professional() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles p where p.id = new.professional_id and p.role = 'professional') then
    raise exception 'El perfil asignado no tiene rol de profesional.' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger professional_athletes_assert_role
  before insert or update on public.professional_athletes
  for each row execute function private.assert_assignee_is_professional();

-- ---- Membresías deportista ↔ equipo -----------------------------------------------

create table public.team_memberships (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references public.athletes (id) on delete cascade,
  team_id       uuid not null references public.teams (id) on delete restrict,
  jersey_number smallint check (jersey_number is null or jersey_number between 0 and 99),
  starts_on     date not null default current_date,
  ends_on       date,
  created_at    timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
create index team_memberships_athlete_idx on public.team_memberships (athlete_id);
-- Una sola membresía vigente por deportista y equipo.
create unique index team_memberships_one_active
  on public.team_memberships (athlete_id, team_id) where ends_on is null;
-- Un número de camiseta no se repite entre membresías vigentes del mismo equipo.
create unique index team_memberships_jersey_active
  on public.team_memberships (team_id, jersey_number)
  where ends_on is null and jersey_number is not null;

create function private.prevent_athlete_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.athlete_id is distinct from old.athlete_id then
    raise exception 'No se puede reasignar un registro a otro deportista.' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger team_memberships_keep_athlete before update on public.team_memberships
  for each row execute function private.prevent_athlete_change();

-- ---- Funciones de autorización -----------------------------------------------------
-- SECURITY DEFINER + search_path vacío: leen las tablas sin disparar RLS (evita
-- recursión) y no dependen del search_path del llamante. VOLATILE a propósito:
-- deben ver filas insertadas por triggers del mismo comando.

create function private.current_athlete_id() returns uuid
language sql security definer set search_path = '' as $$
  select a.id
  from public.athletes a
  join public.profiles p on p.id = a.user_id
  where a.user_id = auth.uid() and a.is_active and p.is_active;
$$;

create function private.is_self(target_athlete uuid) returns boolean
language sql security definer set search_path = '' as $$
  select target_athlete is not null and target_athlete = private.current_athlete_id();
$$;

create function private.is_assigned(target_athlete uuid) returns boolean
language sql security definer set search_path = '' as $$
  select private.is_professional() and exists (
    select 1 from public.professional_athletes pa
    where pa.professional_id = auth.uid() and pa.athlete_id = target_athlete
  );
$$;

create function private.can_read_athlete(target_athlete uuid) returns boolean
language sql security definer set search_path = '' as $$
  select private.is_self(target_athlete) or private.is_assigned(target_athlete);
$$;

-- Ventana en la que un deportista puede crear/editar sus propios registros diarios.
create function private.in_edit_window(d date) returns boolean
language sql immutable set search_path = '' as $$
  select d between (current_date - 14) and (current_date + 1);
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'private.current_athlete_id()', 'private.is_self(uuid)', 'private.is_assigned(uuid)',
    'private.can_read_athlete(uuid)', 'private.in_edit_window(date)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Alta automática: un profesional que crea un deportista queda asignado a él.
-- BEFORE INSERT + FK diferida => la asignación existe cuando se evalúa RETURNING.
create function private.auto_assign_creator() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and private.is_professional() then
    insert into public.professional_athletes (professional_id, athlete_id)
    values (auth.uid(), new.id)
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger athletes_auto_assign before insert on public.athletes
  for each row execute function private.auto_assign_creator();

-- ---- Privilegios -----------------------------------------------------------------------

revoke all on public.categories, public.positions, public.teams, public.athletes,
              public.professional_athletes, public.team_memberships
  from anon, authenticated;

grant select on public.categories, public.positions, public.teams to authenticated;
grant insert (name, category_id, season, is_active), update (name, category_id, season, is_active)
  on public.teams to authenticated;
grant insert (name) on public.categories to authenticated;
grant update (name) on public.categories to authenticated;
grant insert (code, name) on public.positions to authenticated;
grant update (code, name) on public.positions to authenticated;

grant select on public.athletes to authenticated;
grant insert (display_name, birth_date, category_id, position_id, created_by) on public.athletes to authenticated;
grant update (display_name, birth_date, category_id, position_id, is_active) on public.athletes to authenticated;

grant select on public.professional_athletes to authenticated;   -- sin escritura

grant select on public.team_memberships to authenticated;
grant insert (athlete_id, team_id, jersey_number, starts_on, ends_on) on public.team_memberships to authenticated;
grant update (team_id, jersey_number, starts_on, ends_on) on public.team_memberships to authenticated;

-- ---- RLS ---------------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.positions enable row level security;
alter table public.teams enable row level security;
alter table public.athletes enable row level security;
alter table public.professional_athletes enable row level security;
alter table public.team_memberships enable row level security;

-- Catálogos: lectura para cualquier usuario autenticado, escritura solo profesionales.
create policy categories_select on public.categories for select to authenticated using (true);
create policy categories_write on public.categories for all to authenticated
  using (private.is_professional()) with check (private.is_professional());

create policy positions_select on public.positions for select to authenticated using (true);
create policy positions_write on public.positions for all to authenticated
  using (private.is_professional()) with check (private.is_professional());

create policy teams_select on public.teams for select to authenticated using (true);
create policy teams_write on public.teams for all to authenticated
  using (private.is_professional()) with check (private.is_professional());

-- Deportistas
create policy athletes_select on public.athletes for select to authenticated
  using (private.can_read_athlete(id));

create policy athletes_insert_professional on public.athletes for insert to authenticated
  with check (private.is_professional() and user_id is null and created_by = auth.uid());

create policy athletes_update_assigned on public.athletes for update to authenticated
  using (private.is_assigned(id)) with check (private.is_assigned(id));

-- Asignaciones: cada profesional ve solo las suyas; nadie escribe desde la API.
create policy professional_athletes_select_own on public.professional_athletes
  for select to authenticated
  using (professional_id = auth.uid() and private.is_professional());

-- Membresías
create policy team_memberships_select on public.team_memberships for select to authenticated
  using (private.can_read_athlete(athlete_id));

create policy team_memberships_insert on public.team_memberships for insert to authenticated
  with check (private.is_assigned(athlete_id));

create policy team_memberships_update on public.team_memberships for update to authenticated
  using (private.is_assigned(athlete_id)) with check (private.is_assigned(athlete_id));
