-- =============================================================================
-- 01 · Identidad: perfiles y roles
-- -----------------------------------------------------------------------------
-- * Schema `private`: funciones auxiliares que NO se exponen por la API REST.
-- * `profiles`: una fila por usuario de auth.users, con su rol.
-- * Nadie puede otorgarse un rol: el rol por defecto es `athlete` y solo cambia
--   desde el servidor (SQL Editor / service_role). Triple defensa:
--     1) el alta automática ignora cualquier metadato enviado por el usuario;
--     2) no hay privilegio UPDATE sobre `role` para `authenticated`;
--     3) un trigger rechaza cambios de rol/estado hechos por `authenticated`/`anon`.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.app_role as enum ('athlete', 'professional');

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         public.app_role not null default 'athlete',
  display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 120),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.profiles is
  'Perfil de cada usuario autenticado. El rol y el estado solo los cambia el servidor.';

-- ---- Utilidades --------------------------------------------------------------

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---- Alta automática del perfil ----------------------------------------------
-- El rol SIEMPRE es 'athlete'. Se ignora raw_user_meta_data.role, que el propio
-- usuario puede manipular al registrarse.

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    'athlete',
    left(nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''), 120)
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---- Protección contra auto-asignación de rol ---------------------------------

create function private.guard_profile_privileges() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.is_active is distinct from old.is_active then
      raise exception 'No está permitido modificar el rol, el estado ni el identificador del perfil.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_guard_privileges before update on public.profiles
  for each row execute function private.guard_profile_privileges();

-- ---- Privilegios y RLS ---------------------------------------------------------
-- Supabase concede privilegios amplios por defecto: se revocan y se vuelve a
-- conceder solo lo necesario.

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---- Funciones de autorización (solo la identidad; el resto en 02) -----------

create function private.is_professional() returns boolean
language sql security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'professional' and p.is_active
  );
$$;

revoke all on function private.is_professional() from public;
grant execute on function private.is_professional() to authenticated;
