-- Rituel — schéma de sync (spec 2026-09-16). Exécutable dans l'éditeur SQL Supabase.

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists weeks (
  household_id uuid not null references households on delete cascade,
  semaine text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, semaine)
);

create table if not exists checks (
  household_id uuid not null references households on delete cascade,
  semaine text not null,
  check_id text not null,
  done boolean not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, semaine, check_id)
);

create table if not exists weights (
  household_id uuid not null references households on delete cascade,
  profil text not null,
  date_ date not null,
  kg numeric not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, profil, date_)
);

create table if not exists depenses (
  household_id uuid not null references households on delete cascade,
  date_ date not null,
  magasin_key text not null,
  magasin text not null,
  total numeric not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, date_, magasin_key)
);

create table if not exists profiles (
  household_id uuid not null references households on delete cascade,
  profil text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, profil)
);

-- RLS : accès uniquement au foyer du JWT (claim household_id, signé par
-- l'edge function). households : aucune policy → inaccessible côté client.
alter table households enable row level security;
alter table weeks enable row level security;
alter table checks enable row level security;
alter table weights enable row level security;
alter table depenses enable row level security;
alter table profiles enable row level security;

drop policy if exists foyer_weeks on weeks;
create policy foyer_weeks on weeks for all
  using (household_id::text = auth.jwt()->>'household_id')
  with check (household_id::text = auth.jwt()->>'household_id');
drop policy if exists foyer_checks on checks;
create policy foyer_checks on checks for all
  using (household_id::text = auth.jwt()->>'household_id')
  with check (household_id::text = auth.jwt()->>'household_id');
drop policy if exists foyer_weights on weights;
create policy foyer_weights on weights for all
  using (household_id::text = auth.jwt()->>'household_id')
  with check (household_id::text = auth.jwt()->>'household_id');
drop policy if exists foyer_depenses on depenses;
create policy foyer_depenses on depenses for all
  using (household_id::text = auth.jwt()->>'household_id')
  with check (household_id::text = auth.jwt()->>'household_id');
drop policy if exists foyer_profiles on profiles;
create policy foyer_profiles on profiles for all
  using (household_id::text = auth.jwt()->>'household_id')
  with check (household_id::text = auth.jwt()->>'household_id');

-- Realtime (idempotent : duplicate_object si la table est déjà membre)
do $$
begin
  alter publication supabase_realtime add table weeks;
  alter publication supabase_realtime add table checks;
  alter publication supabase_realtime add table weights;
  alter publication supabase_realtime add table depenses;
  alter publication supabase_realtime add table profiles;
exception
  when duplicate_object then null;
end $$;
